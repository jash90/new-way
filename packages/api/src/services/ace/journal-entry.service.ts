/**
 * ACC-006: Journal Entry Service
 * Manages journal entries with double-entry bookkeeping validation
 */

import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type {
  CreateJournalEntryInput,
  GetJournalEntryInput,
  UpdateJournalEntryInput,
  DeleteJournalEntryInput,
  PostJournalEntryInput,
  QueryJournalEntriesInput,
  GetJournalEntryStatsInput,
  ValidateJournalEntryInput,
  CopyJournalEntryInput,
  GetNextEntryNumberInput,
  AttachDocumentInput,
  DetachDocumentInput,
  BulkPostEntriesInput,
  BulkDeleteEntriesInput,
  CreateJournalEntryResult,
  UpdateJournalEntryResult,
  DeleteJournalEntryResult,
  PostJournalEntryResult,
  QueryJournalEntriesResult,
  JournalEntryStats,
  JournalEntryValidationResult,
  NextEntryNumberResult,
  BulkPostEntriesResult,
  BulkDeleteEntriesResult,
  JournalEntryType,
  JournalEntryStatus,
} from '@ksiegowacrm/shared';
import { ENTRY_TYPE_PREFIXES } from '@ksiegowacrm/shared';

interface AuditLogger {
  log: (entry: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
    organizationId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    details?: Record<string, unknown>;
  }) => void;
}

// Reserved for future line data operations
// @ts-expect-error Reserved for future implementation
interface _JournalLineData {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
  currency?: string;
  exchangeRate?: number;
  costCenterId?: string | null;
  projectId?: string | null;
  taxCode?: string | null;
  taxAmount?: number | null;
}

export class JournalEntryService {
  // Reserved for future caching implementation
  private readonly _CACHE_PREFIX = 'journal-entry';
  private readonly _CACHE_TTL = 300; // 5 minutes

