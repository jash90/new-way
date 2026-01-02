/**
 * ACC-013: Balance Sheet Service
 * Provides Polish standard balance sheet (Bilans) generation following Ustawa o rachunkowości
 * Features:
 * - Full balance sheet generation with all sections (Assets, Equity, Liabilities)
 * - Comparative analysis with prior period
 * - Export to multiple formats (Excel, PDF, CSV, XML)
 * - Save and manage balance sheet reports
 */

import { Decimal } from 'decimal.js';
import type {
  GenerateBalanceSheetInput,
  ExportBalanceSheetInput,
  SaveBalanceSheetInput,
  GetBalanceSheetInput,
  ListBalanceSheetInput,
  DeleteBalanceSheetInput,
  BalanceSheetResult,
  ExportBalanceSheetResult,
  SaveBalanceSheetResult,
  GetBalanceSheetResult,
  ListBalanceSheetResult,
  DeleteBalanceSheetResult,
  BalanceSheetLine,
  FixedAssetsSection,
  CurrentAssetsSection,
  AssetsSection,
  EquitySection,
  LiabilitiesSection,
} from '@ksiegowacrm/shared';

type PrismaClient = any;
type RedisClient = any;
type AuditLogger = any;

/**
 * Polish Chart of Accounts mapping to Balance Sheet lines
 * Based on Załącznik nr 1 do Ustawy o rachunkowości
 */
