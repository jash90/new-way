import { describe, it, expect, vi, beforeEach } from 'vitest';
import { entryTemplateRouter } from '../../routers/ace/entry-template.router';
import { EntryTemplateService } from '../../services/ace/entry-template.service';
import { router, createCallerFactory } from '../../trpc';
import type { Context } from '../../trpc';

// ===========================================================================
// MOCKS
// ===========================================================================

vi.mock('../../services/ace/entry-template.service');

const mockSession = {
  userId: 'user-123',
  organizationId: 'org-456',
  email: 'test@example.com',
  role: 'admin' as const,
  permissions: ['*'],
};

const mockContext: Context = {
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
  session: mockSession,
};

const createCaller = createCallerFactory(router({ entryTemplate: entryTemplateRouter }));
const caller = createCaller(mockContext);

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_CATEGORY_ID = '660e8400-e29b-41d4-a716-446655440002';
const TEST_ACCOUNT_ID = '770e8400-e29b-41d4-a716-446655440003';
const TEST_ENTRY_ID = '880e8400-e29b-41d4-a716-446655440004';

const testTemplate = {
  id: TEST_TEMPLATE_ID,
  organizationId: mockSession.organizationId,
  templateCode: 'TPL-001',
  templateName: 'Monthly Rent Payment',
  description: 'Template for recurring rent payments',
  categoryId: TEST_CATEGORY_ID,
  entryType: 'STANDARD' as const,
  defaultDescription: 'Monthly rent payment for {month}',
  status: 'ACTIVE' as const,
  version: 1,
  sourceEntryId: null,
  usageCount: 5,
  lastUsedAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  createdBy: mockSession.userId,
  updatedBy: null,
  archivedAt: null,
  archivedBy: null,
};

