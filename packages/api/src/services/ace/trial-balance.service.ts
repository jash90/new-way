/**
 * ACC-012: Trial Balance Service
 * Provides comprehensive trial balance operations including:
 * - Standard trial balance generation with filtering and grouping
 * - Comparative trial balance with variance analysis
 * - Working trial balance with adjustment columns
 * - Export to Excel, PDF, and CSV formats
 */

import { Decimal } from 'decimal.js';
import type {
  GenerateTrialBalanceInput,
  ComparativeTrialBalanceInput,
  CreateWorkingTBInput,
  GetWorkingTBInput,
  ListWorkingTBInput,
  AddAdjustmentColumnInput,
  RecordAdjustmentInput,
  LockWTBInput,
  DeleteWTBInput,
  ExportTrialBalanceInput,
  TrialBalanceResult,
  ComparativeTrialBalanceResult,
  CreateWorkingTBResult,
  GetWorkingTBResult,
  ListWorkingTBResult,
  AddAdjustmentColumnResult,
  RecordAdjustmentResult,
  LockWTBResult,
  DeleteWTBResult,
  ExportTrialBalanceResult,
  TrialBalanceLine,
  TrialBalanceTotals,
} from '@ksiegowacrm/shared';

type PrismaClient = any;
type RedisClient = any;
type AuditLogger = any;

