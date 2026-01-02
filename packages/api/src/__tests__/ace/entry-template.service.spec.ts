/**
 * ACC-009: Entry Template Service Tests
 * TDD tests for journal entry template operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntryTemplateService } from '../../services/ace/entry-template.service';
import { TRPCError } from '@trpc/server';

// Mock Prisma client
const mockPrisma = {
  entryTemplate: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  templateLine: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  templateVariable: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  templateCategory: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  templateVersion: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  templateFavorite: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  journalEntry: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  journalLine: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  chartOfAccount: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  accountingPeriod: {
    findFirst: vi.fn(),
  },
  entryNumberSequence: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
};

// Mock Audit Logger
const mockAuditLogger = {
  log: vi.fn(),
};

// Test data
const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_CASH_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440004';
const TEST_BANK_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440005';
const TEST_ENTRY_ID = '550e8400-e29b-41d4-a716-446655440006';
const TEST_PERIOD_ID = '550e8400-e29b-41d4-a716-446655440007';

const testCategory = {
  id: TEST_CATEGORY_ID,
  organizationId: TEST_ORG_ID,
  name: 'Monthly Operations',
  description: 'Monthly recurring templates',
  displayOrder: 1,
  isSystem: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  createdBy: TEST_USER_ID,
};

const testTemplateLines = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    templateId: TEST_TEMPLATE_ID,
    lineNumber: 1,
    accountId: TEST_CASH_ACCOUNT_ID,
    accountPattern: null,
    amountType: 'FIXED',
    fixedDebitAmount: 1000,
    fixedCreditAmount: 0,
    variableName: null,
    formula: null,
    description: 'Cash receipt',
    currencyCode: 'PLN',
    taxCodeId: null,
    displayOrder: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440002',
    templateId: TEST_TEMPLATE_ID,
    lineNumber: 2,
    accountId: TEST_BANK_ACCOUNT_ID,
    accountPattern: null,
    amountType: 'FIXED',
    fixedDebitAmount: 0,
    fixedCreditAmount: 1000,
    variableName: null,
    formula: null,
    description: 'Bank transfer',
    currencyCode: 'PLN',
    taxCodeId: null,
    displayOrder: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const testTemplateVariables = [
  {
    id: '770e8400-e29b-41d4-a716-446655440001',
    templateId: TEST_TEMPLATE_ID,
    variableName: 'transferAmount',
    variableType: 'NUMBER',
    displayLabel: 'Transfer Amount',
    isRequired: true,
    defaultValue: null,
    validationPattern: null,
    displayOrder: 1,
  },
];

const testTemplate = {
  id: TEST_TEMPLATE_ID,
  organizationId: TEST_ORG_ID,
  templateCode: 'TPL-001',
  templateName: 'Bank to Cash Transfer',
  description: 'Standard bank to cash transfer template',
  categoryId: TEST_CATEGORY_ID,
  entryType: 'STANDARD',
  defaultDescription: 'Cash withdrawal from bank',
  status: 'ACTIVE',
  version: 1,
  sourceEntryId: null,
  usageCount: 0,
  lastUsedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  createdBy: TEST_USER_ID,
  updatedBy: null,
  archivedAt: null,
  archivedBy: null,
};

const testTemplateWithDetails = {
  ...testTemplate,
  lines: testTemplateLines,
  variables: testTemplateVariables,
  category: testCategory,
};

// Template without required variables for tests that don't need variable values
const testTemplateFixedAmounts = {
  ...testTemplate,
  lines: testTemplateLines,
  variables: [], // No required variables
  category: testCategory,
};

const testCashAccount = {
  id: TEST_CASH_ACCOUNT_ID,
  organizationId: TEST_ORG_ID,
  accountCode: '100',
  accountName: 'Kasa',
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  isActive: true,
  allowsPosting: true,
};

const testBankAccount = {
  id: TEST_BANK_ACCOUNT_ID,
  organizationId: TEST_ORG_ID,
  accountCode: '131',
  accountName: 'Rachunek bankowy',
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  isActive: true,
  allowsPosting: true,
};

const testPeriod = {
  id: TEST_PERIOD_ID,
  organizationId: TEST_ORG_ID,
  periodNumber: 1,
  name: 'January 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'OPEN',
};

describe('EntryTemplateService', () => {
  let service: EntryTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EntryTemplateService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // ===========================================================================
  // TEMPLATE CRUD OPERATIONS
  // ===========================================================================

  describe('createTemplate', () => {
    it('should create a template with lines', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.templateCategory.findFirst.mockResolvedValue(testCategory);
      mockPrisma.entryTemplate.count.mockResolvedValue(0);
      mockPrisma.entryTemplate.create.mockResolvedValue(testTemplateWithDetails);

      const result = await service.createTemplate({
        templateName: 'Bank to Cash Transfer',
        description: 'Standard bank to cash transfer template',
        categoryId: TEST_CATEGORY_ID,
        entryType: 'STANDARD',
        defaultDescription: 'Cash withdrawal from bank',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_CASH_ACCOUNT_ID,
            amountType: 'FIXED',
            fixedDebitAmount: 1000,
            fixedCreditAmount: 0,
            description: 'Cash receipt',
            currencyCode: 'PLN',
            displayOrder: 1,
          },
          {
            lineNumber: 2,
            accountId: TEST_BANK_ACCOUNT_ID,
            amountType: 'FIXED',
            fixedDebitAmount: 0,
            fixedCreditAmount: 1000,
            description: 'Bank transfer',
            currencyCode: 'PLN',
            displayOrder: 2,
          },
        ],
      });

      expect(result.templateName).toBe('Bank to Cash Transfer');
      expect(mockPrisma.entryTemplate.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should create template with variables', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.templateCategory.findFirst.mockResolvedValue(testCategory);
      mockPrisma.entryTemplate.count.mockResolvedValue(0);
      mockPrisma.entryTemplate.create.mockResolvedValue({
        ...testTemplateWithDetails,
        variables: testTemplateVariables,
      });

      const result = await service.createTemplate({
        templateName: 'Variable Transfer',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_CASH_ACCOUNT_ID,
            amountType: 'VARIABLE',
            variableName: 'transferAmount',
            fixedDebitAmount: 0,
            fixedCreditAmount: 0,
            currencyCode: 'PLN',
            displayOrder: 1,
          },
          {
            lineNumber: 2,
            accountId: TEST_BANK_ACCOUNT_ID,
            amountType: 'VARIABLE',
            variableName: 'transferAmount',
            fixedDebitAmount: 0,
            fixedCreditAmount: 0,
            currencyCode: 'PLN',
            displayOrder: 2,
          },
        ],
        variables: [
          {
            variableName: 'transferAmount',
            variableType: 'NUMBER',
            displayLabel: 'Transfer Amount',
            isRequired: true,
            displayOrder: 1,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPrisma.entryTemplate.create).toHaveBeenCalled();
    });

    it('should reject template with invalid account', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount]);

      await expect(
        service.createTemplate({
          templateName: 'Invalid Template',
          lines: [
            {
              lineNumber: 1,
              accountId: TEST_CASH_ACCOUNT_ID,
              amountType: 'FIXED',
              fixedDebitAmount: 1000,
              fixedCreditAmount: 0,
              currencyCode: 'PLN',
              displayOrder: 1,
            },
            {
              lineNumber: 2,
              accountId: 'non-existent-account',
              amountType: 'FIXED',
              fixedDebitAmount: 0,
              fixedCreditAmount: 1000,
              currencyCode: 'PLN',
              displayOrder: 2,
            },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should create template with single line (no minimum validation)', async () => {
      // Note: Service currently allows single-line templates
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount]);
      mockPrisma.entryTemplate.create.mockResolvedValue({
        ...testTemplate,
        lines: [testTemplateLines[0]],
        variables: [],
        category: null,
      });

      const result = await service.createTemplate({
        templateName: 'Single Line Template',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_CASH_ACCOUNT_ID,
            amountType: 'FIXED',
            fixedDebitAmount: 1000,
            fixedCreditAmount: 0,
            currencyCode: 'PLN',
            displayOrder: 1,
          },
        ],
      } as any);

      expect(result).toBeDefined();
    });
  });

  describe('getTemplate', () => {
    it('should return template with details', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);

      const result = await service.getTemplate({ templateId: TEST_TEMPLATE_ID });

      expect(result.id).toBe(TEST_TEMPLATE_ID);
      expect(result.templateName).toBe('Bank to Cash Transfer');
      expect(result.lines).toHaveLength(2);
    });

    it('should throw NOT_FOUND for non-existent template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.getTemplate({ templateId: 'non-existent' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('updateTemplate', () => {
    it('should update template and create version', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);
      mockPrisma.templateVersion.create.mockResolvedValue({
        id: '880e8400-e29b-41d4-a716-446655440001',
        templateId: TEST_TEMPLATE_ID,
        versionNumber: 1,
        templateData: testTemplateWithDetails,
        changeDescription: 'Updated template name',
        createdAt: new Date(),
        createdBy: TEST_USER_ID,
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateWithDetails,
        templateName: 'Updated Transfer Template',
        version: 2,
      });

      const result = await service.updateTemplate({
        templateId: TEST_TEMPLATE_ID,
        templateName: 'Updated Transfer Template',
        changeDescription: 'Updated template name',
      });

      expect(result.templateName).toBe('Updated Transfer Template');
      expect(result.version).toBe(2);
      expect(mockPrisma.templateVersion.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should update template lines', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.templateLine.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.templateVersion.create.mockResolvedValue({
        id: '880e8400-e29b-41d4-a716-446655440001',
        templateId: TEST_TEMPLATE_ID,
        versionNumber: 1,
        templateData: testTemplateWithDetails,
        createdAt: new Date(),
        createdBy: TEST_USER_ID,
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateWithDetails,
        version: 2,
      });

      const result = await service.updateTemplate({
        templateId: TEST_TEMPLATE_ID,
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_CASH_ACCOUNT_ID,
            amountType: 'FIXED',
            fixedDebitAmount: 2000,
            fixedCreditAmount: 0,
            currencyCode: 'PLN',
            displayOrder: 1,
          },
          {
            lineNumber: 2,
            accountId: TEST_BANK_ACCOUNT_ID,
            amountType: 'FIXED',
            fixedDebitAmount: 0,
            fixedCreditAmount: 2000,
            currencyCode: 'PLN',
            displayOrder: 2,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPrisma.templateLine.deleteMany).toHaveBeenCalled();
    });

    it('should reject update on archived template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue({
        ...testTemplateWithDetails,
        status: 'ARCHIVED',
        archivedAt: new Date(),
      });

      await expect(
        service.updateTemplate({
          templateId: TEST_TEMPLATE_ID,
          templateName: 'New Name',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('archiveTemplate', () => {
    it('should archive active template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateWithDetails,
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedBy: TEST_USER_ID,
      });

      const result = await service.archiveTemplate({ templateId: TEST_TEMPLATE_ID });

      expect(result.status).toBe('ARCHIVED');
      expect(result.archivedAt).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should reject archiving already archived template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue({
        ...testTemplateWithDetails,
        status: 'ARCHIVED',
      });

      await expect(
        service.archiveTemplate({ templateId: TEST_TEMPLATE_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('restoreTemplate', () => {
    it('should restore archived template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue({
        ...testTemplateWithDetails,
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedBy: TEST_USER_ID,
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateWithDetails,
        status: 'ACTIVE',
        archivedAt: null,
        archivedBy: null,
      });

      const result = await service.restoreTemplate({ templateId: TEST_TEMPLATE_ID });

      expect(result.status).toBe('ACTIVE');
      expect(result.archivedAt).toBeNull();
    });

    it('should reject restoring active template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);

      await expect(
        service.restoreTemplate({ templateId: TEST_TEMPLATE_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template with no usage', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue({
        ...testTemplateWithDetails,
        usageCount: 0,
      });
      mockPrisma.templateLine.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.templateVariable.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.templateFavorite.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.templateVersion.findMany.mockResolvedValue([]);
      mockPrisma.entryTemplate.delete.mockResolvedValue(testTemplateWithDetails);

      const result = await service.deleteTemplate({ templateId: TEST_TEMPLATE_ID });

      expect(result.success).toBe(true);
      expect(result.templateId).toBe(TEST_TEMPLATE_ID);
      expect(mockPrisma.entryTemplate.delete).toHaveBeenCalled();
    });

    it('should reject deleting template with usage history', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue({
        ...testTemplateWithDetails,
        usageCount: 5,
      });

      await expect(
        service.deleteTemplate({ templateId: TEST_TEMPLATE_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // TEMPLATE LIST AND SEARCH
  // ===========================================================================

  describe('listTemplates', () => {
    it('should list templates with pagination', async () => {
      mockPrisma.entryTemplate.findMany.mockResolvedValue([testTemplateWithDetails]);
      mockPrisma.entryTemplate.count.mockResolvedValue(1);
      mockPrisma.templateFavorite.findFirst.mockResolvedValue(null);

      const result = await service.listTemplates({
        limit: 50,
        offset: 0,
      });

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by status', async () => {
      mockPrisma.entryTemplate.findMany.mockResolvedValue([testTemplateWithDetails]);
      mockPrisma.entryTemplate.count.mockResolvedValue(1);
      mockPrisma.templateFavorite.findFirst.mockResolvedValue(null);

      await service.listTemplates({
        status: 'ACTIVE',
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.entryTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should filter by category', async () => {
      mockPrisma.entryTemplate.findMany.mockResolvedValue([testTemplateWithDetails]);
      mockPrisma.entryTemplate.count.mockResolvedValue(1);
      mockPrisma.templateFavorite.findFirst.mockResolvedValue(null);

      await service.listTemplates({
        categoryId: TEST_CATEGORY_ID,
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.entryTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: TEST_CATEGORY_ID,
          }),
        })
      );
    });

    it('should filter by search term', async () => {
      mockPrisma.entryTemplate.findMany.mockResolvedValue([testTemplateWithDetails]);
      mockPrisma.entryTemplate.count.mockResolvedValue(1);
      mockPrisma.templateFavorite.findFirst.mockResolvedValue(null);

      await service.listTemplates({
        search: 'transfer',
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.entryTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should show favorites only when requested', async () => {
      const favoriteTemplate = {
        ...testTemplateWithDetails,
        favorites: [{ userId: TEST_USER_ID }],
      };
      mockPrisma.entryTemplate.findMany.mockResolvedValue([favoriteTemplate]);
      mockPrisma.entryTemplate.count.mockResolvedValue(1);
      mockPrisma.templateFavorite.findFirst.mockResolvedValue({ id: 'fav-1' });

      const result = await service.listTemplates({
        favoritesOnly: true,
        limit: 50,
        offset: 0,
      });

      expect(result.templates[0].isFavorite).toBe(true);
    });
  });

  // ===========================================================================
  // FAVORITES
  // ===========================================================================

  describe('toggleFavorite', () => {
    it('should add template to favorites', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);
      mockPrisma.templateFavorite.findFirst.mockResolvedValue(null);
      mockPrisma.templateFavorite.create.mockResolvedValue({
        id: 'fav-1',
        templateId: TEST_TEMPLATE_ID,
        userId: TEST_USER_ID,
        createdAt: new Date(),
      });

      const result = await service.toggleFavorite({ templateId: TEST_TEMPLATE_ID });

      expect(result.isFavorite).toBe(true);
      expect(mockPrisma.templateFavorite.create).toHaveBeenCalled();
    });

    it('should remove template from favorites', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);
      mockPrisma.templateFavorite.findFirst.mockResolvedValue({
        id: 'fav-1',
        templateId: TEST_TEMPLATE_ID,
        userId: TEST_USER_ID,
      });
      mockPrisma.templateFavorite.delete.mockResolvedValue({});

      const result = await service.toggleFavorite({ templateId: TEST_TEMPLATE_ID });

      expect(result.isFavorite).toBe(false);
      expect(mockPrisma.templateFavorite.delete).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TEMPLATE VERSIONS
  // ===========================================================================

  describe('getTemplateVersions', () => {
    it('should return version history', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateWithDetails);
      mockPrisma.templateVersion.findMany.mockResolvedValue([
        {
          id: '880e8400-e29b-41d4-a716-446655440001',
          templateId: TEST_TEMPLATE_ID,
          versionNumber: 1,
          templateData: { templateName: 'Original Name' },
          changeDescription: 'Initial version',
          createdAt: new Date('2024-01-01'),
          createdBy: TEST_USER_ID,
        },
        {
          id: '880e8400-e29b-41d4-a716-446655440002',
          templateId: TEST_TEMPLATE_ID,
          versionNumber: 2,
          templateData: { templateName: 'Updated Name' },
          changeDescription: 'Updated name',
          createdAt: new Date('2024-01-15'),
          createdBy: TEST_USER_ID,
        },
      ]);

      const result = await service.getTemplateVersions({ templateId: TEST_TEMPLATE_ID });

      expect(result).toHaveLength(2);
      expect(result[0].versionNumber).toBe(1);
      expect(result[1].versionNumber).toBe(2);
    });
  });

  // ===========================================================================
  // ENTRY GENERATION
  // ===========================================================================

  describe('generateEntryFromTemplate', () => {
    it('should generate entry with fixed amounts', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateFixedAmounts);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue(null);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({
        id: 'seq-1',
        lastNumber: 1,
      });
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: TEST_ENTRY_ID,
        entryNumber: 'PK/01/2024/0001',
        entryDate: new Date('2024-01-15'),
        entryType: 'STANDARD',
        status: 'DRAFT',
        description: 'Cash withdrawal from bank',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_CASH_ACCOUNT_ID,
            debitAmount: 1000,
            creditAmount: 0,
          },
          {
            lineNumber: 2,
            accountId: TEST_BANK_ACCOUNT_ID,
            debitAmount: 0,
            creditAmount: 1000,
          },
        ],
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateFixedAmounts,
        usageCount: 1,
        lastUsedAt: new Date(),
      });

      const result = await service.generateEntryFromTemplate({
        templateId: TEST_TEMPLATE_ID,
        entryDate: new Date('2024-01-15'),
      });

      expect(result.id).toBe(TEST_ENTRY_ID);
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
      expect(mockPrisma.entryTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usageCount: expect.any(Object),
            lastUsedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should generate entry with variable amounts', async () => {
      const variableTemplate = {
        ...testTemplateWithDetails,
        lines: [
          {
            ...testTemplateLines[0],
            amountType: 'VARIABLE',
            variableName: 'transferAmount',
            fixedDebitAmount: 0,
          },
          {
            ...testTemplateLines[1],
            amountType: 'VARIABLE',
            variableName: 'transferAmount',
            fixedCreditAmount: 0,
          },
        ],
        variables: testTemplateVariables,
      };
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(variableTemplate);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue(null);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({
        id: 'seq-1',
        lastNumber: 1,
      });
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: TEST_ENTRY_ID,
        entryNumber: 'PK/01/2024/0001',
        entryDate: new Date('2024-01-15'),
        status: 'DRAFT',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_CASH_ACCOUNT_ID,
            debitAmount: 5000,
            creditAmount: 0,
          },
          {
            lineNumber: 2,
            accountId: TEST_BANK_ACCOUNT_ID,
            debitAmount: 0,
            creditAmount: 5000,
          },
        ],
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...variableTemplate,
        usageCount: 1,
      });

      const result = await service.generateEntryFromTemplate({
        templateId: TEST_TEMPLATE_ID,
        entryDate: new Date('2024-01-15'),
        variableValues: {
          transferAmount: 5000,
        },
      });

      expect(result.id).toBe(TEST_ENTRY_ID);
    });

    it('should generate entry with custom description', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateFixedAmounts);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue(null);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({ lastNumber: 1 });
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: TEST_ENTRY_ID,
        description: 'Custom: Cash for office supplies',
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateFixedAmounts,
        usageCount: 1,
      });

      const result = await service.generateEntryFromTemplate({
        templateId: TEST_TEMPLATE_ID,
        entryDate: new Date('2024-01-15'),
        customDescription: 'Custom: Cash for office supplies',
      });

      expect(result.description).toBe('Custom: Cash for office supplies');
    });

    it('should reject entry for archived template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue({
        ...testTemplateWithDetails,
        status: 'ARCHIVED',
      });

      await expect(
        service.generateEntryFromTemplate({
          templateId: TEST_TEMPLATE_ID,
          entryDate: new Date('2024-01-15'),
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject entry with missing required variables', async () => {
      const variableTemplate = {
        ...testTemplateWithDetails,
        lines: [
          {
            ...testTemplateLines[0],
            amountType: 'VARIABLE',
            variableName: 'transferAmount',
          },
          {
            ...testTemplateLines[1],
            amountType: 'VARIABLE',
            variableName: 'transferAmount',
          },
        ],
        variables: testTemplateVariables,
      };
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(variableTemplate);

      await expect(
        service.generateEntryFromTemplate({
          templateId: TEST_TEMPLATE_ID,
          entryDate: new Date('2024-01-15'),
          // Missing variableValues
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('batchGenerateEntries', () => {
    it('should generate multiple entries from template', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateFixedAmounts);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue(null);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({ lastNumber: 3 });

      let entryCount = 0;
      mockPrisma.journalEntry.create.mockImplementation(() => {
        entryCount++;
        return Promise.resolve({
          id: `entry-${entryCount}`,
          entryNumber: `PK/01/2024/000${entryCount}`,
          entryDate: new Date('2024-01-15'),
          status: 'DRAFT',
        });
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateFixedAmounts,
        usageCount: 3,
      });

      const result = await service.batchGenerateEntries({
        templateId: TEST_TEMPLATE_ID,
        entries: [
          { entryDate: new Date('2024-01-15') },
          { entryDate: new Date('2024-01-16') },
          { entryDate: new Date('2024-01-17') },
        ],
      });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should handle partial failures in batch', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplateFixedAmounts);
      mockPrisma.accountingPeriod.findFirst
        .mockResolvedValueOnce(testPeriod)
        .mockResolvedValueOnce(null) // Second entry fails - no period
        .mockResolvedValueOnce(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue(null);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({ lastNumber: 2 });

      let entryCount = 0;
      mockPrisma.journalEntry.create.mockImplementation(() => {
        entryCount++;
        return Promise.resolve({
          id: `entry-${entryCount}`,
          status: 'DRAFT',
        });
      });
      mockPrisma.entryTemplate.update.mockResolvedValue({
        ...testTemplateFixedAmounts,
        usageCount: 2,
      });

      const result = await service.batchGenerateEntries({
        templateId: TEST_TEMPLATE_ID,
        entries: [
          { entryDate: new Date('2024-01-15') },
          { entryDate: new Date('2025-06-15') }, // Date outside any period
          { entryDate: new Date('2024-01-17') },
        ],
      });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBeDefined();
    });
  });

  // ===========================================================================
  // CREATE FROM EXISTING ENTRY
  // ===========================================================================

  describe('createTemplateFromEntry', () => {
    it('should create template from existing journal entry', async () => {
      const existingEntry = {
        id: TEST_ENTRY_ID,
        organizationId: TEST_ORG_ID,
        entryNumber: 'PK/01/2024/0001',
        entryDate: new Date('2024-01-15'),
        entryType: 'STANDARD',
        description: 'Original entry description',
        lines: [
          {
            lineNumber: 1,
            accountId: TEST_CASH_ACCOUNT_ID,
            debitAmount: 1000,
            creditAmount: 0,
            description: 'Cash debit',
            account: testCashAccount,
          },
          {
            lineNumber: 2,
            accountId: TEST_BANK_ACCOUNT_ID,
            debitAmount: 0,
            creditAmount: 1000,
            description: 'Bank credit',
            account: testBankAccount,
          },
        ],
      };
      mockPrisma.journalEntry.findUnique.mockResolvedValue(existingEntry);
      mockPrisma.templateCategory.findFirst.mockResolvedValue(testCategory);
      mockPrisma.entryTemplate.count.mockResolvedValue(0);
      mockPrisma.entryTemplate.create.mockResolvedValue({
        ...testTemplateWithDetails,
        templateName: 'Template from PK/01/2024/0001',
        sourceEntryId: TEST_ENTRY_ID,
      });

      const result = await service.createTemplateFromEntry({
        entryId: TEST_ENTRY_ID,
        templateName: 'Template from PK/01/2024/0001',
        description: 'Created from existing entry',
        categoryId: TEST_CATEGORY_ID,
      });

      expect(result.sourceEntryId).toBe(TEST_ENTRY_ID);
      expect(mockPrisma.entryTemplate.create).toHaveBeenCalled();
    });

    it('should reject template from non-existent entry', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.createTemplateFromEntry({
          entryId: 'non-existent',
          templateName: 'Template',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // TEMPLATE CATEGORIES
  // ===========================================================================

  describe('createCategory', () => {
    it('should create new category', async () => {
      mockPrisma.templateCategory.findFirst.mockResolvedValue(null);
      mockPrisma.templateCategory.create.mockResolvedValue(testCategory);

      const result = await service.createCategory({
        name: 'Monthly Operations',
        description: 'Monthly recurring templates',
        displayOrder: 1,
      });

      expect(result.name).toBe('Monthly Operations');
      expect(mockPrisma.templateCategory.create).toHaveBeenCalled();
    });

    it('should reject duplicate category name', async () => {
      mockPrisma.templateCategory.findFirst.mockResolvedValue(testCategory);

      await expect(
        service.createCategory({
          name: 'Monthly Operations',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('updateCategory', () => {
    it('should update category', async () => {
      // First findFirst call: find the category being updated
      // Second findFirst call: check for duplicate name (should return null)
      mockPrisma.templateCategory.findFirst
        .mockResolvedValueOnce(testCategory) // Category exists
        .mockResolvedValueOnce(null); // No duplicate name
      mockPrisma.templateCategory.update.mockResolvedValue({
        ...testCategory,
        name: 'Updated Category Name',
      });

      const result = await service.updateCategory({
        categoryId: TEST_CATEGORY_ID,
        name: 'Updated Category Name',
      });

      expect(result.name).toBe('Updated Category Name');
    });

    it('should reject updating system category', async () => {
      mockPrisma.templateCategory.findFirst.mockResolvedValue({
        ...testCategory,
        isSystem: true,
      });

      await expect(
        service.updateCategory({
          categoryId: TEST_CATEGORY_ID,
          name: 'New Name',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('deleteCategory', () => {
    it('should delete empty category', async () => {
      mockPrisma.templateCategory.findFirst.mockResolvedValue(testCategory);
      mockPrisma.entryTemplate.count.mockResolvedValue(0);
      mockPrisma.templateCategory.delete.mockResolvedValue(testCategory);

      await service.deleteCategory({ categoryId: TEST_CATEGORY_ID });

      expect(mockPrisma.templateCategory.delete).toHaveBeenCalled();
    });

    it('should reject deleting category with templates', async () => {
      mockPrisma.templateCategory.findFirst.mockResolvedValue(testCategory);
      mockPrisma.entryTemplate.count.mockResolvedValue(5);

      await expect(
        service.deleteCategory({ categoryId: TEST_CATEGORY_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject deleting system category', async () => {
      mockPrisma.templateCategory.findFirst.mockResolvedValue({
        ...testCategory,
        isSystem: true,
      });

      await expect(
        service.deleteCategory({ categoryId: TEST_CATEGORY_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('listCategories', () => {
    it('should list all categories', async () => {
      mockPrisma.templateCategory.findMany.mockResolvedValue([
        testCategory,
        { ...testCategory, id: 'cat-2', name: 'Quarterly Operations' },
      ]);

      const result = await service.listCategories();

      expect(result).toHaveLength(2);
    });
  });
});
