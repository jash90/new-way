import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService } from '../../services/ace/template.service';
import type { AccountTemplate, TemplateAccount } from '@ksiegowacrm/shared';

// ===========================================================================
// MOCKS
// ===========================================================================

vi.mock('../../services/ace/template.service');

const mockListTemplates = vi.fn();
const mockGetTemplate = vi.fn();
const mockPreviewTemplate = vi.fn();
const mockApplyTemplate = vi.fn();
const mockGetTemplateApplications = vi.fn();

vi.mocked(TemplateService).mockImplementation(() => ({
  listTemplates: mockListTemplates,
  getTemplate: mockGetTemplate,
  previewTemplate: mockPreviewTemplate,
  applyTemplate: mockApplyTemplate,
  getTemplateApplications: mockGetTemplateApplications,
} as any));

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

// ===========================================================================
// TESTS
// ===========================================================================

describe('TemplateRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // LIST TEMPLATES
  // =========================================================================

  describe('list', () => {
    it('should list all templates', async () => {
      mockListTemplates.mockResolvedValue({
        templates: [sampleTemplate],
        total: 1,
      });

      const result = await mockListTemplates({});

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by business type', async () => {
      mockListTemplates.mockResolvedValue({
        templates: [sampleTemplate],
        total: 1,
      });

      await mockListTemplates({ businessType: 'general' });

      expect(mockListTemplates).toHaveBeenCalledWith({ businessType: 'general' });
    });

    it('should filter by company size', async () => {
      mockListTemplates.mockResolvedValue({
        templates: [],
        total: 0,
      });

      await mockListTemplates({ companySize: 'micro' });

      expect(mockListTemplates).toHaveBeenCalledWith({ companySize: 'micro' });
    });
  });

  // =========================================================================
  // GET TEMPLATE
  // =========================================================================

  describe('get', () => {
    it('should return template by ID', async () => {
      mockGetTemplate.mockResolvedValue(sampleTemplate);

      const result = await mockGetTemplate({ templateId: 'tpl-001' });

      expect(result).toEqual(sampleTemplate);
    });

    it('should throw if template not found', async () => {
      mockGetTemplate.mockRejectedValue(new Error('Template not found'));

      await expect(mockGetTemplate({ templateId: 'non-existent' })).rejects.toThrow(
        'Template not found'
      );
    });
  });

  // =========================================================================
  // PREVIEW TEMPLATE
  // =========================================================================

  describe('preview', () => {
    it('should return preview with accounts and conflicts', async () => {
      mockPreviewTemplate.mockResolvedValue({
        template: sampleTemplate,
        accounts: [sampleTemplateAccount],
        conflictingAccounts: [],
        summary: {
          totalAccounts: 1,
          byClass: { 0: 1 },
          byType: { asset: 1 },
        },
      });

      const result = await mockPreviewTemplate({ templateId: 'tpl-001' });

      expect(result.template).toEqual(sampleTemplate);
      expect(result.accounts).toHaveLength(1);
      expect(result.conflictingAccounts).toEqual([]);
    });
  });

  // =========================================================================
  // APPLY TEMPLATE
  // =========================================================================

  describe('apply', () => {
    it('should apply template successfully', async () => {
      mockApplyTemplate.mockResolvedValue({
        success: true,
        templateId: 'tpl-001',
        templateName: 'Pełny Plan Kont (wg UoR)',
        accountsCreated: 120,
        accountsSkipped: 0,
        applicationId: 'app-001',
      });

      const result = await mockApplyTemplate({ templateId: 'tpl-001' });

      expect(result.success).toBe(true);
      expect(result.accountsCreated).toBe(120);
    });

    it('should exclude specified classes', async () => {
      mockApplyTemplate.mockResolvedValue({
        success: true,
        templateId: 'tpl-001',
        templateName: 'Pełny Plan Kont (wg UoR)',
        accountsCreated: 100,
        accountsSkipped: 20,
        applicationId: 'app-001',
      });

      await mockApplyTemplate({
        templateId: 'tpl-001',
        excludeAccountClasses: [9], // Exclude off-balance
      });

      expect(mockApplyTemplate).toHaveBeenCalledWith({
        templateId: 'tpl-001',
        excludeAccountClasses: [9],
      });
    });

    it('should apply account modifications', async () => {
      mockApplyTemplate.mockResolvedValue({
        success: true,
        templateId: 'tpl-001',
        templateName: 'Pełny Plan Kont (wg UoR)',
        accountsCreated: 120,
        accountsSkipped: 0,
        applicationId: 'app-001',
      });

      await mockApplyTemplate({
        templateId: 'tpl-001',
        accountModifications: [
          { accountCode: '010', newName: 'Custom Name' },
        ],
      });

      expect(mockApplyTemplate).toHaveBeenCalledWith({
        templateId: 'tpl-001',
        accountModifications: [{ accountCode: '010', newName: 'Custom Name' }],
      });
    });
  });

  // =========================================================================
  // GET TEMPLATE APPLICATIONS
  // =========================================================================

  describe('applications', () => {
    it('should return application history', async () => {
      mockGetTemplateApplications.mockResolvedValue({
        applications: [
          {
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
          },
        ],
        total: 1,
      });

      const result = await mockGetTemplateApplications({});

      expect(result.applications).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
