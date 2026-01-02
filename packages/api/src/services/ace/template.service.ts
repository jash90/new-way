import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import {
  getAccountLevel,
} from '@ksiegowacrm/shared';
import type {
  AccountTemplate,
  TemplateAccount,
  TemplateApplication,
  ListTemplatesInput,
  ListTemplatesResult,
  GetTemplateInput,
  PreviewTemplateInput,
  PreviewTemplateResult,
  ApplyTemplateInput,
  ApplyTemplateResult,
  GetTemplateApplicationsInput,
  TemplateApplicationsResult,
} from '@ksiegowacrm/shared';

// Cache TTL (5 minutes)
const CACHE_TTL = 300;

export class TemplateService {
  private prisma: PrismaClient;
  private redis: Redis;
  private auditLogger: AuditLogger;
  private userId: string;
  private organizationId: string;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    auditLogger: AuditLogger,
    userId: string,
    organizationId: string
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.auditLogger = auditLogger;
    this.userId = userId;
    this.organizationId = organizationId;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private getCacheKey(suffix: string): string {
    return `template:${this.organizationId}:${suffix}`;
  }

  private async invalidateCache(): Promise<void> {
    // Invalidate template cache
    const templatePattern = `template:${this.organizationId}:*`;
    const templateKeys = await this.redis.keys(templatePattern);
    if (templateKeys.length > 0) {
      await this.redis.del(...templateKeys);
    }

    // Also invalidate account cache since accounts were created
    const accountPattern = `account:${this.organizationId}:*`;
    const accountKeys = await this.redis.keys(accountPattern);
    if (accountKeys.length > 0) {
      await this.redis.del(...accountKeys);
    }
  }

  // ===========================================================================
  // LIST TEMPLATES
  // ===========================================================================

