import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaggingService } from '../../services/crm/tagging.service';

// ===========================================
// MOCK SETUP
// ===========================================

const mockPrisma = {
  tagCategory: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  tag: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  clientTag: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  client: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  clientTimelineEvent: {
    create: vi.fn(),
  },
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
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

const mockAuditLogger = {
  log: vi.fn().mockResolvedValue(undefined),
  logAsync: vi.fn().mockResolvedValue(undefined),
};

// ===========================================
// TEST DATA
// ===========================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_ID_2 = '33333333-3333-3333-3333-333333333334';
const TAG_ID = '44444444-4444-4444-4444-444444444444';
const TAG_ID_2 = '55555555-5555-5555-5555-555555555555';
const CATEGORY_ID = '66666666-6666-6666-6666-666666666666';
const CATEGORY_ID_2 = '88888888-8888-8888-8888-888888888888';

const mockCategory = {
  id: CATEGORY_ID,
  organizationId: ORG_ID,
  name: 'Status klienta',
  description: 'Kategoria statusu klienta',
  selectionMode: 'SINGLE',
  displayOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: TEST_USER_ID,
};

const mockTag = {
  id: TAG_ID,
  organizationId: ORG_ID,
  categoryId: CATEGORY_ID,
  name: 'VIP',
  slug: 'vip',
  color: '#FFD700',
  description: 'Klient VIP',
  icon: 'star',
  displayOrder: 0,
  isSystem: false,
  isActive: true,
  isArchived: false,
  createdBy: TEST_USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { name: 'Status klienta' },
  _count: { clientTags: 5 },
};

const mockTag2 = {
  id: TAG_ID_2,
  organizationId: ORG_ID,
  categoryId: CATEGORY_ID,
  name: 'Nowy',
  slug: 'nowy',
  color: '#00FF00',
  description: 'Nowy klient',
  icon: 'user-plus',
  displayOrder: 1,
  isSystem: false,
  isActive: true,
  isArchived: false,
  createdBy: TEST_USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { name: 'Status klienta' },
  _count: { clientTags: 10 },
};

const mockClient = {
  id: CLIENT_ID,
  organizationId: ORG_ID,
  displayName: 'Test Company',
  type: 'company',
  status: 'active',
};

const mockClientTag = {
  id: '77777777-7777-7777-7777-777777777777',
  clientId: CLIENT_ID,
  tagId: TAG_ID,
  assignedBy: TEST_USER_ID,
  assignedAt: new Date(),
  tag: {
    ...mockTag,
    category: { id: CATEGORY_ID, name: 'Status klienta' },
  },
  assignedByUser: { id: TEST_USER_ID, firstName: 'Test', lastName: 'User' },
};

// ===========================================
// TEST SUITE
// ===========================================

describe('TaggingService (CRM-007)', () => {
  let service: TaggingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaggingService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      ORG_ID
    );
  });

  // ===========================================
  // TAG CATEGORY OPERATIONS
  // ===========================================

  describe('getCategories', () => {
    it('should return all active categories with tags', async () => {
      const categoryWithTags = {
        ...mockCategory,
        tags: [mockTag, mockTag2],
      };
      mockPrisma.tagCategory.findMany.mockResolvedValue([categoryWithTags]);

      const result = await service.getCategories({
        includeInactive: false,
        includeTags: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].tags).toHaveLength(2);
      expect(mockPrisma.tagCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            isActive: true,
          }),
        })
      );
    });

    it('should include inactive categories when requested', async () => {
      const inactiveCategory = { ...mockCategory, isActive: false };
      mockPrisma.tagCategory.findMany.mockResolvedValue([mockCategory, inactiveCategory]);

      const result = await service.getCategories({
        includeInactive: true,
        includeTags: false,
      });

      expect(result).toHaveLength(2);
      expect(mockPrisma.tagCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
          }),
        })
      );
    });

    it('should return empty array when no categories exist', async () => {
      mockPrisma.tagCategory.findMany.mockResolvedValue([]);

      const result = await service.getCategories({
        includeInactive: false,
        includeTags: true,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('createCategory', () => {
    it('should create a new tag category', async () => {
      mockPrisma.tagCategory.findFirst.mockResolvedValue(null);
      mockPrisma.tagCategory.create.mockResolvedValue(mockCategory);

      const result = await service.createCategory({
        name: 'Status klienta',
        description: 'Kategoria statusu klienta',
        selectionMode: 'SINGLE',
        displayOrder: 0,
      });

      expect(result.id).toBe(CATEGORY_ID);
      expect(result.name).toBe('Status klienta');
      expect(mockPrisma.tagCategory.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error for duplicate category name', async () => {
      mockPrisma.tagCategory.findFirst.mockResolvedValue(mockCategory);

      await expect(
        service.createCategory({
          name: 'Status klienta',
          selectionMode: 'SINGLE',
        })
      ).rejects.toThrow('Kategoria o tej nazwie już istnieje');
    });
  });

  describe('updateCategory', () => {
    it('should update an existing category', async () => {
      mockPrisma.tagCategory.findFirst
        .mockResolvedValueOnce(mockCategory) // Check existing
        .mockResolvedValueOnce(null); // Check duplicate name
      mockPrisma.tagCategory.update.mockResolvedValue({
        ...mockCategory,
        name: 'Updated Name',
      });

      const result = await service.updateCategory({
        id: CATEGORY_ID,
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error for non-existent category', async () => {
      mockPrisma.tagCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCategory({
          id: CATEGORY_ID,
          name: 'Updated Name',
        })
      ).rejects.toThrow('Kategoria nie została znaleziona');
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category and reassign orphan tags', async () => {
      const categoryWithTags = {
        ...mockCategory,
        tags: [{ id: TAG_ID }],
      };
      mockPrisma.tagCategory.findFirst.mockResolvedValue(categoryWithTags);
      mockPrisma.tag.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.tagCategory.delete.mockResolvedValue(mockCategory);

      const result = await service.deleteCategory({
        id: CATEGORY_ID,
        reassignToCategory: CATEGORY_ID_2,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.tag.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { categoryId: CATEGORY_ID },
          data: { categoryId: CATEGORY_ID_2 },
        })
      );
      expect(mockPrisma.tagCategory.delete).toHaveBeenCalled();
    });

    it('should delete category and orphan tags', async () => {
      const categoryWithTags = {
        ...mockCategory,
        tags: [{ id: TAG_ID }],
      };
      mockPrisma.tagCategory.findFirst.mockResolvedValue(categoryWithTags);
      mockPrisma.tag.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.tagCategory.delete.mockResolvedValue(mockCategory);

      const result = await service.deleteCategory({
        id: CATEGORY_ID,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.tag.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { categoryId: CATEGORY_ID },
          data: { categoryId: null },
        })
      );
    });

    it('should throw error for non-existent category', async () => {
      mockPrisma.tagCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCategory({ id: CATEGORY_ID })
      ).rejects.toThrow('Kategoria nie została znaleziona');
    });
  });

  // ===========================================
  // TAG OPERATIONS
  // ===========================================

  describe('getTags', () => {
    it('should return tags with filtering', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([mockTag, mockTag2]);

      const result = await service.getTags({
        includeInactive: false,
        includeArchived: false,
        page: 1,
        limit: 50,
      });

      expect(result).toHaveLength(2);
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            isActive: true,
            isArchived: false,
          }),
        })
      );
    });

    it('should filter by category', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);

      const result = await service.getTags({
        categoryId: CATEGORY_ID,
        includeInactive: false,
        includeArchived: false,
        page: 1,
        limit: 50,
      });

      expect(result).toHaveLength(1);
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: CATEGORY_ID,
          }),
        })
      );
    });

    it('should search tags by name', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);

      const result = await service.getTags({
        search: 'VIP',
        includeInactive: false,
        includeArchived: false,
        page: 1,
        limit: 50,
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('VIP');
    });
  });

  describe('getTagById', () => {
    it('should return a tag by ID', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(mockTag);

      const result = await service.getTagById({
        id: TAG_ID,
        includeClientCount: false,
      });

      expect(result.id).toBe(TAG_ID);
      expect(result.name).toBe('VIP');
    });

    it('should include client count when requested', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(mockTag);

      const result = await service.getTagById({
        id: TAG_ID,
        includeClientCount: true,
      });

      expect(result.clientCount).toBe(5);
    });

    it('should throw error for non-existent tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.getTagById({
          id: TAG_ID,
          includeClientCount: false,
        })
      ).rejects.toThrow('Tag nie został znaleziony');
    });
  });

  describe('createTag', () => {
    it('should create a new tag', async () => {
      mockPrisma.tag.findFirst
        .mockResolvedValueOnce(null) // Check duplicate name
        .mockResolvedValueOnce(null); // Check duplicate slug
      mockPrisma.tag.create.mockResolvedValue(mockTag);

      const result = await service.createTag({
        name: 'VIP',
        categoryId: CATEGORY_ID,
        color: '#FFD700',
        description: 'Klient VIP',
        icon: 'star',
        displayOrder: 0,
      });

      expect(result.name).toBe('VIP');
      expect(mockPrisma.tag.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should generate slug from name', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);
      mockPrisma.tag.create.mockResolvedValue({
        ...mockTag,
        name: 'Klient Premium',
        slug: 'klient-premium',
      });

      const result = await service.createTag({
        name: 'Klient Premium',
        color: '#FFD700',
      });

      expect(result.slug).toBe('klient-premium');
    });

    it('should throw error for duplicate tag name', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(mockTag);

      await expect(
        service.createTag({
          name: 'VIP',
          color: '#FFD700',
        })
      ).rejects.toThrow('Tag o tej nazwie już istnieje');
    });
  });

  describe('updateTag', () => {
    it('should update an existing tag', async () => {
      mockPrisma.tag.findFirst
        .mockResolvedValueOnce(mockTag) // Check existing
        .mockResolvedValueOnce(null); // Check duplicate name
      mockPrisma.tag.update.mockResolvedValue({
        ...mockTag,
        name: 'Super VIP',
        color: '#FF0000',
      });

      const result = await service.updateTag({
        id: TAG_ID,
        name: 'Super VIP',
        color: '#FF0000',
      });

      expect(result.name).toBe('Super VIP');
      expect(result.color).toBe('#FF0000');
    });

    it('should not allow editing system tags', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        isSystem: true,
      });

      await expect(
        service.updateTag({
          id: TAG_ID,
          name: 'Updated Name',
        })
      ).rejects.toThrow('Nie można modyfikować tagów systemowych');
    });

    it('should throw error for non-existent tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTag({
          id: TAG_ID,
          name: 'Updated Name',
        })
      ).rejects.toThrow('Tag nie został znaleziony');
    });
  });

  describe('archiveTag', () => {
    it('should archive a tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(mockTag);
      mockPrisma.tag.update.mockResolvedValue({
        ...mockTag,
        isArchived: true,
      });

      const result = await service.archiveTag({ id: TAG_ID });

      expect(result.success).toBe(true);
      expect(mockPrisma.tag.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TAG_ID },
          data: expect.objectContaining({ isArchived: true }),
        })
      );
    });

    it('should not allow archiving system tags', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        isSystem: true,
      });

      await expect(
        service.archiveTag({ id: TAG_ID })
      ).rejects.toThrow('Nie można archiwizować tagów systemowych');
    });

    it('should throw error for non-existent tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.archiveTag({ id: TAG_ID })
      ).rejects.toThrow('Tag nie został znaleziony');
    });
  });

  describe('restoreTag', () => {
    it('should restore an archived tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        isArchived: true,
      });
      mockPrisma.tag.update.mockResolvedValue(mockTag);

      const result = await service.restoreTag({ id: TAG_ID });

      expect(result.success).toBe(true);
      expect(mockPrisma.tag.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TAG_ID },
          data: expect.objectContaining({ isArchived: false }),
        })
      );
    });

    it('should throw error for non-archived tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.restoreTag({ id: TAG_ID })
      ).rejects.toThrow('Tag nie został znaleziony lub nie jest zarchiwizowany');
    });
  });

  describe('deleteTag', () => {
    it('should soft delete a tag by default', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(mockTag);
      mockPrisma.tag.update.mockResolvedValue({
        ...mockTag,
        isArchived: true,
        isActive: false,
      });

      const result = await service.deleteTag({ id: TAG_ID, hardDelete: false });

      expect(result.success).toBe(true);
      expect(result.message).toContain('zarchiwizowany');
      expect(mockPrisma.tag.update).toHaveBeenCalled();
    });

    it('should hard delete when requested', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(mockTag);
      mockPrisma.clientTag.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.tag.delete.mockResolvedValue(mockTag);

      const result = await service.deleteTag({ id: TAG_ID, hardDelete: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('trwale usunięty');
      expect(mockPrisma.tag.delete).toHaveBeenCalled();
    });

    it('should not allow deleting system tags', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        isSystem: true,
      });

      await expect(
        service.deleteTag({ id: TAG_ID, hardDelete: true })
      ).rejects.toThrow('Nie można usunąć tagów systemowych');
    });

    it('should throw error for non-existent tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteTag({ id: TAG_ID, hardDelete: false })
      ).rejects.toThrow('Tag nie został znaleziony');
    });
  });

  // ===========================================
  // CLIENT TAG OPERATIONS
  // ===========================================

  describe('getClientTags', () => {
    it('should return tags for a client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.clientTag.findMany.mockResolvedValue([mockClientTag]);

      const result = await service.getClientTags({ clientId: CLIENT_ID });

      expect(result).toHaveLength(1);
      expect(result[0].tagId).toBe(TAG_ID);
      expect(result[0].tagName).toBe('VIP');
    });

    it('should return empty array for client with no tags', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.clientTag.findMany.mockResolvedValue([]);

      const result = await service.getClientTags({ clientId: CLIENT_ID });

      expect(result).toHaveLength(0);
    });

    it('should throw error for non-existent client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.getClientTags({ clientId: CLIENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  describe('assignTags', () => {
    it('should assign tags to a client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);
      mockPrisma.clientTag.findMany.mockResolvedValue([]);
      mockPrisma.clientTag.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});

      const result = await service.assignTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(result.assignedTags).toContain(TAG_ID);
    });

    it('should skip already assigned tags', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);
      mockPrisma.clientTag.findMany.mockResolvedValue([{ tagId: TAG_ID }]);
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});

      const result = await service.assignTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(result.assignedTags).toHaveLength(0);
      expect(result.skippedTags).toContain(TAG_ID);
    });

    it('should enforce SINGLE selection mode', async () => {
      const singleCategoryTag = {
        ...mockTag,
        category: { id: CATEGORY_ID, selectionMode: 'SINGLE' },
      };
      const anotherTag = {
        ...mockTag2,
        category: { id: CATEGORY_ID, selectionMode: 'SINGLE' },
      };

      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.tag.findMany.mockResolvedValue([singleCategoryTag, anotherTag]);

      await expect(
        service.assignTags({
          clientId: CLIENT_ID,
          tagIds: [TAG_ID, TAG_ID_2],
        })
      ).rejects.toThrow('pozwala tylko na jeden tag');
    });

    it('should throw error for non-existent client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.assignTags({
          clientId: CLIENT_ID,
          tagIds: [TAG_ID],
        })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  describe('removeTags', () => {
    it('should remove tags from a client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.clientTag.findMany.mockResolvedValue([
        { tagId: TAG_ID, tag: { isSystem: false } },
      ]);
      mockPrisma.clientTag.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});

      const result = await service.removeTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.clientTag.deleteMany).toHaveBeenCalled();
    });

    it('should handle removing non-existent tag assignments', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.clientTag.findMany.mockResolvedValue([]);
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});

      const result = await service.removeTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
    });

    it('should not allow removing system tags', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.clientTag.findMany.mockResolvedValue([
        { tagId: TAG_ID, tag: { isSystem: true } },
      ]);

      await expect(
        service.removeTags({
          clientId: CLIENT_ID,
          tagIds: [TAG_ID],
        })
      ).rejects.toThrow('Nie można usunąć tagów systemowych');
    });
  });

  describe('replaceClientTags', () => {
    it('should replace all client tags', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.clientTag.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.tag.findMany.mockResolvedValue([mockTag2]);
      mockPrisma.clientTag.findMany.mockResolvedValue([]);
      mockPrisma.clientTag.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});

      const result = await service.replaceClientTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID_2],
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.clientTag.deleteMany).toHaveBeenCalled();
    });

    it('should remove all tags when empty array provided', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.clientTag.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.replaceClientTags({
        clientId: CLIENT_ID,
        tagIds: [],
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('usunięte');
    });
  });

  // ===========================================
  // BULK TAG OPERATIONS
  // ===========================================

  describe('bulkTagOperation', () => {
    beforeEach(() => {
      mockPrisma.client.findMany.mockResolvedValue([
        { id: CLIENT_ID },
        { id: CLIENT_ID_2 },
      ]);
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);
      mockPrisma.clientTag.findMany.mockResolvedValue([]);
      mockPrisma.clientTag.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.clientTag.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});
    });

    it('should add tags to multiple clients', async () => {
      const result = await service.bulkTagOperation({
        clientIds: [CLIENT_ID, CLIENT_ID_2],
        operation: 'ADD',
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should remove tags from multiple clients', async () => {
      mockPrisma.clientTag.findMany.mockResolvedValue([
        { tagId: TAG_ID, tag: { isSystem: false } },
      ]);

      const result = await service.bulkTagOperation({
        clientIds: [CLIENT_ID, CLIENT_ID_2],
        operation: 'REMOVE',
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('REMOVE');
    });

    it('should replace tags for multiple clients', async () => {
      mockPrisma.clientTag.findMany.mockResolvedValue([
        { tagId: TAG_ID, tag: { isSystem: false } },
      ]);

      const result = await service.bulkTagOperation({
        clientIds: [CLIENT_ID, CLIENT_ID_2],
        operation: 'REPLACE',
        tagIds: [TAG_ID],
        replaceTagId: TAG_ID_2,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('REPLACE');
    });

    it('should handle partial failures', async () => {
      mockPrisma.client.findMany.mockResolvedValue([{ id: CLIENT_ID }]);
      // Second client not found

      const result = await service.bulkTagOperation({
        clientIds: [CLIENT_ID, CLIENT_ID_2],
        operation: 'ADD',
        tagIds: [TAG_ID],
      });

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  // ===========================================
  // TAG STATISTICS
  // ===========================================

  describe('getTagStatistics', () => {
    it('should return overview statistics', async () => {
      mockPrisma.tag.count
        .mockResolvedValueOnce(10) // totalTags
        .mockResolvedValueOnce(8) // activeTags
        .mockResolvedValueOnce(2); // archivedTags
      mockPrisma.tagCategory.count.mockResolvedValue(3);
      mockPrisma.clientTag.count.mockResolvedValue(50);
      mockPrisma.tag.findMany.mockResolvedValue([mockTag, mockTag2]);

      const result = await service.getTagStatistics({});

      expect(result).toBeDefined();
      expect((result as any).totalTags).toBe(10);
      expect((result as any).activeTags).toBe(8);
    });

    it('should filter by specific tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(mockTag);
      mockPrisma.clientTag.count
        .mockResolvedValueOnce(1) // today
        .mockResolvedValueOnce(5) // week
        .mockResolvedValueOnce(20); // month

      const result = await service.getTagStatistics({ tagId: TAG_ID });

      expect(result).toBeDefined();
      expect((result as any).tagId).toBe(TAG_ID);
    });

    it('should filter by category', async () => {
      mockPrisma.tag.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);
      mockPrisma.tagCategory.count.mockResolvedValue(1);
      mockPrisma.clientTag.count.mockResolvedValue(25);
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);

      const result = await service.getTagStatistics({ categoryId: CATEGORY_ID });

      expect(result).toBeDefined();
    });

    it('should throw error for non-existent tag', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.getTagStatistics({ tagId: TAG_ID })
      ).rejects.toThrow('Tag nie został znaleziony');
    });
  });

  // ===========================================
  // CACHE MANAGEMENT
  // ===========================================

  describe('cache management', () => {
    it('should invalidate cache on category creation', async () => {
      mockPrisma.tagCategory.findFirst.mockResolvedValue(null);
      mockPrisma.tagCategory.create.mockResolvedValue(mockCategory);
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);

      await service.createCategory({
        name: 'New Category',
        selectionMode: 'MULTIPLE',
      });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on tag creation', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);
      mockPrisma.tag.create.mockResolvedValue(mockTag);
      mockRedis.keys.mockResolvedValue(['key1']);

      await service.createTag({
        name: 'New Tag',
        color: '#FF0000',
      });

      expect(mockRedis.keys).toHaveBeenCalled();
    });
  });

  // ===========================================
  // AUDIT LOGGING
  // ===========================================

  describe('audit logging', () => {
    it('should log category creation', async () => {
      mockPrisma.tagCategory.findFirst.mockResolvedValue(null);
      mockPrisma.tagCategory.create.mockResolvedValue(mockCategory);

      await service.createCategory({
        name: 'Test Category',
        selectionMode: 'SINGLE',
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TAG_CATEGORY_CREATED',
          entityType: 'TAG_CATEGORY',
        })
      );
    });

    it('should log tag creation', async () => {
      mockPrisma.tag.findFirst.mockResolvedValue(null);
      mockPrisma.tag.create.mockResolvedValue(mockTag);

      await service.createTag({
        name: 'Test Tag',
        color: '#FF0000',
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TAG_CREATED',
          entityType: 'TAG',
        })
      );
    });

    it('should log tag assignment', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);
      mockPrisma.clientTag.findMany.mockResolvedValue([]);
      mockPrisma.clientTag.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});

      await service.assignTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID],
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TAGS_ASSIGNED',
        })
      );
    });

    it('should log bulk operations', async () => {
      mockPrisma.client.findMany.mockResolvedValue([{ id: CLIENT_ID }]);
      mockPrisma.client.findFirst.mockResolvedValue(mockClient);
      mockPrisma.tag.findMany.mockResolvedValue([mockTag]);
      mockPrisma.clientTag.findMany.mockResolvedValue([]);
      mockPrisma.clientTag.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.clientTimelineEvent.create.mockResolvedValue({});

      await service.bulkTagOperation({
        clientIds: [CLIENT_ID],
        operation: 'ADD',
        tagIds: [TAG_ID],
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BULK_TAG_OPERATION',
        })
      );
    });
  });
});