const ACCOUNT_MAPPING = {
  // Fixed Assets (Aktywa trwałe)
  intangibleAssets: ['020', '021', '022', '023', '024', '025', '026', '027', '028', '029'],
  tangibleAssets: ['010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '080', '081', '082', '083'],
  longTermReceivables: ['240', '241', '242', '243', '244', '245'],
  longTermInvestments: ['030', '031', '032', '033', '034', '035', '036', '037', '038', '039', '040', '041'],
  longTermPrepayments: ['640', '641', '642', '643', '644', '645'],

  // Current Assets (Aktywa obrotowe)
  inventory: ['310', '311', '312', '313', '314', '315', '316', '330', '331', '332', '333', '340', '341', '342', '343', '344', '345'],
  shortTermReceivables: ['200', '201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212', '213', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239'],
  shortTermInvestments: ['140', '141', '142', '143', '144', '145', '146', '147', '148', '149', '150', '151', '152', '153', '154', '155', '156', '157', '158', '159'],
  cash: ['100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '130', '131', '132', '133', '134', '135', '136', '137', '138', '139'],
  shortTermPrepayments: ['650', '651', '652', '653', '654', '655'],

  // Equity (Kapitał własny)
  shareCapital: ['800', '801', '802', '803'],
  supplementaryCapital: ['810', '811', '812', '813', '814', '815'],
  revaluationReserve: ['820', '821', '822', '823'],
  otherReserves: ['830', '831', '832', '833', '834', '835'],
  priorYearsProfitLoss: ['840', '841', '842', '843'],
  currentYearProfitLoss: ['860', '870'],

  // Liabilities (Zobowiązania i rezerwy)
  provisions: ['831', '832', '833', '834', '835', '836', '837', '838', '839'],
  longTermLiabilities: ['245', '246', '247', '248', '249', '250', '251', '252', '253', '254', '255'],
  shortTermLiabilities: ['200', '201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212', '213', '214', '215', '216', '217', '218', '219', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239'],
  accruals: ['650', '651', '652', '653', '654', '655', '656', '657', '658', '659', '660', '661', '662', '663', '664', '665'],
};

export class BalanceSheetService {
  constructor(
    private readonly prisma: PrismaClient,
    // Redis reserved for future caching implementation
    _redis: RedisClient,
    private readonly auditLogger: AuditLogger,
    private readonly userId: string,
    private readonly organizationId: string
  ) {
    // Suppress unused parameter warning - Redis will be used for caching
    void _redis;
  }

  // ===========================================================================
  // GENERATE BALANCE SHEET
  // ===========================================================================

  /**
   * Generate balance sheet as of a specific date
   * Follows Polish Bilans format (Załącznik nr 1 do Ustawy o rachunkowości)
   */
  async generate(input: GenerateBalanceSheetInput): Promise<BalanceSheetResult> {
    const reportDate = new Date(input.reportDate);
    const comparativeDate = input.comparativeDate ? new Date(input.comparativeDate) : undefined;

    // Get organization info
    const organization = await this.prisma.organization.findUnique({
      where: { id: this.organizationId },
      select: { id: true, name: true, nip: true },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get all accounts
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: {
        organizationId: this.organizationId,
        isActive: true,
      },
      orderBy: { accountCode: 'asc' },
    });

    // Get current period balances
    const currentBalances = await this.getAccountBalances(
      accounts.map((a: any) => a.id),
      reportDate,
      input.includeDrafts
    );

    // Get prior period balances if comparative
    const priorBalances = comparativeDate
      ? await this.getAccountBalances(
          accounts.map((a: any) => a.id),
          comparativeDate,
          input.includeDrafts
        )
      : undefined;

    // Build balance sheet sections
    const assets = this.buildAssetsSection(accounts, currentBalances, priorBalances, input.excludeZeroBalances);
    const equity = this.buildEquitySection(accounts, currentBalances, priorBalances, input.excludeZeroBalances);
    const liabilities = this.buildLiabilitiesSection(accounts, currentBalances, priorBalances, input.excludeZeroBalances);

    // Calculate total equity and liabilities
    const totalEquityAndLiabilities = this.createTotalLine(
      'TOTAL_EQUITY_LIABILITIES',
      'Pasywa razem',
      'Total Equity and Liabilities',
      'EQUITY',
      new Decimal(equity.totalEquity.currentPeriod).plus(liabilities.totalLiabilities.currentPeriod).toNumber(),
      priorBalances
        ? new Decimal(equity.totalEquity.priorPeriod || 0).plus(liabilities.totalLiabilities.priorPeriod || 0).toNumber()
        : undefined
    );

    // Check if balanced
    const totalAssetsValue = new Decimal(assets.totalAssets.currentPeriod);
    const totalEquityLiabilitiesValue = new Decimal(totalEquityAndLiabilities.currentPeriod);
    const balanceDifference = totalAssetsValue.minus(totalEquityLiabilitiesValue).toNumber();
    const isBalanced = Math.abs(balanceDifference) < 0.01;

    await this.auditLogger.log({
      action: 'BALANCE_SHEET_GENERATED',
      entityType: 'balance_sheet',
      entityId: null,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        reportDate: reportDate.toISOString(),
        comparativeDate: comparativeDate?.toISOString(),
        totalAssets: assets.totalAssets.currentPeriod,
        totalEquity: equity.totalEquity.currentPeriod,
        totalLiabilities: liabilities.totalLiabilities.currentPeriod,
        isBalanced,
        balanceDifference,
      },
    });

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      nip: organization.nip,
      reportDate,
      comparativeDate,
      assets,
      equity,
      liabilities,
      totalEquityAndLiabilities,
      isBalanced,
      balanceDifference,
      generatedAt: new Date(),
      generatedBy: this.userId,
    };
  }

  // ===========================================================================
  // EXPORT BALANCE SHEET
  // ===========================================================================

  /**
   * Export balance sheet to various formats
   */
  async export(input: ExportBalanceSheetInput): Promise<ExportBalanceSheetResult> {
    // Generate balance sheet first
    const bs = await this.generate({
      reportDate: input.reportDate,
      comparativeDate: input.comparativeDate,
      includeDrafts: false,
      excludeZeroBalances: true,
      detailLevel: 'DETAILED',
    });

    let fileContent: string;
    let mimeType: string;
    let fileName: string;

    const dateStr = new Date(input.reportDate).toISOString().split('T')[0];
    const langSuffix = input.language === 'EN' ? '_en' : '';

    switch (input.format) {
      case 'EXCEL':
        fileContent = await this.generateExcel(bs, input);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = `bilans_${dateStr}${langSuffix}.xlsx`;
        break;

      case 'PDF':
        fileContent = await this.generatePDF(bs, input);
        mimeType = 'application/pdf';
        fileName = `bilans_${dateStr}${langSuffix}.pdf`;
        break;

      case 'CSV':
        fileContent = this.generateCSV(bs, input.language);
        mimeType = 'text/csv';
        fileName = `bilans_${dateStr}${langSuffix}.csv`;
        break;

      case 'XML':
        fileContent = this.generateXML(bs, input);
        mimeType = 'application/xml';
        fileName = `bilans_${dateStr}${langSuffix}.xml`;
        break;

      default:
        throw new Error(`Unsupported export format: ${input.format}`);
    }

    await this.auditLogger.log({
      action: 'BALANCE_SHEET_EXPORTED',
      entityType: 'balance_sheet',
      entityId: null,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        reportDate: input.reportDate,
        format: input.format,
        language: input.language,
        fileName,
      },
    });

    return {
      fileName,
      fileContent,
      mimeType,
      fileSize: Buffer.from(fileContent, 'base64').length,
    };
  }

  // ===========================================================================
  // SAVE BALANCE SHEET
  // ===========================================================================

  /**
   * Save a generated balance sheet report
   */
  async save(input: SaveBalanceSheetInput): Promise<SaveBalanceSheetResult> {
    const reportDate = new Date(input.reportDate);
    const comparativeDate = input.comparativeDate ? new Date(input.comparativeDate) : null;

    // Generate balance sheet to get values and validate
    const bs = await this.generate({
      reportDate: input.reportDate,
      comparativeDate: input.comparativeDate,
      includeDrafts: false,
      excludeZeroBalances: true,
      detailLevel: 'DETAILED',
    });

    // Check if balanced before saving
    if (!bs.isBalanced && input.markAsFinal) {
      throw new Error('Cannot mark as final: balance sheet is not balanced');
    }

    // Generate report name if not provided
    const reportName = input.reportName || `Bilans na dzień ${reportDate.toISOString().split('T')[0]}`;

    // Get user for creator info (currently userId is stored directly)
    // User fetch removed as userId is sufficient for audit purposes

    // Save the report
    const report = await this.prisma.balanceSheetReport.create({
      data: {
        organizationId: this.organizationId,
        reportDate,
        comparativeDate,
        reportName,
        totalAssets: bs.assets.totalAssets.currentPeriod,
        totalLiabilities: bs.liabilities.totalLiabilities.currentPeriod,
        totalEquity: bs.equity.totalEquity.currentPeriod,
        isFinal: input.markAsFinal,
        finalizedAt: input.markAsFinal ? new Date() : null,
        finalizedBy: input.markAsFinal ? this.userId : null,
        reportData: JSON.stringify(bs),
        exportedFormats: [],
        lastExportedAt: null,
        createdBy: this.userId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        finalizedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogger.log({
      action: 'BALANCE_SHEET_SAVED',
      entityType: 'balance_sheet_report',
      entityId: report.id,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        reportDate: reportDate.toISOString(),
        reportName,
        isFinal: input.markAsFinal,
        totalAssets: bs.assets.totalAssets.currentPeriod,
        totalEquity: bs.equity.totalEquity.currentPeriod,
        totalLiabilities: bs.liabilities.totalLiabilities.currentPeriod,
      },
    });

    return {
      id: report.id,
      organizationId: report.organizationId,
      reportDate: report.reportDate,
      comparativeDate: report.comparativeDate,
      reportName: report.reportName,
      totalAssets: Number(report.totalAssets),
      totalLiabilities: Number(report.totalLiabilities),
      totalEquity: Number(report.totalEquity),
      isFinal: report.isFinal,
      finalizedAt: report.finalizedAt,
      finalizedBy: report.finalizedByUser,
      exportedFormats: report.exportedFormats,
      lastExportedAt: report.lastExportedAt,
      createdAt: report.createdAt,
      createdBy: report.createdByUser,
    };
  }

  // ===========================================================================
  // GET SAVED BALANCE SHEET
  // ===========================================================================

  /**
   * Get a saved balance sheet report by ID
   */
  async get(input: GetBalanceSheetInput): Promise<GetBalanceSheetResult> {
    const report = await this.prisma.balanceSheetReport.findUnique({
      where: { id: input.reportId },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        finalizedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      throw new Error('Balance sheet report not found');
    }

    if (report.organizationId !== this.organizationId) {
      throw new Error('Balance sheet report not found');
    }

    // Parse the stored report data
    const reportData = JSON.parse(report.reportData);

    return {
      id: report.id,
      organizationId: report.organizationId,
      reportDate: report.reportDate,
      comparativeDate: report.comparativeDate,
      reportName: report.reportName,
      totalAssets: Number(report.totalAssets),
      totalLiabilities: Number(report.totalLiabilities),
      totalEquity: Number(report.totalEquity),
      isFinal: report.isFinal,
      finalizedAt: report.finalizedAt,
      finalizedBy: report.finalizedByUser,
      exportedFormats: report.exportedFormats,
      lastExportedAt: report.lastExportedAt,
      createdAt: report.createdAt,
      createdBy: report.createdByUser,
      reportData,
    };
  }

  // ===========================================================================
  // LIST BALANCE SHEET REPORTS
  // ===========================================================================

  /**
   * List saved balance sheet reports with filtering and pagination
   */
  async list(input: ListBalanceSheetInput): Promise<ListBalanceSheetResult> {
    const where: any = {
      organizationId: this.organizationId,
    };

    if (input.year) {
      const startOfYear = new Date(input.year, 0, 1);
      const endOfYear = new Date(input.year, 11, 31, 23, 59, 59);
      where.reportDate = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    if (input.isFinal !== undefined) {
      where.isFinal = input.isFinal;
    }

    if (input.search) {
      where.reportName = {
        contains: input.search,
        mode: 'insensitive',
      };
    }

    const [reports, total] = await Promise.all([
      this.prisma.balanceSheetReport.findMany({
        where,
        orderBy: { reportDate: 'desc' },
        skip: input.offset,
        take: input.limit,
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          finalizedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.balanceSheetReport.count({ where }),
    ]);

    return {
      reports: reports.map((report: any) => ({
        id: report.id,
        organizationId: report.organizationId,
        reportDate: report.reportDate,
        comparativeDate: report.comparativeDate,
        reportName: report.reportName,
        totalAssets: Number(report.totalAssets),
        totalLiabilities: Number(report.totalLiabilities),
        totalEquity: Number(report.totalEquity),
        isFinal: report.isFinal,
        finalizedAt: report.finalizedAt,
        finalizedBy: report.finalizedByUser,
        exportedFormats: report.exportedFormats,
        lastExportedAt: report.lastExportedAt,
        createdAt: report.createdAt,
        createdBy: report.createdByUser,
      })),
      total,
      hasMore: input.offset + reports.length < total,
    };
  }

  // ===========================================================================
  // DELETE BALANCE SHEET REPORT
  // ===========================================================================

  /**
   * Delete a saved balance sheet report (only non-final reports)
   */
  async delete(input: DeleteBalanceSheetInput): Promise<DeleteBalanceSheetResult> {
    const report = await this.prisma.balanceSheetReport.findUnique({
      where: { id: input.reportId },
    });

    if (!report) {
      throw new Error('Balance sheet report not found');
    }

    if (report.organizationId !== this.organizationId) {
      throw new Error('Balance sheet report not found');
    }

    if (report.isFinal) {
      throw new Error('Cannot delete a finalized balance sheet report');
    }

    await this.prisma.balanceSheetReport.delete({
      where: { id: input.reportId },
    });

    await this.auditLogger.log({
      action: 'BALANCE_SHEET_DELETED',
      entityType: 'balance_sheet_report',
      entityId: input.reportId,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        reportName: report.reportName,
        reportDate: report.reportDate,
      },
    });

    return {
      success: true,
      reportId: report.id,
      reportName: report.reportName,
    };
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  /**
   * Get account balances from general ledger as of a specific date
   */
  private async getAccountBalances(
    accountIds: string[],
    asOfDate: Date,
    includeDrafts?: boolean
  ): Promise<Map<string, { debit: Decimal; credit: Decimal }>> {
    const statusFilter = includeDrafts ? ['POSTED', 'DRAFT'] : ['POSTED'];

    const entries = await this.prisma.generalLedgerEntry.groupBy({
      by: ['accountId'],
      where: {
        organizationId: this.organizationId,
        accountId: { in: accountIds },
        transactionDate: { lte: asOfDate },
        journalEntry: {
          status: { in: statusFilter },
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const balances = new Map<string, { debit: Decimal; credit: Decimal }>();

    for (const entry of entries) {
      balances.set(entry.accountId, {
        debit: new Decimal(entry._sum.debitAmount || 0),
        credit: new Decimal(entry._sum.creditAmount || 0),
      });
    }

    return balances;
  }

  /**
   * Get aggregate balance for a set of account code prefixes
   */
  private getBalanceForAccountPrefixes(
    accounts: any[],
    prefixes: string[],
    balances: Map<string, { debit: Decimal; credit: Decimal }>
  ): Decimal {
    let total = new Decimal(0);

    for (const account of accounts) {
      const matchesPrefix = prefixes.some((prefix) => account.accountCode.startsWith(prefix));
      if (matchesPrefix) {
        const balance = balances.get(account.id);
        if (balance) {
          // For assets: debit - credit (positive = asset)
          // For liabilities/equity: credit - debit (positive = liability/equity)
          const netBalance = new Decimal(balance.debit).minus(balance.credit);
          total = total.plus(netBalance);
        }
      }
    }

    return total;
  }

  /**
   * Get credit balance for account prefixes (for liabilities/equity)
   */
  private getCreditBalanceForAccountPrefixes(
    accounts: any[],
    prefixes: string[],
    balances: Map<string, { debit: Decimal; credit: Decimal }>
  ): Decimal {
    let total = new Decimal(0);

    for (const account of accounts) {
      const matchesPrefix = prefixes.some((prefix) => account.accountCode.startsWith(prefix));
      if (matchesPrefix) {
        const balance = balances.get(account.id);
        if (balance) {
          // For liabilities/equity: credit - debit (positive = liability/equity)
          const netBalance = new Decimal(balance.credit).minus(balance.debit);
          total = total.plus(netBalance);
        }
      }
    }

    return total;
  }

  /**
   * Build the assets section of the balance sheet
   */
  private buildAssetsSection(
    accounts: any[],
    currentBalances: Map<string, { debit: Decimal; credit: Decimal }>,
    priorBalances: Map<string, { debit: Decimal; credit: Decimal }> | undefined,
    excludeZeroBalances: boolean
  ): AssetsSection {
    const fixedAssets = this.buildFixedAssetsSection(accounts, currentBalances, priorBalances, excludeZeroBalances);
    const currentAssets = this.buildCurrentAssetsSection(accounts, currentBalances, priorBalances, excludeZeroBalances);

    const totalAssets = this.createTotalLine(
      'TOTAL_ASSETS',
      'Aktywa razem',
      'Total Assets',
      'ASSETS',
      new Decimal(fixedAssets.total.currentPeriod).plus(currentAssets.total.currentPeriod).toNumber(),
      priorBalances
        ? new Decimal(fixedAssets.total.priorPeriod || 0).plus(currentAssets.total.priorPeriod || 0).toNumber()
        : undefined
    );

    return {
      fixedAssets,
      currentAssets,
      totalAssets,
    };
  }

  /**
   * Build the fixed assets subsection
   */
  private buildFixedAssetsSection(
    accounts: any[],
    currentBalances: Map<string, { debit: Decimal; credit: Decimal }>,
    priorBalances: Map<string, { debit: Decimal; credit: Decimal }> | undefined,
    _excludeZeroBalances: boolean
  ): FixedAssetsSection {
    const intangibleAssets = this.createBalanceLine(
      'A.I',
      'Wartości niematerialne i prawne',
      'Intangible Assets',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.intangibleAssets,
      currentBalances,
      priorBalances
    );

    const tangibleAssets = this.createBalanceLine(
      'A.II',
      'Rzeczowe aktywa trwałe',
      'Tangible Fixed Assets',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.tangibleAssets,
      currentBalances,
      priorBalances
    );

    const longTermReceivables = this.createBalanceLine(
      'A.III',
      'Należności długoterminowe',
      'Long-term Receivables',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.longTermReceivables,
      currentBalances,
      priorBalances
    );

    const longTermInvestments = this.createBalanceLine(
      'A.IV',
      'Inwestycje długoterminowe',
      'Long-term Investments',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.longTermInvestments,
      currentBalances,
      priorBalances
    );

    const longTermPrepayments = this.createBalanceLine(
      'A.V',
      'Długoterminowe rozliczenia międzyokresowe',
      'Long-term Prepayments',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.longTermPrepayments,
      currentBalances,
      priorBalances
    );

    const total = this.createTotalLine(
      'A',
      'Aktywa trwałe',
      'Fixed Assets Total',
      'ASSETS',
      new Decimal(intangibleAssets.currentPeriod)
        .plus(tangibleAssets.currentPeriod)
        .plus(longTermReceivables.currentPeriod)
        .plus(longTermInvestments.currentPeriod)
        .plus(longTermPrepayments.currentPeriod)
        .toNumber(),
      priorBalances
        ? new Decimal(intangibleAssets.priorPeriod || 0)
            .plus(tangibleAssets.priorPeriod || 0)
            .plus(longTermReceivables.priorPeriod || 0)
            .plus(longTermInvestments.priorPeriod || 0)
            .plus(longTermPrepayments.priorPeriod || 0)
            .toNumber()
        : undefined
    );

    return {
      intangibleAssets,
      tangibleAssets,
      longTermReceivables,
      longTermInvestments,
      longTermPrepayments,
      total,
    };
  }

  /**
   * Build the current assets subsection
   */
  private buildCurrentAssetsSection(
    accounts: any[],
    currentBalances: Map<string, { debit: Decimal; credit: Decimal }>,
    priorBalances: Map<string, { debit: Decimal; credit: Decimal }> | undefined,
    _excludeZeroBalances: boolean
  ): CurrentAssetsSection {
    const inventory = this.createBalanceLine(
      'B.I',
      'Zapasy',
      'Inventory',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.inventory,
      currentBalances,
      priorBalances
    );

    const shortTermReceivables = this.createBalanceLine(
      'B.II',
      'Należności krótkoterminowe',
      'Short-term Receivables',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.shortTermReceivables,
      currentBalances,
      priorBalances
    );

    const shortTermInvestments = this.createBalanceLine(
      'B.III',
      'Inwestycje krótkoterminowe',
      'Short-term Investments',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.shortTermInvestments,
      currentBalances,
      priorBalances
    );

    const cash = this.createBalanceLine(
      'B.III.1',
      'Środki pieniężne',
      'Cash and Cash Equivalents',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.cash,
      currentBalances,
      priorBalances
    );

    const shortTermPrepayments = this.createBalanceLine(
      'B.IV',
      'Krótkoterminowe rozliczenia międzyokresowe',
      'Short-term Prepayments',
      'ASSETS',
      accounts,
      ACCOUNT_MAPPING.shortTermPrepayments,
      currentBalances,
      priorBalances
    );

    const total = this.createTotalLine(
      'B',
      'Aktywa obrotowe',
      'Current Assets Total',
      'ASSETS',
      new Decimal(inventory.currentPeriod)
        .plus(shortTermReceivables.currentPeriod)
        .plus(shortTermInvestments.currentPeriod)
        .plus(shortTermPrepayments.currentPeriod)
        .toNumber(),
      priorBalances
        ? new Decimal(inventory.priorPeriod || 0)
            .plus(shortTermReceivables.priorPeriod || 0)
            .plus(shortTermInvestments.priorPeriod || 0)
            .plus(shortTermPrepayments.priorPeriod || 0)
            .toNumber()
        : undefined
    );

    return {
      inventory,
      shortTermReceivables,
      shortTermInvestments,
      cash,
      shortTermPrepayments,
      total,
    };
  }

  /**
   * Build the equity section of the balance sheet
   */
  private buildEquitySection(
    accounts: any[],
    currentBalances: Map<string, { debit: Decimal; credit: Decimal }>,
    priorBalances: Map<string, { debit: Decimal; credit: Decimal }> | undefined,
    _excludeZeroBalances: boolean
  ): EquitySection {
    const shareCapital = this.createCreditBalanceLine(
      'A.I',
      'Kapitał (fundusz) podstawowy',
      'Share Capital',
      'EQUITY',
      accounts,
      ACCOUNT_MAPPING.shareCapital,
      currentBalances,
      priorBalances
    );

    const supplementaryCapital = this.createCreditBalanceLine(
      'A.II',
      'Kapitał (fundusz) zapasowy',
      'Supplementary Capital',
      'EQUITY',
      accounts,
      ACCOUNT_MAPPING.supplementaryCapital,
      currentBalances,
      priorBalances
    );

    const revaluationReserve = this.createCreditBalanceLine(
      'A.III',
      'Kapitał (fundusz) z aktualizacji wyceny',
      'Revaluation Reserve',
      'EQUITY',
      accounts,
      ACCOUNT_MAPPING.revaluationReserve,
      currentBalances,
      priorBalances
    );

    const otherReserves = this.createCreditBalanceLine(
      'A.IV',
      'Pozostałe kapitały (fundusze) rezerwowe',
      'Other Reserves',
      'EQUITY',
      accounts,
      ACCOUNT_MAPPING.otherReserves,
      currentBalances,
      priorBalances
    );

    const priorYearsProfitLoss = this.createCreditBalanceLine(
      'A.V',
      'Zysk (strata) z lat ubiegłych',
      'Prior Years Profit/Loss',
      'EQUITY',
      accounts,
      ACCOUNT_MAPPING.priorYearsProfitLoss,
      currentBalances,
      priorBalances
    );

    // Get current year profit/loss from income statement calculation
    const currentYearProfitLoss = this.createCreditBalanceLine(
      'A.VI',
      'Zysk (strata) netto',
      'Current Year Net Profit/Loss',
      'EQUITY',
      accounts,
      ACCOUNT_MAPPING.currentYearProfitLoss,
      currentBalances,
      priorBalances
    );

    const totalEquity = this.createTotalLine(
      'A',
      'Kapitał (fundusz) własny',
      'Total Equity',
      'EQUITY',
      new Decimal(shareCapital.currentPeriod)
        .plus(supplementaryCapital.currentPeriod)
        .plus(revaluationReserve.currentPeriod)
        .plus(otherReserves.currentPeriod)
        .plus(priorYearsProfitLoss.currentPeriod)
        .plus(currentYearProfitLoss.currentPeriod)
        .toNumber(),
      priorBalances
        ? new Decimal(shareCapital.priorPeriod || 0)
            .plus(supplementaryCapital.priorPeriod || 0)
            .plus(revaluationReserve.priorPeriod || 0)
            .plus(otherReserves.priorPeriod || 0)
            .plus(priorYearsProfitLoss.priorPeriod || 0)
            .plus(currentYearProfitLoss.priorPeriod || 0)
            .toNumber()
        : undefined
    );

    return {
      shareCapital,
      supplementaryCapital,
      revaluationReserve,
      otherReserves,
      priorYearsProfitLoss,
      currentYearProfitLoss,
      totalEquity,
    };
  }

  /**
   * Build the liabilities section of the balance sheet
   */
  private buildLiabilitiesSection(
    accounts: any[],
    currentBalances: Map<string, { debit: Decimal; credit: Decimal }>,
    priorBalances: Map<string, { debit: Decimal; credit: Decimal }> | undefined,
    _excludeZeroBalances: boolean
  ): LiabilitiesSection {
    const provisions = this.createCreditBalanceLine(
      'B.I',
      'Rezerwy na zobowiązania',
      'Provisions',
      'LIABILITIES',
      accounts,
      ACCOUNT_MAPPING.provisions,
      currentBalances,
      priorBalances
    );

    const longTermLiabilities = this.createCreditBalanceLine(
      'B.II',
      'Zobowiązania długoterminowe',
      'Long-term Liabilities',
      'LIABILITIES',
      accounts,
      ACCOUNT_MAPPING.longTermLiabilities,
      currentBalances,
      priorBalances
    );

    const shortTermLiabilities = this.createCreditBalanceLine(
      'B.III',
      'Zobowiązania krótkoterminowe',
      'Short-term Liabilities',
      'LIABILITIES',
      accounts,
      ACCOUNT_MAPPING.shortTermLiabilities,
      currentBalances,
      priorBalances
    );

    const accruals = this.createCreditBalanceLine(
      'B.IV',
      'Rozliczenia międzyokresowe',
      'Accruals and Deferred Income',
      'LIABILITIES',
      accounts,
      ACCOUNT_MAPPING.accruals,
      currentBalances,
      priorBalances
    );

    const totalLiabilities = this.createTotalLine(
      'B',
      'Zobowiązania i rezerwy na zobowiązania',
      'Total Liabilities',
      'LIABILITIES',
      new Decimal(provisions.currentPeriod)
        .plus(longTermLiabilities.currentPeriod)
        .plus(shortTermLiabilities.currentPeriod)
        .plus(accruals.currentPeriod)
        .toNumber(),
      priorBalances
        ? new Decimal(provisions.priorPeriod || 0)
            .plus(longTermLiabilities.priorPeriod || 0)
            .plus(shortTermLiabilities.priorPeriod || 0)
            .plus(accruals.priorPeriod || 0)
            .toNumber()
        : undefined
    );

    return {
      provisions,
      longTermLiabilities,
      shortTermLiabilities,
      accruals,
      totalLiabilities,
    };
  }

  /**
   * Create a balance sheet line for asset accounts (debit balance)
   */
  private createBalanceLine(
    lineCode: string,
    lineNamePl: string,
    lineNameEn: string,
    section: 'ASSETS' | 'EQUITY' | 'LIABILITIES',
    accounts: any[],
    accountPrefixes: string[],
    currentBalances: Map<string, { debit: Decimal; credit: Decimal }>,
    priorBalances: Map<string, { debit: Decimal; credit: Decimal }> | undefined
  ): BalanceSheetLine {
    const currentPeriod = this.getBalanceForAccountPrefixes(accounts, accountPrefixes, currentBalances).toNumber();
    const priorPeriod = priorBalances
      ? this.getBalanceForAccountPrefixes(accounts, accountPrefixes, priorBalances).toNumber()
      : undefined;

    return {
      lineCode,
      lineNamePl,
      lineNameEn,
      section,
      indentLevel: lineCode.split('.').length - 1,
      currentPeriod,
      priorPeriod,
      variance: priorPeriod !== undefined ? currentPeriod - priorPeriod : undefined,
      variancePercent:
        priorPeriod !== undefined && priorPeriod !== 0
          ? ((currentPeriod - priorPeriod) / Math.abs(priorPeriod)) * 100
          : undefined,
      isHeader: false,
      isTotal: false,
      accounts: accountPrefixes,
    };
  }

  /**
   * Create a balance sheet line for liability/equity accounts (credit balance)
   */
  private createCreditBalanceLine(
    lineCode: string,
    lineNamePl: string,
    lineNameEn: string,
    section: 'ASSETS' | 'EQUITY' | 'LIABILITIES',
    accounts: any[],
    accountPrefixes: string[],
    currentBalances: Map<string, { debit: Decimal; credit: Decimal }>,
    priorBalances: Map<string, { debit: Decimal; credit: Decimal }> | undefined
  ): BalanceSheetLine {
    const currentPeriod = this.getCreditBalanceForAccountPrefixes(accounts, accountPrefixes, currentBalances).toNumber();
    const priorPeriod = priorBalances
      ? this.getCreditBalanceForAccountPrefixes(accounts, accountPrefixes, priorBalances).toNumber()
      : undefined;

    return {
      lineCode,
      lineNamePl,
      lineNameEn,
      section,
      indentLevel: lineCode.split('.').length - 1,
      currentPeriod,
      priorPeriod,
      variance: priorPeriod !== undefined ? currentPeriod - priorPeriod : undefined,
      variancePercent:
        priorPeriod !== undefined && priorPeriod !== 0
          ? ((currentPeriod - priorPeriod) / Math.abs(priorPeriod)) * 100
          : undefined,
      isHeader: false,
      isTotal: false,
      accounts: accountPrefixes,
    };
  }

  /**
   * Create a total line for the balance sheet
   */
  private createTotalLine(
    lineCode: string,
    lineNamePl: string,
    lineNameEn: string,
    section: 'ASSETS' | 'EQUITY' | 'LIABILITIES',
    currentPeriod: number,
    priorPeriod?: number
  ): BalanceSheetLine {
    return {
      lineCode,
      lineNamePl,
      lineNameEn,
      section,
      indentLevel: 0,
      currentPeriod,
      priorPeriod,
      variance: priorPeriod !== undefined ? currentPeriod - priorPeriod : undefined,
      variancePercent:
        priorPeriod !== undefined && priorPeriod !== 0
          ? ((currentPeriod - priorPeriod) / Math.abs(priorPeriod)) * 100
          : undefined,
      isHeader: false,
      isTotal: true,
    };
  }

  /**
   * Generate Excel export (base64 encoded)
   */
  private async generateExcel(bs: BalanceSheetResult, input: ExportBalanceSheetInput): Promise<string> {
    // In production, use exceljs library
    // For now, return base64 encoded CSV as placeholder
    const content = this.generateCSV(bs, input.language);
    return Buffer.from(content).toString('base64');
  }

  /**
   * Generate PDF export (base64 encoded)
   */
  private async generatePDF(bs: BalanceSheetResult, input: ExportBalanceSheetInput): Promise<string> {
    // In production, use pdfkit or puppeteer
    // For now, return base64 encoded text as placeholder
    const lang = input.language;
    const title = lang === 'PL' ? 'BILANS' : 'BALANCE SHEET';
    const content = `${title}
Na dzień / As of: ${bs.reportDate.toISOString().split('T')[0]}

${bs.organizationName}
NIP: ${bs.nip}

${this.generateCSV(bs, lang)}`;

    return Buffer.from(content).toString('base64');
  }

  /**
   * Generate CSV export
   */
  private generateCSV(bs: BalanceSheetResult, language: 'PL' | 'EN'): string {
    const lines: string[] = [];
    const getName = (line: BalanceSheetLine) => (language === 'PL' ? line.lineNamePl : line.lineNameEn || line.lineNamePl);

    // Header
    lines.push(`"${language === 'PL' ? 'Pozycja' : 'Position'}","${language === 'PL' ? 'Nazwa' : 'Description'}","${language === 'PL' ? 'Rok bieżący' : 'Current Period'}","${language === 'PL' ? 'Rok poprzedni' : 'Prior Period'}"`);

    // Assets
    lines.push(`"","${language === 'PL' ? 'AKTYWA' : 'ASSETS'}","",""`);

    // Fixed assets
    lines.push(`"${bs.assets.fixedAssets.total.lineCode}","${getName(bs.assets.fixedAssets.total)}",${bs.assets.fixedAssets.total.currentPeriod},${bs.assets.fixedAssets.total.priorPeriod || ''}`);
    lines.push(`"${bs.assets.fixedAssets.intangibleAssets.lineCode}","${getName(bs.assets.fixedAssets.intangibleAssets)}",${bs.assets.fixedAssets.intangibleAssets.currentPeriod},${bs.assets.fixedAssets.intangibleAssets.priorPeriod || ''}`);
    lines.push(`"${bs.assets.fixedAssets.tangibleAssets.lineCode}","${getName(bs.assets.fixedAssets.tangibleAssets)}",${bs.assets.fixedAssets.tangibleAssets.currentPeriod},${bs.assets.fixedAssets.tangibleAssets.priorPeriod || ''}`);
    lines.push(`"${bs.assets.fixedAssets.longTermReceivables.lineCode}","${getName(bs.assets.fixedAssets.longTermReceivables)}",${bs.assets.fixedAssets.longTermReceivables.currentPeriod},${bs.assets.fixedAssets.longTermReceivables.priorPeriod || ''}`);
    lines.push(`"${bs.assets.fixedAssets.longTermInvestments.lineCode}","${getName(bs.assets.fixedAssets.longTermInvestments)}",${bs.assets.fixedAssets.longTermInvestments.currentPeriod},${bs.assets.fixedAssets.longTermInvestments.priorPeriod || ''}`);
    lines.push(`"${bs.assets.fixedAssets.longTermPrepayments.lineCode}","${getName(bs.assets.fixedAssets.longTermPrepayments)}",${bs.assets.fixedAssets.longTermPrepayments.currentPeriod},${bs.assets.fixedAssets.longTermPrepayments.priorPeriod || ''}`);

    // Current assets
    lines.push(`"${bs.assets.currentAssets.total.lineCode}","${getName(bs.assets.currentAssets.total)}",${bs.assets.currentAssets.total.currentPeriod},${bs.assets.currentAssets.total.priorPeriod || ''}`);
    lines.push(`"${bs.assets.currentAssets.inventory.lineCode}","${getName(bs.assets.currentAssets.inventory)}",${bs.assets.currentAssets.inventory.currentPeriod},${bs.assets.currentAssets.inventory.priorPeriod || ''}`);
    lines.push(`"${bs.assets.currentAssets.shortTermReceivables.lineCode}","${getName(bs.assets.currentAssets.shortTermReceivables)}",${bs.assets.currentAssets.shortTermReceivables.currentPeriod},${bs.assets.currentAssets.shortTermReceivables.priorPeriod || ''}`);
    lines.push(`"${bs.assets.currentAssets.shortTermInvestments.lineCode}","${getName(bs.assets.currentAssets.shortTermInvestments)}",${bs.assets.currentAssets.shortTermInvestments.currentPeriod},${bs.assets.currentAssets.shortTermInvestments.priorPeriod || ''}`);
    lines.push(`"${bs.assets.currentAssets.cash.lineCode}","${getName(bs.assets.currentAssets.cash)}",${bs.assets.currentAssets.cash.currentPeriod},${bs.assets.currentAssets.cash.priorPeriod || ''}`);
    lines.push(`"${bs.assets.currentAssets.shortTermPrepayments.lineCode}","${getName(bs.assets.currentAssets.shortTermPrepayments)}",${bs.assets.currentAssets.shortTermPrepayments.currentPeriod},${bs.assets.currentAssets.shortTermPrepayments.priorPeriod || ''}`);

    // Total assets
    lines.push(`"${bs.assets.totalAssets.lineCode}","${getName(bs.assets.totalAssets)}",${bs.assets.totalAssets.currentPeriod},${bs.assets.totalAssets.priorPeriod || ''}`);

    // Equity and Liabilities
    lines.push(`"","${language === 'PL' ? 'PASYWA' : 'EQUITY AND LIABILITIES'}","",""`);

    // Equity
    lines.push(`"${bs.equity.totalEquity.lineCode}","${getName(bs.equity.totalEquity)}",${bs.equity.totalEquity.currentPeriod},${bs.equity.totalEquity.priorPeriod || ''}`);
    lines.push(`"${bs.equity.shareCapital.lineCode}","${getName(bs.equity.shareCapital)}",${bs.equity.shareCapital.currentPeriod},${bs.equity.shareCapital.priorPeriod || ''}`);
    lines.push(`"${bs.equity.supplementaryCapital.lineCode}","${getName(bs.equity.supplementaryCapital)}",${bs.equity.supplementaryCapital.currentPeriod},${bs.equity.supplementaryCapital.priorPeriod || ''}`);
    lines.push(`"${bs.equity.revaluationReserve.lineCode}","${getName(bs.equity.revaluationReserve)}",${bs.equity.revaluationReserve.currentPeriod},${bs.equity.revaluationReserve.priorPeriod || ''}`);
    lines.push(`"${bs.equity.otherReserves.lineCode}","${getName(bs.equity.otherReserves)}",${bs.equity.otherReserves.currentPeriod},${bs.equity.otherReserves.priorPeriod || ''}`);
    lines.push(`"${bs.equity.priorYearsProfitLoss.lineCode}","${getName(bs.equity.priorYearsProfitLoss)}",${bs.equity.priorYearsProfitLoss.currentPeriod},${bs.equity.priorYearsProfitLoss.priorPeriod || ''}`);
    lines.push(`"${bs.equity.currentYearProfitLoss.lineCode}","${getName(bs.equity.currentYearProfitLoss)}",${bs.equity.currentYearProfitLoss.currentPeriod},${bs.equity.currentYearProfitLoss.priorPeriod || ''}`);

    // Liabilities
    lines.push(`"${bs.liabilities.totalLiabilities.lineCode}","${getName(bs.liabilities.totalLiabilities)}",${bs.liabilities.totalLiabilities.currentPeriod},${bs.liabilities.totalLiabilities.priorPeriod || ''}`);
    lines.push(`"${bs.liabilities.provisions.lineCode}","${getName(bs.liabilities.provisions)}",${bs.liabilities.provisions.currentPeriod},${bs.liabilities.provisions.priorPeriod || ''}`);
    lines.push(`"${bs.liabilities.longTermLiabilities.lineCode}","${getName(bs.liabilities.longTermLiabilities)}",${bs.liabilities.longTermLiabilities.currentPeriod},${bs.liabilities.longTermLiabilities.priorPeriod || ''}`);
    lines.push(`"${bs.liabilities.shortTermLiabilities.lineCode}","${getName(bs.liabilities.shortTermLiabilities)}",${bs.liabilities.shortTermLiabilities.currentPeriod},${bs.liabilities.shortTermLiabilities.priorPeriod || ''}`);
    lines.push(`"${bs.liabilities.accruals.lineCode}","${getName(bs.liabilities.accruals)}",${bs.liabilities.accruals.currentPeriod},${bs.liabilities.accruals.priorPeriod || ''}`);

    // Total
    lines.push(`"${bs.totalEquityAndLiabilities.lineCode}","${getName(bs.totalEquityAndLiabilities)}",${bs.totalEquityAndLiabilities.currentPeriod},${bs.totalEquityAndLiabilities.priorPeriod || ''}`);

    return lines.join('\n');
  }

  /**
   * Generate XML export (base64 encoded)
   */
  private generateXML(bs: BalanceSheetResult, _input: ExportBalanceSheetInput): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Bilans xmlns="http://www.mf.gov.pl/schemat/sprawozdania/bilans/1.0">
  <NaglowekBilans>
    <DataRaportu>${bs.reportDate.toISOString().split('T')[0]}</DataRaportu>
    <NazwaPodmiotu>${bs.organizationName}</NazwaPodmiotu>
    <NIP>${bs.nip}</NIP>
  </NaglowekBilans>
  <Aktywa>
    <AktywaTrałe>
      <WartosciNiematerialneIPrawne>${bs.assets.fixedAssets.intangibleAssets.currentPeriod}</WartosciNiematerialneIPrawne>
      <RzeijnoweAktywaTrałe>${bs.assets.fixedAssets.tangibleAssets.currentPeriod}</RzeijnoweAktywaTrałe>
      <NaleznosciDlugoterminowe>${bs.assets.fixedAssets.longTermReceivables.currentPeriod}</NaleznosciDlugoterminowe>
      <InwestycjeDlugoterminowe>${bs.assets.fixedAssets.longTermInvestments.currentPeriod}</InwestycjeDlugoterminowe>
      <DlugoterminoweRozliczeniaMiedzyokresowe>${bs.assets.fixedAssets.longTermPrepayments.currentPeriod}</DlugoterminoweRozliczeniaMiedzyokresowe>
      <Razem>${bs.assets.fixedAssets.total.currentPeriod}</Razem>
    </AktywaTrałe>
    <AktywaObrotowe>
      <Zapasy>${bs.assets.currentAssets.inventory.currentPeriod}</Zapasy>
      <NaleznosciKrótkoterminowe>${bs.assets.currentAssets.shortTermReceivables.currentPeriod}</NaleznosciKrótkoterminowe>
      <InwestycjeKrótkoterminowe>${bs.assets.currentAssets.shortTermInvestments.currentPeriod}</InwestycjeKrótkoterminowe>
      <SrodkiPieniezne>${bs.assets.currentAssets.cash.currentPeriod}</SrodkiPieniezne>
      <KrótkoterminoweRozliczeniaMiedzyokresowe>${bs.assets.currentAssets.shortTermPrepayments.currentPeriod}</KrótkoterminoweRozliczeniaMiedzyokresowe>
      <Razem>${bs.assets.currentAssets.total.currentPeriod}</Razem>
    </AktywaObrotowe>
    <AktywaRazem>${bs.assets.totalAssets.currentPeriod}</AktywaRazem>
  </Aktywa>
  <Pasywa>
    <KapitalWlasny>
      <KapitalPodstawowy>${bs.equity.shareCapital.currentPeriod}</KapitalPodstawowy>
      <KapitalZapasowy>${bs.equity.supplementaryCapital.currentPeriod}</KapitalZapasowy>
      <KapitalZAktualizacjiWyceny>${bs.equity.revaluationReserve.currentPeriod}</KapitalZAktualizacjiWyceny>
      <PozostaleKapitalyRezerwowe>${bs.equity.otherReserves.currentPeriod}</PozostaleKapitalyRezerwowe>
      <ZyskZLatUbieglych>${bs.equity.priorYearsProfitLoss.currentPeriod}</ZyskZLatUbieglych>
      <ZyskNetto>${bs.equity.currentYearProfitLoss.currentPeriod}</ZyskNetto>
      <Razem>${bs.equity.totalEquity.currentPeriod}</Razem>
    </KapitalWlasny>
    <ZobowiazaniaRezerwy>
      <RezerwyNaZobowiazania>${bs.liabilities.provisions.currentPeriod}</RezerwyNaZobowiazania>
      <ZobowiazaniaDlugoterminowe>${bs.liabilities.longTermLiabilities.currentPeriod}</ZobowiazaniaDlugoterminowe>
      <ZobowiazaniaKrótkoterminowe>${bs.liabilities.shortTermLiabilities.currentPeriod}</ZobowiazaniaKrótkoterminowe>
      <RozliczeniaMiedzyokresowe>${bs.liabilities.accruals.currentPeriod}</RozliczeniaMiedzyokresowe>
      <Razem>${bs.liabilities.totalLiabilities.currentPeriod}</Razem>
    </ZobowiazaniaRezerwy>
    <PasywaRazem>${bs.totalEquityAndLiabilities.currentPeriod}</PasywaRazem>
  </Pasywa>
  <SprawdzenieBilansu>
    <Zbilansowany>${bs.isBalanced}</Zbilansowany>
    <Róznica>${bs.balanceDifference}</Róznica>
  </SprawdzenieBilansu>
</Bilans>`;

    return Buffer.from(xml).toString('base64');
  }
}
