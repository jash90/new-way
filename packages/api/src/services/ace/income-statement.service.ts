/**
 * ACC-014: Income Statement (Rachunek Zysków i Strat - RZiS) Service
 * Generates Polish income statements following Ustawa o rachunkowości
 *
 * TODO: This service requires the following Prisma models to be implemented:
 * - IncomeStatementReport: For persisting generated income statements
 * Currently, persistence methods throw NotImplementedError
 */

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
// import { Decimal } from 'decimal.js'; // Reserved for future calculations
import type {
  GenerateIncomeStatementInput,
  ExportIncomeStatementInput,
  SaveIncomeStatementInput,
  GetIncomeStatementInput,
  ListIncomeStatementsInput,
  DeleteIncomeStatementInput,
  ApproveIncomeStatementInput,
  IncomeStatement,
  IncomeStatementLine,
  RevenueSection,
  OperatingCostsSection,
  OtherOperatingRevenueSection,
  OtherOperatingCostsSection,
  FinancialRevenueSection,
  FinancialCostsSection,
  SavedIncomeStatementReport,
  ExportIncomeStatementResult,
  ListIncomeStatementsResult,
  DeleteIncomeStatementResult,
  GetIncomeStatementResult,
} from '@ksiegowacrm/shared';

interface AuditLogger {
  log: (data: Record<string, unknown>) => void;
}

interface AccountBalance {
  accountCode: string;
  accountName: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  totalDebit: number;
  totalCredit: number;
}