export class TrialBalanceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly _redis: RedisClient,
    private readonly auditLogger: AuditLogger,
    private readonly userId: string,
    private readonly organizationId: string
  ) {
    // Suppress unused warning - redis reserved for future caching implementation
    void this._redis;
  }

  // ===========================================================================
  // GENERATE TRIAL BALANCE
  // ===========================================================================

  /**
   * Generate trial balance as of a specific date
   * Aggregates all account balances with optional filtering and grouping
   */
  async generate(input: GenerateTrialBalanceInput): Promise<TrialBalanceResult> {
    const asOfDate = new Date(input.asOfDate);

    // Build account filters
    const accountWhere: any = {
      organizationId: this.organizationId,
    };

    if (input.accountClassFilter && input.accountClassFilter.length > 0) {
      accountWhere.accountClass = { in: input.accountClassFilter };
    }

    if (input.accountCodeFrom || input.accountCodeTo) {
      accountWhere.accountCode = {};
      if (input.accountCodeFrom) {
        accountWhere.accountCode.gte = input.accountCodeFrom;
      }
      if (input.accountCodeTo) {
        accountWhere.accountCode.lte = input.accountCodeTo;
      }
    }

    if (input.accountIds && input.accountIds.length > 0) {
      accountWhere.id = { in: input.accountIds };
    }

    if (!input.includeInactiveAccounts) {
      accountWhere.isActive = true;
    }

    // Get accounts
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: accountWhere,
      orderBy: [{ accountClass: 'asc' }, { accountCode: 'asc' }],
    });

    // Get balances from general ledger up to asOfDate
    const balances = await this.getAccountBalances(accounts.map((a: any) => a.id), asOfDate, input.periodId);

    // Build trial balance lines
    const lines: TrialBalanceLine[] = [];
    let warningCount = 0;

    for (const account of accounts) {
      const balance = balances.get(account.id) || { debit: new Decimal(0), credit: new Decimal(0) };
      const debitBalance = new Decimal(balance.debit);
      const creditBalance = new Decimal(balance.credit);

      // Skip zero balances if not included
      if (!input.includeZeroBalances && debitBalance.isZero() && creditBalance.isZero()) {
        continue;
      }

      // Check for unusual balance
      const isWarning = this.hasUnusualBalance(account.normalBalance, debitBalance, creditBalance);
      if (isWarning) warningCount++;

      lines.push({
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountClass: account.accountClass,
        accountType: account.accountType,
        parentAccountId: account.parentAccountId,
        normalBalance: account.normalBalance,
        isActive: account.isActive,
        debitBalance: debitBalance.toNumber(),
        creditBalance: creditBalance.toNumber(),
        isWarning,
        isGroupHeader: false,
        level: this.getAccountLevel(account.accountCode),
      });
    }

    // Apply grouping if requested
    const groupedLines = this.applyGrouping(lines, input.groupBy || 'NONE');

    // Calculate totals
    const totals = this.calculateTotals(groupedLines);

    // Check if balanced
    const outOfBalanceAmount = new Decimal(totals.debit).minus(totals.credit).abs().toNumber();
    const isBalanced = outOfBalanceAmount < 0.01;

    // Audit log
    await this.auditLogger.log({
      action: 'TRIAL_BALANCE_GENERATED',
      entityType: 'trial_balance',
      entityId: null,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        asOfDate: asOfDate.toISOString(),
        accountCount: groupedLines.length,
        isBalanced,
        outOfBalanceAmount,
      },
    });

    return {
      asOfDate,
      periodId: input.periodId || null,
      generatedAt: new Date(),
      generatedBy: this.userId,
      lines: groupedLines,
      totals,
      isBalanced,
      outOfBalanceAmount,
      metadata: {
        accountCount: groupedLines.filter((l) => !l.isGroupHeader).length,
        groupBy: input.groupBy || 'NONE',
        includeZeroBalances: input.includeZeroBalances ?? false,
        warningCount,
      },
    };
  }

  // ===========================================================================
  // COMPARATIVE TRIAL BALANCE
  // ===========================================================================

  /**
   * Generate comparative trial balance across multiple periods
   * Calculates variances and percentage changes
   */
  async generateComparative(input: ComparativeTrialBalanceInput): Promise<ComparativeTrialBalanceResult> {
    const currentAsOfDate = new Date(input.currentAsOfDate);

    // Build account filters
    const accountWhere: any = {
      organizationId: this.organizationId,
      isActive: true,
    };

    if (input.accountClassFilter && input.accountClassFilter.length > 0) {
      accountWhere.accountClass = { in: input.accountClassFilter };
    }

    // Get accounts
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: accountWhere,
      orderBy: [{ accountClass: 'asc' }, { accountCode: 'asc' }],
    });

    // Get current balances
    const currentBalances = await this.getAccountBalances(
      accounts.map((a: any) => a.id),
      currentAsOfDate
    );

    // Get comparison period balances
    const periodBalances: Map<string, Map<string, { debit: Decimal; credit: Decimal }>> = new Map();

    for (const period of input.comparePeriods) {
      const periodDate = new Date(period.asOfDate);
      const balances = await this.getAccountBalances(
        accounts.map((a: any) => a.id),
        periodDate
      );
      periodBalances.set(period.label, balances);
    }

    // Build comparative lines
    const lines = [];

    for (const account of accounts) {
      const current = currentBalances.get(account.id) || { debit: new Decimal(0), credit: new Decimal(0) };
      const currentDebit = new Decimal(current.debit);
      const currentCredit = new Decimal(current.credit);
      const currentNet = currentDebit.minus(currentCredit);

      // Skip zero balances if not included
      if (!input.includeZeroBalances) {
        let hasBalance = !currentDebit.isZero() || !currentCredit.isZero();
        for (const [, balances] of periodBalances) {
          const balance = balances.get(account.id);
          if (balance && (!new Decimal(balance.debit).isZero() || !new Decimal(balance.credit).isZero())) {
            hasBalance = true;
            break;
          }
        }
        if (!hasBalance) continue;
      }

      const periodData = input.comparePeriods.map((period) => {
        const balances = periodBalances.get(period.label);
        const balance = balances?.get(account.id) || { debit: new Decimal(0), credit: new Decimal(0) };
        return {
          label: period.label,
          asOfDate: new Date(period.asOfDate),
          debit: new Decimal(balance.debit).toNumber(),
          credit: new Decimal(balance.credit).toNumber(),
        };
      });

      // Calculate variances
      const variances = input.comparePeriods.map((period) => {
        const balances = periodBalances.get(period.label);
        const balance = balances?.get(account.id) || { debit: new Decimal(0), credit: new Decimal(0) };
        const periodNet = new Decimal(balance.debit).minus(balance.credit);
        const variance = currentNet.minus(periodNet).toNumber();

        let percentChange: number | null = null;
        if (!periodNet.isZero()) {
          percentChange = currentNet.minus(periodNet).div(periodNet.abs()).times(100).toNumber();
        }

        const isSignificant = Math.abs(percentChange || 0) >= (input.highlightThreshold ?? 10);

        return {
          label: period.label,
          variance,
          percentChange,
          isSignificant,
        };
      });

      lines.push({
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountClass: account.accountClass,
        normalBalance: account.normalBalance,
        currentDebit: currentDebit.toNumber(),
        currentCredit: currentCredit.toNumber(),
        periodBalances: periodData,
        variances,
      });
    }

    // Apply grouping if requested
    const finalLines = input.groupBy === 'NONE' ? lines : this.applyComparativeGrouping(lines, input.groupBy);

    await this.auditLogger.log({
      action: 'COMPARATIVE_TB_GENERATED',
      entityType: 'trial_balance',
      entityId: null,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        currentAsOfDate: currentAsOfDate.toISOString(),
        comparePeriods: input.comparePeriods.length,
        accountCount: finalLines.length,
      },
    });

    return {
      currentAsOfDate,
      comparePeriods: input.comparePeriods.map((p) => ({
        asOfDate: new Date(p.asOfDate),
        label: p.label,
      })),
      generatedAt: new Date(),
      lines: finalLines,
      metadata: {
        accountCount: finalLines.length,
        groupBy: input.groupBy || 'NONE',
        highlightThreshold: input.highlightThreshold ?? 10,
      },
    };
  }

  // ===========================================================================
  // WORKING TRIAL BALANCE
  // ===========================================================================

  /**
   * Create a working trial balance for adjustments
   */
  async createWorkingTB(input: CreateWorkingTBInput): Promise<CreateWorkingTBResult> {
    const asOfDate = new Date(input.asOfDate);

    // Validate fiscal year exists
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: input.fiscalYearId },
    });

    if (!fiscalYear || fiscalYear.organizationId !== this.organizationId) {
      throw new Error('Fiscal year not found');
    }

    // Generate WTB code
    const wtbCode = await this.generateWTBCode(asOfDate);

    // Get accounts for the working trial balance
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: {
        organizationId: this.organizationId,
        isActive: true,
      },
      orderBy: [{ accountClass: 'asc' }, { accountCode: 'asc' }],
    });

    // Get balances
    const balances = await this.getAccountBalances(
      accounts.map((a: any) => a.id),
      asOfDate,
      input.periodId
    );

    // Create working trial balance with lines
    const wtb = await this.prisma.workingTrialBalance.create({
      data: {
        organizationId: this.organizationId,
        wtbCode,
        wtbName: input.wtbName,
        description: input.description,
        fiscalYearId: input.fiscalYearId,
        periodId: input.periodId,
        asOfDate,
        status: 'DRAFT',
        includeZeroBalances: input.includeZeroBalances ?? false,
        groupBy: input.groupBy || 'NONE',
        createdBy: this.userId,
        lines: {
          create: accounts
            .filter((account: any) => {
              const balance = balances.get(account.id) || { debit: new Decimal(0), credit: new Decimal(0) };
              if (!input.includeZeroBalances) {
                return !new Decimal(balance.debit).isZero() || !new Decimal(balance.credit).isZero();
              }
              return true;
            })
            .map((account: any, idx: number) => {
              const balance = balances.get(account.id) || { debit: new Decimal(0), credit: new Decimal(0) };
              return {
                accountId: account.id,
                unadjustedDebit: balance.debit,
                unadjustedCredit: balance.credit,
                adjustedDebit: balance.debit,
                adjustedCredit: balance.credit,
                adjustments: [],
                isWarning: false,
                displayOrder: idx + 1,
              };
            }),
        },
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogger.log({
      action: 'WORKING_TB_CREATED',
      entityType: 'working_trial_balance',
      entityId: wtb.id,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        wtbCode,
        wtbName: input.wtbName,
        asOfDate: asOfDate.toISOString(),
      },
    });

    return {
      id: wtb.id,
      organizationId: wtb.organizationId,
      wtbCode: wtb.wtbCode,
      wtbName: wtb.wtbName,
      description: wtb.description,
      fiscalYearId: wtb.fiscalYearId,
      periodId: wtb.periodId,
      asOfDate: wtb.asOfDate,
      status: wtb.status,
      lockedAt: null,
      lockedBy: null,
      includeZeroBalances: wtb.includeZeroBalances,
      groupBy: wtb.groupBy,
      createdAt: wtb.createdAt,
      updatedAt: wtb.updatedAt,
      createdBy: wtb.createdByUser,
    };
  }

  /**
   * Get working trial balance with lines and columns
   */
  async getWorkingTB(input: GetWorkingTBInput): Promise<GetWorkingTBResult> {
    const wtb = await this.prisma.workingTrialBalance.findUnique({
      where: { id: input.wtbId },
      include: {
        lines: {
          orderBy: { displayOrder: 'asc' },
          include: {
            account: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
              },
            },
          },
        },
        adjustmentColumns: {
          orderBy: { displayOrder: 'asc' },
          include: {
            createdByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        fiscalYear: {
          select: {
            id: true,
            yearCode: true,
            yearName: true,
          },
        },
        period: {
          select: {
            id: true,
            periodCode: true,
            periodName: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lockedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!wtb) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.organizationId !== this.organizationId) {
      throw new Error('Working trial balance not found');
    }

    // Calculate totals
    let unadjustedDebit = new Decimal(0);
    let unadjustedCredit = new Decimal(0);
    let adjustedDebit = new Decimal(0);
    let adjustedCredit = new Decimal(0);

    const lines = wtb.lines.map((line: any) => {
      unadjustedDebit = unadjustedDebit.plus(line.unadjustedDebit);
      unadjustedCredit = unadjustedCredit.plus(line.unadjustedCredit);
      adjustedDebit = adjustedDebit.plus(line.adjustedDebit);
      adjustedCredit = adjustedCredit.plus(line.adjustedCredit);

      return {
        id: line.id,
        wtbId: line.wtbId,
        accountId: line.accountId,
        accountCode: line.account.accountCode,
        accountName: line.account.accountName,
        unadjustedDebit: new Decimal(line.unadjustedDebit).toNumber(),
        unadjustedCredit: new Decimal(line.unadjustedCredit).toNumber(),
        adjustments: line.adjustments || [],
        adjustedDebit: new Decimal(line.adjustedDebit).toNumber(),
        adjustedCredit: new Decimal(line.adjustedCredit).toNumber(),
        isWarning: line.isWarning,
        notes: line.notes,
        displayOrder: line.displayOrder,
      };
    });

    const adjustmentColumns = wtb.adjustmentColumns.map((col: any) => ({
      id: col.id,
      wtbId: col.wtbId,
      columnName: col.columnName,
      columnType: col.columnType,
      journalEntryId: col.journalEntryId,
      description: col.description,
      displayOrder: col.displayOrder,
      createdAt: col.createdAt,
      createdBy: col.createdByUser,
    }));

    return {
      id: wtb.id,
      organizationId: wtb.organizationId,
      wtbCode: wtb.wtbCode,
      wtbName: wtb.wtbName,
      description: wtb.description,
      fiscalYearId: wtb.fiscalYearId,
      periodId: wtb.periodId,
      asOfDate: wtb.asOfDate,
      status: wtb.status,
      lockedAt: wtb.lockedAt,
      lockedBy: wtb.lockedByUser,
      includeZeroBalances: wtb.includeZeroBalances,
      groupBy: wtb.groupBy,
      createdAt: wtb.createdAt,
      updatedAt: wtb.updatedAt,
      createdBy: wtb.createdByUser,
      lines,
      adjustmentColumns,
      fiscalYear: wtb.fiscalYear,
      period: wtb.period,
      totals: {
        unadjustedDebit: unadjustedDebit.toNumber(),
        unadjustedCredit: unadjustedCredit.toNumber(),
        adjustedDebit: adjustedDebit.toNumber(),
        adjustedCredit: adjustedCredit.toNumber(),
      },
      isBalanced: adjustedDebit.minus(adjustedCredit).abs().lessThan(0.01),
    };
  }

  /**
   * List working trial balances
   */
  async listWorkingTB(input: ListWorkingTBInput): Promise<ListWorkingTBResult> {
    const where: any = {
      organizationId: this.organizationId,
    };

    if (input.fiscalYearId) {
      where.fiscalYearId = input.fiscalYearId;
    }

    if (input.status) {
      where.status = input.status;
    }

    if (input.search) {
      where.OR = [
        { wtbCode: { contains: input.search, mode: 'insensitive' } },
        { wtbName: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [wtbs, total] = await Promise.all([
      this.prisma.workingTrialBalance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset,
        take: input.limit,
        include: {
          fiscalYear: {
            select: {
              yearCode: true,
              yearName: true,
            },
          },
          period: {
            select: {
              periodCode: true,
              periodName: true,
            },
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lockedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.workingTrialBalance.count({ where }),
    ]);

    return {
      workingTrialBalances: wtbs.map((wtb: any) => ({
        id: wtb.id,
        organizationId: wtb.organizationId,
        wtbCode: wtb.wtbCode,
        wtbName: wtb.wtbName,
        description: wtb.description,
        fiscalYearId: wtb.fiscalYearId,
        periodId: wtb.periodId,
        asOfDate: wtb.asOfDate,
        status: wtb.status,
        lockedAt: wtb.lockedAt,
        lockedBy: wtb.lockedByUser,
        includeZeroBalances: wtb.includeZeroBalances,
        groupBy: wtb.groupBy,
        createdAt: wtb.createdAt,
        updatedAt: wtb.updatedAt,
        createdBy: wtb.createdByUser,
        fiscalYear: wtb.fiscalYear,
        period: wtb.period,
      })),
      total,
      hasMore: input.offset + wtbs.length < total,
    };
  }

  // ===========================================================================
  // ADJUSTMENT COLUMNS
  // ===========================================================================

  /**
   * Add an adjustment column to working trial balance
   */
  async addAdjustmentColumn(input: AddAdjustmentColumnInput): Promise<AddAdjustmentColumnResult> {
    const wtb = await this.prisma.workingTrialBalance.findUnique({
      where: { id: input.wtbId },
      include: {
        adjustmentColumns: true,
      },
    });

    if (!wtb) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.organizationId !== this.organizationId) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.status === 'LOCKED') {
      throw new Error('Cannot add columns to locked working trial balance');
    }

    const displayOrder = wtb.adjustmentColumns.length + 1;

    const column = await this.prisma.adjustmentColumn.create({
      data: {
        wtbId: input.wtbId,
        columnName: input.columnName,
        columnType: input.columnType,
        journalEntryId: input.journalEntryId,
        description: input.description,
        displayOrder,
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
      },
    });

    await this.auditLogger.log({
      action: 'ADJUSTMENT_COLUMN_ADDED',
      entityType: 'working_trial_balance',
      entityId: input.wtbId,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        columnId: column.id,
        columnName: input.columnName,
        columnType: input.columnType,
      },
    });

    return {
      id: column.id,
      wtbId: column.wtbId,
      columnName: column.columnName,
      columnType: column.columnType,
      journalEntryId: column.journalEntryId,
      description: column.description,
      displayOrder: column.displayOrder,
      createdAt: column.createdAt,
      createdBy: column.createdByUser,
    };
  }

  /**
   * Record an adjustment in a working trial balance line
   */
  async recordAdjustment(input: RecordAdjustmentInput): Promise<RecordAdjustmentResult> {
    const wtb = await this.prisma.workingTrialBalance.findUnique({
      where: { id: input.wtbId },
    });

    if (!wtb) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.organizationId !== this.organizationId) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.status === 'LOCKED') {
      throw new Error('Cannot record adjustments to locked working trial balance');
    }

    // Validate column exists
    const column = await this.prisma.adjustmentColumn.findUnique({
      where: { id: input.columnId },
    });

    if (!column || column.wtbId !== input.wtbId) {
      throw new Error('Adjustment column not found');
    }

    // Find the line
    const line = await this.prisma.wtbLine.findFirst({
      where: {
        wtbId: input.wtbId,
        accountId: input.accountId,
      },
    });

    if (!line) {
      throw new Error('Account not found in working trial balance');
    }

    // Update adjustments array and recalculate adjusted balance
    const adjustments = line.adjustments || [];
    const existingIdx = adjustments.findIndex((a: any) => a.columnId === input.columnId);

    const adjustment = {
      columnId: input.columnId,
      amount: input.amount,
      reference: input.reference || null,
      description: input.description || null,
      updatedAt: new Date().toISOString(),
      updatedBy: this.userId,
    };

    if (existingIdx >= 0) {
      adjustments[existingIdx] = adjustment;
    } else {
      adjustments.push(adjustment);
    }

    // Calculate new adjusted balances
    let adjustedDebit = new Decimal(line.unadjustedDebit);
    let adjustedCredit = new Decimal(line.unadjustedCredit);

    for (const adj of adjustments) {
      if (adj.amount > 0) {
        adjustedDebit = adjustedDebit.plus(adj.amount);
      } else {
        adjustedCredit = adjustedCredit.plus(Math.abs(adj.amount));
      }
    }

    const updatedLine = await this.prisma.wtbLine.update({
      where: { id: line.id },
      data: {
        adjustments,
        adjustedDebit,
        adjustedCredit,
        updatedAt: new Date(),
      },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
      },
    });

    await this.auditLogger.log({
      action: 'ADJUSTMENT_RECORDED',
      entityType: 'working_trial_balance',
      entityId: input.wtbId,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        lineId: line.id,
        accountId: input.accountId,
        columnId: input.columnId,
        amount: input.amount,
      },
    });

    return {
      success: true,
      line: {
        id: updatedLine.id,
        wtbId: updatedLine.wtbId,
        accountId: updatedLine.accountId,
        accountCode: updatedLine.account.accountCode,
        accountName: updatedLine.account.accountName,
        unadjustedDebit: new Decimal(updatedLine.unadjustedDebit).toNumber(),
        unadjustedCredit: new Decimal(updatedLine.unadjustedCredit).toNumber(),
        adjustments: updatedLine.adjustments,
        adjustedDebit: new Decimal(updatedLine.adjustedDebit).toNumber(),
        adjustedCredit: new Decimal(updatedLine.adjustedCredit).toNumber(),
        isWarning: updatedLine.isWarning,
        notes: updatedLine.notes,
        displayOrder: updatedLine.displayOrder,
      },
    };
  }

  // ===========================================================================
  // LOCK AND DELETE
  // ===========================================================================

  /**
   * Lock a working trial balance
   */
  async lock(input: LockWTBInput): Promise<LockWTBResult> {
    const wtb = await this.prisma.workingTrialBalance.findUnique({
      where: { id: input.wtbId },
    });

    if (!wtb) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.organizationId !== this.organizationId) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.status === 'LOCKED') {
      throw new Error('Working trial balance is already locked');
    }

    if (wtb.status === 'ARCHIVED') {
      throw new Error('Cannot lock an archived working trial balance');
    }

    const updated = await this.prisma.workingTrialBalance.update({
      where: { id: input.wtbId },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy: this.userId,
        lockReason: input.lockReason,
        updatedAt: new Date(),
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lockedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogger.log({
      action: 'WORKING_TB_LOCKED',
      entityType: 'working_trial_balance',
      entityId: input.wtbId,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        wtbCode: wtb.wtbCode,
        lockReason: input.lockReason,
      },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      wtbCode: updated.wtbCode,
      wtbName: updated.wtbName,
      description: updated.description,
      fiscalYearId: updated.fiscalYearId,
      periodId: updated.periodId,
      asOfDate: updated.asOfDate,
      status: updated.status,
      lockedAt: updated.lockedAt,
      lockedBy: updated.lockedByUser,
      includeZeroBalances: updated.includeZeroBalances,
      groupBy: updated.groupBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      createdBy: updated.createdByUser,
    };
  }

  /**
   * Delete a working trial balance (only draft status)
   */
  async delete(input: DeleteWTBInput): Promise<DeleteWTBResult> {
    const wtb = await this.prisma.workingTrialBalance.findUnique({
      where: { id: input.wtbId },
    });

    if (!wtb) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.organizationId !== this.organizationId) {
      throw new Error('Working trial balance not found');
    }

    if (wtb.status === 'LOCKED') {
      throw new Error('Cannot delete a locked working trial balance');
    }

    // Delete related records first
    await this.prisma.wtbLine.deleteMany({
      where: { wtbId: input.wtbId },
    });

    await this.prisma.adjustmentColumn.deleteMany({
      where: { wtbId: input.wtbId },
    });

    await this.prisma.workingTrialBalance.delete({
      where: { id: input.wtbId },
    });

    await this.auditLogger.log({
      action: 'WORKING_TB_DELETED',
      entityType: 'working_trial_balance',
      entityId: input.wtbId,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        wtbCode: wtb.wtbCode,
        wtbName: wtb.wtbName,
      },
    });

    return {
      success: true,
      wtbId: wtb.id,
      wtbCode: wtb.wtbCode,
    };
  }

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  /**
   * Export trial balance to various formats
   */
  async export(input: ExportTrialBalanceInput): Promise<ExportTrialBalanceResult> {
    // Generate trial balance first
    const tb = await this.generate({
      asOfDate: input.asOfDate,
      includeZeroBalances: input.includeZeroBalances ?? false,
      groupBy: input.groupBy ?? 'NONE',
      includeInactiveAccounts: true,
      includeOpeningBalance: true,
      includeMovements: true,
    });

    let data: string;
    let contentType: string;
    let filename: string;

    const dateStr = new Date(input.asOfDate).toISOString().split('T')[0];

    switch (input.format) {
      case 'XLSX':
        data = await this.generateExcel(tb, input);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `trial_balance_${dateStr}.xlsx`;
        break;

      case 'PDF':
        data = await this.generatePDF(tb, input);
        contentType = 'application/pdf';
        filename = `trial_balance_${dateStr}.pdf`;
        break;

      case 'CSV':
        data = this.generateCSV(tb);
        contentType = 'text/csv';
        filename = `trial_balance_${dateStr}.csv`;
        break;

      default:
        throw new Error(`Unsupported export format: ${input.format}`);
    }

    await this.auditLogger.log({
      action: 'TRIAL_BALANCE_EXPORTED',
      entityType: 'trial_balance',
      entityId: null,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        asOfDate: input.asOfDate,
        format: input.format,
        filename,
      },
    });

    return {
      filename,
      contentType,
      data,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Get account balances from general ledger
   */
  private async getAccountBalances(
    accountIds: string[],
    asOfDate: Date,
    periodId?: string
  ): Promise<Map<string, { debit: Decimal; credit: Decimal }>> {
    const where: any = {
      organizationId: this.organizationId,
      accountId: { in: accountIds },
      transactionDate: { lte: asOfDate },
    };

    if (periodId) {
      where.periodId = periodId;
    }

    const entries = await this.prisma.generalLedgerEntry.groupBy({
      by: ['accountId'],
      where,
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
   * Check if account has unusual balance (opposite of normal balance)
   */
  private hasUnusualBalance(normalBalance: string, debit: Decimal, credit: Decimal): boolean {
    const netBalance = debit.minus(credit);
    if (normalBalance === 'DEBIT' && netBalance.isNegative()) return true;
    if (normalBalance === 'CREDIT' && netBalance.isPositive()) return true;
    return false;
  }

  /**
   * Get account level from account code
   */
  private getAccountLevel(accountCode: string): number {
    if (accountCode.length <= 3) return 1;
    if (accountCode.length <= 5) return 2;
    return 3;
  }

  /**
   * Apply grouping to trial balance lines
   */
  private applyGrouping(lines: TrialBalanceLine[], groupBy: string): TrialBalanceLine[] {
    if (groupBy === 'NONE') return lines;

    if (groupBy === 'CLASS') {
      const grouped: TrialBalanceLine[] = [];
      const classes = new Map<number, TrialBalanceLine[]>();

      for (const line of lines) {
        if (!classes.has(line.accountClass)) {
          classes.set(line.accountClass, []);
        }
        classes.get(line.accountClass)!.push(line);
      }

      for (const [accountClass, classLines] of classes) {
        // Add class header
        const totals = this.calculateTotals(classLines);
        grouped.push({
          accountId: '',
          accountCode: `${accountClass}`,
          accountName: this.getAccountClassName(accountClass),
          accountClass,
          accountType: '',
          parentAccountId: null,
          normalBalance: 'DEBIT',
          isActive: true,
          debitBalance: totals.debit,
          creditBalance: totals.credit,
          isGroupHeader: true,
          level: 0,
        });
        grouped.push(...classLines);
      }

      return grouped;
    }

    // PARENT grouping - group by parent account
    return lines;
  }

  /**
   * Apply grouping to comparative lines
   */
  private applyComparativeGrouping(lines: any[], groupBy: string): any[] {
    if (groupBy === 'NONE') return lines;
    // Similar logic for comparative grouping
    return lines;
  }

  /**
   * Calculate totals from trial balance lines
   */
  private calculateTotals(lines: TrialBalanceLine[]): TrialBalanceTotals {
    let debit = new Decimal(0);
    let credit = new Decimal(0);

    for (const line of lines) {
      if (!line.isGroupHeader) {
        debit = debit.plus(line.debitBalance);
        credit = credit.plus(line.creditBalance);
      }
    }

    return {
      debit: debit.toNumber(),
      credit: credit.toNumber(),
    };
  }

  /**
   * Get account class name
   */
  private getAccountClassName(accountClass: number): string {
    const classNames: Record<number, string> = {
      0: 'Środki trwałe (Fixed Assets)',
      1: 'Środki pieniężne (Cash)',
      2: 'Rozrachunki (Settlements)',
      3: 'Materiały i towary (Materials)',
      4: 'Koszty (Costs)',
      5: 'Koszty układu kalkulacyjnego (Cost Allocation)',
      6: 'Produkty (Products)',
      7: 'Przychody (Revenues)',
      8: 'Wynik finansowy (Financial Result)',
      9: 'Konta pozabilansowe (Off-balance)',
    };
    return classNames[accountClass] || `Class ${accountClass}`;
  }

  /**
   * Generate WTB code
   */
  private async generateWTBCode(asOfDate: Date): Promise<string> {
    const year = asOfDate.getFullYear();
    const prefix = `WTB-${year}-`;

    const count = await this.prisma.workingTrialBalance.count({
      where: {
        organizationId: this.organizationId,
        wtbCode: { startsWith: prefix },
      },
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Generate Excel export
   */
  private async generateExcel(tb: TrialBalanceResult, _input: ExportTrialBalanceInput): Promise<string> {
    // In production, use a library like exceljs
    // For now, return base64 encoded placeholder
    const content = this.generateCSV(tb);
    return Buffer.from(content).toString('base64');
  }

  /**
   * Generate PDF export
   */
  private async generatePDF(tb: TrialBalanceResult, _input: ExportTrialBalanceInput): Promise<string> {
    // In production, use a library like pdfkit or puppeteer
    // For now, return base64 encoded placeholder
    const content = `Trial Balance as of ${tb.asOfDate.toISOString()}\n\n${this.generateCSV(tb)}`;
    return Buffer.from(content).toString('base64');
  }

  /**
   * Generate CSV export
   */
  private generateCSV(tb: TrialBalanceResult): string {
    const lines = ['Account Code,Account Name,Debit,Credit'];

    for (const line of tb.lines) {
      lines.push(`"${line.accountCode}","${line.accountName}",${line.debitBalance},${line.creditBalance}`);
    }

    lines.push(`"","TOTALS",${tb.totals.debit},${tb.totals.credit}`);

    return lines.join('\n');
  }
}
