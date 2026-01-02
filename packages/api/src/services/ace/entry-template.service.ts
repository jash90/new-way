/**
 * ACC-009: Entry Template Service
 * Handles journal entry template operations including CRUD and generation
 *
 * NOTE: This is a simplified implementation working with the current Prisma schema.
 * The schema uses a JSON-based approach (linesTemplate) rather than separate models
 * for lines, variables, categories, favorites, and versions.
 *
 * Features requiring schema extension (marked as TODO):
 * - Template categories (templateCategory model)
 * - Template favorites (templateFavorite model)
 * - Template versioning (templateVersion model)
 * - Separate line/variable models (templateLine, templateVariable models)
 */

import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import { Decimal } from 'decimal.js';
import type {
  CreateEntryTemplateInput,
  CreateTemplateFromEntryInput,
  UpdateEntryTemplateInput,
  GetEntryTemplateInput,
  ArchiveEntryTemplateInput,
  RestoreEntryTemplateInput,
  DeleteEntryTemplateInput,
  GenerateEntryFromTemplateInput,
  BatchGenerateEntriesInput,
  ListEntryTemplatesInput,
  ToggleTemplateFavoriteInput,
  GetTemplateVersionsInput,
  CreateTemplateCategoryInput,
  UpdateTemplateCategoryInput,
  DeleteTemplateCategoryInput,
} from '@ksiegowacrm/shared';

// Suppress unused imports - kept for future implementation
void Decimal;

// Type for template line configuration stored in linesTemplate JSON
interface TemplateLineConfig {
  lineNumber: number;
  accountId?: string;
  accountPattern?: string;
  description?: string;
  amountType?: 'FIXED' | 'VARIABLE' | 'FORMULA';
  fixedDebitAmount?: number;
  fixedCreditAmount?: number;
  variableName?: string;
  formula?: string;
  currencyCode?: string;
  displayOrder?: number;
}