// Error for not implemented features
class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not yet implemented. Requires IncomeStatementReport Prisma model.`);
    this.name = 'NotImplementedError';
  }
}

// Polish income statement line definitions (Wariant porównawczy - Załącznik nr 1)
// This configuration defines account mappings for Polish income statement structure
const _INCOME_STATEMENT_LINES = {
  // A. Przychody netto ze sprzedaży i zrównane z nimi
  'A.I': { pl: 'Przychody netto ze sprzedaży produktów', en: 'Net revenue from sales of products', accounts: ['701', '702', '703', '704'] },
  'A.II': { pl: 'Zmiana stanu produktów', en: 'Change in inventory of products', accounts: ['490'] },
  'A.III': { pl: 'Koszt wytworzenia produktów na własne potrzeby', en: 'Manufacturing cost for internal use', accounts: ['791'] },
  'A.IV': { pl: 'Przychody netto ze sprzedaży towarów i materiałów', en: 'Net revenue from sales of goods and materials', accounts: ['730', '731', '732'] },

  // B. Koszty działalności operacyjnej
  'B.I': { pl: 'Amortyzacja', en: 'Depreciation and amortization', accounts: ['400'] },
  'B.II': { pl: 'Zużycie materiałów i energii', en: 'Materials and energy consumption', accounts: ['401', '402'] },
  'B.III': { pl: 'Usługi obce', en: 'External services', accounts: ['403'] },
  'B.IV': { pl: 'Podatki i opłaty', en: 'Taxes and fees', accounts: ['404'] },
  'B.V': { pl: 'Wynagrodzenia', en: 'Salaries and wages', accounts: ['405'] },
  'B.VI': { pl: 'Ubezpieczenia społeczne i inne świadczenia', en: 'Social security and other benefits', accounts: ['406'] },
  'B.VII': { pl: 'Pozostałe koszty rodzajowe', en: 'Other operating costs by nature', accounts: ['407', '408', '409'] },
  'B.VIII': { pl: 'Wartość sprzedanych towarów i materiałów', en: 'Cost of goods and materials sold', accounts: ['731', '733', '734'] },

  // D. Pozostałe przychody operacyjne
  'D.I': { pl: 'Zysk z tytułu rozchodu niefinansowych aktywów trwałych', en: 'Gain on disposal of non-financial fixed assets', accounts: ['764'] },
  'D.II': { pl: 'Dotacje', en: 'Subsidies', accounts: ['761'] },
  'D.III': { pl: 'Aktualizacja wartości aktywów niefinansowych', en: 'Revaluation of non-financial assets', accounts: ['762'] },
  'D.IV': { pl: 'Inne przychody operacyjne', en: 'Other operating revenue', accounts: ['760', '763', '765'] },

  // E. Pozostałe koszty operacyjne
  'E.I': { pl: 'Strata z tytułu rozchodu niefinansowych aktywów trwałych', en: 'Loss on disposal of non-financial fixed assets', accounts: ['766'] },
  'E.II': { pl: 'Aktualizacja wartości aktywów niefinansowych', en: 'Impairment of non-financial assets', accounts: ['767'] },
  'E.III': { pl: 'Inne koszty operacyjne', en: 'Other operating costs', accounts: ['762', '768', '769'] },

  // G. Przychody finansowe
  'G.I': { pl: 'Dywidendy i udziały w zyskach', en: 'Dividends and profit shares', accounts: ['740'] },
  'G.II': { pl: 'Odsetki', en: 'Interest income', accounts: ['751'] },
  'G.III': { pl: 'Zysk z tytułu rozchodu aktywów finansowych', en: 'Gain on disposal of financial assets', accounts: ['752'] },
  'G.IV': { pl: 'Aktualizacja wartości aktywów finansowych', en: 'Revaluation of financial assets', accounts: ['753'] },
  'G.V': { pl: 'Inne', en: 'Other financial revenue', accounts: ['750', '754', '759'] },

  // H. Koszty finansowe
  'H.I': { pl: 'Odsetki', en: 'Interest expense', accounts: ['755', '756'] },
  'H.II': { pl: 'Strata z tytułu rozchodu aktywów finansowych', en: 'Loss on disposal of financial assets', accounts: ['757'] },
  'H.III': { pl: 'Aktualizacja wartości aktywów finansowych', en: 'Impairment of financial assets', accounts: ['758'] },
  'H.IV': { pl: 'Inne', en: 'Other financial costs', accounts: ['759', '760'] },
} as const;

// Suppress unused warnings - these are reserved for future use
void _INCOME_STATEMENT_LINES;

export class IncomeStatementService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly redis: Redis;

  constructor(
    private prisma: PrismaClient,
    redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string
  ) {
    this.redis = redis; // Stored for future caching implementation
    this._suppressUnusedWarnings();
  }

  // ===========================================================================
  // GENERATE INCOME STATEMENT
  // ===========================================================================

  async generate(input: GenerateIncomeStatementInput): Promise<IncomeStatement> {
    // TODO: Replace with actual Organization model lookup when available
    // For now, use organizationId directly as organization context
    const organization = { id: this.organizationId, name: 'Organization', nip: '' };

    // Get account balances for the period
    const currentBalances = await this.getAccountBalances(
      input.periodStart,
      input.periodEnd,
      input.includeDrafts ?? false
    );

    // Get prior period balances if comparison enabled
    let priorBalances: AccountBalance[] = [];
    if (input.comparisonEnabled && input.comparisonPeriodStart && input.comparisonPeriodEnd) {
      priorBalances = await this.getAccountBalances(
        input.comparisonPeriodStart,
        input.comparisonPeriodEnd,
        input.includeDrafts ?? false
      );
    }

    // Calculate sections
    const revenueSection = this.calculateRevenueSection(currentBalances, priorBalances);
    const operatingCostsSection = this.calculateOperatingCostsSection(currentBalances, priorBalances);
    const salesProfit = this.calculateSalesProfit(revenueSection, operatingCostsSection, priorBalances.length > 0);
    const otherOperatingRevenue = this.calculateOtherOperatingRevenue(currentBalances, priorBalances);
    const otherOperatingCosts = this.calculateOtherOperatingCosts(currentBalances, priorBalances);
    const operatingProfit = this.calculateOperatingProfit(salesProfit, otherOperatingRevenue, otherOperatingCosts, priorBalances.length > 0);
    const financialRevenue = this.calculateFinancialRevenue(currentBalances, priorBalances);
    const financialCosts = this.calculateFinancialCosts(currentBalances, priorBalances);
    const grossProfit = this.calculateGrossProfit(operatingProfit, financialRevenue, financialCosts, priorBalances.length > 0);
    const incomeTax = this.calculateIncomeTax(grossProfit, priorBalances.length > 0);
    const otherDeductions = this.createEmptyLine('K', 'Pozostałe obowiązkowe zmniejszenia zysku', 'Other mandatory profit deductions');
    const netProfit = this.calculateNetProfit(grossProfit, incomeTax, otherDeductions, priorBalances.length > 0);

    const fiscalYear = input.periodEnd.getFullYear();

    const result: IncomeStatement = {
      organizationId: this.organizationId,
      organizationName: organization.name,
      nip: organization.nip ?? '',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      fiscalYear,
      statementVariant: input.statementVariant ?? 'COMPARATIVE',
      comparisonEnabled: input.comparisonEnabled ?? false,
      comparisonPeriodStart: input.comparisonPeriodStart,
      comparisonPeriodEnd: input.comparisonPeriodEnd,
      revenueSection,
      operatingCostsSection,
      salesProfit,
      otherOperatingRevenue,
      otherOperatingCosts,
      operatingProfit,
      financialRevenue,
      financialCosts,
      grossProfit,
      incomeTax,
      otherDeductions,
      netProfit,
      totals: {
        totalRevenue: revenueSection.total.currentAmount,
        totalCosts: operatingCostsSection.total.currentAmount,
        operatingProfit: operatingProfit.currentAmount,
        grossProfit: grossProfit.currentAmount,
        netProfit: netProfit.currentAmount,
        prevTotalRevenue: priorBalances.length > 0 ? revenueSection.total.priorAmount : undefined,
        prevTotalCosts: priorBalances.length > 0 ? operatingCostsSection.total.priorAmount : undefined,
        prevNetProfit: priorBalances.length > 0 ? netProfit.priorAmount : undefined,
      },
      status: 'DRAFT',
      isPreliminary: input.includeDrafts ?? false,
      generatedAt: new Date(),
      generatedBy: this.userId,
    };

    this.auditLogger.log({
      action: 'INCOME_STATEMENT_GENERATED',
      organizationId: this.organizationId,
      userId: this.userId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });

    return result;
  }

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  async export(_input: ExportIncomeStatementInput): Promise<ExportIncomeStatementResult> {
    // TODO: Implement when IncomeStatementReport Prisma model is available
    throw new NotImplementedError('export');
    // Original implementation preserved below for reference:
    /*
    const report = await this.prisma.incomeStatementReport.findUnique({
      where: {
        id: input.reportId,
        organizationId: this.organizationId,
      },
    });

    if (!report) {
      throw new Error('Income statement report not found');
    }

    const language = input.language ?? 'PL';
    const filePrefix = language === 'PL' ? 'RZiS' : 'IncomeStatement';
    const dateStr = new Date().toISOString().split('T')[0];

    let fileName: string;
    let mimeType: string;
    let fileContent: string;

    switch (input.format) {
      case 'EXCEL':
        fileName = `${filePrefix}_${dateStr}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileContent = await this.generateExcelExport(report, input);
        break;
      case 'PDF':
        fileName = `${filePrefix}_${dateStr}.pdf`;
        mimeType = 'application/pdf';
        fileContent = await this.generatePdfExport(report, input);
        break;
      case 'CSV':
        fileName = `${filePrefix}_${dateStr}.csv`;
        mimeType = 'text/csv';
        fileContent = await this.generateCsvExport(report, input);
        break;
      case 'XML':
        fileName = `${filePrefix}_${dateStr}.xml`;
        mimeType = 'application/xml';
        fileContent = await this.generateXmlExport(report, input);
        break;
      default:
        throw new Error(`Unsupported export format: ${input.format}`);
    }

    // Update export tracking
    await this.prisma.incomeStatementReport.update({
      where: { id: input.reportId },
      data: {
        exportedFormats: {
          push: input.format,
        },
        lastExportedAt: new Date(),
      },
    });

    this.auditLogger.log({
      action: 'INCOME_STATEMENT_EXPORTED',
      organizationId: this.organizationId,
      userId: this.userId,
      reportId: input.reportId,
      format: input.format,
    });

    return {
      fileName,
      fileContent,
      mimeType,
      fileSize: Buffer.byteLength(fileContent, 'base64'),
    };
    */
  }

  // ===========================================================================
  // SAVE
  // ===========================================================================

  async save(_input: SaveIncomeStatementInput): Promise<SavedIncomeStatementReport> {
    // TODO: Implement when IncomeStatementReport Prisma model is available
    throw new NotImplementedError('save');
    /*
    const incomeStatement = await this.generate({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      statementVariant: input.statementVariant,
      comparisonEnabled: !!(input.comparisonPeriodStart && input.comparisonPeriodEnd),
      comparisonPeriodStart: input.comparisonPeriodStart,
      comparisonPeriodEnd: input.comparisonPeriodEnd,
      includeDrafts: false,
    });

    const fiscalYear = input.periodEnd.getFullYear();
    const reportNumber = await this.generateReportNumber(fiscalYear);
    const status = input.markAsFinal ? 'FINAL' : 'DRAFT';

    const savedReport = await this.prisma.incomeStatementReport.upsert({
      where: {
        id: 'new', // Force insert
      },
      update: {},
      create: {
        organizationId: this.organizationId,
        reportNumber,
        reportName: input.reportName ?? `RZiS ${fiscalYear}`,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        fiscalYear,
        statementVariant: input.statementVariant ?? 'COMPARATIVE',
        comparisonEnabled: !!(input.comparisonPeriodStart && input.comparisonPeriodEnd),
        comparisonPeriodStart: input.comparisonPeriodStart ?? null,
        comparisonPeriodEnd: input.comparisonPeriodEnd ?? null,
        totalRevenue: incomeStatement.totals.totalRevenue,
        totalCosts: incomeStatement.totals.totalCosts,
        operatingProfit: incomeStatement.totals.operatingProfit,
        grossProfit: incomeStatement.totals.grossProfit,
        netProfit: incomeStatement.totals.netProfit,
        reportData: incomeStatement as unknown as Prisma.JsonObject,
        status,
        isPreliminary: false,
        createdBy: this.userId,
      },
      include: {
        approvedByUser: {
          select: { id: true, name: true, email: true },
        },
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.auditLogger.log({
      action: input.markAsFinal ? 'INCOME_STATEMENT_FINALIZED' : 'INCOME_STATEMENT_SAVED',
      organizationId: this.organizationId,
      userId: this.userId,
      reportId: savedReport.id,
    });

    return this.mapToSavedReport(savedReport);
    */
  }

  // ===========================================================================
  // GET
  // ===========================================================================

  async get(_input: GetIncomeStatementInput): Promise<GetIncomeStatementResult> {
    // TODO: Implement when IncomeStatementReport Prisma model is available
    throw new NotImplementedError('get');
    /*
    const report = await this.prisma.incomeStatementReport.findUnique({
      where: {
        id: input.reportId,
        organizationId: this.organizationId,
      },
      include: {
        approvedByUser: {
          select: { id: true, name: true, email: true },
        },
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!report) {
      throw new Error('Income statement report not found');
    }

    const savedReport = this.mapToSavedReport(report);

    return {
      ...savedReport,
      reportData: report.reportData as unknown as IncomeStatement,
    };
    */
  }

  // ===========================================================================
  // LIST
  // ===========================================================================

  async list(_input: ListIncomeStatementsInput): Promise<ListIncomeStatementsResult> {
    // TODO: Implement when IncomeStatementReport Prisma model is available
    throw new NotImplementedError('list');
    /*
    const where: any = {
      organizationId: this.organizationId,
    };

    if (input.fiscalYear) {
      where.fiscalYear = input.fiscalYear;
    }

    if (input.status) {
      where.status = input.status;
    }

    if (input.statementVariant) {
      where.statementVariant = input.statementVariant;
    }

    if (input.search) {
      where.reportName = {
        contains: input.search,
        mode: 'insensitive',
      };
    }

    const [reports, total] = await Promise.all([
      this.prisma.incomeStatementReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset ?? 0,
        take: input.limit ?? 20,
        include: {
          approvedByUser: {
            select: { id: true, name: true, email: true },
          },
          createdByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.incomeStatementReport.count({ where }),
    ]);

    const _limit = input.limit ?? 20;
    const offset = input.offset ?? 0;

    return {
      reports: reports.map((r: any) => this.mapToSavedReport(r)),
      total,
      hasMore: offset + reports.length < total,
    };
    */
  }

  // ===========================================================================
  // DELETE
  // ===========================================================================

  async delete(_input: DeleteIncomeStatementInput): Promise<DeleteIncomeStatementResult> {
    // TODO: Implement when IncomeStatementReport Prisma model is available
    throw new NotImplementedError('delete');
    /*
    const report = await this.prisma.incomeStatementReport.findUnique({
      where: {
        id: input.reportId,
        organizationId: this.organizationId,
      },
    });

    if (!report) {
      throw new Error('Income statement report not found');
    }

    if (report.status === 'FINAL') {
      throw new Error('Cannot delete finalized income statement');
    }

    if (report.status === 'APPROVED') {
      throw new Error('Cannot delete approved income statement');
    }

    await this.prisma.incomeStatementReport.delete({
      where: { id: input.reportId },
    });

    this.auditLogger.log({
      action: 'INCOME_STATEMENT_DELETED',
      organizationId: this.organizationId,
      userId: this.userId,
      reportId: input.reportId,
      reportName: report.reportName,
    });

    return {
      success: true,
      reportId: input.reportId,
      reportName: report.reportName,
    };
    */
  }

  // ===========================================================================
  // APPROVE
  // ===========================================================================

  async approve(_input: ApproveIncomeStatementInput): Promise<SavedIncomeStatementReport> {
    // TODO: Implement when IncomeStatementReport Prisma model is available
    throw new NotImplementedError('approve');
    /*
    const report = await this.prisma.incomeStatementReport.findUnique({
      where: {
        id: input.reportId,
        organizationId: this.organizationId,
      },
    });

    if (!report) {
      throw new Error('Income statement report not found');
    }

    if (report.status !== 'FINAL') {
      throw new Error('Only final income statements can be approved');
    }

    const updatedReport = await this.prisma.incomeStatementReport.update({
      where: { id: input.reportId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: this.userId,
      },
      include: {
        approvedByUser: {
          select: { id: true, name: true, email: true },
        },
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.auditLogger.log({
      action: 'INCOME_STATEMENT_APPROVED',
      organizationId: this.organizationId,
      userId: this.userId,
      reportId: input.reportId,
    });

    return this.mapToSavedReport(updatedReport);
    */
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private async getAccountBalances(
    periodStart: Date,
    periodEnd: Date,
    includeDrafts: boolean
  ): Promise<AccountBalance[]> {
    const statusFilter = includeDrafts ? ['POSTED', 'DRAFT'] : ['POSTED'];

    const balances = await this.prisma.$queryRaw<AccountBalance[]>`
      SELECT
        coa."accountCode" as "accountCode",
        coa."name" as "accountName",
        coa."normalBalance" as "normalBalance",
        COALESCE(SUM(jl."debitAmount"), 0)::float as "totalDebit",
        COALESCE(SUM(jl."creditAmount"), 0)::float as "totalCredit"
      FROM "ChartOfAccounts" coa
      LEFT JOIN "JournalLine" jl ON jl."accountId" = coa."id"
      LEFT JOIN "JournalEntry" je ON je."id" = jl."entryId"
        AND je."entryDate" >= ${periodStart}
        AND je."entryDate" <= ${periodEnd}
        AND je."status" = ANY(${statusFilter})
        AND je."organizationId" = ${this.organizationId}
      WHERE coa."organizationId" = ${this.organizationId}
        AND coa."accountCode" LIKE '4%' OR coa."accountCode" LIKE '7%'
      GROUP BY coa."id", coa."accountCode", coa."name", coa."normalBalance"
      ORDER BY coa."accountCode"
    `;

    return balances;
  }

  private sumAccountsByPrefix(balances: AccountBalance[], prefixes: string[]): number {
    return balances
      .filter((b) => prefixes.some((p) => b.accountCode.startsWith(p)))
      .reduce((sum, b) => {
        const balance = b.normalBalance === 'CREDIT'
          ? b.totalCredit - b.totalDebit
          : b.totalDebit - b.totalCredit;
        return sum + balance;
      }, 0);
  }

  private createLine(
    lineCode: string,
    lineNamePl: string,
    lineNameEn: string,
    currentAmount: number,
    priorAmount?: number,
    options?: { isHeader?: boolean; isSubtotal?: boolean; isTotal?: boolean; indentLevel?: number }
  ): IncomeStatementLine {
    const variance = priorAmount !== undefined ? currentAmount - priorAmount : undefined;
    const variancePercent = priorAmount !== undefined && priorAmount !== 0
      ? (variance! / Math.abs(priorAmount)) * 100
      : undefined;

    return {
      lineCode,
      lineNamePl,
      lineNameEn,
      indentLevel: options?.indentLevel ?? 0,
      currentAmount,
      priorAmount,
      variance,
      variancePercent,
      isHeader: options?.isHeader ?? false,
      isSubtotal: options?.isSubtotal ?? false,
      isTotal: options?.isTotal ?? false,
    };
  }

  private createEmptyLine(lineCode: string, lineNamePl: string, lineNameEn: string): IncomeStatementLine {
    return this.createLine(lineCode, lineNamePl, lineNameEn, 0, 0);
  }

  private calculateRevenueSection(current: AccountBalance[], prior: AccountBalance[]): RevenueSection {
    const hasPrior = prior.length > 0;

    // A.I - Sales of products (701-704)
    const salesProductsCurrent = this.sumAccountsByPrefix(current, ['701', '702', '703', '704']);
    const salesProductsPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['701', '702', '703', '704']) : undefined;

    // A.II - Change in inventory (490)
    const changeInInventoryCurrent = this.sumAccountsByPrefix(current, ['490']);
    const changeInInventoryPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['490']) : undefined;

    // A.III - Manufacturing for own use (791)
    const manufacturingCurrent = this.sumAccountsByPrefix(current, ['791']);
    const manufacturingPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['791']) : undefined;

    // A.IV - Sales of goods and materials (730-732)
    const salesGoodsCurrent = this.sumAccountsByPrefix(current, ['730', '731', '732']);
    const salesGoodsPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['730', '731', '732']) : undefined;

    const totalCurrent = salesProductsCurrent + changeInInventoryCurrent + manufacturingCurrent + salesGoodsCurrent;
    const totalPrior = hasPrior
      ? (salesProductsPrior ?? 0) + (changeInInventoryPrior ?? 0) + (manufacturingPrior ?? 0) + (salesGoodsPrior ?? 0)
      : undefined;

    return {
      salesProducts: this.createLine('A.I', 'Przychody netto ze sprzedaży produktów', 'Net revenue from sales of products', salesProductsCurrent, salesProductsPrior, { indentLevel: 1 }),
      changeInInventory: this.createLine('A.II', 'Zmiana stanu produktów', 'Change in inventory of products', changeInInventoryCurrent, changeInInventoryPrior, { indentLevel: 1 }),
      manufacturingForOwnUse: this.createLine('A.III', 'Koszt wytworzenia produktów na własne potrzeby', 'Manufacturing cost for internal use', manufacturingCurrent, manufacturingPrior, { indentLevel: 1 }),
      salesGoodsAndMaterials: this.createLine('A.IV', 'Przychody netto ze sprzedaży towarów i materiałów', 'Net revenue from sales of goods and materials', salesGoodsCurrent, salesGoodsPrior, { indentLevel: 1 }),
      total: this.createLine('A', 'Przychody netto ze sprzedaży i zrównane z nimi', 'Net revenue from sales and equivalents', totalCurrent, totalPrior, { isTotal: true }),
    };
  }

  private calculateOperatingCostsSection(current: AccountBalance[], prior: AccountBalance[]): OperatingCostsSection {
    const hasPrior = prior.length > 0;

    const depreciation = this.sumAccountsByPrefix(current, ['400']);
    const materialsEnergy = this.sumAccountsByPrefix(current, ['401', '402']);
    const externalServices = this.sumAccountsByPrefix(current, ['403']);
    const taxesFees = this.sumAccountsByPrefix(current, ['404']);
    const salaries = this.sumAccountsByPrefix(current, ['405']);
    const socialInsurance = this.sumAccountsByPrefix(current, ['406']);
    const otherCosts = this.sumAccountsByPrefix(current, ['407', '408', '409']);
    const costOfGoodsSold = this.sumAccountsByPrefix(current, ['731', '733', '734']);

    const depreciationPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['400']) : undefined;
    const materialsEnergyPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['401', '402']) : undefined;
    const externalServicesPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['403']) : undefined;
    const taxesFeesPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['404']) : undefined;
    const salariesPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['405']) : undefined;
    const socialInsurancePrior = hasPrior ? this.sumAccountsByPrefix(prior, ['406']) : undefined;
    const otherCostsPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['407', '408', '409']) : undefined;
    const costOfGoodsSoldPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['731', '733', '734']) : undefined;

    const totalCurrent = depreciation + materialsEnergy + externalServices + taxesFees + salaries + socialInsurance + otherCosts + costOfGoodsSold;
    const totalPrior = hasPrior
      ? (depreciationPrior ?? 0) + (materialsEnergyPrior ?? 0) + (externalServicesPrior ?? 0) + (taxesFeesPrior ?? 0) + (salariesPrior ?? 0) + (socialInsurancePrior ?? 0) + (otherCostsPrior ?? 0) + (costOfGoodsSoldPrior ?? 0)
      : undefined;

    return {
      depreciation: this.createLine('B.I', 'Amortyzacja', 'Depreciation and amortization', depreciation, depreciationPrior, { indentLevel: 1 }),
      materialsAndEnergy: this.createLine('B.II', 'Zużycie materiałów i energii', 'Materials and energy consumption', materialsEnergy, materialsEnergyPrior, { indentLevel: 1 }),
      externalServices: this.createLine('B.III', 'Usługi obce', 'External services', externalServices, externalServicesPrior, { indentLevel: 1 }),
      taxesAndFees: this.createLine('B.IV', 'Podatki i opłaty', 'Taxes and fees', taxesFees, taxesFeesPrior, { indentLevel: 1 }),
      salaries: this.createLine('B.V', 'Wynagrodzenia', 'Salaries and wages', salaries, salariesPrior, { indentLevel: 1 }),
      socialInsurance: this.createLine('B.VI', 'Ubezpieczenia społeczne i inne świadczenia', 'Social security and other benefits', socialInsurance, socialInsurancePrior, { indentLevel: 1 }),
      otherOperatingCosts: this.createLine('B.VII', 'Pozostałe koszty rodzajowe', 'Other operating costs by nature', otherCosts, otherCostsPrior, { indentLevel: 1 }),
      costOfGoodsSold: this.createLine('B.VIII', 'Wartość sprzedanych towarów i materiałów', 'Cost of goods and materials sold', costOfGoodsSold, costOfGoodsSoldPrior, { indentLevel: 1 }),
      total: this.createLine('B', 'Koszty działalności operacyjnej', 'Operating costs', totalCurrent, totalPrior, { isTotal: true }),
    };
  }

  private calculateSalesProfit(revenue: RevenueSection, costs: OperatingCostsSection, hasPrior: boolean): IncomeStatementLine {
    const current = revenue.total.currentAmount - costs.total.currentAmount;
    const prior = hasPrior ? (revenue.total.priorAmount ?? 0) - (costs.total.priorAmount ?? 0) : undefined;
    return this.createLine('C', 'Zysk (strata) ze sprzedaży', 'Profit (loss) from sales', current, prior, { isTotal: true });
  }

  private calculateOtherOperatingRevenue(current: AccountBalance[], prior: AccountBalance[]): OtherOperatingRevenueSection {
    const hasPrior = prior.length > 0;

    const gainOnDisposal = this.sumAccountsByPrefix(current, ['764']);
    const subsidies = this.sumAccountsByPrefix(current, ['761']);
    const revaluation = this.sumAccountsByPrefix(current, ['762']);
    const other = this.sumAccountsByPrefix(current, ['760', '763', '765']);

    const gainOnDisposalPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['764']) : undefined;
    const subsidiesPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['761']) : undefined;
    const revaluationPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['762']) : undefined;
    const otherPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['760', '763', '765']) : undefined;

    const totalCurrent = gainOnDisposal + subsidies + revaluation + other;
    const totalPrior = hasPrior ? (gainOnDisposalPrior ?? 0) + (subsidiesPrior ?? 0) + (revaluationPrior ?? 0) + (otherPrior ?? 0) : undefined;

    return {
      gainOnDisposal: this.createLine('D.I', 'Zysk z tytułu rozchodu niefinansowych aktywów trwałych', 'Gain on disposal of non-financial fixed assets', gainOnDisposal, gainOnDisposalPrior, { indentLevel: 1 }),
      subsidies: this.createLine('D.II', 'Dotacje', 'Subsidies', subsidies, subsidiesPrior, { indentLevel: 1 }),
      revaluationOfAssets: this.createLine('D.III', 'Aktualizacja wartości aktywów niefinansowych', 'Revaluation of non-financial assets', revaluation, revaluationPrior, { indentLevel: 1 }),
      other: this.createLine('D.IV', 'Inne przychody operacyjne', 'Other operating revenue', other, otherPrior, { indentLevel: 1 }),
      total: this.createLine('D', 'Pozostałe przychody operacyjne', 'Other operating revenue', totalCurrent, totalPrior, { isTotal: true }),
    };
  }

  private calculateOtherOperatingCosts(current: AccountBalance[], prior: AccountBalance[]): OtherOperatingCostsSection {
    const hasPrior = prior.length > 0;

    const lossOnDisposal = this.sumAccountsByPrefix(current, ['766']);
    const revaluation = this.sumAccountsByPrefix(current, ['767']);
    const other = this.sumAccountsByPrefix(current, ['762', '768', '769']);

    const lossOnDisposalPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['766']) : undefined;
    const revaluationPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['767']) : undefined;
    const otherPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['762', '768', '769']) : undefined;

    const totalCurrent = lossOnDisposal + revaluation + other;
    const totalPrior = hasPrior ? (lossOnDisposalPrior ?? 0) + (revaluationPrior ?? 0) + (otherPrior ?? 0) : undefined;

    return {
      lossOnDisposal: this.createLine('E.I', 'Strata z tytułu rozchodu niefinansowych aktywów trwałych', 'Loss on disposal of non-financial fixed assets', lossOnDisposal, lossOnDisposalPrior, { indentLevel: 1 }),
      revaluationOfAssets: this.createLine('E.II', 'Aktualizacja wartości aktywów niefinansowych', 'Impairment of non-financial assets', revaluation, revaluationPrior, { indentLevel: 1 }),
      other: this.createLine('E.III', 'Inne koszty operacyjne', 'Other operating costs', other, otherPrior, { indentLevel: 1 }),
      total: this.createLine('E', 'Pozostałe koszty operacyjne', 'Other operating costs', totalCurrent, totalPrior, { isTotal: true }),
    };
  }

  private calculateOperatingProfit(
    salesProfit: IncomeStatementLine,
    otherRevenue: OtherOperatingRevenueSection,
    otherCosts: OtherOperatingCostsSection,
    hasPrior: boolean
  ): IncomeStatementLine {
    const current = salesProfit.currentAmount + otherRevenue.total.currentAmount - otherCosts.total.currentAmount;
    const prior = hasPrior
      ? (salesProfit.priorAmount ?? 0) + (otherRevenue.total.priorAmount ?? 0) - (otherCosts.total.priorAmount ?? 0)
      : undefined;
    return this.createLine('F', 'Zysk (strata) z działalności operacyjnej', 'Operating profit (loss)', current, prior, { isTotal: true });
  }

  private calculateFinancialRevenue(current: AccountBalance[], prior: AccountBalance[]): FinancialRevenueSection {
    const hasPrior = prior.length > 0;

    const dividends = this.sumAccountsByPrefix(current, ['740']);
    const interest = this.sumAccountsByPrefix(current, ['751']);
    const gainOnDisposal = this.sumAccountsByPrefix(current, ['752']);
    const revaluation = this.sumAccountsByPrefix(current, ['753']);
    const other = this.sumAccountsByPrefix(current, ['750', '754', '759']);

    const dividendsPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['740']) : undefined;
    const interestPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['751']) : undefined;
    const gainOnDisposalPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['752']) : undefined;
    const revaluationPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['753']) : undefined;
    const otherPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['750', '754', '759']) : undefined;

    const totalCurrent = dividends + interest + gainOnDisposal + revaluation + other;
    const totalPrior = hasPrior ? (dividendsPrior ?? 0) + (interestPrior ?? 0) + (gainOnDisposalPrior ?? 0) + (revaluationPrior ?? 0) + (otherPrior ?? 0) : undefined;

    return {
      dividendsAndProfitSharing: this.createLine('G.I', 'Dywidendy i udziały w zyskach', 'Dividends and profit shares', dividends, dividendsPrior, { indentLevel: 1 }),
      interestIncome: this.createLine('G.II', 'Odsetki', 'Interest income', interest, interestPrior, { indentLevel: 1 }),
      gainOnDisposal: this.createLine('G.III', 'Zysk z tytułu rozchodu aktywów finansowych', 'Gain on disposal of financial assets', gainOnDisposal, gainOnDisposalPrior, { indentLevel: 1 }),
      revaluationOfInvestments: this.createLine('G.IV', 'Aktualizacja wartości aktywów finansowych', 'Revaluation of financial assets', revaluation, revaluationPrior, { indentLevel: 1 }),
      other: this.createLine('G.V', 'Inne', 'Other financial revenue', other, otherPrior, { indentLevel: 1 }),
      total: this.createLine('G', 'Przychody finansowe', 'Financial revenue', totalCurrent, totalPrior, { isTotal: true }),
    };
  }

  private calculateFinancialCosts(current: AccountBalance[], prior: AccountBalance[]): FinancialCostsSection {
    const hasPrior = prior.length > 0;

    const interest = this.sumAccountsByPrefix(current, ['755', '756']);
    const lossOnDisposal = this.sumAccountsByPrefix(current, ['757']);
    const revaluation = this.sumAccountsByPrefix(current, ['758']);
    const other = this.sumAccountsByPrefix(current, ['759', '760']);

    const interestPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['755', '756']) : undefined;
    const lossOnDisposalPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['757']) : undefined;
    const revaluationPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['758']) : undefined;
    const otherPrior = hasPrior ? this.sumAccountsByPrefix(prior, ['759', '760']) : undefined;

    const totalCurrent = interest + lossOnDisposal + revaluation + other;
    const totalPrior = hasPrior ? (interestPrior ?? 0) + (lossOnDisposalPrior ?? 0) + (revaluationPrior ?? 0) + (otherPrior ?? 0) : undefined;

    return {
      interestExpense: this.createLine('H.I', 'Odsetki', 'Interest expense', interest, interestPrior, { indentLevel: 1 }),
      lossOnDisposal: this.createLine('H.II', 'Strata z tytułu rozchodu aktywów finansowych', 'Loss on disposal of financial assets', lossOnDisposal, lossOnDisposalPrior, { indentLevel: 1 }),
      revaluationOfInvestments: this.createLine('H.III', 'Aktualizacja wartości aktywów finansowych', 'Impairment of financial assets', revaluation, revaluationPrior, { indentLevel: 1 }),
      other: this.createLine('H.IV', 'Inne', 'Other financial costs', other, otherPrior, { indentLevel: 1 }),
      total: this.createLine('H', 'Koszty finansowe', 'Financial costs', totalCurrent, totalPrior, { isTotal: true }),
    };
  }

  private calculateGrossProfit(
    operatingProfit: IncomeStatementLine,
    financialRevenue: FinancialRevenueSection,
    financialCosts: FinancialCostsSection,
    hasPrior: boolean
  ): IncomeStatementLine {
    const current = operatingProfit.currentAmount + financialRevenue.total.currentAmount - financialCosts.total.currentAmount;
    const prior = hasPrior
      ? (operatingProfit.priorAmount ?? 0) + (financialRevenue.total.priorAmount ?? 0) - (financialCosts.total.priorAmount ?? 0)
      : undefined;
    return this.createLine('I', 'Zysk (strata) brutto', 'Gross profit (loss)', current, prior, { isTotal: true });
  }

  private calculateIncomeTax(grossProfit: IncomeStatementLine, hasPrior: boolean): IncomeStatementLine {
    // Polish CIT rate is 19% (or 9% for small taxpayers)
    const taxRate = 0.19;
    const current = grossProfit.currentAmount > 0 ? grossProfit.currentAmount * taxRate : 0;
    const prior = hasPrior && (grossProfit.priorAmount ?? 0) > 0 ? (grossProfit.priorAmount ?? 0) * taxRate : undefined;
    return this.createLine('J', 'Podatek dochodowy', 'Income tax', current, prior, { isTotal: true });
  }

  private calculateNetProfit(
    grossProfit: IncomeStatementLine,
    incomeTax: IncomeStatementLine,
    otherDeductions: IncomeStatementLine,
    hasPrior: boolean
  ): IncomeStatementLine {
    const current = grossProfit.currentAmount - incomeTax.currentAmount - otherDeductions.currentAmount;
    const prior = hasPrior
      ? (grossProfit.priorAmount ?? 0) - (incomeTax.priorAmount ?? 0) - (otherDeductions.priorAmount ?? 0)
      : undefined;
    return this.createLine('L', 'Zysk (strata) netto', 'Net profit (loss)', current, prior, { isTotal: true });
  }

  private async generateReportNumber(fiscalYear: number): Promise<string> {
    // TODO: Implement when IncomeStatementReport Prisma model is available
    // For now, generate a temporary number
    const timestamp = Date.now().toString(36);
    return `RZiS-${fiscalYear}-${timestamp}`;
    /*
    const count = await this.prisma.incomeStatementReport.count({
      where: {
        organizationId: this.organizationId,
        fiscalYear,
      },
    });
    return `RZiS-${fiscalYear}-${String(count + 1).padStart(3, '0')}`;
    */
  }

  private mapToSavedReport(report: any): SavedIncomeStatementReport {
    return {
      id: report.id,
      organizationId: report.organizationId,
      reportNumber: report.reportNumber,
      reportName: report.reportName,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      fiscalYear: report.fiscalYear,
      statementVariant: report.statementVariant,
      comparisonEnabled: report.comparisonEnabled,
      comparisonPeriodStart: report.comparisonPeriodStart,
      comparisonPeriodEnd: report.comparisonPeriodEnd,
      totalRevenue: report.totalRevenue,
      totalCosts: report.totalCosts,
      operatingProfit: report.operatingProfit,
      grossProfit: report.grossProfit,
      netProfit: report.netProfit,
      status: report.status,
      isPreliminary: report.isPreliminary,
      approvedAt: report.approvedAt,
      approvedBy: report.approvedByUser ?? null,
      exportedFormats: report.exportedFormats ?? [],
      lastExportedAt: report.lastExportedAt,
      createdAt: report.createdAt,
      createdBy: report.createdByUser ?? null,
    };
  }

  // Export helper methods (simplified implementations)
  private async generateExcelExport(_report: any, _input: ExportIncomeStatementInput): Promise<string> {
    // In production, use ExcelJS or similar library
    return Buffer.from('Excel content placeholder').toString('base64');
  }

  private async generatePdfExport(_report: any, _input: ExportIncomeStatementInput): Promise<string> {
    // In production, use PDFKit or similar library
    return Buffer.from('PDF content placeholder').toString('base64');
  }

  private async generateCsvExport(_report: any, _input: ExportIncomeStatementInput): Promise<string> {
    // Generate CSV content
    const lines = ['Line Code,Line Name,Current Amount,Prior Amount'];
    return Buffer.from(lines.join('\n')).toString('base64');
  }

  private async generateXmlExport(_report: any, _input: ExportIncomeStatementInput): Promise<string> {
    // Generate XML content following Polish Ministry format
    const xml = '<?xml version="1.0" encoding="UTF-8"?><RZiS></RZiS>';
    return Buffer.from(xml).toString('base64');
  }

  // Suppress unused warnings - these methods are reserved for future use when IncomeStatementReport Prisma model is available
  private _suppressUnusedWarnings(): void {
    void this.generateReportNumber;
    void this.mapToSavedReport;
    void this.generateExcelExport;
    void this.generatePdfExport;
    void this.generateCsvExport;
    void this.generateXmlExport;
    void this.redis;
  }
}
