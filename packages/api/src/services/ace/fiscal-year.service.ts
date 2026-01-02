/**
 * ACC-003: Fiscal Year Service
 * Handles fiscal year and accounting period management
 *
 * NOTE: This service has been adapted to work with the actual Prisma schema.
 * The domain types expect some fields that don't exist in the database:
 * - Domain uses 'code' but Prisma has 'yearCode'
 * - Domain uses 'fiscalPeriod' but Prisma has 'accountingPeriod'
 * - Domain expects 'openedAt', 'lockedAt', 'openedBy', 'lockedBy' which don't exist in Prisma
 */

import { TRPCError } from '@trpc/server';
import type { PrismaClient, FiscalYear as PrismaFiscalYear, AccountingPeriod as PrismaAccountingPeriod } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  CreateFiscalYearInput,
  FiscalYear,
  FiscalPeriod,
  GetFiscalYearInput,
  ListFiscalYearsInput,
  ListFiscalYearsResult,
  UpdateFiscalYearInput,
  OpenFiscalYearInput,
  OpenFiscalYearResult,
  CloseFiscalYearInput,
  CloseFiscalYearResult,
  LockFiscalYearInput,
  LockFiscalYearResult,
  SetCurrentFiscalYearInput,
  SetCurrentFiscalYearResult,
  DeleteFiscalYearInput,
  DeleteFiscalYearResult,
  GetCurrentFiscalYearInput,
  GetFiscalYearStatisticsInput,
  FiscalYearStatistics,
  ListFiscalPeriodsInput,
  ListFiscalPeriodsResult,
  CloseFiscalPeriodInput,
  CloseFiscalPeriodResult,
  ReopenFiscalPeriodInput,
  ReopenFiscalPeriodResult,
} from '@ksiegowacrm/shared';