// Type for template with parsed lines
interface TemplateWithLines {
  id: string;
  organizationId: string;
  templateCode: string;
  templateName: string;
  description: string | null;
  linesTemplate: TemplateLineConfig[];
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export class EntryTemplateService {
  constructor(
    private prisma: PrismaClient,
    // Redis reserved for future caching implementation
    _redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string
  ) {
    // Suppress unused parameter warning - Redis will be used for caching
    void _redis;
  }

  // ===========================================================================
  // TEMPLATE CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create a new entry template
   */
  async createTemplate(input: CreateEntryTemplateInput) {
    // Convert lines to JSON format for storage
    const linesTemplate: TemplateLineConfig[] = input.lines.map((line, index) => ({
      lineNumber: index + 1,
      accountId: line.accountId,
      accountPattern: line.accountPattern,
      description: line.description,
      amountType: line.amountType,
      fixedDebitAmount: line.fixedDebitAmount,
      fixedCreditAmount: line.fixedCreditAmount,
      variableName: line.variableName,
      formula: line.formula,
      currencyCode: line.currencyCode,
      displayOrder: line.displayOrder ?? index,
    }));

    // Validate accounts exist
    const accountIds = linesTemplate
      .filter((line) => line.accountId)
      .map((line) => line.accountId!);

    if (accountIds.length > 0) {
      const accounts = await this.prisma.chartOfAccount.findMany({
        where: {
          id: { in: accountIds },
          organizationId: this.organizationId,
          status: 'active',
        },
      });

      const foundIds = new Set(accounts.map((a) => a.id));
      const missingIds = accountIds.filter((id) => !foundIds.has(id));

      if (missingIds.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid account IDs: ${missingIds.join(', ')}`,
        });
      }
    }

    // Generate template code
    const templateCount = await this.prisma.entryTemplate.count({
      where: { organizationId: this.organizationId },
    });
    const templateCode = `TPL-${String(templateCount + 1).padStart(3, '0')}`;

    // Create template
    const template = await this.prisma.entryTemplate.create({
      data: {
        organizationId: this.organizationId,
        templateCode,
        templateName: input.templateName,
        description: input.description ?? null,
        linesTemplate: linesTemplate as unknown as object,
        isActive: true,
        createdBy: this.userId,
      },
    });

    await this.auditLogger.log({
      action: 'TEMPLATE_CREATED',
      entityType: 'EntryTemplate',
      entityId: template.id,
      details: { templateCode, name: input.templateName },
    });

    return this.mapTemplateToResponse(template);
  }

  /**
   * Get a template by ID
   */
  async getTemplate(input: GetEntryTemplateInput) {
    const template = await this.prisma.entryTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: this.organizationId,
      },
    });

    if (!template) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    return this.mapTemplateToResponse(template);
  }

  /**
   * Update an existing template
   */
  async updateTemplate(input: UpdateEntryTemplateInput) {
    const existing = await this.prisma.entryTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (input.templateName !== undefined) {
      updateData.templateName = input.templateName;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    // Update lines if provided
    if (input.lines !== undefined) {
      const linesTemplate: TemplateLineConfig[] = input.lines.map((line, index) => ({
        lineNumber: index + 1,
        accountId: line.accountId,
        accountPattern: line.accountPattern,
        description: line.description,
        amountType: line.amountType,
        fixedDebitAmount: line.fixedDebitAmount,
        fixedCreditAmount: line.fixedCreditAmount,
        variableName: line.variableName,
        formula: line.formula,
        currencyCode: line.currencyCode,
        displayOrder: line.displayOrder ?? index,
      }));
      updateData.linesTemplate = linesTemplate as unknown as object;
    }

    const updated = await this.prisma.entryTemplate.update({
      where: { id: input.templateId },
      data: updateData,
    });

    await this.auditLogger.log({
      action: 'TEMPLATE_UPDATED',
      entityType: 'EntryTemplate',
      entityId: input.templateId,
      details: { templateCode: updated.templateCode },
    });

    return this.mapTemplateToResponse(updated);
  }

  /**
   * Archive a template (set inactive)
   */
  async archiveTemplate(input: ArchiveEntryTemplateInput) {
    const existing = await this.prisma.entryTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    if (!existing.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Template is already archived',
      });
    }

    const updated = await this.prisma.entryTemplate.update({
      where: { id: input.templateId },
      data: { isActive: false },
    });

    await this.auditLogger.log({
      action: 'TEMPLATE_ARCHIVED',
      entityType: 'EntryTemplate',
      entityId: input.templateId,
      details: { templateCode: updated.templateCode },
    });

    return { success: true, template: this.mapTemplateToResponse(updated) };
  }

  /**
   * Restore an archived template
   */
  async restoreTemplate(input: RestoreEntryTemplateInput) {
    const existing = await this.prisma.entryTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    if (existing.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Template is not archived',
      });
    }

    const updated = await this.prisma.entryTemplate.update({
      where: { id: input.templateId },
      data: { isActive: true },
    });

    await this.auditLogger.log({
      action: 'TEMPLATE_RESTORED',
      entityType: 'EntryTemplate',
      entityId: input.templateId,
      details: { templateCode: updated.templateCode },
    });

    return { success: true, template: this.mapTemplateToResponse(updated) };
  }

  /**
   * Delete a template permanently
   */
  async deleteTemplate(input: DeleteEntryTemplateInput) {
    const existing = await this.prisma.entryTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    await this.prisma.entryTemplate.delete({
      where: { id: input.templateId },
    });

    await this.auditLogger.log({
      action: 'TEMPLATE_DELETED',
      entityType: 'EntryTemplate',
      entityId: input.templateId,
      details: { templateCode: existing.templateCode },
    });

    return { success: true, templateId: input.templateId };
  }

  /**
   * List templates with filtering and pagination
   */
  async listTemplates(input: ListEntryTemplatesInput) {
    const where: Record<string, unknown> = {
      organizationId: this.organizationId,
    };

    if (input.search) {
      where.OR = [
        { templateName: { contains: input.search, mode: 'insensitive' } },
        { templateCode: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    if (input.status === 'ACTIVE') {
      where.isActive = true;
    } else if (input.status === 'ARCHIVED') {
      where.isActive = false;
    }

    const [templates, total] = await Promise.all([
      this.prisma.entryTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset ?? 0,
        take: input.limit ?? 20,
      }),
      this.prisma.entryTemplate.count({ where }),
    ]);

    return {
      templates: templates.map((t) => this.mapTemplateToResponse(t)),
      total,
      hasMore: (input.offset ?? 0) + templates.length < total,
    };
  }

  /**
   * Toggle template as favorite for the current user
   * TODO: Requires templateFavorite model in schema
   */
  async toggleFavorite(_input: ToggleTemplateFavoriteInput) {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Template favorites feature requires schema extension (templateFavorite model)',
    });
  }

  /**
   * Get template version history
   * TODO: Requires templateVersion model in schema
   */
  async getTemplateVersions(_input: GetTemplateVersionsInput) {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Template versioning feature requires schema extension (templateVersion model)',
    });
  }

  /**
   * Generate a journal entry from a template
   */
  async generateEntryFromTemplate(input: GenerateEntryFromTemplateInput) {
    const template = await this.prisma.entryTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: this.organizationId,
        isActive: true,
      },
    });

    if (!template) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Template not found or inactive',
      });
    }

    // Get current accounting period
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        fiscalYear: {
          organizationId: this.organizationId,
        },
        status: 'open',
        startDate: { lte: new Date(input.entryDate) },
        endDate: { gte: new Date(input.entryDate) },
      },
    });

    if (!period) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No open accounting period found for the specified date',
      });
    }

    // Parse lines from template
    const linesTemplate = template.linesTemplate as unknown as TemplateLineConfig[];

    // Validate and apply variable values
    const entryLines = linesTemplate.map((line, index) => {
      const variableValues = input.variableValues ?? {};

      // Simple formula evaluation (replace variables)
      const evaluateFormula = (formula?: string): number => {
        if (!formula) return 0;
        let result = formula;
        for (const [key, value] of Object.entries(variableValues)) {
          result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        try {
          // eslint-disable-next-line no-eval
          return eval(result) || 0;
        } catch {
          return 0;
        }
      };

      // Calculate amounts based on amountType
      let debitAmount = 0;
      let creditAmount = 0;

      if (line.amountType === 'FIXED') {
        debitAmount = line.fixedDebitAmount ?? 0;
        creditAmount = line.fixedCreditAmount ?? 0;
      } else if (line.amountType === 'FORMULA' || line.amountType === 'VARIABLE') {
        // For formula/variable, use formula field and apply to debit or credit based on which has fixed amount
        const formulaValue = evaluateFormula(line.formula);
        if ((line.fixedDebitAmount ?? 0) > 0 || line.formula?.includes('debit')) {
          debitAmount = formulaValue;
        } else {
          creditAmount = formulaValue;
        }
      }

      // Check for override amounts
      const override = input.overrideAmounts?.find((o) => o.lineNumber === line.lineNumber);
      if (override) {
        if (override.debitAmount !== undefined) debitAmount = override.debitAmount;
        if (override.creditAmount !== undefined) creditAmount = override.creditAmount;
      }

      return {
        lineNumber: index + 1,
        accountId: line.accountId ?? '',
        description: line.description ?? '',
        debitAmount,
        creditAmount,
      };
    });

    // Generate entry number
    const entryNumber = await this.generateEntryNumber('JE', period.id);

    // Create journal entry
    const entry = await this.prisma.journalEntry.create({
      data: {
        organizationId: this.organizationId,
        entryNumber,
        entryDate: new Date(input.entryDate),
        periodId: period.id,
        fiscalYearId: period.fiscalYearId,
        entryType: 'STANDARD',
        description: input.customDescription ?? template.templateName,
        status: 'DRAFT',
        totalDebit: entryLines.reduce((sum, l) => sum + l.debitAmount, 0),
        totalCredit: entryLines.reduce((sum, l) => sum + l.creditAmount, 0),
        createdBy: this.userId,
        lines: {
          create: entryLines.map((line) => ({
            lineNumber: line.lineNumber,
            accountId: line.accountId,
            description: line.description,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
          })),
        },
      },
      include: {
        lines: true,
      },
    });

    await this.auditLogger.log({
      action: 'ENTRY_GENERATED_FROM_TEMPLATE',
      entityType: 'JournalEntry',
      entityId: entry.id,
      details: { templateId: input.templateId, templateCode: template.templateCode },
    });

    return { success: true, entry };
  }

  /**
   * Generate multiple entries from a template (batch)
   */
  async batchGenerateEntries(input: BatchGenerateEntriesInput) {
    const results = [];

    for (const item of input.entries) {
      try {
        const result = await this.generateEntryFromTemplate({
          templateId: input.templateId,
          entryDate: item.entryDate,
          customDescription: item.customDescription,
          variableValues: item.variableValues,
        });
        results.push({ success: true, entryId: result.entry.id, date: item.entryDate });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          date: item.entryDate,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      total: results.length,
      successful: successCount,
      failed: failureCount,
      results,
    };
  }

  /**
   * Create a template from an existing journal entry
   */
  async createTemplateFromEntry(input: CreateTemplateFromEntryInput) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
      include: {
        lines: true,
      },
    });

    if (!entry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      });
    }

    // Convert entry lines to template format
    // Use Decimal comparison for amounts
    const linesTemplate: TemplateLineConfig[] = entry.lines.map((line) => {
      const debitAmount = new Decimal(line.debitAmount.toString());
      const creditAmount = new Decimal(line.creditAmount.toString());

      return {
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        description: line.description ?? undefined,
        amountType: 'VARIABLE' as const,
        // Store amounts as fixed values initially
        fixedDebitAmount: debitAmount.greaterThan(0) ? debitAmount.toNumber() : 0,
        fixedCreditAmount: creditAmount.greaterThan(0) ? creditAmount.toNumber() : 0,
        // Use formula for variable amounts
        formula: debitAmount.greaterThan(0)
          ? `{amount_${line.lineNumber}_debit}`
          : creditAmount.greaterThan(0)
            ? `{amount_${line.lineNumber}_credit}`
            : undefined,
        currencyCode: 'PLN',
        displayOrder: line.lineNumber,
      };
    });

    // Generate template code
    const templateCount = await this.prisma.entryTemplate.count({
      where: { organizationId: this.organizationId },
    });
    const templateCode = `TPL-${String(templateCount + 1).padStart(3, '0')}`;

    const template = await this.prisma.entryTemplate.create({
      data: {
        organizationId: this.organizationId,
        templateCode,
        templateName: input.templateName,
        description: input.description ?? `Created from entry ${entry.entryNumber}`,
        linesTemplate: linesTemplate as unknown as object,
        isActive: true,
        createdBy: this.userId,
      },
    });

    await this.auditLogger.log({
      action: 'TEMPLATE_CREATED_FROM_ENTRY',
      entityType: 'EntryTemplate',
      entityId: template.id,
      details: { sourceEntryId: input.entryId, templateCode },
    });

    return this.mapTemplateToResponse(template);
  }

  // ===========================================================================
  // CATEGORY OPERATIONS
  // TODO: Requires templateCategory model in schema
  // ===========================================================================

  async createCategory(_input: CreateTemplateCategoryInput) {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Template categories feature requires schema extension (templateCategory model)',
    });
  }

  async updateCategory(_input: UpdateTemplateCategoryInput) {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Template categories feature requires schema extension (templateCategory model)',
    });
  }

  async deleteCategory(_input: DeleteTemplateCategoryInput) {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Template categories feature requires schema extension (templateCategory model)',
    });
  }

  async listCategories() {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Template categories feature requires schema extension (templateCategory model)',
    });
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private async generateEntryNumber(prefix: string, periodId: string): Promise<string> {
    // Get or create sequence for this period and entry type
    const sequenceKey = `${this.organizationId}_${periodId}_${prefix}`;

    // Use a simple counter approach - find max entry number for this period
    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: {
        organizationId: this.organizationId,
        periodId,
        entryNumber: { startsWith: prefix },
      },
      orderBy: { entryNumber: 'desc' },
    });

    let nextNumber = 1;
    if (lastEntry) {
      const match = lastEntry.entryNumber.match(/(\d+)$/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Suppress unused variable warning
    void sequenceKey;

    return `${prefix}-${String(nextNumber).padStart(6, '0')}`;
  }

  private mapTemplateToResponse(template: {
    id: string;
    organizationId: string;
    templateCode: string;
    templateName: string;
    description: string | null;
    linesTemplate: unknown;
    isActive: boolean;
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
  }): TemplateWithLines {
    return {
      id: template.id,
      organizationId: template.organizationId,
      templateCode: template.templateCode,
      templateName: template.templateName,
      description: template.description,
      linesTemplate: template.linesTemplate as TemplateLineConfig[],
      isActive: template.isActive,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
      updatedAt: template.updatedAt,
    };
  }
}
