import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService } from '../../services/ace/template.service';
import type { AccountTemplate, TemplateAccount, BusinessType, CompanySize } from '@ksiegowacrm/shared';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  accountTemplate: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  templateAccount: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  templateApplication: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  chartOfAccount: {
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
};

const mockAuditLogger = {
  log: vi.fn(),
};

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';

const sampleTemplate: AccountTemplate = {
  id: 'tpl-001',
  templateCode: 'PL_FULL',
  templateName: 'Pełny Plan Kont (wg UoR)',
  templateNameEn: 'Full Polish Chart of Accounts',
  description: 'Kompletny plan kont zgodny z Ustawą o rachunkowości',
  businessType: 'general',
  companySize: 'large',
  version: '1.0.0',
  isActive: true,
  isSystemTemplate: true,
  accountCount: 120,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const sampleSimplifiedTemplate: AccountTemplate = {
  ...sampleTemplate,
  id: 'tpl-002',
  templateCode: 'PL_SIMPLIFIED',
  templateName: 'Uproszczony Plan Kont (MŚP)',
  templateNameEn: 'Simplified Polish Chart of Accounts',
  description: 'Uproszczony plan kont dla małych i średnich przedsiębiorstw',
  companySize: 'small',
  accountCount: 35,
};

const sampleMicroTemplate: AccountTemplate = {
  ...sampleTemplate,
  id: 'tpl-003',
  templateCode: 'PL_MICRO',
  templateName: 'Plan Kont dla Mikroprzedsiębiorstw',
  templateNameEn: 'Micro-entity Chart of Accounts',
  description: 'Minimalny plan kont dla mikroprzedsiębiorstw',
  companySize: 'micro',
  accountCount: 13,
};

const sampleTemplateAccount: TemplateAccount = {
  id: 'ta-001',
  templateId: 'tpl-001',
  accountCode: '010',
  accountName: 'Środki trwałe',
  accountNameEn: 'Fixed Assets',
  accountType: 'asset',
  accountClass: 0,
  accountGroup: null,
  parentAccountCode: null,
  normalBalance: 'debit',
  allowsPosting: false,
  taxCategory: null,
  jpkSymbol: null,
  sortOrder: 1,
};

const sampleTemplateAccounts: TemplateAccount[] = [
  sampleTemplateAccount,
  {
    ...sampleTemplateAccount,
    id: 'ta-002',
    accountCode: '011',
    accountName: 'Grunty',
    accountNameEn: 'Land',
    parentAccountCode: '010',
    allowsPosting: true,
    sortOrder: 2,
  },
  {
    ...sampleTemplateAccount,
    id: 'ta-003',
    accountCode: '100',
    accountName: 'Kasa',
    accountNameEn: 'Cash',
    accountClass: 1,
    allowsPosting: false,
    sortOrder: 3,
  },
];

// ===========================================================================
// TESTS
// ===========================================================================

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // =========================================================================
  // LIST TEMPLATES
  // =========================================================================

  describe('listTemplates', () => {
    it('should list all active templates', async () => {
      mockPrisma.accountTemplate.findMany.mockResolvedValue([
        sampleTemplate,
        sampleSimplifiedTemplate,
        sampleMicroTemplate,
      ]);
      mockPrisma.accountTemplate.count.mockResolvedValue(3);

      const result = await service.listTemplates({});

      expect(result.templates).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(mockPrisma.accountTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });

    it('should filter templates by businessType', async () => {
      mockPrisma.accountTemplate.findMany.mockResolvedValue([sampleTemplate]);
      mockPrisma.accountTemplate.count.mockResolvedValue(1);

      const result = await service.listTemplates({
        businessType: 'general',
      });

      expect(result.templates).toHaveLength(1);
      expect(mockPrisma.accountTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessType: 'general',
          }),
        })
      );
    });

    it('should filter templates by companySize', async () => {
      mockPrisma.accountTemplate.findMany.mockResolvedValue([sampleMicroTemplate]);
      mockPrisma.accountTemplate.count.mockResolvedValue(1);

      const result = await service.listTemplates({
        companySize: 'micro',
      });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].companySize).toBe('micro');
    });

    it('should search templates by name', async () => {
      mockPrisma.accountTemplate.findMany.mockResolvedValue([sampleSimplifiedTemplate]);
      mockPrisma.accountTemplate.count.mockResolvedValue(1);

      const result = await service.listTemplates({
        search: 'MŚP',
      });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].templateCode).toBe('PL_SIMPLIFIED');
    });

    it('should use cache for repeated calls', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        templates: [sampleTemplate],
        total: 1,
      }));

      const result = await service.listTemplates({});

      expect(result.templates).toHaveLength(1);
      expect(mockPrisma.accountTemplate.findMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET TEMPLATE
  // =========================================================================

  describe('getTemplate', () => {
    it('should return template by ID', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);

      const result = await service.getTemplate({ templateId: 'tpl-001' });

      expect(result).toEqual(sampleTemplate);
      expect(mockPrisma.accountTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'tpl-001' },
      });
    });

    it('should throw error if template not found', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.getTemplate({ templateId: 'non-existent' })
      ).rejects.toThrow('Template not found');
    });
  });

  // =========================================================================
  // PREVIEW TEMPLATE
  // =========================================================================

  describe('previewTemplate', () => {
    it('should return template with accounts and conflict analysis', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue(sampleTemplateAccounts);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

      const result = await service.previewTemplate({ templateId: 'tpl-001' });

      expect(result.template).toEqual(sampleTemplate);
      expect(result.accounts).toHaveLength(3);
      expect(result.conflictingAccounts).toEqual([]);
      expect(result.summary).toEqual(
        expect.objectContaining({
          totalAccounts: 3,
          byClass: { 0: 2, 1: 1 },
        })
      );
    });

    it('should identify conflicting accounts', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue(sampleTemplateAccounts);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        { code: '010' }, // Existing account with code 010
      ]);

      const result = await service.previewTemplate({ templateId: 'tpl-001' });

      expect(result.conflictingAccounts).toContain('010');
    });

    it('should summarize accounts by type', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue(sampleTemplateAccounts);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

      const result = await service.previewTemplate({ templateId: 'tpl-001' });

      expect(result.summary.byType).toEqual({ asset: 3 });
    });
  });

  // =========================================================================
  // APPLY TEMPLATE
  // =========================================================================

  describe('applyTemplate', () => {
    it('should apply template and create accounts', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue(sampleTemplateAccounts);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
      mockPrisma.chartOfAccount.createMany.mockResolvedValue({ count: 3 });
      mockPrisma.templateApplication.create.mockResolvedValue({
        id: 'app-001',
        templateId: 'tpl-001',
        organizationId: TEST_ORG_ID,
        appliedBy: TEST_USER_ID,
        appliedAt: new Date(),
        accountsCreated: 3,
        customizations: null,
      });

      const result = await service.applyTemplate({ templateId: 'tpl-001' });

      expect(result.success).toBe(true);
      expect(result.accountsCreated).toBe(3);
      expect(result.accountsSkipped).toBe(0);
      expect(mockPrisma.chartOfAccount.createMany).toHaveBeenCalled();
      expect(mockPrisma.templateApplication.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'template.apply',
        })
      );
    });

    it('should skip existing accounts when skipExisting is true', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue(sampleTemplateAccounts);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        { code: '010' }, // Existing account
      ]);
      mockPrisma.chartOfAccount.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.templateApplication.create.mockResolvedValue({
        id: 'app-001',
        templateId: 'tpl-001',
        organizationId: TEST_ORG_ID,
        appliedBy: TEST_USER_ID,
        appliedAt: new Date(),
        accountsCreated: 2,
        customizations: null,
      });

      const result = await service.applyTemplate({
        templateId: 'tpl-001',
        skipExisting: true,
      });

      expect(result.success).toBe(true);
      expect(result.accountsCreated).toBe(2);
      expect(result.accountsSkipped).toBe(1);
    });

    it('should exclude specified account classes', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue(sampleTemplateAccounts);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
      mockPrisma.chartOfAccount.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.templateApplication.create.mockResolvedValue({
        id: 'app-001',
        templateId: 'tpl-001',
        organizationId: TEST_ORG_ID,
        appliedBy: TEST_USER_ID,
        appliedAt: new Date(),
        accountsCreated: 1,
        customizations: { excludedClasses: [0] },
      });

      const result = await service.applyTemplate({
        templateId: 'tpl-001',
        excludeAccountClasses: [0], // Exclude class 0 (Fixed Assets)
      });

      expect(result.accountsCreated).toBe(1); // Only class 1 accounts
    });

    it('should apply account modifications', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue([sampleTemplateAccount]);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
      mockPrisma.chartOfAccount.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.templateApplication.create.mockResolvedValue({
        id: 'app-001',
        templateId: 'tpl-001',
        organizationId: TEST_ORG_ID,
        appliedBy: TEST_USER_ID,
        appliedAt: new Date(),
        accountsCreated: 1,
        customizations: {
          modifications: [
            { accountCode: '010', newName: 'Custom Fixed Assets' },
          ],
        },
      });

      const result = await service.applyTemplate({
        templateId: 'tpl-001',
        accountModifications: [
          { accountCode: '010', newName: 'Custom Fixed Assets' },
        ],
      });

      expect(result.success).toBe(true);
      // The createMany should have the modified name
      expect(mockPrisma.chartOfAccount.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'Custom Fixed Assets',
            }),
          ]),
        })
      );
    });

    it('should throw error if template not found', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.applyTemplate({ templateId: 'non-existent' })
      ).rejects.toThrow('Template not found');
    });

    it('should throw error if template is not active', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue({
        ...sampleTemplate,
        isActive: false,
      });

      await expect(
        service.applyTemplate({ templateId: 'tpl-001' })
      ).rejects.toThrow('Template is not active');
    });
  });

  // =========================================================================
  // GET TEMPLATE APPLICATIONS
  // =========================================================================

  describe('getTemplateApplications', () => {
    it('should return template applications for organization', async () => {
      const applicationWithTemplate = {
        id: 'app-001',
        templateId: 'tpl-001',
        organizationId: TEST_ORG_ID,
        appliedBy: TEST_USER_ID,
        appliedAt: new Date(),
        accountsCreated: 120,
        customizations: null,
        template: {
          templateCode: 'PL_FULL',
          templateName: 'Pełny Plan Kont (wg UoR)',
        },
      };

      mockPrisma.templateApplication.findMany.mockResolvedValue([applicationWithTemplate]);
      mockPrisma.templateApplication.count.mockResolvedValue(1);

      const result = await service.getTemplateApplications({});

      expect(result.applications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.applications[0].template.templateCode).toBe('PL_FULL');
    });

    it('should filter applications by templateId', async () => {
      mockPrisma.templateApplication.findMany.mockResolvedValue([]);
      mockPrisma.templateApplication.count.mockResolvedValue(0);

      const result = await service.getTemplateApplications({
        templateId: 'tpl-002',
      });

      expect(mockPrisma.templateApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            templateId: 'tpl-002',
          }),
        })
      );
    });
  });

  // =========================================================================
  // CACHE INVALIDATION
  // =========================================================================

  describe('cache invalidation', () => {
    it('should invalidate cache after applying template', async () => {
      mockPrisma.accountTemplate.findUnique.mockResolvedValue(sampleTemplate);
      mockPrisma.templateAccount.findMany.mockResolvedValue(sampleTemplateAccounts);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);
      mockPrisma.chartOfAccount.createMany.mockResolvedValue({ count: 3 });
      mockPrisma.templateApplication.create.mockResolvedValue({
        id: 'app-001',
        templateId: 'tpl-001',
        organizationId: TEST_ORG_ID,
        appliedBy: TEST_USER_ID,
        appliedAt: new Date(),
        accountsCreated: 3,
        customizations: null,
      });
      mockRedis.keys.mockResolvedValue(['template:org-456:list', 'account:org-456:list']);

      await service.applyTemplate({ templateId: 'tpl-001' });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
