import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { Decimal } from 'decimal.js';
import { TRPCError } from '@trpc/server';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  GetAccountLedgerInput,
  GetFullGLReportInput,
  GetAccountBalanceInput,
  GetAccountBalancesInput,
  RecalculateBalanceInput,
  PostToGLInput,
  BatchRecalculateBalancesInput,
  AccountLedger,
  FullGLReport,
  AccountBalanceResponse,
  AccountBalancesResponse,
  RecalculateBalanceResult,
  PostToGLResult,
  BatchRecalculateResult,
  NormalBalance,
} from '@ksiegowacrm/shared';

/**
 * ACC-008: General Ledger Service
 * Manages GL entries, account balances, and ledger reporting
 */
export class GeneralLedgerService {
  private readonly CACHE_PREFIX = 'gl';
  private readonly CACHE_TTL = 300 as const; // 5 minutes - reserved for future caching
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly _validateCacheConfig = () => this.CACHE_TTL > 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly auditLogger: AuditLogger,
    private readonly userId: string,
    private readonly organizationId: string
  ) {
    // Suppress unused warnings for reserved properties
    void this._validateCacheConfig;
  }

  // ===========================================================================
  // GET ACCOUNT LEDGER
  // ===========================================================================

  /**
   * Get ledger entries for a single account with optional running balance
   */
  async getAccountLedger(input: GetAccountLedgerInput): Promise<AccountLedger> {
    // Get account details
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: input.accountId, organizationId: this.organizationId },
    });

    if (!account) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
    }

    // Build query conditions
    const where: any = {
      organizationId: this.organizationId,
      accountId: input.accountId,
    };

    let periodInfo: { name: string; startDate: Date; endDate: Date } | undefined;

    if (input.periodId) {
      where.periodId = input.periodId;
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: input.periodId },
      });
      if (period) {
        periodInfo = {
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
        };
      }
    }

    if (input.fiscalYearId) {
      where.period = { fiscalYearId: input.fiscalYearId };
    }

    if (input.dateRange) {
      where.entryDate = {
        gte: input.dateRange.from,
        lte: input.dateRange.to,
      };
    }

    if (input.entryTypes && input.entryTypes.length > 0) {
      where.entryType = { in: input.entryTypes };
    }

    if (input.search) {
      where.OR = [
        { description: { contains: input.search, mode: 'insensitive' } },
        { reference: { contains: input.search, mode: 'insensitive' } },
        { entryNumber: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    if (input.costCenterId) {
      where.costCenterId = input.costCenterId;
    }

    if (input.projectId) {
      where.projectId = input.projectId;
    }

    // Calculate opening balance
    const openingBalanceDate = input.dateRange?.from || periodInfo?.startDate;
    const openingBalance = await this.calculateOpeningBalance(
      input.accountId,
      account.normalBalance as NormalBalance,
      openingBalanceDate
    );

    // Fetch ledger entries with pagination
    const orderDirection = input.orderBy === 'date_asc' ? 'asc' : 'desc';
    const [entries, total] = await Promise.all([
      this.prisma.generalLedgerEntry.findMany({
        where,
        include: {
          entry: { select: { entryType: true, description: true, reference: true } },
        },
        orderBy: [
          { entryDate: orderDirection },
          { postedAt: orderDirection },
        ],
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.generalLedgerEntry.count({ where }),
    ]);

    // Calculate running balance if requested and order is ascending
    let entriesWithBalance = entries.map((e: any) => ({
      id: e.id,
      entryDate: e.entryDate,
      entryNumber: e.entryNumber,
      entryType: e.entry?.entryType ?? null,
      entryId: e.entryId,
      description: e.entry?.description ?? null,
      reference: e.entry?.reference ?? null,
      debitAmount: Number(e.debitAmount),
      creditAmount: Number(e.creditAmount),
      runningBalance: undefined as number | undefined,
      costCenterName: null, // Cost center not available on GL entry
      projectName: null, // Project not available on GL entry
      postedAt: e.postedAt,
    }));

    if (input.includeRunningBalance && input.orderBy === 'date_asc') {
      let runningBalance = new Decimal(openingBalance);

      entriesWithBalance = entriesWithBalance.map((entry) => {
        const movement = account.normalBalance === 'debit'
          ? new Decimal(entry.debitAmount).minus(entry.creditAmount)
          : new Decimal(entry.creditAmount).minus(entry.debitAmount);

        runningBalance = runningBalance.plus(movement);

        return {
          ...entry,
          runningBalance: runningBalance.toNumber(),
        };
      });
    }

    // Calculate totals
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const entry of entries) {
      totalDebits = totalDebits.plus(entry.debitAmount);
      totalCredits = totalCredits.plus(entry.creditAmount);
    }

    const netMovement = account.normalBalance === 'debit'
      ? totalDebits.minus(totalCredits)
      : totalCredits.minus(totalDebits);

    const closingBalance = new Decimal(openingBalance).plus(netMovement);

    return {
      account: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        normalBalance: account.normalBalance as NormalBalance,
      },
      period: periodInfo,
      openingBalance,
      entries: entriesWithBalance,
      totals: {
        debitTotal: totalDebits.toNumber(),
        creditTotal: totalCredits.toNumber(),
        netMovement: netMovement.toNumber(),
        closingBalance: closingBalance.toNumber(),
      },
      pagination: {
        total,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + entries.length < total,
      },
    };
  }

  // ===========================================================================
  // GET FULL GL REPORT
  // ===========================================================================

  /**
   * Generate full GL report with all accounts
   */
  async getFullReport(input: GetFullGLReportInput): Promise<FullGLReport> {
    // Get all active accounts
    const accountsWhere: any = {
      organizationId: this.organizationId,
      isActive: true,
    };

    if (input.accountTypes && input.accountTypes.length > 0) {
      accountsWhere.accountType = { in: input.accountTypes };
    }

    const accounts = await this.prisma.chartOfAccount.findMany({
      where: accountsWhere,
      orderBy: { accountCode: 'asc' },
    });

    // Determine date range and period name
    let dateFrom: Date;
    let dateTo: Date;
    let periodName: string;

    if (input.dateRange) {
      dateFrom = input.dateRange.from;
      dateTo = input.dateRange.to;
      periodName = `${dateFrom.toLocaleDateString('pl-PL')} - ${dateTo.toLocaleDateString('pl-PL')}`;
    } else if (input.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: input.periodId },
      });
      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Period not found',
        });
      }
      dateFrom = period.startDate;
      dateTo = period.endDate;
      periodName = period.name;
    } else if (input.fiscalYearId) {
      const year = await this.prisma.fiscalYear.findFirst({
        where: { id: input.fiscalYearId },
      });
      if (!year) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Fiscal year not found',
        });
      }
      dateFrom = year.startDate;
      dateTo = year.endDate;
      periodName = year.name;
    } else {
      // Default to current month
      const now = new Date();
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodName = dateFrom.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    }

    // Get balances and movements for each account
    const accountSummaries: any[] = [];

    for (const account of accounts) {
      const openingBalance = await this.calculateOpeningBalance(
        account.id,
        account.normalBalance as NormalBalance,
        dateFrom
      );

      const movements = await this.prisma.generalLedgerEntry.aggregate({
        where: {
          organizationId: this.organizationId,
          accountId: account.id,
          entryDate: { gte: dateFrom, lte: dateTo },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
        _count: true,
      });

      const debitMovements = Number(movements._sum.debitAmount || 0);
      const creditMovements = Number(movements._sum.creditAmount || 0);
      const entryCount = movements._count;

      const netMovement = account.normalBalance === 'debit'
        ? new Decimal(debitMovements).minus(creditMovements)
        : new Decimal(creditMovements).minus(debitMovements);

      const closingBalance = new Decimal(openingBalance).plus(netMovement);

      // Skip zero balance accounts if not included
      if (!input.includeZeroBalance &&
          closingBalance.isZero() &&
          debitMovements === 0 &&
          creditMovements === 0) {
        continue;
      }

      accountSummaries.push({
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        openingBalance,
        debitMovements,
        creditMovements,
        closingBalance: closingBalance.toNumber(),
        entryCount,
      });
    }

    // Group by account type if requested
    let groupedByType: Record<string, any[]> | undefined;

    if (input.groupByType) {
      const grouped: Record<string, any[]> = {};
      for (const summary of accountSummaries) {
        const accountType = summary.accountType;
        if (!grouped[accountType]) {
          grouped[accountType] = [];
        }
        grouped[accountType]!.push(summary);
      }
      groupedByType = grouped;
    }

    // Calculate totals
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    let totalEntries = 0;

    for (const summary of accountSummaries) {
      totalDebits = totalDebits.plus(summary.debitMovements);
      totalCredits = totalCredits.plus(summary.creditMovements);
      totalEntries += summary.entryCount;
    }

    return {
      reportTitle: 'General Ledger Report',
      period: periodName,
      generatedAt: new Date(),
      accounts: accountSummaries,
      groupedByType,
      totals: {
        totalDebits: totalDebits.toNumber(),
        totalCredits: totalCredits.toNumber(),
        accountCount: accountSummaries.length,
        entryCount: totalEntries,
      },
    };
  }

  // ===========================================================================
  // GET ACCOUNT BALANCE
  // ===========================================================================

  /**
   * Get account balance as of a specific date
   */
  async getAccountBalance(input: GetAccountBalanceInput): Promise<AccountBalanceResponse> {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: input.accountId, organizationId: this.organizationId },
    });

    if (!account) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
    }

    // Sum all movements up to date
    const movements = await this.prisma.generalLedgerEntry.aggregate({
      where: {
        organizationId: this.organizationId,
        accountId: input.accountId,
        entryDate: { lte: input.asOfDate },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const debits = new Decimal(movements._sum.debitAmount || 0);
    const credits = new Decimal(movements._sum.creditAmount || 0);

    const balance = account.normalBalance === 'debit'
      ? debits.minus(credits)
      : credits.minus(debits);

    return {
      accountId: input.accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      asOfDate: input.asOfDate ?? new Date(),
      debitTotal: debits.toNumber(),
      creditTotal: credits.toNumber(),
      balance: balance.toNumber(),
    };
  }

  // ===========================================================================
  // GET ACCOUNT BALANCES (MULTIPLE)
  // ===========================================================================

  /**
   * Get balances for multiple accounts in a period
   */
  async getAccountBalances(input: GetAccountBalancesInput): Promise<AccountBalancesResponse[]> {
    const balances = await this.prisma.accountBalance.findMany({
      where: {
        accountId: { in: input.accountIds },
        periodId: input.periodId,
        account: { organizationId: this.organizationId },
      },
      include: {
        account: {
          select: {
            accountCode: true,
            accountName: true,
            accountType: true,
            normalBalance: true,
          },
        },
      },
    });

    return balances.map((b: any) => ({
      accountId: b.accountId,
      accountCode: b.account.accountCode,
      accountName: b.account.accountName,
      accountType: b.account.accountType,
      openingBalance: Number(b.openingBalance),
      debitMovements: Number(b.debitMovements),
      creditMovements: Number(b.creditMovements),
      closingBalance: Number(b.closingBalance),
    }));
  }

  // ===========================================================================
  // RECALCULATE BALANCE
  // ===========================================================================

  /**
   * Recalculate and update balance for account/period
   */
  async recalculateBalance(input: RecalculateBalanceInput): Promise<RecalculateBalanceResult> {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: input.accountId, organizationId: this.organizationId },
    });

    if (!account) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: input.periodId },
    });

    if (!period) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Period not found',
      });
    }

    // Calculate opening balance from prior activity
    const openingBalance = await this.calculateOpeningBalance(
      input.accountId,
      account.normalBalance as NormalBalance,
      period.startDate
    );

    // Sum movements in period
    const movements = await this.prisma.generalLedgerEntry.aggregate({
      where: {
        organizationId: this.organizationId,
        accountId: input.accountId,
        periodId: input.periodId,
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const debitMovements = Number(movements._sum.debitAmount || 0);
    const creditMovements = Number(movements._sum.creditAmount || 0);

    const netMovement = account.normalBalance === 'debit'
      ? new Decimal(debitMovements).minus(creditMovements)
      : new Decimal(creditMovements).minus(debitMovements);

    const closingBalance = new Decimal(openingBalance).plus(netMovement);

    // Update balance record
    await this.prisma.accountBalance.upsert({
      where: {
        accountId_periodId: {
          accountId: input.accountId,
          periodId: input.periodId,
        },
      },
      create: {
        accountId: input.accountId,
        periodId: input.periodId,
        organizationId: this.organizationId,
        openingBalance,
        debitMovements,
        creditMovements,
        closingBalance: closingBalance.toNumber(),
      },
      update: {
        openingBalance,
        debitMovements,
        creditMovements,
        closingBalance: closingBalance.toNumber(),
        lastUpdated: new Date(),
      },
    });

    // Audit log
    await this.auditLogger.log({
      action: 'BALANCE_RECALCULATED',
      entityType: 'ACCOUNT_BALANCE',
      entityId: input.accountId,
      userId: this.userId,
      organizationId: this.organizationId,
      details: {
        accountCode: account.accountCode,
        periodName: period.name,
        closingBalance: closingBalance.toString(),
      },
    });

    return {
      success: true,
      accountId: input.accountId,
      periodId: input.periodId,
      openingBalance,
      debitMovements,
      creditMovements,
      closingBalance: closingBalance.toNumber(),
    };
  }

  // ===========================================================================
  // POST TO GL
  // ===========================================================================

  /**
   * Post journal entry to general ledger
   */
  async postToGL(input: PostToGLInput): Promise<PostToGLResult> {
    // Get entry with period info
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
      include: {
        period: true,
      },
    });

    if (!entry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      });
    }

    if (entry.status === 'POSTED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Entry is already posted',
      });
    }

    if (entry.period.status === 'closed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot post to closed period',
      });
    }

    // Get entry lines
    const lines = await this.prisma.journalLine.findMany({
      where: { entryId: input.entryId },
      include: { account: true },
    });

    // Create GL records
    const glRecords = lines.map((line: any) => ({
      organizationId: this.organizationId,
      entryId: entry.id,
      lineId: line.id,
      accountId: line.accountId,
      periodId: entry.periodId,
      entryDate: entry.entryDate,
      entryNumber: entry.entryNumber,
      entryType: entry.entryType,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.description || entry.description,
      reference: entry.reference,
      costCenterId: line.costCenterId || null,
      projectId: line.projectId || null,
      postedAt: new Date(),
    }));

    // Use transaction for atomic posting
    const result = await this.prisma.$transaction(async (tx) => {
      // Create GL records
      const created = await tx.generalLedgerEntry.createMany({
        data: glRecords,
      });

      // Update entry status
      await tx.journalEntry.update({
        where: { id: input.entryId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedBy: this.userId,
        },
      });

      // Update account balances
      const accountIds = [...new Set(lines.map((l: any) => l.accountId))];
      for (const accountId of accountIds) {
        const account = await tx.chartOfAccount.findFirst({
          where: { id: accountId },
        });

        if (account) {
          const accountLines = lines.filter((l: any) => l.accountId === accountId);
          let debitSum = new Decimal(0);
          let creditSum = new Decimal(0);

          for (const line of accountLines) {
            debitSum = debitSum.plus(line.debitAmount);
            creditSum = creditSum.plus(line.creditAmount);
          }

          await tx.accountBalance.upsert({
            where: {
              accountId_periodId: {
                accountId,
                periodId: entry.periodId,
              },
            },
            create: {
              accountId,
              periodId: entry.periodId,
              organizationId: this.organizationId,
              openingBalance: 0,
              debitMovements: debitSum.toNumber(),
              creditMovements: creditSum.toNumber(),
              closingBalance: account.normalBalance === 'debit'
                ? debitSum.minus(creditSum).toNumber()
                : creditSum.minus(debitSum).toNumber(),
            },
            update: {
              debitMovements: {
                increment: debitSum.toNumber(),
              },
              creditMovements: {
                increment: creditSum.toNumber(),
              },
              closingBalance: {
                increment: account.normalBalance === 'debit'
                  ? debitSum.minus(creditSum).toNumber()
                  : creditSum.minus(debitSum).toNumber(),
              },
              lastUpdated: new Date(),
            },
          });
        }
      }

      return {
        recordsCreated: created.count,
        balancesUpdated: accountIds.length,
      };
    });

    // Invalidate caches
    const cacheKeys = await this.redis.keys(`${this.CACHE_PREFIX}:${this.organizationId}:*`);
    if (cacheKeys.length > 0) {
      await this.redis.del(...cacheKeys);
    }

    // Audit log
    await this.auditLogger.log({
      action: 'ENTRY_POSTED_TO_GL',
      entityType: 'JOURNAL_ENTRY',
      entityId: input.entryId,
      userId: this.userId,
      organizationId: this.organizationId,
      details: {
        entryNumber: entry.entryNumber,
        recordsCreated: result.recordsCreated,
      },
    });

    return {
      success: true,
      entryId: input.entryId,
      recordsCreated: result.recordsCreated,
      balancesUpdated: result.balancesUpdated,
    };
  }

  // ===========================================================================
  // BATCH RECALCULATE BALANCES
  // ===========================================================================

  /**
   * Recalculate balances for multiple accounts in a period
   */
  async batchRecalculateBalances(input: BatchRecalculateBalancesInput): Promise<BatchRecalculateResult> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: input.periodId },
    });

    if (!period) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Period not found',
      });
    }

    // Get accounts to process
    const accountsWhere: any = {
      organizationId: this.organizationId,
      isActive: true,
    };

    if (input.accountIds && input.accountIds.length > 0) {
      accountsWhere.id = { in: input.accountIds };
    }

    const accounts = await this.prisma.chartOfAccount.findMany({
      where: accountsWhere,
    });

    let processed = 0;
    const errors: { accountId: string; error: string }[] = [];

    for (const account of accounts) {
      try {
        // Calculate opening balance
        const openingBalance = await this.calculateOpeningBalance(
          account.id,
          account.normalBalance as NormalBalance,
          period.startDate
        );

        // Sum movements in period
        const movements = await this.prisma.generalLedgerEntry.aggregate({
          where: {
            organizationId: this.organizationId,
            accountId: account.id,
            periodId: input.periodId,
          },
          _sum: {
            debitAmount: true,
            creditAmount: true,
          },
        });

        const debitMovements = Number(movements._sum.debitAmount || 0);
        const creditMovements = Number(movements._sum.creditAmount || 0);

        const netMovement = account.normalBalance === 'debit'
          ? new Decimal(debitMovements).minus(creditMovements)
          : new Decimal(creditMovements).minus(debitMovements);

        const closingBalance = new Decimal(openingBalance).plus(netMovement);

        // Update balance record
        await this.prisma.accountBalance.upsert({
          where: {
            accountId_periodId: {
              accountId: account.id,
              periodId: input.periodId,
            },
          },
          create: {
            accountId: account.id,
            periodId: input.periodId,
            organizationId: this.organizationId,
            openingBalance,
            debitMovements,
            creditMovements,
            closingBalance: closingBalance.toNumber(),
          },
          update: {
            openingBalance,
            debitMovements,
            creditMovements,
            closingBalance: closingBalance.toNumber(),
            lastUpdated: new Date(),
          },
        });

        processed++;
      } catch (error) {
        errors.push({
          accountId: account.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Audit log
    await this.auditLogger.log({
      action: 'BATCH_BALANCES_RECALCULATED',
      entityType: 'ACCOUNT_BALANCE',
      entityId: input.periodId,
      userId: this.userId,
      organizationId: this.organizationId,
      details: {
        periodId: input.periodId,
        accountsProcessed: processed,
        errorsCount: errors.length,
      },
    });

    return {
      success: errors.length === 0,
      accountsProcessed: processed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Calculate opening balance for a date
   */
  private async calculateOpeningBalance(
    accountId: string,
    normalBalance: NormalBalance,
    asOfDate?: Date
  ): Promise<number> {
    if (!asOfDate) return 0;

    const priorMovements = await this.prisma.generalLedgerEntry.aggregate({
      where: {
        organizationId: this.organizationId,
        accountId,
        entryDate: { lt: asOfDate },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const debits = new Decimal(priorMovements._sum.debitAmount || 0);
    const credits = new Decimal(priorMovements._sum.creditAmount || 0);

    const balance = normalBalance === 'DEBIT'
      ? debits.minus(credits)
      : credits.minus(debits);

    return balance.toNumber();
  }
}