  // Suppress unused warnings for cache-related fields
  private _suppressCacheWarnings() {
    void this._CACHE_PREFIX;
    void this._CACHE_TTL;
  }

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly auditLogger: AuditLogger,
    private readonly userId: string,
    private readonly organizationId: string
  ) {
    // Call to suppress unused variable warnings
    this._suppressCacheWarnings();
  }

  // =========================================================================
  // CREATE ENTRY
  // =========================================================================

  /**
   * Create a new journal entry
   */
  async createEntry(input: CreateJournalEntryInput): Promise<CreateJournalEntryResult> {
    // Validate entry is balanced
    const totalDebits = input.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = input.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

    if (Math.abs(totalDebits - totalCredits) >= 0.01) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Entry is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}, Difference: ${Math.abs(totalDebits - totalCredits)}`,
      });
    }

    // Find period for date
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        fiscalYear: { organizationId: this.organizationId },
        startDate: { lte: input.entryDate },
        endDate: { gte: input.entryDate },
      },
      include: {
        fiscalYear: true,
      },
    });

    if (!period) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No accounting period found for the specified date',
      });
    }

    if (period.status === 'closed') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Cannot create entry in a closed period',
      });
    }

    // Validate accounts
    const accountIds = input.lines.map((line) => line.accountId);
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        id: { in: accountIds },
        organizationId: this.organizationId,
      },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    for (const line of input.lines) {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Account not found: ${line.accountId}`,
        });
      }
      if (account.status !== 'active') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Account is inactive: ${account.accountCode} - ${account.accountName}`,
        });
      }
      if (!account.allowsPosting) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Account does not allow posting (header account): ${account.accountCode} - ${account.accountName}`,
        });
      }
    }

    // Generate entry number
    const entryType = input.entryType || 'STANDARD';
    const entryNumber = await this.generateEntryNumber(entryType, input.entryDate);

    // Create the entry
    const entry = await this.prisma.journalEntry.create({
      data: {
        organizationId: this.organizationId,
        periodId: period.id,
        fiscalYearId: period.fiscalYearId,
        entryNumber,
        entryDate: input.entryDate,
        entryType,
        status: 'DRAFT',
        description: input.description,
        reference: input.reference || null,
        totalDebit: totalDebits,
        totalCredit: totalCredits,
        baseCurrency: 'PLN', // Default to PLN
        requiresApproval: input.requiresApproval || false,
        createdBy: this.userId,
        lines: {
          create: input.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: line.debitAmount || 0,
            creditAmount: line.creditAmount || 0,
            baseDebitAmount: (line.debitAmount || 0) * (line.exchangeRate || 1),
            baseCreditAmount: (line.creditAmount || 0) * (line.exchangeRate || 1),
            currency: line.currency || 'PLN',
            exchangeRate: line.exchangeRate || 1,
            description: line.description || null,
            costCenterId: line.costCenterId || null,
            // projectId, taxCode, taxAmount not in current schema
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        period: true,
      },
    });

    await this.invalidateCache();

    this.auditLogger.log({
      action: 'JOURNAL_ENTRY_CREATED',
      entityType: 'JOURNAL_ENTRY',
      entityId: entry.id,
      userId: this.userId,
      organizationId: this.organizationId,
      newValues: {
        entryNumber: entry.entryNumber,
        entryType: entry.entryType,
        description: entry.description,
        lineCount: entry.lines.length,
        totalDebit: totalDebits,
        totalCredit: totalCredits,
      },
    });

    return this.mapEntryToResult(entry);
  }

  // =========================================================================
  // GET ENTRY
  // =========================================================================

  /**
   * Get a journal entry with lines
   */
  async getEntry(input: GetJournalEntryInput): Promise<CreateJournalEntryResult> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        period: true,
        fiscalYear: true,
      },
    });

    if (!entry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      });
    }

    return this.mapEntryToResult(entry);
  }

  // =========================================================================
  // UPDATE ENTRY
  // =========================================================================

  /**
   * Update a draft journal entry
   */
  async updateEntry(input: UpdateJournalEntryInput): Promise<UpdateJournalEntryResult> {
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

    if (entry.status === 'POSTED' || entry.status === 'REVERSED') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Cannot update ${entry.status.toLowerCase()} entry. Create a reversal or adjustment instead.`,
      });
    }

    const updateData: Record<string, unknown> = {};

    // Handle date change - need to update period
    if (input.entryDate) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: {
          fiscalYear: { organizationId: this.organizationId },
          startDate: { lte: input.entryDate },
          endDate: { gte: input.entryDate },
        },
      });

      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No accounting period found for the specified date',
        });
      }

      if (period.status === 'closed') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot move entry to a closed period',
        });
      }

      updateData.entryDate = input.entryDate;
      updateData.periodId = period.id;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.reference !== undefined) {
      updateData.reference = input.reference;
    }
    // notes and tags are not in current schema - skip
    // if (input.requiresApproval !== undefined) - requiresApproval exists on schema

    // Handle lines update
    if (input.lines) {
      // Validate balance
      const totalDebits = input.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
      const totalCredits = input.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

      if (Math.abs(totalDebits - totalCredits) >= 0.01) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Entry is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`,
        });
      }

      // Validate accounts
      const accountIds = input.lines.map((line) => line.accountId);
      const accounts = await this.prisma.chartOfAccount.findMany({
        where: {
          id: { in: accountIds },
          organizationId: this.organizationId,
        },
      });

      const accountMap = new Map(accounts.map((a) => [a.id, a]));
      for (const line of input.lines) {
        const account = accountMap.get(line.accountId);
        if (!account) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Account not found: ${line.accountId}`,
          });
        }
        if (account.status !== 'active') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Account is inactive: ${account.accountCode}`,
          });
        }
        if (!account.allowsPosting) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Account does not allow posting: ${account.accountCode}`,
          });
        }
      }

      // Delete existing lines and create new ones
      await this.prisma.journalLine.deleteMany({
        where: { entryId: input.entryId },
      });

      await this.prisma.journalLine.createMany({
        data: input.lines.map((line, index) => ({
          entryId: input.entryId,
          lineNumber: index + 1,
          accountId: line.accountId,
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
          baseDebitAmount: (line.debitAmount || 0) * (line.exchangeRate || 1),
          baseCreditAmount: (line.creditAmount || 0) * (line.exchangeRate || 1),
          currency: line.currency || 'PLN',
          exchangeRate: line.exchangeRate || 1,
          description: line.description || null,
          costCenterId: line.costCenterId || null,
          // projectId, taxCode, taxAmount not in current schema
        })),
      });

      updateData.totalDebit = totalDebits;
      updateData.totalCredit = totalCredits;
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id: input.entryId },
      data: updateData,
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        period: true,
      },
    });

    await this.invalidateCache();

    this.auditLogger.log({
      action: 'JOURNAL_ENTRY_UPDATED',
      entityType: 'JOURNAL_ENTRY',
      entityId: input.entryId,
      userId: this.userId,
      organizationId: this.organizationId,
      newValues: updateData,
    });

    return this.mapEntryToResult(updated);
  }

  // =========================================================================
  // DELETE ENTRY
  // =========================================================================

  /**
   * Delete a draft journal entry
   */
  async deleteEntry(input: DeleteJournalEntryInput): Promise<DeleteJournalEntryResult> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
    });

    if (!entry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      });
    }

    if (entry.status !== 'DRAFT') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Cannot delete ${entry.status.toLowerCase()} entry. Only draft entries can be deleted.`,
      });
    }

    await this.prisma.journalEntry.delete({
      where: { id: input.entryId },
    });

    await this.invalidateCache();

    this.auditLogger.log({
      action: 'JOURNAL_ENTRY_DELETED',
      entityType: 'JOURNAL_ENTRY',
      entityId: input.entryId,
      userId: this.userId,
      organizationId: this.organizationId,
      oldValues: {
        entryNumber: entry.entryNumber,
        description: entry.description,
        entryType: entry.entryType,
      },
    });

    return {
      success: true,
      entryNumber: entry.entryNumber,
      deletedId: input.entryId,
    };
  }

  // =========================================================================
  // POST ENTRY
  // =========================================================================

  /**
   * Post a journal entry to the general ledger
   */
  async postEntry(input: PostJournalEntryInput): Promise<PostJournalEntryResult> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
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
        code: 'CONFLICT',
        message: 'Entry is already posted',
      });
    }

    if (entry.status === 'REVERSED') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Cannot post a reversed entry',
      });
    }

    if (entry.period.status === 'closed') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Cannot post entry to a closed period',
      });
    }

    // Check approval requirement
    if (entry.requiresApproval && !entry.approvedAt && !input.bypassApproval) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Entry requires approval before posting',
      });
    }

    // Validate entry is still balanced (data corruption check)
    const totalDebits = entry.lines.reduce(
      (sum, line) => sum + Number(line.debitAmount),
      0
    );
    const totalCredits = entry.lines.reduce(
      (sum, line) => sum + Number(line.creditAmount),
      0
    );

    if (Math.abs(totalDebits - totalCredits) >= 0.01) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Entry is not balanced. Data may be corrupted.',
      });
    }

    const postedAt = new Date();

    // Execute posting in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update entry status
      await tx.journalEntry.update({
        where: { id: input.entryId },
        data: {
          status: 'POSTED',
          postedAt,
          postedBy: this.userId,
        },
      });

      // Create general ledger entries
      await tx.generalLedgerEntry.createMany({
        data: entry.lines.map((line) => ({
          organizationId: this.organizationId,
          entryId: entry.id,
          lineId: line.id,
          accountId: line.accountId,
          periodId: entry.periodId,
          entryDate: entry.entryDate,
          entryNumber: entry.entryNumber,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          runningBalance: 0, // Will be recalculated
          postedAt,
        })),
      });

      // Update account balances
      for (const line of entry.lines) {
        await tx.accountBalance.upsert({
          where: {
            accountId_periodId: {
              accountId: line.accountId,
              periodId: entry.periodId,
            },
          },
          create: {
            organizationId: this.organizationId,
            accountId: line.accountId,
            periodId: entry.periodId,
            openingBalance: 0,
            debitMovements: line.debitAmount,
            creditMovements: line.creditAmount,
            closingBalance: new Decimal(line.debitAmount.toString())
              .minus(line.creditAmount.toString())
              .toNumber(),
          },
          update: {
            debitMovements: {
              increment: Number(line.debitAmount),
            },
            creditMovements: {
              increment: Number(line.creditAmount),
            },
            closingBalance: {
              increment: new Decimal(line.debitAmount.toString())
                .minus(line.creditAmount.toString())
                .toNumber(),
            },
          },
        });
      }
    });

    await this.invalidateCache();

    this.auditLogger.log({
      action: 'JOURNAL_ENTRY_POSTED',
      entityType: 'JOURNAL_ENTRY',
      entityId: input.entryId,
      userId: this.userId,
      organizationId: this.organizationId,
      newValues: {
        entryNumber: entry.entryNumber,
        totalDebit: totalDebits.toString(),
        totalCredit: totalCredits.toString(),
        postedAt,
      },
    });

    return {
      success: true,
      entryId: input.entryId,
      entryNumber: entry.entryNumber,
      status: 'POSTED' as JournalEntryStatus,
      postedAt,
      postedBy: this.userId,
      totalDebit: totalDebits,
      totalCredit: totalCredits,
      lineCount: entry.lines.length,
      glEntriesCreated: entry.lines.length,
    };
  }

  // =========================================================================
  // QUERY ENTRIES
  // =========================================================================

  /**
   * Query journal entries with filters
   */
  async queryEntries(input: QueryJournalEntriesInput): Promise<QueryJournalEntriesResult> {
    const where: Record<string, unknown> = {
      organizationId: this.organizationId,
    };

    if (input.status && input.status.length > 0) {
      where.status = { in: input.status };
    }

    if (input.entryType && input.entryType.length > 0) {
      where.entryType = { in: input.entryType };
    }

    if (input.dateRange) {
      where.entryDate = {
        gte: input.dateRange.from,
        lte: input.dateRange.to,
      };
    }

    if (input.periodId) {
      where.periodId = input.periodId;
    }

    if (input.fiscalYearId) {
      where.fiscalYearId = input.fiscalYearId;
    }

    if (input.accountId) {
      where.lines = {
        some: { accountId: input.accountId },
      };
    }

    if (input.search) {
      where.OR = [
        { description: { contains: input.search, mode: 'insensitive' } },
        { entryNumber: { contains: input.search, mode: 'insensitive' } },
        { reference: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    let orderBy: Record<string, string> = { entryDate: 'desc' };
    if (input.orderBy) {
      const [field, direction] = input.orderBy.split('_') as [string, 'asc' | 'desc'];
      switch (field) {
        case 'date':
          orderBy = { entryDate: direction };
          break;
        case 'number':
          orderBy = { entryNumber: direction };
          break;
        case 'amount':
          orderBy = { totalDebit: direction };
          break;
        case 'created':
          orderBy = { createdAt: direction };
          break;
      }
    }

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: true,
            },
            orderBy: { lineNumber: 'asc' },
          },
          period: {
            select: {
              name: true,
              periodNumber: true,
            },
          },
        },
        orderBy,
        take: input.limit,
        skip: input.offset,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      entries: entries.map((entry) => this.mapEntryToResult(entry)),
      total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + entries.length < total,
    };
  }

  // =========================================================================
  // VALIDATE ENTRY
  // =========================================================================

  /**
   * Validate entry for posting
   */
  async validateEntry(input: ValidateJournalEntryInput): Promise<JournalEntryValidationResult> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
        period: true,
      },
    });

    if (!entry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      });
    }

    const errors: Array<{ code: string; message: string; lineNumber?: number }> = [];
    const warnings: Array<{ code: string; message: string; lineNumber?: number }> = [];

    // Check balance
    const totalDebits = entry.lines.reduce(
      (sum, line) => sum + Number(line.debitAmount),
      0
    );
    const totalCredits = entry.lines.reduce(
      (sum, line) => sum + Number(line.creditAmount),
      0
    );
    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01;

    if (!isBalanced) {
      errors.push({
        code: 'UNBALANCED',
        message: `Entry is not balanced. Difference: ${difference.toFixed(2)}`,
      });
    }

    // Check period status
    if (entry.period.status === 'closed') {
      errors.push({
        code: 'PERIOD_CLOSED',
        message: 'Period is closed',
      });
    }

    // Check for abnormal balance directions
    for (const line of entry.lines) {
      const hasDebit = Number(line.debitAmount) > 0;
      const hasCredit = Number(line.creditAmount) > 0;
      const expectedDebit = line.account.normalBalance === 'debit';

      if (hasDebit && !expectedDebit) {
        warnings.push({
          code: 'ABNORMAL_BALANCE',
          message: `Debit on credit-normal account: ${line.account.accountCode}`,
          lineNumber: line.lineNumber,
        });
      }
      if (hasCredit && expectedDebit) {
        warnings.push({
          code: 'ABNORMAL_BALANCE',
          message: `Credit on debit-normal account: ${line.account.accountCode}`,
          lineNumber: line.lineNumber,
        });
      }
    }

    // Check approval requirement
    let canPost = isBalanced && entry.period.status !== 'closed';
    if (entry.requiresApproval && !entry.approvedAt) {
      canPost = false;
      errors.push({
        code: 'APPROVAL_REQUIRED',
        message: 'Entry requires approval before posting',
      });
    }

    // Check entry status
    if (entry.status === 'POSTED') {
      canPost = false;
      errors.push({
        code: 'ALREADY_POSTED',
        message: 'Entry is already posted',
      });
    }

    if (entry.status === 'REVERSED') {
      canPost = false;
      errors.push({
        code: 'REVERSED',
        message: 'Entry has been reversed',
      });
    }

    return {
      isValid: errors.length === 0,
      isBalanced,
      totalDebit: totalDebits,
      totalCredit: totalCredits,
      difference,
      lineCount: entry.lines.length,
      canPost: canPost && errors.length === 0,
      errors,
      warnings,
    };
  }

  // =========================================================================
  // STATISTICS
  // =========================================================================

  /**
   * Get journal entry statistics
   */
  async getStats(input: GetJournalEntryStatsInput): Promise<JournalEntryStats> {
    const where: Record<string, unknown> = {
      organizationId: this.organizationId,
    };

    if (input.periodId) {
      where.periodId = input.periodId;
    }

    if (input.fiscalYearId) {
      where.fiscalYearId = input.fiscalYearId;
    }
    // Note: dateRange is not in GetJournalEntryStatsInput schema - use periodId or fiscalYearId for filtering

    const [
      totalEntries,
      draftEntries,
      pendingEntries,
      postedEntries,
      reversedEntries,
      byTypeGrouping,
      aggregates,
    ] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.count({ where: { ...where, status: 'DRAFT' } }),
      this.prisma.journalEntry.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.journalEntry.count({ where: { ...where, status: 'POSTED' } }),
      this.prisma.journalEntry.count({ where: { ...where, status: 'REVERSED' } }),
      this.prisma.journalEntry.groupBy({
        by: ['entryType'],
        where,
        _count: { _all: true },
      }),
      this.prisma.journalEntry.aggregate({
        where,
        _sum: {
          totalDebit: true,
          totalCredit: true,
        },
        _max: {
          entryDate: true,
          postedAt: true,
        },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const group of byTypeGrouping) {
      byType[group.entryType] = group._count._all;
    }

    return {
      totalEntries,
      draftEntries,
      pendingEntries,
      postedEntries,
      reversedEntries,
      byType,
      totalDebit: aggregates._sum.totalDebit
        ? Number(aggregates._sum.totalDebit)
        : 0,
      totalCredit: aggregates._sum.totalCredit
        ? Number(aggregates._sum.totalCredit)
        : 0,
      lastEntryDate: aggregates._max.entryDate || null,
      lastPostedDate: aggregates._max.postedAt || null,
    };
  }

  // =========================================================================
  // COPY ENTRY
  // =========================================================================

  /**
   * Copy an existing entry
   */
  async copyEntry(input: CopyJournalEntryInput): Promise<CreateJournalEntryResult> {
    const sourceEntry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.sourceEntryId,
        organizationId: this.organizationId,
      },
      include: {
        lines: true,
      },
    });

    if (!sourceEntry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Source entry not found',
      });
    }

    const entryDate = input.entryDate || new Date();

    // Create new entry using the createEntry method
    return this.createEntry({
      entryDate,
      description: input.description || sourceEntry.description,
      entryType: sourceEntry.entryType as JournalEntryType,
      reference: sourceEntry.reference || undefined,
      requiresApproval: sourceEntry.requiresApproval,
      lines: sourceEntry.lines.map((line) => ({
        accountId: line.accountId,
        debitAmount: Number(line.debitAmount),
        creditAmount: Number(line.creditAmount),
        description: line.description || undefined,
        currency: line.currency,
        exchangeRate: Number(line.exchangeRate),
        costCenterId: line.costCenterId || undefined,
        // projectId, taxCode, taxAmount not in current Prisma schema
      })),
      // Note: baseCurrency, notes, tags are not in CreateJournalEntryInput
    });
  }

  // =========================================================================
  // ENTRY NUMBERING
  // =========================================================================

  /**
   * Get next entry number
   */
  async getNextEntryNumber(input: GetNextEntryNumberInput): Promise<NextEntryNumberResult> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        fiscalYear: { organizationId: this.organizationId },
        startDate: { lte: input.entryDate },
        endDate: { gte: input.entryDate },
      },
      include: {
        fiscalYear: true,
      },
    });

    if (!period) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No accounting period found for the specified date',
      });
    }

    const prefix = ENTRY_TYPE_PREFIXES[input.entryType];
    const year = period.fiscalYear.startDate.getFullYear();
    const month = period.periodNumber;

    const sequence = await this.prisma.entryNumberSequence.findFirst({
      where: {
        organizationId: this.organizationId,
        entryType: input.entryType,
        year,
        month,
      },
    });

    const nextNumber = (sequence?.lastNumber || 0) + 1;
    const entryNumber = `${prefix}/${year}/${String(month).padStart(2, '0')}/${String(nextNumber).padStart(4, '0')}`;

    return {
      entryNumber,
      prefix,
      year,
      month,
      sequence: nextNumber,
    };
  }

  // =========================================================================
  // BULK OPERATIONS
  // =========================================================================

  /**
   * Post multiple entries
   */
  async bulkPostEntries(input: BulkPostEntriesInput): Promise<BulkPostEntriesResult> {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        id: { in: input.entryIds },
        organizationId: this.organizationId,
      },
      include: {
        lines: true,
        period: true,
      },
    });

    const results: Array<{
      entryId: string;
      entryNumber: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const entryId of input.entryIds) {
      const entry = entries.find((e) => e.id === entryId);

      if (!entry) {
        results.push({
          entryId,
          entryNumber: '', // Unknown entry number
          success: false,
          error: 'Entry not found',
        });
        continue;
      }

      if (entry.status !== 'DRAFT' && entry.status !== 'PENDING') {
        results.push({
          entryId,
          entryNumber: entry.entryNumber,
          success: false,
          error: `Entry is already ${entry.status.toLowerCase()}`,
        });
        continue;
      }

      try {
        await this.postEntry({
          entryId,
          bypassApproval: input.bypassApproval,
        });
        results.push({
          entryId,
          entryNumber: entry.entryNumber,
          success: true,
        });
      } catch (error) {
        results.push({
          entryId,
          entryNumber: entry.entryNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      totalRequested: input.entryIds.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Delete multiple draft entries
   */
  async bulkDeleteEntries(input: BulkDeleteEntriesInput): Promise<BulkDeleteEntriesResult> {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        id: { in: input.entryIds },
        organizationId: this.organizationId,
      },
    });

    let deletedCount = 0;
    let skippedCount = 0;
    const results: Array<{
      entryId: string;
      entryNumber: string;
      deleted: boolean;
      reason?: string;
    }> = [];

    for (const entryId of input.entryIds) {
      const entry = entries.find((e) => e.id === entryId);

      if (!entry) {
        skippedCount++;
        results.push({
          entryId,
          entryNumber: '', // Unknown
          deleted: false,
          reason: 'Entry not found',
        });
        continue;
      }

      if (entry.status !== 'DRAFT') {
        skippedCount++;
        results.push({
          entryId,
          entryNumber: entry.entryNumber,
          deleted: false,
          reason: `Cannot delete ${entry.status.toLowerCase()} entry`,
        });
        continue;
      }

      await this.prisma.journalEntry.delete({
        where: { id: entryId },
      });
      deletedCount++;
      results.push({
        entryId,
        entryNumber: entry.entryNumber,
        deleted: true,
      });
    }

    await this.invalidateCache();

    return {
      totalRequested: input.entryIds.length,
      deletedCount,
      skippedCount,
      results,
    };
  }

  // =========================================================================
  // ATTACHMENT OPERATIONS
  // =========================================================================

  /**
   * Attach document to entry
   */
  async attachDocument(input: AttachDocumentInput): Promise<CreateJournalEntryResult> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
    });

    if (!entry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      });
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id: input.entryId },
      data: {
        sourceDocumentId: input.documentId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        period: true,
      },
    });

    return this.mapEntryToResult(updated);
  }

  /**
   * Detach document from entry
   */
  async detachDocument(input: DetachDocumentInput): Promise<CreateJournalEntryResult> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: this.organizationId,
      },
    });

    if (!entry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
      });
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id: input.entryId },
      data: {
        sourceDocumentId: null,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
        period: true,
      },
    });

    return this.mapEntryToResult(updated);
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private async generateEntryNumber(
    entryType: JournalEntryType,
    entryDate: Date
  ): Promise<string> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        fiscalYear: { organizationId: this.organizationId },
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
      include: {
        fiscalYear: true,
      },
    });

    if (!period) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No accounting period found for the specified date',
      });
    }

    const prefix = ENTRY_TYPE_PREFIXES[entryType];
    const year = period.fiscalYear.startDate.getFullYear();
    const month = period.periodNumber;

    // Upsert sequence - uses entryType not prefix
    const sequence = await this.prisma.entryNumberSequence.upsert({
      where: {
        organizationId_entryType_year_month: {
          organizationId: this.organizationId,
          entryType,
          year,
          month,
        },
      },
      create: {
        organizationId: this.organizationId,
        entryType,
        year,
        month,
        lastNumber: 1,
      },
      update: {
        lastNumber: {
          increment: 1,
        },
      },
    });

    return `${prefix}/${year}/${String(month).padStart(2, '0')}/${String(sequence.lastNumber).padStart(4, '0')}`;
  }

  private async invalidateCache(): Promise<void> {
    const keys = await this.redis.keys(`${this._CACHE_PREFIX}:${this.organizationId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private mapEntryToResult(entry: any): CreateJournalEntryResult {
    const totalDebit = Number(entry.totalDebit);
    const totalCredit = Number(entry.totalCredit);
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      periodId: entry.periodId,
      fiscalYearId: entry.fiscalYearId,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      entryType: entry.entryType as JournalEntryType,
      status: entry.status as JournalEntryStatus,
      description: entry.description,
      reference: entry.reference,
      sourceDocumentId: entry.sourceDocumentId,
      reversedEntryId: entry.reversedEntryId || null,
      templateId: entry.templateId || null,
      recurringEntryId: entry.recurringEntryId || null,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      lineCount: entry.lines?.length || 0,
      baseCurrency: entry.baseCurrency,
      requiresApproval: entry.requiresApproval,
      approvedAt: entry.approvedAt,
      approvedBy: entry.approvedBy,
      postedAt: entry.postedAt,
      postedBy: entry.postedBy,
      reversedAt: entry.reversedAt,
      reversedBy: entry.reversedBy,
      notes: entry.notes,
      tags: entry.tags || [],
      createdAt: entry.createdAt,
      createdBy: entry.createdBy,
      updatedAt: entry.updatedAt,
      lines: entry.lines?.map((line: any) => ({
        id: line.id,
        entryId: line.entryId,
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        debitAmount: Number(line.debitAmount),
        creditAmount: Number(line.creditAmount),
        baseDebitAmount: Number(line.baseDebitAmount),
        baseCreditAmount: Number(line.baseCreditAmount),
        currency: line.currency,
        exchangeRate: Number(line.exchangeRate),
        description: line.description,
        costCenterId: line.costCenterId,
        projectId: line.projectId,
        taxCode: line.taxCode,
        taxAmount: line.taxAmount ? Number(line.taxAmount) : null,
        isReconciled: line.isReconciled,
        reconciledAt: line.reconciledAt,
        createdAt: line.createdAt,
        account: line.account
          ? {
              id: line.account.id,
              accountCode: line.account.accountCode,
              accountName: line.account.accountName,
              accountType: line.account.accountType,
              normalBalance: line.account.normalBalance,
            }
          : undefined,
      })) || [],
      period: entry.period
        ? {
            id: entry.period.id,
            name: entry.period.name,
            periodNumber: entry.period.periodNumber,
            status: entry.period.status,
            startDate: entry.period.startDate,
            endDate: entry.period.endDate,
          }
        : undefined,
    };
  }
}
