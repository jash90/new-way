/**
 * ACC-011: Entry Reversal Service
 * Provides comprehensive entry reversal operations including:
 * - Standard entry reversal with debit/credit swap
 * - Auto-reversal scheduling and processing
 * - Correction entry creation for partial fixes
 * - Reversal history and audit tracking
 */

import { Decimal } from 'decimal.js';
import type {
  ReverseEntryInput,
  ScheduleAutoReversalInput,
  CancelAutoReversalInput,
  CreateCorrectionInput,
  ListReversalsInput,
  GetReversalDetailsInput,
  ListPendingAutoReversalsInput,
  ProcessAutoReversalsInput,
  ReverseEntryResult,
  ScheduleAutoReversalResult,
  CancelAutoReversalResult,
  CreateCorrectionResult,
  ListReversalsResult,
  ListPendingAutoReversalsResult,
  ProcessAutoReversalsResult,
  ReversalDetails,
} from '@ksiegowacrm/shared';

type PrismaClient = any;
type RedisClient = any;
type AuditLogger = any;

export class EntryReversalService {
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
  // REVERSE ENTRY
  // ===========================================================================

  /**
   * Reverse a posted journal entry
   * Creates a new reversing entry with swapped debits and credits
   */
  async reverseEntry(input: ReverseEntryInput): Promise<ReverseEntryResult> {
    // Fetch original entry with lines
    const originalEntry = await this.prisma.journalEntry.findUnique({
      where: { id: input.entryId },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!originalEntry) {
      throw new Error('Entry not found');
    }

    // Validate organization
    if (originalEntry.organizationId !== this.organizationId) {
      throw new Error('Entry not found');
    }

    // Validate entry can be reversed
    if (originalEntry.status !== 'POSTED') {
      throw new Error(`Cannot reverse entry with status ${originalEntry.status}`);
    }

    if (originalEntry.status === 'REVERSED' || originalEntry.reversingEntryId) {
      throw new Error('Entry has already been reversed');
    }

    // Validate reversal date is on or after original entry date
    const reversalDate = new Date(input.reversalDate);
    const entryDate = new Date(originalEntry.entryDate);
    if (reversalDate < entryDate) {
      throw new Error('Reversal date must be on or after original entry date');
    }

    // Validate reversal period is open
    const reversalPeriod = await this.findPeriodForDate(reversalDate);
    if (!reversalPeriod) {
      throw new Error('No fiscal period found for reversal date');
    }

    if (reversalPeriod.status === 'CLOSED') {
      throw new Error('Selected period is closed');
    }

    // Execute reversal in transaction
    return await this.prisma.$transaction(async (tx: any) => {
      // Generate entry number
      const entryNumber = await this.generateEntryNumber(tx, 'REVERSING', reversalDate);

      // Create reversed lines (swap debits and credits)
      const reversedLinesData = originalEntry.lines.map((line: any, idx: number) => ({
        lineNumber: idx + 1,
        accountId: line.accountId,
        debitAmount: line.creditAmount, // Swap
        creditAmount: line.debitAmount, // Swap
        description: `Reversal: ${line.description || ''}`,
        currencyCode: line.currencyCode,
        exchangeRate: line.exchangeRate,
        baseCurrencyDebit: line.baseCurrencyCredit,
        baseCurrencyCredit: line.baseCurrencyDebit,
      }));

      // Create the reversing entry
      const reversingEntry = await tx.journalEntry.create({
        data: {
          organizationId: this.organizationId,
          fiscalYearId: reversalPeriod.fiscalYearId,
          periodId: reversalPeriod.id,
          entryNumber,
          entryDate: reversalDate,
          description: `Reversal of ${originalEntry.entryNumber}: ${input.reason}`,
          entryType: 'REVERSING',
          status: input.autoPost ? 'POSTED' : 'DRAFT',
          reversedEntryId: originalEntry.id,
          reversalType: 'STANDARD',
          postedAt: input.autoPost ? new Date() : null,
          postedBy: input.autoPost ? this.userId : null,
          createdBy: this.userId,
          lines: {
            create: reversedLinesData,
          },
        },
        include: {
          lines: true,
        },
      });

      // If auto-post, create GL entries
      if (input.autoPost) {
        await this.postToGeneralLedger(tx, reversingEntry);
      }

      // Update original entry
      const updatedOriginal = await tx.journalEntry.update({
        where: { id: input.entryId },
        data: {
          status: 'REVERSED',
          reversingEntryId: reversingEntry.id,
          reversalReason: input.reason,
          reversedAt: new Date(),
          reversedBy: this.userId,
          updatedAt: new Date(),
          updatedBy: this.userId,
        },
      });

      // Audit log
      await this.auditLogger.log({
        action: 'ENTRY_REVERSED',
        entityType: 'journal_entry',
        entityId: input.entryId,
        organizationId: this.organizationId,
        userId: this.userId,
        details: {
          originalEntryNumber: originalEntry.entryNumber,
          reversingEntryNumber: entryNumber,
          reversalDate: reversalDate.toISOString(),
          reason: input.reason,
          autoPosted: input.autoPost,
        },
      });

      return {
        reversingEntry: {
          id: reversingEntry.id,
          entryNumber: reversingEntry.entryNumber,
          entryDate: reversingEntry.entryDate,
          description: reversingEntry.description,
          status: reversingEntry.status,
          entryType: reversingEntry.entryType,
        },
        originalEntry: {
          id: updatedOriginal.id,
          entryNumber: updatedOriginal.entryNumber,
          status: updatedOriginal.status,
        },
      };
    });
  }

  // ===========================================================================
  // SCHEDULE AUTO-REVERSAL
  // ===========================================================================

  /**
   * Schedule an entry for automatic reversal on a specific date
   */
  async scheduleAutoReversal(input: ScheduleAutoReversalInput): Promise<ScheduleAutoReversalResult> {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: input.entryId },
    });

    if (!entry) {
      throw new Error('Entry not found');
    }

    if (entry.organizationId !== this.organizationId) {
      throw new Error('Entry not found');
    }

    if (entry.status !== 'POSTED') {
      throw new Error('Only posted entries can be scheduled for auto-reversal');
    }

    const autoReverseDate = new Date(input.autoReverseDate);
    const entryDate = new Date(entry.entryDate);
    if (autoReverseDate <= entryDate) {
      throw new Error('Auto-reverse date must be after entry date');
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id: input.entryId },
      data: {
        autoReverseDate: autoReverseDate,
        reversalType: 'AUTO_SCHEDULED',
        updatedAt: new Date(),
        updatedBy: this.userId,
      },
    });

    await this.auditLogger.log({
      action: 'AUTO_REVERSAL_SCHEDULED',
      entityType: 'journal_entry',
      entityId: input.entryId,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        entryNumber: entry.entryNumber,
        autoReverseDate: autoReverseDate.toISOString(),
      },
    });

    return {
      id: updated.id,
      entryNumber: updated.entryNumber,
      autoReverseDate: updated.autoReverseDate,
      reversalType: updated.reversalType,
    };
  }

  // ===========================================================================
  // CANCEL AUTO-REVERSAL
  // ===========================================================================

  /**
   * Cancel a scheduled auto-reversal
   */
  async cancelAutoReversal(input: CancelAutoReversalInput): Promise<CancelAutoReversalResult> {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: input.entryId },
    });

    if (!entry) {
      throw new Error('Entry not found');
    }

    if (entry.organizationId !== this.organizationId) {
      throw new Error('Entry not found');
    }

    if (!entry.autoReverseDate) {
      throw new Error('No auto-reversal scheduled for this entry');
    }

    await this.prisma.journalEntry.update({
      where: { id: input.entryId },
      data: {
        autoReverseDate: null,
        reversalType: null,
        updatedAt: new Date(),
        updatedBy: this.userId,
      },
    });

    await this.auditLogger.log({
      action: 'AUTO_REVERSAL_CANCELLED',
      entityType: 'journal_entry',
      entityId: input.entryId,
      organizationId: this.organizationId,
      userId: this.userId,
      details: {
        entryNumber: entry.entryNumber,
        previousAutoReverseDate: entry.autoReverseDate?.toISOString(),
      },
    });

    return {
      success: true,
      entryId: entry.id,
      entryNumber: entry.entryNumber,
    };
  }

  // ===========================================================================
  // CREATE CORRECTION
  // ===========================================================================

  /**
   * Create a correction entry for partial adjustment
   * Unlike full reversal, this creates an adjusting entry with the difference
   */
  async createCorrection(input: CreateCorrectionInput): Promise<CreateCorrectionResult> {
    const originalEntry = await this.prisma.journalEntry.findUnique({
      where: { id: input.originalEntryId },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!originalEntry) {
      throw new Error('Original entry not found');
    }

    if (originalEntry.organizationId !== this.organizationId) {
      throw new Error('Original entry not found');
    }

    if (originalEntry.status !== 'POSTED') {
      throw new Error('Can only create corrections for posted entries');
    }

    // Validate correction period
    const correctionDate = new Date(input.correctionDate);
    const period = await this.findPeriodForDate(correctionDate);

    if (!period) {
      throw new Error('No fiscal period found for correction date');
    }

    if (period.status === 'CLOSED') {
      throw new Error('Correction period is closed');
    }

    return await this.prisma.$transaction(async (tx: any) => {
      // Generate entry number
      const entryNumber = await this.generateEntryNumber(tx, 'ADJUSTING', correctionDate);

      // Calculate net effect
      const totalDebit = input.correctedLines.reduce((sum, l) => sum + l.debitAmount, 0);
      const totalCredit = input.correctedLines.reduce((sum, l) => sum + l.creditAmount, 0);

      // Create correction entry
      const correctionEntry = await tx.journalEntry.create({
        data: {
          organizationId: this.organizationId,
          fiscalYearId: period.fiscalYearId,
          periodId: period.id,
          entryNumber,
          entryDate: correctionDate,
          description: `Correction of ${originalEntry.entryNumber}: ${input.reason}`,
          entryType: 'ADJUSTING',
          status: input.autoPost ? 'POSTED' : 'DRAFT',
          reversedEntryId: originalEntry.id,
          reversalType: 'CORRECTION',
          reversalReason: input.reason,
          postedAt: input.autoPost ? new Date() : null,
          postedBy: input.autoPost ? this.userId : null,
          createdBy: this.userId,
          lines: {
            create: input.correctedLines.map((line, idx) => ({
              lineNumber: idx + 1,
              accountId: line.accountId,
              debitAmount: new Decimal(line.debitAmount),
              creditAmount: new Decimal(line.creditAmount),
              description: line.description || 'Correction',
              currencyCode: 'PLN',
              exchangeRate: new Decimal(1),
              baseCurrencyDebit: new Decimal(line.debitAmount),
              baseCurrencyCredit: new Decimal(line.creditAmount),
            })),
          },
        },
        include: {
          lines: true,
        },
      });

      // If auto-post, create GL entries
      if (input.autoPost) {
        await this.postToGeneralLedger(tx, correctionEntry);
      }

      // Update original entry to link correction (but don't change status)
      await tx.journalEntry.update({
        where: { id: input.originalEntryId },
        data: {
          // Add to linked corrections if tracking multiple corrections
          updatedAt: new Date(),
          updatedBy: this.userId,
        },
      });

      await this.auditLogger.log({
        action: 'CORRECTION_ENTRY_CREATED',
        entityType: 'journal_entry',
        entityId: correctionEntry.id,
        organizationId: this.organizationId,
        userId: this.userId,
        details: {
          originalEntryId: input.originalEntryId,
          originalEntryNumber: originalEntry.entryNumber,
          correctionEntryNumber: entryNumber,
          reason: input.reason,
          netDebit: totalDebit,
          netCredit: totalCredit,
        },
      });

      return {
        correctionEntry: {
          id: correctionEntry.id,
          entryNumber: correctionEntry.entryNumber,
          entryDate: correctionEntry.entryDate,
          description: correctionEntry.description,
          status: correctionEntry.status,
          entryType: correctionEntry.entryType,
        },
        originalEntry: {
          id: originalEntry.id,
          entryNumber: originalEntry.entryNumber,
        },
        netEffect: {
          totalDebit,
          totalCredit,
        },
      };
    });
  }

  // ===========================================================================
  // LIST REVERSALS
  // ===========================================================================

  /**
   * List reversed entries with optional filters
   */
  async listReversals(input: ListReversalsInput): Promise<ListReversalsResult> {
    const where: any = {
      organizationId: this.organizationId,
      status: 'REVERSED',
    };

    if (input.fromDate || input.toDate) {
      where.reversedAt = {};
      if (input.fromDate) {
        where.reversedAt.gte = new Date(input.fromDate);
      }
      if (input.toDate) {
        where.reversedAt.lte = new Date(input.toDate);
      }
    }

    if (input.reversedBy) {
      where.reversedBy = input.reversedBy;
    }

    if (input.type) {
      where.reversalType = input.type;
    }

    if (input.search) {
      where.OR = [
        { entryNumber: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [reversals, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: { reversedAt: 'desc' },
        skip: input.offset,
        take: input.limit,
        include: {
          reversingEntry: {
            select: {
              id: true,
              entryNumber: true,
              entryDate: true,
            },
          },
          reversedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      reversals: reversals.map((entry: any) => ({
        originalEntryId: entry.id,
        originalEntryNumber: entry.entryNumber,
        originalEntryDate: entry.entryDate,
        originalDescription: entry.description,
        reversingEntryId: entry.reversingEntry?.id,
        reversingEntryNumber: entry.reversingEntry?.entryNumber,
        reversalDate: entry.reversingEntry?.entryDate,
        reversalType: entry.reversalType,
        reversalReason: entry.reversalReason,
        reversedAt: entry.reversedAt,
        reversedBy: entry.reversedByUser,
      })),
      total,
      hasMore: input.offset + reversals.length < total,
    };
  }

  // ===========================================================================
  // GET REVERSAL DETAILS
  // ===========================================================================

  /**
   * Get comprehensive reversal details for an entry
   */
  async getReversalDetails(input: GetReversalDetailsInput): Promise<ReversalDetails> {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: input.entryId },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
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
        reversingEntry: {
          include: {
            lines: {
              orderBy: { lineNumber: 'asc' },
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
          },
        },
        reversedEntry: {
          include: {
            lines: {
              orderBy: { lineNumber: 'asc' },
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
          },
        },
        reversedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!entry) {
      throw new Error('Entry not found');
    }

    if (entry.organizationId !== this.organizationId) {
      throw new Error('Entry not found');
    }

    // Calculate totals
    const formatEntry = (e: any) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      entryDate: e.entryDate,
      description: e.description,
      status: e.status,
      entryType: e.entryType,
      lines: e.lines.map((l: any) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        accountCode: l.account?.accountCode,
        accountName: l.account?.accountName,
        debitAmount: new Decimal(l.debitAmount).toNumber(),
        creditAmount: new Decimal(l.creditAmount).toNumber(),
        description: l.description,
      })),
      totalDebit: e.lines.reduce((sum: number, l: any) => sum + new Decimal(l.debitAmount).toNumber(), 0),
      totalCredit: e.lines.reduce((sum: number, l: any) => sum + new Decimal(l.creditAmount).toNumber(), 0),
    });

    const originalEntry = formatEntry(entry);
    const reversingEntry = entry.reversingEntry ? formatEntry(entry.reversingEntry) : null;

    // Calculate net effect
    let netDebit = originalEntry.totalDebit;
    let netCredit = originalEntry.totalCredit;
    if (reversingEntry) {
      netDebit += reversingEntry.totalDebit;
      netCredit += reversingEntry.totalCredit;
    }

    return {
      originalEntry,
      reversingEntry,
      reversalInfo: {
        reversalType: entry.reversalType,
        reversalReason: entry.reversalReason,
        reversedAt: entry.reversedAt,
        reversedBy: entry.reversedByUser,
        autoReverseDate: entry.autoReverseDate,
      },
      netEffect: {
        totalDebit: netDebit,
        totalCredit: netCredit,
        isBalanced: Math.abs(netDebit - netCredit) < 0.01,
      },
    };
  }

  // ===========================================================================
  // LIST PENDING AUTO-REVERSALS
  // ===========================================================================

  /**
   * List entries scheduled for auto-reversal
   */
  async listPendingAutoReversals(input: ListPendingAutoReversalsInput): Promise<ListPendingAutoReversalsResult> {
    const where: any = {
      organizationId: this.organizationId,
      status: 'POSTED',
      autoReverseDate: { not: null },
    };

    if (input.fromDate || input.toDate) {
      where.autoReverseDate = { ...where.autoReverseDate };
      if (input.fromDate) {
        where.autoReverseDate.gte = new Date(input.fromDate);
      }
      if (input.toDate) {
        where.autoReverseDate.lte = new Date(input.toDate);
      }
    }

    const [pending, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: { autoReverseDate: 'asc' },
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
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      pending: pending.map((entry: any) => ({
        id: entry.id,
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        description: entry.description,
        autoReverseDate: entry.autoReverseDate,
        createdBy: entry.createdByUser,
        template: null, // If entry was created from template
      })),
      total,
      hasMore: input.offset + pending.length < total,
    };
  }

  // ===========================================================================
  // PROCESS AUTO-REVERSALS
  // ===========================================================================

  /**
   * Process all entries due for auto-reversal on a given date
   * Typically called by a scheduled job
   */
  async processAutoReversals(input: ProcessAutoReversalsInput): Promise<ProcessAutoReversalsResult> {
    const forDate = input.forDate ? new Date(input.forDate) : new Date();
    forDate.setHours(23, 59, 59, 999); // End of day

    // Find all entries due for auto-reversal
    const dueEntries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId: this.organizationId,
        status: 'POSTED',
        autoReverseDate: { lte: forDate },
      },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (input.dryRun) {
      return {
        processed: dueEntries.length,
        successful: dueEntries.length,
        failed: 0,
        results: dueEntries.map((entry: any) => ({
          date: entry.autoReverseDate,
          success: true,
          entryId: entry.id,
        })),
        dryRun: true,
      };
    }

    const results: any[] = [];

    for (const entry of dueEntries) {
      try {
        // Find period for auto-reversal date
        const period = await this.findPeriodForDate(entry.autoReverseDate);

        if (!period) {
          throw new Error(`No fiscal period found for auto-reversal date ${entry.autoReverseDate}`);
        }

        if (period.status === 'CLOSED') {
          throw new Error(`Period for auto-reversal date is closed`);
        }

        await this.prisma.$transaction(async (tx: any) => {
          // Generate entry number
          const entryNumber = await this.generateEntryNumber(tx, 'REVERSING', entry.autoReverseDate);

          // Create reversed lines
          const reversedLinesData = entry.lines.map((line: any, idx: number) => ({
            lineNumber: idx + 1,
            accountId: line.accountId,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            description: `Auto-reversal: ${line.description || ''}`,
            currencyCode: line.currencyCode,
            exchangeRate: line.exchangeRate,
            baseCurrencyDebit: line.baseCurrencyCredit,
            baseCurrencyCredit: line.baseCurrencyDebit,
          }));

          // Create reversing entry
          const reversingEntry = await tx.journalEntry.create({
            data: {
              organizationId: this.organizationId,
              fiscalYearId: period.fiscalYearId,
              periodId: period.id,
              entryNumber,
              entryDate: entry.autoReverseDate,
              description: `Auto-reversal of ${entry.entryNumber}`,
              entryType: 'REVERSING',
              status: 'POSTED',
              reversedEntryId: entry.id,
              reversalType: 'AUTO_SCHEDULED',
              postedAt: new Date(),
              postedBy: this.userId,
              createdBy: entry.createdBy,
              lines: {
                create: reversedLinesData,
              },
            },
            include: {
              lines: true,
            },
          });

          // Post to GL
          await this.postToGeneralLedger(tx, reversingEntry);

          // Update original entry
          await tx.journalEntry.update({
            where: { id: entry.id },
            data: {
              status: 'REVERSED',
              reversingEntryId: reversingEntry.id,
              reversalReason: 'Auto-reversed as scheduled',
              reversedAt: new Date(),
              autoReverseDate: null,
              updatedAt: new Date(),
            },
          });

          await this.auditLogger.log({
            action: 'ENTRY_AUTO_REVERSED',
            entityType: 'journal_entry',
            entityId: entry.id,
            organizationId: this.organizationId,
            userId: this.userId,
            details: {
              originalEntryNumber: entry.entryNumber,
              reversingEntryNumber: entryNumber,
            },
          });

          results.push({
            date: entry.autoReverseDate,
            success: true,
            entryId: entry.id,
            reversingEntryId: reversingEntry.id,
          });
        });
      } catch (error) {
        results.push({
          date: entry.autoReverseDate,
          success: false,
          entryId: entry.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
      dryRun: false,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Find accounting period for a given date
   */
  private async findPeriodForDate(date: Date): Promise<any> {
    return await this.prisma.accountingPeriod.findFirst({
      where: {
        organizationId: this.organizationId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }

  /**
   * Generate entry number based on type and date
   */
  private async generateEntryNumber(tx: any, entryType: string, entryDate: Date): Promise<string> {
    const year = entryDate.getFullYear();
    const prefix = entryType === 'REVERSING' ? 'RV' : entryType === 'ADJUSTING' ? 'AJ' : 'JE';
    const fullPrefix = `${prefix}-${year}-`;

    const count = await tx.journalEntry.count({
      where: {
        organizationId: this.organizationId,
        entryNumber: { startsWith: fullPrefix },
      },
    });

    return `${fullPrefix}${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Post journal entry to general ledger
   */
  private async postToGeneralLedger(tx: any, entry: any): Promise<void> {
    const glEntries = entry.lines.map((line: any) => ({
      organizationId: entry.organizationId,
      accountId: line.accountId,
      fiscalYearId: entry.fiscalYearId,
      periodId: entry.periodId,
      journalEntryId: entry.id,
      journalEntryLineId: line.id,
      transactionDate: entry.entryDate,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      baseCurrencyDebit: line.baseCurrencyDebit || line.debitAmount,
      baseCurrencyCredit: line.baseCurrencyCredit || line.creditAmount,
      description: line.description,
      postedAt: new Date(),
      postedBy: this.userId,
    }));

    await tx.generalLedgerEntry.createMany({
      data: glEntries,
    });
  }
}