const testTemplateWithDetails = {
  ...testTemplate,
  lines: [
    {
      id: 'line-1',
      templateId: TEST_TEMPLATE_ID,
      lineNumber: 1,
      accountId: TEST_ACCOUNT_ID,
      accountPattern: null,
      amountType: 'FIXED' as const,
      fixedDebitAmount: 5000,
      fixedCreditAmount: 0,
      variableName: null,
      formula: null,
      description: 'Rent expense',
      currencyCode: 'PLN',
      taxCodeId: null,
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'line-2',
      templateId: TEST_TEMPLATE_ID,
      lineNumber: 2,
      accountId: '880e8400-e29b-41d4-a716-446655440005',
      accountPattern: null,
      amountType: 'FIXED' as const,
      fixedDebitAmount: 0,
      fixedCreditAmount: 5000,
      variableName: null,
      formula: null,
      description: 'Bank payment',
      currencyCode: 'PLN',
      taxCodeId: null,
      displayOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  variables: [],
  category: {
    id: TEST_CATEGORY_ID,
    organizationId: mockSession.organizationId,
    name: 'Operating Expenses',
    description: 'Regular operating expense templates',
    displayOrder: 1,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockSession.userId,
  },
};

const testListResult = {
  templates: [
    {
      ...testTemplate,
      isFavorite: true,
      category: testTemplateWithDetails.category,
    },
  ],
  total: 1,
  hasMore: false,
};

const testCategory = {
  id: TEST_CATEGORY_ID,
  organizationId: mockSession.organizationId,
  name: 'Operating Expenses',
  description: 'Regular operating expense templates',
  displayOrder: 1,
  isSystem: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: mockSession.userId,
};

const testVersion = {
  id: 'version-1',
  templateId: TEST_TEMPLATE_ID,
  versionNumber: 1,
  templateData: { ...testTemplate },
  changeDescription: 'Initial creation',
  createdAt: new Date('2024-01-01'),
  createdBy: mockSession.userId,
  createdByUser: {
    id: mockSession.userId,
    name: 'Test User',
  },
};

const testGeneratedEntry = {
  id: TEST_ENTRY_ID,
  entryNumber: 'PK/01/2024/0001',
  entryDate: new Date('2024-01-15'),
  description: 'Monthly rent payment for January',
  status: 'DRAFT' as const,
};

const testBatchResult = {
  total: 3,
  successful: 2,
  failed: 1,
  results: [
    { success: true, entryId: 'entry-1', date: new Date('2024-01-15') },
    { success: true, entryId: 'entry-2', date: new Date('2024-02-15') },
    { success: false, date: new Date('2024-03-15'), error: 'Period closed' },
  ],
};

// ===========================================================================
// TESTS
// ===========================================================================

describe('entryTemplateRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // TEMPLATE CRUD
  // =========================================================================

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      vi.mocked(EntryTemplateService.prototype.createTemplate).mockResolvedValue(testTemplateWithDetails);

      const result = await caller.entryTemplate.createTemplate({
        templateName: 'Monthly Rent Payment',
        description: 'Template for recurring rent payments',
        categoryId: TEST_CATEGORY_ID,
        entryType: 'STANDARD',
        defaultDescription: 'Monthly rent payment for {month}',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_ACCOUNT_ID,
            amountType: 'FIXED',
            fixedDebitAmount: 5000,
            fixedCreditAmount: 0,
            description: 'Rent expense',
            currencyCode: 'PLN',
            displayOrder: 1,
          },
          {
            lineNumber: 2,
            accountId: '880e8400-e29b-41d4-a716-446655440005',
            amountType: 'FIXED',
            fixedDebitAmount: 0,
            fixedCreditAmount: 5000,
            description: 'Bank payment',
            currencyCode: 'PLN',
            displayOrder: 2,
          },
        ],
      });

      expect(result.id).toBe(TEST_TEMPLATE_ID);
      expect(result.templateName).toBe('Monthly Rent Payment');
      expect(result.lines).toHaveLength(2);
      expect(EntryTemplateService.prototype.createTemplate).toHaveBeenCalled();
    });

    it('should create template with variables', async () => {
      const templateWithVars = {
        ...testTemplateWithDetails,
        variables: [
          {
            id: 'var-1',
            templateId: TEST_TEMPLATE_ID,
            variableName: 'amount',
            variableType: 'NUMBER' as const,
            displayLabel: 'Payment Amount',
            isRequired: true,
            defaultValue: null,
            validationPattern: null,
            displayOrder: 1,
          },
        ],
      };
      vi.mocked(EntryTemplateService.prototype.createTemplate).mockResolvedValue(templateWithVars);

      const result = await caller.entryTemplate.createTemplate({
        templateName: 'Variable Amount Payment',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_ACCOUNT_ID,
            amountType: 'VARIABLE',
            fixedDebitAmount: 0,
            fixedCreditAmount: 0,
            variableName: 'amount',
            currencyCode: 'PLN',
            displayOrder: 1,
          },
          {
            lineNumber: 2,
            accountId: '880e8400-e29b-41d4-a716-446655440005',
            amountType: 'VARIABLE',
            fixedDebitAmount: 0,
            fixedCreditAmount: 0,
            variableName: 'amount',
            currencyCode: 'PLN',
            displayOrder: 2,
          },
        ],
        variables: [
          {
            variableName: 'amount',
            variableType: 'NUMBER',
            displayLabel: 'Payment Amount',
            isRequired: true,
            displayOrder: 1,
          },
        ],
      });

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].variableName).toBe('amount');
    });
  });

  describe('getTemplate', () => {
    it('should return template with details', async () => {
      vi.mocked(EntryTemplateService.prototype.getTemplate).mockResolvedValue(testTemplateWithDetails);

      const result = await caller.entryTemplate.getTemplate({
        templateId: TEST_TEMPLATE_ID,
      });

      expect(result.id).toBe(TEST_TEMPLATE_ID);
      expect(result.lines).toHaveLength(2);
      expect(result.category?.name).toBe('Operating Expenses');
      expect(EntryTemplateService.prototype.getTemplate).toHaveBeenCalledWith({
        templateId: TEST_TEMPLATE_ID,
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update template', async () => {
      const updatedTemplate = {
        ...testTemplateWithDetails,
        templateName: 'Updated Rent Payment',
        version: 2,
      };
      vi.mocked(EntryTemplateService.prototype.updateTemplate).mockResolvedValue(updatedTemplate);

      const result = await caller.entryTemplate.updateTemplate({
        templateId: TEST_TEMPLATE_ID,
        templateName: 'Updated Rent Payment',
        changeDescription: 'Updated name',
      });

      expect(result.templateName).toBe('Updated Rent Payment');
      expect(result.version).toBe(2);
      expect(EntryTemplateService.prototype.updateTemplate).toHaveBeenCalled();
    });

    it('should update template lines', async () => {
      vi.mocked(EntryTemplateService.prototype.updateTemplate).mockResolvedValue(testTemplateWithDetails);

      await caller.entryTemplate.updateTemplate({
        templateId: TEST_TEMPLATE_ID,
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_ACCOUNT_ID,
            amountType: 'FIXED',
            fixedDebitAmount: 6000,
            fixedCreditAmount: 0,
            currencyCode: 'PLN',
            displayOrder: 1,
          },
          {
            lineNumber: 2,
            accountId: '880e8400-e29b-41d4-a716-446655440005',
            amountType: 'FIXED',
            fixedDebitAmount: 0,
            fixedCreditAmount: 6000,
            currencyCode: 'PLN',
            displayOrder: 2,
          },
        ],
      });

      expect(EntryTemplateService.prototype.updateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: TEST_TEMPLATE_ID,
          lines: expect.any(Array),
        })
      );
    });
  });

  describe('archiveTemplate', () => {
    it('should archive template', async () => {
      const archivedTemplate = {
        ...testTemplate,
        status: 'ARCHIVED' as const,
        archivedAt: new Date(),
        archivedBy: mockSession.userId,
      };
      vi.mocked(EntryTemplateService.prototype.archiveTemplate).mockResolvedValue(archivedTemplate);

      const result = await caller.entryTemplate.archiveTemplate({
        templateId: TEST_TEMPLATE_ID,
      });

      expect(result.status).toBe('ARCHIVED');
      expect(result.archivedAt).toBeDefined();
      expect(EntryTemplateService.prototype.archiveTemplate).toHaveBeenCalledWith({
        templateId: TEST_TEMPLATE_ID,
      });
    });
  });

  describe('restoreTemplate', () => {
    it('should restore archived template', async () => {
      const restoredTemplate = {
        ...testTemplate,
        status: 'ACTIVE' as const,
        archivedAt: null,
        archivedBy: null,
      };
      vi.mocked(EntryTemplateService.prototype.restoreTemplate).mockResolvedValue(restoredTemplate);

      const result = await caller.entryTemplate.restoreTemplate({
        templateId: TEST_TEMPLATE_ID,
      });

      expect(result.status).toBe('ACTIVE');
      expect(result.archivedAt).toBeNull();
      expect(EntryTemplateService.prototype.restoreTemplate).toHaveBeenCalledWith({
        templateId: TEST_TEMPLATE_ID,
      });
    });
  });

  describe('deleteTemplate', () => {
    it('should delete unused template', async () => {
      vi.mocked(EntryTemplateService.prototype.deleteTemplate).mockResolvedValue({
        success: true,
        templateId: TEST_TEMPLATE_ID,
      });

      const result = await caller.entryTemplate.deleteTemplate({
        templateId: TEST_TEMPLATE_ID,
      });

      expect(result.success).toBe(true);
      expect(result.templateId).toBe(TEST_TEMPLATE_ID);
      expect(EntryTemplateService.prototype.deleteTemplate).toHaveBeenCalledWith({
        templateId: TEST_TEMPLATE_ID,
      });
    });
  });

  // =========================================================================
  // LIST AND SEARCH
  // =========================================================================

  describe('listTemplates', () => {
    it('should list templates with pagination', async () => {
      vi.mocked(EntryTemplateService.prototype.listTemplates).mockResolvedValue(testListResult);

      const result = await caller.entryTemplate.listTemplates({
        limit: 50,
        offset: 0,
      });

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(EntryTemplateService.prototype.listTemplates).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
      });
    });

    it('should filter by status', async () => {
      vi.mocked(EntryTemplateService.prototype.listTemplates).mockResolvedValue(testListResult);

      await caller.entryTemplate.listTemplates({
        status: 'ACTIVE',
      });

      expect(EntryTemplateService.prototype.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })
      );
    });

    it('should filter by category', async () => {
      vi.mocked(EntryTemplateService.prototype.listTemplates).mockResolvedValue(testListResult);

      await caller.entryTemplate.listTemplates({
        categoryId: TEST_CATEGORY_ID,
      });

      expect(EntryTemplateService.prototype.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: TEST_CATEGORY_ID })
      );
    });

    it('should filter by entry type', async () => {
      vi.mocked(EntryTemplateService.prototype.listTemplates).mockResolvedValue(testListResult);

      await caller.entryTemplate.listTemplates({
        entryType: 'STANDARD',
      });

      expect(EntryTemplateService.prototype.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ entryType: 'STANDARD' })
      );
    });

    it('should filter favorites only', async () => {
      vi.mocked(EntryTemplateService.prototype.listTemplates).mockResolvedValue(testListResult);

      await caller.entryTemplate.listTemplates({
        favoritesOnly: true,
      });

      expect(EntryTemplateService.prototype.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ favoritesOnly: true })
      );
    });

    it('should search templates', async () => {
      vi.mocked(EntryTemplateService.prototype.listTemplates).mockResolvedValue(testListResult);

      await caller.entryTemplate.listTemplates({
        search: 'rent',
      });

      expect(EntryTemplateService.prototype.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'rent' })
      );
    });
  });

  // =========================================================================
  // FAVORITES
  // =========================================================================

  describe('toggleFavorite', () => {
    it('should toggle favorite on', async () => {
      vi.mocked(EntryTemplateService.prototype.toggleFavorite).mockResolvedValue({
        isFavorite: true,
      });

      const result = await caller.entryTemplate.toggleFavorite({
        templateId: TEST_TEMPLATE_ID,
      });

      expect(result.isFavorite).toBe(true);
      expect(EntryTemplateService.prototype.toggleFavorite).toHaveBeenCalledWith({
        templateId: TEST_TEMPLATE_ID,
      });
    });

    it('should toggle favorite off', async () => {
      vi.mocked(EntryTemplateService.prototype.toggleFavorite).mockResolvedValue({
        isFavorite: false,
      });

      const result = await caller.entryTemplate.toggleFavorite({
        templateId: TEST_TEMPLATE_ID,
      });

      expect(result.isFavorite).toBe(false);
    });
  });

  // =========================================================================
  // VERSIONS
  // =========================================================================

  describe('getTemplateVersions', () => {
    it('should return version history', async () => {
      vi.mocked(EntryTemplateService.prototype.getTemplateVersions).mockResolvedValue([testVersion]);

      const result = await caller.entryTemplate.getTemplateVersions({
        templateId: TEST_TEMPLATE_ID,
      });

      expect(result).toHaveLength(1);
      expect(result[0].versionNumber).toBe(1);
      expect(result[0].createdByUser?.name).toBe('Test User');
      expect(EntryTemplateService.prototype.getTemplateVersions).toHaveBeenCalledWith({
        templateId: TEST_TEMPLATE_ID,
      });
    });
  });

  // =========================================================================
  // ENTRY GENERATION
  // =========================================================================

  describe('generateEntryFromTemplate', () => {
    it('should generate journal entry from template', async () => {
      vi.mocked(EntryTemplateService.prototype.generateEntryFromTemplate).mockResolvedValue(testGeneratedEntry);

      const result = await caller.entryTemplate.generateEntryFromTemplate({
        templateId: TEST_TEMPLATE_ID,
        entryDate: new Date('2024-01-15'),
      });

      expect(result.id).toBe(TEST_ENTRY_ID);
      expect(result.status).toBe('DRAFT');
      expect(EntryTemplateService.prototype.generateEntryFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: TEST_TEMPLATE_ID,
        })
      );
    });

    it('should generate entry with variable values', async () => {
      vi.mocked(EntryTemplateService.prototype.generateEntryFromTemplate).mockResolvedValue(testGeneratedEntry);

      await caller.entryTemplate.generateEntryFromTemplate({
        templateId: TEST_TEMPLATE_ID,
        entryDate: new Date('2024-01-15'),
        variableValues: {
          amount: 7500,
          description: 'Custom description',
        },
      });

      expect(EntryTemplateService.prototype.generateEntryFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          variableValues: expect.objectContaining({
            amount: 7500,
          }),
        })
      );
    });

    it('should generate entry with override amounts', async () => {
      vi.mocked(EntryTemplateService.prototype.generateEntryFromTemplate).mockResolvedValue(testGeneratedEntry);

      await caller.entryTemplate.generateEntryFromTemplate({
        templateId: TEST_TEMPLATE_ID,
        entryDate: new Date('2024-01-15'),
        overrideAmounts: [
          { lineNumber: 1, debitAmount: 6000 },
          { lineNumber: 2, creditAmount: 6000 },
        ],
      });

      expect(EntryTemplateService.prototype.generateEntryFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideAmounts: expect.any(Array),
        })
      );
    });

    it('should generate entry with custom description', async () => {
      vi.mocked(EntryTemplateService.prototype.generateEntryFromTemplate).mockResolvedValue({
        ...testGeneratedEntry,
        description: 'Custom rent payment',
      });

      await caller.entryTemplate.generateEntryFromTemplate({
        templateId: TEST_TEMPLATE_ID,
        entryDate: new Date('2024-01-15'),
        customDescription: 'Custom rent payment',
      });

      expect(EntryTemplateService.prototype.generateEntryFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          customDescription: 'Custom rent payment',
        })
      );
    });
  });

  describe('batchGenerateEntries', () => {
    it('should batch generate multiple entries', async () => {
      vi.mocked(EntryTemplateService.prototype.batchGenerateEntries).mockResolvedValue(testBatchResult);

      const result = await caller.entryTemplate.batchGenerateEntries({
        templateId: TEST_TEMPLATE_ID,
        entries: [
          { entryDate: new Date('2024-01-15') },
          { entryDate: new Date('2024-02-15') },
          { entryDate: new Date('2024-03-15') },
        ],
      });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(EntryTemplateService.prototype.batchGenerateEntries).toHaveBeenCalled();
    });

    it('should handle entries with different variable values', async () => {
      vi.mocked(EntryTemplateService.prototype.batchGenerateEntries).mockResolvedValue(testBatchResult);

      await caller.entryTemplate.batchGenerateEntries({
        templateId: TEST_TEMPLATE_ID,
        entries: [
          { entryDate: new Date('2024-01-15'), variableValues: { amount: 5000 } },
          { entryDate: new Date('2024-02-15'), variableValues: { amount: 5500 } },
        ],
      });

      expect(EntryTemplateService.prototype.batchGenerateEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ variableValues: { amount: 5000 } }),
            expect.objectContaining({ variableValues: { amount: 5500 } }),
          ]),
        })
      );
    });
  });

  describe('createTemplateFromEntry', () => {
    it('should create template from existing entry', async () => {
      vi.mocked(EntryTemplateService.prototype.createTemplateFromEntry).mockResolvedValue(testTemplateWithDetails);

      const result = await caller.entryTemplate.createTemplateFromEntry({
        entryId: TEST_ENTRY_ID,
        templateName: 'Created from Entry',
        description: 'Template created from journal entry',
        categoryId: TEST_CATEGORY_ID,
      });

      expect(result.id).toBe(TEST_TEMPLATE_ID);
      expect(EntryTemplateService.prototype.createTemplateFromEntry).toHaveBeenCalledWith({
        entryId: TEST_ENTRY_ID,
        templateName: 'Created from Entry',
        description: 'Template created from journal entry',
        categoryId: TEST_CATEGORY_ID,
      });
    });
  });

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  describe('createCategory', () => {
    it('should create category', async () => {
      vi.mocked(EntryTemplateService.prototype.createCategory).mockResolvedValue(testCategory);

      const result = await caller.entryTemplate.createCategory({
        name: 'Operating Expenses',
        description: 'Regular operating expense templates',
        displayOrder: 1,
      });

      expect(result.id).toBe(TEST_CATEGORY_ID);
      expect(result.name).toBe('Operating Expenses');
      expect(EntryTemplateService.prototype.createCategory).toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    it('should update category', async () => {
      const updatedCategory = {
        ...testCategory,
        name: 'Updated Operating Expenses',
      };
      vi.mocked(EntryTemplateService.prototype.updateCategory).mockResolvedValue(updatedCategory);

      const result = await caller.entryTemplate.updateCategory({
        categoryId: TEST_CATEGORY_ID,
        name: 'Updated Operating Expenses',
      });

      expect(result.name).toBe('Updated Operating Expenses');
      expect(EntryTemplateService.prototype.updateCategory).toHaveBeenCalledWith({
        categoryId: TEST_CATEGORY_ID,
        name: 'Updated Operating Expenses',
      });
    });
  });

  describe('deleteCategory', () => {
    it('should delete category without templates', async () => {
      vi.mocked(EntryTemplateService.prototype.deleteCategory).mockResolvedValue({
        success: true,
        categoryId: TEST_CATEGORY_ID,
      });

      const result = await caller.entryTemplate.deleteCategory({
        categoryId: TEST_CATEGORY_ID,
      });

      expect(result.success).toBe(true);
      expect(EntryTemplateService.prototype.deleteCategory).toHaveBeenCalledWith({
        categoryId: TEST_CATEGORY_ID,
      });
    });
  });

  describe('listCategories', () => {
    it('should list all categories', async () => {
      vi.mocked(EntryTemplateService.prototype.listCategories).mockResolvedValue([testCategory]);

      const result = await caller.entryTemplate.listCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Operating Expenses');
      expect(EntryTemplateService.prototype.listCategories).toHaveBeenCalled();
    });
  });
});