  async listTemplates(input: ListTemplatesInput): Promise<ListTemplatesResult> {
    const { businessType, companySize, isActive = true, search } = input;

    // Try cache first
    const cacheKey = this.getCacheKey(
      `list:${businessType || 'all'}:${companySize || 'all'}:${isActive}:${search || ''}`
    );
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build where clause
    const where: any = {
      isActive,
    };

    if (businessType) {
      where.businessType = businessType;
    }

    if (companySize) {
      where.companySize = companySize;
    }

    if (search) {
      where.OR = [
        { templateName: { contains: search, mode: 'insensitive' } },
        { templateNameEn: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { templateCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      this.prisma.accountTemplate.findMany({
        where,
        orderBy: [
          { companySize: 'desc' }, // Large first
          { templateCode: 'asc' },
        ],
      }),
      this.prisma.accountTemplate.count({ where }),
    ]);

    const result: ListTemplatesResult = {
      templates: templates as unknown as AccountTemplate[],
      total,
    };

    // Cache result
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);

    return result;
  }

  // ===========================================================================
  // GET TEMPLATE
  // ===========================================================================

  async getTemplate(input: GetTemplateInput): Promise<AccountTemplate> {
    const { templateId } = input;

    const template = await this.prisma.accountTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return template as unknown as AccountTemplate;
  }

  // ===========================================================================
  // PREVIEW TEMPLATE
  // ===========================================================================

  async previewTemplate(input: PreviewTemplateInput): Promise<PreviewTemplateResult> {
    const { templateId } = input;

    // Get template
    const template = await this.prisma.accountTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Get template accounts
    const accounts = await this.prisma.templateAccount.findMany({
      where: { templateId },
      orderBy: { sortOrder: 'asc' },
    });

    // Get existing accounts in organization to check for conflicts
    const existingAccounts = await this.prisma.chartOfAccount.findMany({
      where: { organizationId: this.organizationId },
      select: { accountCode: true },
    });
    const existingCodes = new Set(existingAccounts.map(a => a.accountCode));

    // Find conflicting accounts
    const conflictingAccounts = accounts
      .filter(a => existingCodes.has(a.accountCode))
      .map(a => a.accountCode);

    // Generate summary
    const byClass: Record<number, number> = {};
    const byType: Record<string, number> = {};

    for (const account of accounts) {
      byClass[account.accountClass] = (byClass[account.accountClass] || 0) + 1;
      byType[account.accountType] = (byType[account.accountType] || 0) + 1;
    }

    return {
      template: template as unknown as AccountTemplate,
      accounts: accounts as unknown as TemplateAccount[],
      conflictingAccounts,
      summary: {
        totalAccounts: accounts.length,
        byClass,
        byType,
      },
    };
  }

  // ===========================================================================
  // APPLY TEMPLATE
  // ===========================================================================

  async applyTemplate(input: ApplyTemplateInput): Promise<ApplyTemplateResult> {
    const {
      templateId,
      excludeAccountClasses = [],
      excludeAccountCodes = [],
      accountModifications = [],
      skipExisting = true,
    } = input;

    // Get template
    const template = await this.prisma.accountTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (!template.isActive) {
      throw new Error('Template is not active');
    }

    // Get template accounts
    let templateAccounts = await this.prisma.templateAccount.findMany({
      where: { templateId },
      orderBy: { sortOrder: 'asc' },
    });

    // Apply exclusions
    templateAccounts = templateAccounts.filter(account => {
      // Exclude by class
      if (excludeAccountClasses.includes(account.accountClass)) {
        return false;
      }
      // Exclude by code
      if (excludeAccountCodes.includes(account.accountCode)) {
        return false;
      }
      return true;
    });

    // Get existing accounts to check for conflicts
    const existingAccounts = await this.prisma.chartOfAccount.findMany({
      where: { organizationId: this.organizationId },
      select: { accountCode: true },
    });
    const existingCodes = new Set(existingAccounts.map(a => a.accountCode));

    // Filter out existing accounts if skipExisting is true
    let accountsToCreate = templateAccounts;
    let skippedCount = 0;

    if (skipExisting) {
      accountsToCreate = templateAccounts.filter(account => {
        if (existingCodes.has(account.accountCode)) {
          skippedCount++;
          return false;
        }
        return true;
      });
    }

    // Apply modifications
    const modificationMap = new Map(
      accountModifications.map(m => [m.accountCode, m])
    );

    // Transform template accounts to chart of accounts
    // Note: sortOrder from template is not stored in ChartOfAccount schema
    const chartAccountsData = accountsToCreate.map((account) => {
      const modification = modificationMap.get(account.accountCode);

      return {
        organizationId: this.organizationId,
        accountCode: account.accountCode,
        accountName: modification?.newName || account.accountName,
        accountNameEn: modification?.newNameEn || account.accountNameEn,
        accountType: account.accountType,
        accountClass: account.accountClass,
        normalBalance: account.normalBalance,
        level: getAccountLevel(account.accountCode),
        allowsPosting: account.allowsPosting,
        isSynthetic: !account.allowsPosting,
        taxCategory: account.taxCategory,
        status: 'active' as const,
        createdBy: this.userId,
      };
    });

    // Use transaction to create accounts and record application
    const result = await this.prisma.$transaction(async (tx) => {
      // Create accounts
      const createResult = await tx.chartOfAccount.createMany({
        data: chartAccountsData,
        skipDuplicates: true,
      });

      // Record template application
      const application = await tx.templateApplication.create({
        data: {
          organizationId: this.organizationId,
          templateId,
          appliedBy: this.userId,
          appliedAt: new Date(),
          accountsCreated: createResult.count,
          customizations: {
            excludedClasses: excludeAccountClasses.length > 0 ? excludeAccountClasses : undefined,
            excludedCodes: excludeAccountCodes.length > 0 ? excludeAccountCodes : undefined,
            modifications: accountModifications.length > 0 ? accountModifications : undefined,
          },
        },
      });

      return {
        created: createResult.count,
        applicationId: application.id,
      };
    });

    // Invalidate cache
    await this.invalidateCache();

    // Audit log
    await this.auditLogger.log({
      action: 'template.apply',
      userId: this.userId,
      organizationId: this.organizationId,
      entityType: 'AccountTemplate',
      entityId: templateId,
      details: {
        templateCode: template.templateCode,
        templateName: template.templateName,
        accountsCreated: result.created,
        accountsSkipped: skippedCount,
        excludedClasses: excludeAccountClasses,
        excludedCodes: excludeAccountCodes,
        modifications: accountModifications.length,
      },
    });

    return {
      success: true,
      templateId,
      templateName: template.templateName,
      accountsCreated: result.created,
      accountsSkipped: skippedCount,
      applicationId: result.applicationId,
    };
  }

  // ===========================================================================
  // GET TEMPLATE APPLICATIONS
  // ===========================================================================

  async getTemplateApplications(
    input: GetTemplateApplicationsInput
  ): Promise<TemplateApplicationsResult> {
    const { organizationId = this.organizationId, templateId } = input;

    // Build where clause
    const where: any = {
      organizationId,
    };

    if (templateId) {
      where.templateId = templateId;
    }

    const [applications, total] = await Promise.all([
      this.prisma.templateApplication.findMany({
        where,
        include: {
          template: {
            select: {
              templateCode: true,
              templateName: true,
            },
          },
        },
        orderBy: { appliedAt: 'desc' },
      }),
      this.prisma.templateApplication.count({ where }),
    ]);

    return {
      applications: applications as unknown as Array<
        TemplateApplication & {
          template: Pick<AccountTemplate, 'templateCode' | 'templateName'>;
        }
      >,
      total,
    };
  }
}