// Polish month names
const POLISH_MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export class FiscalYearService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string
  ) {}

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async invalidateCache(): Promise<void> {
    const pattern = `fiscal_year:${this.organizationId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Map Prisma FiscalYear to domain FiscalYear type
   * Handles field name differences between Prisma and domain models
   */
  private mapPrismaToFiscalYear(prismaYear: PrismaFiscalYear & { periods?: PrismaAccountingPeriod[] }): FiscalYear {
    return {
      id: prismaYear.id,
      organizationId: prismaYear.organizationId,
      name: prismaYear.name,
      code: prismaYear.yearCode, // Prisma: yearCode -> Domain: code
      startDate: prismaYear.startDate,
      endDate: prismaYear.endDate,
      status: prismaYear.status,
      isCurrent: prismaYear.isCurrent,
      // Fields that don't exist in Prisma - provide defaults
      openedAt: prismaYear.status === 'open' ? prismaYear.updatedAt : null,
      lockedAt: prismaYear.status === 'locked' ? prismaYear.updatedAt : null,
      closedAt: prismaYear.closedAt,
      openedBy: null, // Not tracked in current schema
      lockedBy: null, // Not tracked in current schema
      closedBy: prismaYear.closedBy,
      createdAt: prismaYear.createdAt,
      updatedAt: prismaYear.updatedAt,
      createdBy: prismaYear.createdBy,
      updatedBy: prismaYear.updatedBy,
      periods: prismaYear.periods?.map((p) => this.mapPrismaToPeriod(p)),
    } as FiscalYear;
  }

  /**
   * Map Prisma AccountingPeriod to domain FiscalPeriod type
   * Maps Prisma field names to domain field names
   */
  private mapPrismaToPeriod(prismaPeriod: PrismaAccountingPeriod): FiscalPeriod {
    // Map Prisma PeriodStatus to domain FiscalPeriodStatus
    // Prisma: open, soft_closed, closed
    // Domain: open, closed, locked
    let domainStatus: 'open' | 'closed' | 'locked' = 'open';
    if (prismaPeriod.status === 'closed') {
      domainStatus = 'locked'; // Prisma closed = domain locked (permanent)
    } else if (prismaPeriod.status === 'soft_closed') {
      domainStatus = 'closed'; // Prisma soft_closed = domain closed (can reopen)
    }

    return {
      id: prismaPeriod.id,
      fiscalYearId: prismaPeriod.fiscalYearId,
      name: prismaPeriod.name,
      periodNumber: prismaPeriod.periodNumber,
      startDate: prismaPeriod.startDate,
      endDate: prismaPeriod.endDate,
      status: domainStatus,
      // Map Prisma lockedAt/lockedBy to domain closedAt/closedBy
      closedAt: prismaPeriod.lockedAt,
      closedBy: prismaPeriod.lockedBy,
      createdAt: prismaPeriod.createdAt,
      updatedAt: prismaPeriod.updatedAt,
    } as FiscalPeriod;
  }

  private generatePeriods(
    fiscalYearId: string,
    startDate: Date,
    endDate: Date
  ): Array<{
    fiscalYearId: string;
    name: string;
    periodNumber: number;
    startDate: Date;
    endDate: Date;
    periodType: 'regular' | 'opening' | 'closing' | 'adjusting';
    status: 'open' | 'soft_closed' | 'closed';
  }> {
    const periods: Array<{
      fiscalYearId: string;
      name: string;
      periodNumber: number;
      startDate: Date;
      endDate: Date;
      periodType: 'regular' | 'opening' | 'closing' | 'adjusting';
      status: 'open' | 'soft_closed' | 'closed';
    }> = [];

    let currentDate = new Date(startDate);
    let periodNumber = 1;

    while (currentDate < endDate && periodNumber <= 12) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Start of period
      const periodStart = new Date(year, month, 1);

      // End of period (last day of month or fiscal year end, whichever is earlier)
      const nextMonth = new Date(year, month + 1, 0); // Last day of current month
      const periodEnd = nextMonth < endDate ? nextMonth : new Date(endDate);

      periods.push({
        fiscalYearId,
        name: `${POLISH_MONTHS[month]} ${year}`,
        periodNumber,
        startDate: periodStart,
        endDate: periodEnd,
        periodType: 'regular',
        status: 'open',
      });

      // Move to next month
      currentDate = new Date(year, month + 1, 1);
      periodNumber++;
    }

    return periods;
  }

  // ===========================================================================
  // CREATE FISCAL YEAR
  // ===========================================================================

  async createFiscalYear(input: CreateFiscalYearInput): Promise<FiscalYear> {
    const { name, code, startDate, endDate, generatePeriods } = input;

    // Check if fiscal year with same code exists
    const existing = await this.prisma.fiscalYear.findFirst({
      where: {
        organizationId: this.organizationId,
        yearCode: code, // Use yearCode instead of code
      },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Rok obrotowy o kodzie ${code} już istnieje`,
      });
    }

    // Create fiscal year
    const fiscalYear = await this.prisma.fiscalYear.create({
      data: {
        organizationId: this.organizationId,
        name,
        yearCode: code, // Use yearCode instead of code
        startDate,
        endDate,
        status: 'draft',
        isCurrent: false,
        createdBy: this.userId,
      },
    });

    // Generate periods if requested (using accountingPeriod)
    if (generatePeriods) {
      const periods = this.generatePeriods(fiscalYear.id, startDate, endDate);
      await this.prisma.accountingPeriod.createMany({ data: periods });
    }

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_year_created',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'fiscal_year',
      resourceId: fiscalYear.id,
      metadata: { name, code, startDate, endDate, generatePeriods },
    });

    return this.mapPrismaToFiscalYear(fiscalYear);
  }

  // ===========================================================================
  // GET FISCAL YEAR
  // ===========================================================================

  async getFiscalYear(input: GetFiscalYearInput): Promise<FiscalYear | null> {
    const { id, includePeriods } = input;

    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
      include: { periods: includePeriods },
    });

    if (!fiscalYear) return null;

    return this.mapPrismaToFiscalYear(fiscalYear);
  }

  // ===========================================================================
  // LIST FISCAL YEARS
  // ===========================================================================

  async listFiscalYears(input: ListFiscalYearsInput): Promise<ListFiscalYearsResult> {
    const { status, limit = 20, offset = 0, includePeriods } = input;

    const where = {
      organizationId: this.organizationId,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.fiscalYear.findMany({
        where,
        orderBy: { startDate: 'desc' },
        take: limit,
        skip: offset,
        include: { periods: includePeriods },
      }),
      this.prisma.fiscalYear.count({ where }),
    ]);

    return {
      items: items.map((fy) => this.mapPrismaToFiscalYear(fy)),
      total,
      limit,
      offset,
    };
  }

  // ===========================================================================
  // UPDATE FISCAL YEAR
  // ===========================================================================

  async updateFiscalYear(input: UpdateFiscalYearInput): Promise<FiscalYear> {
    const { id, name, code } = input;

    // Verify fiscal year exists and is not locked
    const existing = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    if (existing.status === 'locked') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Nie można edytować zablokowanego roku obrotowego',
      });
    }

    const fiscalYear = await this.prisma.fiscalYear.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { yearCode: code }), // Use yearCode instead of code
        updatedBy: this.userId,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_year_updated',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'fiscal_year',
      resourceId: id,
      metadata: { name, code },
    });

    return this.mapPrismaToFiscalYear(fiscalYear);
  }

  // ===========================================================================
  // OPEN FISCAL YEAR
  // ===========================================================================

  async openFiscalYear(input: OpenFiscalYearInput): Promise<OpenFiscalYearResult> {
    const { id } = input;

    // Verify fiscal year exists
    const existing = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    if (existing.status === 'open') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Rok obrotowy jest już otwarty',
      });
    }

    if (existing.status === 'closed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można otworzyć zamkniętego roku obrotowego',
      });
    }

    const fiscalYear = await this.prisma.fiscalYear.update({
      where: { id },
      data: {
        status: 'open',
        updatedBy: this.userId,
      },
    });

    // Open all periods
    await this.prisma.accountingPeriod.updateMany({
      where: { fiscalYearId: id },
      data: { status: 'open' },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_year_opened',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'fiscal_year',
      resourceId: id,
    });

    return {
      success: true,
      fiscalYear: this.mapPrismaToFiscalYear(fiscalYear),
      message: 'Rok obrotowy został otwarty',
    };
  }

  // ===========================================================================
  // CLOSE FISCAL YEAR
  // ===========================================================================

  async closeFiscalYear(input: CloseFiscalYearInput): Promise<CloseFiscalYearResult> {
    const { id } = input;

    const existing = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
      include: { periods: true },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    if (existing.status === 'closed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Rok obrotowy jest już zamknięty',
      });
    }

    // Check if all periods are closed or locked
    const openPeriods = existing.periods.filter((p) => p.status === 'open');
    if (openPeriods.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Nie można zamknąć roku. Otwarte okresy: ${openPeriods.length}`,
      });
    }

    const fiscalYear = await this.prisma.fiscalYear.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedBy: this.userId,
        updatedBy: this.userId,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_year_closed',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'fiscal_year',
      resourceId: id,
    });

    return {
      success: true,
      fiscalYear: this.mapPrismaToFiscalYear(fiscalYear),
      message: 'Rok obrotowy został zamknięty',
    };
  }

  // ===========================================================================
  // LOCK FISCAL YEAR
  // ===========================================================================

  async lockFiscalYear(input: LockFiscalYearInput): Promise<LockFiscalYearResult> {
    const { id, reason } = input;

    const existing = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    if (existing.status === 'locked') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Rok obrotowy jest już zablokowany',
      });
    }

    // Lock all periods first (using 'closed' in Prisma = 'locked' in domain)
    await this.prisma.accountingPeriod.updateMany({
      where: { fiscalYearId: id },
      data: {
        status: 'closed',
        lockedAt: new Date(),
        lockedBy: this.userId,
        lockReason: reason,
      },
    });

    const fiscalYear = await this.prisma.fiscalYear.update({
      where: { id },
      data: {
        status: 'locked',
        updatedBy: this.userId,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_year_locked',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'fiscal_year',
      resourceId: id,
      metadata: { reason },
    });

    return {
      success: true,
      fiscalYear: this.mapPrismaToFiscalYear(fiscalYear),
      message: 'Rok obrotowy został zablokowany',
    };
  }

  // ===========================================================================
  // SET CURRENT FISCAL YEAR
  // ===========================================================================

  async setCurrentFiscalYear(input: SetCurrentFiscalYearInput): Promise<SetCurrentFiscalYearResult> {
    const { id } = input;

    const existing = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    if (existing.status !== 'open') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Tylko otwarty rok obrotowy może być ustawiony jako bieżący',
      });
    }

    // Find previous current fiscal year
    const previousCurrent = await this.prisma.fiscalYear.findFirst({
      where: {
        organizationId: this.organizationId,
        isCurrent: true,
      },
    });
    const previousCurrentId = previousCurrent?.id ?? null;

    // Unset current flag on all other fiscal years
    await this.prisma.fiscalYear.updateMany({
      where: {
        organizationId: this.organizationId,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    // Set current flag on the specified fiscal year
    const fiscalYear = await this.prisma.fiscalYear.update({
      where: { id },
      data: {
        isCurrent: true,
        updatedBy: this.userId,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_year_set_current',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'fiscal_year',
      resourceId: id,
    });

    return {
      success: true,
      fiscalYear: this.mapPrismaToFiscalYear(fiscalYear),
      previousCurrentId,
      message: 'Rok obrotowy został ustawiony jako bieżący',
    };
  }

  // ===========================================================================
  // DELETE FISCAL YEAR
  // ===========================================================================

  async deleteFiscalYear(input: DeleteFiscalYearInput): Promise<DeleteFiscalYearResult> {
    const { id } = input;

    const existing = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    // Only draft fiscal years can be deleted
    if (existing.status !== 'draft') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Tylko robocze lata obrotowe mogą być usuwane',
      });
    }

    // Check if there are any journal entries
    const entriesCount = await this.prisma.journalEntry.count({
      where: {
        period: { fiscalYearId: id },
      },
    });

    if (entriesCount > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Rok obrotowy zawiera ${entriesCount} zapisów i nie może być usunięty`,
      });
    }

    // Delete periods first (cascade should handle this but being explicit)
    await this.prisma.accountingPeriod.deleteMany({
      where: { fiscalYearId: id },
    });

    // Delete the fiscal year
    await this.prisma.fiscalYear.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_year_deleted',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'fiscal_year',
      resourceId: id,
    });

    return { success: true, message: 'Rok obrotowy został usunięty' };
  }

  // ===========================================================================
  // GET CURRENT FISCAL YEAR
  // ===========================================================================

  async getCurrentFiscalYear(_input: GetCurrentFiscalYearInput): Promise<FiscalYear | null> {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: {
        organizationId: this.organizationId,
        isCurrent: true,
      },
      include: { periods: true },
    });

    if (!fiscalYear) return null;

    return this.mapPrismaToFiscalYear(fiscalYear);
  }

  // ===========================================================================
  // LIST FISCAL PERIODS
  // ===========================================================================

  async listFiscalPeriods(input: ListFiscalPeriodsInput): Promise<ListFiscalPeriodsResult> {
    const { fiscalYearId, status } = input;

    // Verify fiscal year exists
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, organizationId: this.organizationId },
    });

    if (!fiscalYear) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    // Map domain status to Prisma status for where clause
    // Domain: open, closed, locked -> Prisma: open, soft_closed, closed
    let prismaStatus: 'open' | 'soft_closed' | 'closed' | undefined;
    if (status === 'open') {
      prismaStatus = 'open';
    } else if (status === 'closed') {
      prismaStatus = 'soft_closed';
    } else if (status === 'locked') {
      prismaStatus = 'closed';
    }

    const where = {
      fiscalYearId,
      ...(prismaStatus && { status: prismaStatus }),
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingPeriod.findMany({
        where,
        orderBy: { periodNumber: 'asc' },
      }),
      this.prisma.accountingPeriod.count({ where }),
    ]);

    return {
      items: items.map((p) => this.mapPrismaToPeriod(p)),
      total,
    };
  }

  // ===========================================================================
  // CLOSE FISCAL PERIOD
  // ===========================================================================

  async closeFiscalPeriod(input: CloseFiscalPeriodInput): Promise<CloseFiscalPeriodResult> {
    const { id } = input;

    const existing = await this.prisma.accountingPeriod.findFirst({
      where: { id },
      include: { fiscalYear: true },
    });

    if (!existing || existing.fiscalYear.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Okres nie został znaleziony',
      });
    }

    // Prisma uses: open, soft_closed, closed
    // Cannot close if already soft_closed or closed
    if (existing.status === 'soft_closed' || existing.status === 'closed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Okres jest już zamknięty lub zablokowany',
      });
    }

    // Use soft_closed for domain "closed" (can be reopened)
    const period = await this.prisma.accountingPeriod.update({
      where: { id },
      data: {
        status: 'soft_closed',
        lockedAt: new Date(),
        lockedBy: this.userId,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_period_closed',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accounting_period',
      resourceId: id,
    });

    return {
      success: true,
      period: this.mapPrismaToPeriod(period),
      message: 'Okres został zamknięty',
    };
  }

  // ===========================================================================
  // REOPEN FISCAL PERIOD
  // ===========================================================================

  async reopenFiscalPeriod(input: ReopenFiscalPeriodInput): Promise<ReopenFiscalPeriodResult> {
    const { id, reason } = input;

    const existing = await this.prisma.accountingPeriod.findFirst({
      where: { id },
      include: { fiscalYear: true },
    });

    if (!existing || existing.fiscalYear.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Okres nie został znaleziony',
      });
    }

    if (existing.status === 'open') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Okres jest już otwarty',
      });
    }

    // Prisma 'closed' = domain 'locked' (cannot be reopened)
    if (existing.status === 'closed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można ponownie otworzyć zablokowanego okresu',
      });
    }

    // Only soft_closed periods can be reopened
    const period = await this.prisma.accountingPeriod.update({
      where: { id },
      data: {
        status: 'open',
        lockedAt: null,
        lockedBy: null,
        lockReason: null,
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    // Log audit event
    await this.auditLogger.log({
      action: 'fiscal_period_reopened',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accounting_period',
      resourceId: id,
      metadata: { reason },
    });

    return {
      success: true,
      period: this.mapPrismaToPeriod(period),
      message: 'Okres został ponownie otwarty',
    };
  }

  // ===========================================================================
  // GET FISCAL YEAR STATISTICS
  // ===========================================================================

  async getFiscalYearStatistics(input: GetFiscalYearStatisticsInput): Promise<FiscalYearStatistics> {
    // Schema uses 'id', not 'fiscalYearId'
    const { id } = input;

    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: this.organizationId },
      include: { periods: true },
    });

    if (!fiscalYear) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rok obrotowy nie został znaleziony',
      });
    }

    // Get period counts and journal entry statistics
    // Note: Prisma status 'soft_closed' = domain 'closed', Prisma 'closed' = domain 'locked'
    const [journalEntriesCount, openPeriods, closedPeriods, lockedPeriods, aggregates] = await Promise.all([
      this.prisma.journalEntry.count({
        where: { period: { fiscalYearId: id } },
      }),
      this.prisma.accountingPeriod.count({
        where: { fiscalYearId: id, status: 'open' },
      }),
      this.prisma.accountingPeriod.count({
        where: { fiscalYearId: id, status: 'soft_closed' }, // Domain 'closed' = Prisma 'soft_closed'
      }),
      this.prisma.accountingPeriod.count({
        where: { fiscalYearId: id, status: 'closed' }, // Domain 'locked' = Prisma 'closed'
      }),
      this.prisma.journalEntry.aggregate({
        where: { period: { fiscalYearId: id } },
        _sum: { totalDebit: true, totalCredit: true },
      }),
    ]);

    const totalDebit = aggregates._sum?.totalDebit?.toNumber() ?? 0;
    const totalCredit = aggregates._sum?.totalCredit?.toNumber() ?? 0;
    const isBalanced = totalDebit === totalCredit;

    return {
      fiscalYearId: id,
      totalPeriods: fiscalYear.periods.length,
      openPeriods,
      closedPeriods,
      lockedPeriods,
      journalEntriesCount,
      totalDebit,
      totalCredit,
      isBalanced,
    };
  }
}
