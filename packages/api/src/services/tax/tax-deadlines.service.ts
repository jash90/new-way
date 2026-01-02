// TAX-003: Tax Deadline Management Service
// Manages Polish tax deadlines, calendar, reminders, and holiday adjustments

import type {
  GetDeadlinesInput,
  GetCalendarInput,
  GetHolidaysInput,
  GetDeadlineByIdInput,
  GetDeadlineTypesInput,
  GenerateDeadlinesInput,
  UpdateDeadlineStatusInput,
  CalculateAdjustedDeadlineInput,
  UpdateOverdueDeadlinesInput,
  ConfigureRemindersInput,
  GetReminderConfigsInput,
  SnoozeReminderInput,
  GetPendingRemindersInput,
  GetCalendarResult,
  AdjustedDeadlineResult,
  GenerateDeadlinesResult,
  UpdateOverdueResult,
  ClientDeadlineWithRelations,
  UpcomingDeadlinesSummary,
  TaxDeadlineType,
  PolishHoliday,
  ClientTaxDeadline,
  DeadlineReminderConfig,
} from '@ksiegowacrm/shared';

// Polish holidays static data (2024-2030)
const POLISH_HOLIDAYS: Record<number, Array<{ date: string; name: string; nameEn: string; isMoveable: boolean }>> = {
  2024: [
    { date: '2024-01-01', name: 'Nowy Rok', nameEn: 'New Year', isMoveable: false },
    { date: '2024-01-06', name: 'Święto Trzech Króli', nameEn: 'Epiphany', isMoveable: false },
    { date: '2024-03-31', name: 'Wielkanoc', nameEn: 'Easter Sunday', isMoveable: true },
    { date: '2024-04-01', name: 'Poniedziałek Wielkanocny', nameEn: 'Easter Monday', isMoveable: true },
    { date: '2024-05-01', name: 'Święto Pracy', nameEn: 'Labour Day', isMoveable: false },
    { date: '2024-05-03', name: 'Święto Konstytucji 3 Maja', nameEn: 'Constitution Day', isMoveable: false },
    { date: '2024-05-19', name: 'Zielone Świątki', nameEn: 'Pentecost', isMoveable: true },
    { date: '2024-05-30', name: 'Boże Ciało', nameEn: 'Corpus Christi', isMoveable: true },
    { date: '2024-08-15', name: 'Wniebowzięcie NMP', nameEn: 'Assumption of Mary', isMoveable: false },
    { date: '2024-11-01', name: 'Wszystkich Świętych', nameEn: 'All Saints Day', isMoveable: false },
    { date: '2024-11-11', name: 'Święto Niepodległości', nameEn: 'Independence Day', isMoveable: false },
    { date: '2024-12-25', name: 'Boże Narodzenie', nameEn: 'Christmas Day', isMoveable: false },
    { date: '2024-12-26', name: 'Drugi dzień Bożego Narodzenia', nameEn: 'St. Stephen Day', isMoveable: false },
  ],
  2025: [
    { date: '2025-01-01', name: 'Nowy Rok', nameEn: 'New Year', isMoveable: false },
    { date: '2025-01-06', name: 'Święto Trzech Króli', nameEn: 'Epiphany', isMoveable: false },
    { date: '2025-04-20', name: 'Wielkanoc', nameEn: 'Easter Sunday', isMoveable: true },
    { date: '2025-04-21', name: 'Poniedziałek Wielkanocny', nameEn: 'Easter Monday', isMoveable: true },
    { date: '2025-05-01', name: 'Święto Pracy', nameEn: 'Labour Day', isMoveable: false },
    { date: '2025-05-03', name: 'Święto Konstytucji 3 Maja', nameEn: 'Constitution Day', isMoveable: false },
    { date: '2025-06-08', name: 'Zielone Świątki', nameEn: 'Pentecost', isMoveable: true },
    { date: '2025-06-19', name: 'Boże Ciało', nameEn: 'Corpus Christi', isMoveable: true },
    { date: '2025-08-15', name: 'Wniebowzięcie NMP', nameEn: 'Assumption of Mary', isMoveable: false },
    { date: '2025-11-01', name: 'Wszystkich Świętych', nameEn: 'All Saints Day', isMoveable: false },
    { date: '2025-11-11', name: 'Święto Niepodległości', nameEn: 'Independence Day', isMoveable: false },
    { date: '2025-12-25', name: 'Boże Narodzenie', nameEn: 'Christmas Day', isMoveable: false },
    { date: '2025-12-26', name: 'Drugi dzień Bożego Narodzenia', nameEn: 'St. Stephen Day', isMoveable: false },
  ],
  2026: [
    { date: '2026-01-01', name: 'Nowy Rok', nameEn: 'New Year', isMoveable: false },
    { date: '2026-01-06', name: 'Święto Trzech Króli', nameEn: 'Epiphany', isMoveable: false },
    { date: '2026-04-05', name: 'Wielkanoc', nameEn: 'Easter Sunday', isMoveable: true },
    { date: '2026-04-06', name: 'Poniedziałek Wielkanocny', nameEn: 'Easter Monday', isMoveable: true },
    { date: '2026-05-01', name: 'Święto Pracy', nameEn: 'Labour Day', isMoveable: false },
    { date: '2026-05-03', name: 'Święto Konstytucji 3 Maja', nameEn: 'Constitution Day', isMoveable: false },
    { date: '2026-05-24', name: 'Zielone Świątki', nameEn: 'Pentecost', isMoveable: true },
    { date: '2026-06-04', name: 'Boże Ciało', nameEn: 'Corpus Christi', isMoveable: true },
    { date: '2026-08-15', name: 'Wniebowzięcie NMP', nameEn: 'Assumption of Mary', isMoveable: false },
    { date: '2026-11-01', name: 'Wszystkich Świętych', nameEn: 'All Saints Day', isMoveable: false },
    { date: '2026-11-11', name: 'Święto Niepodległości', nameEn: 'Independence Day', isMoveable: false },
    { date: '2026-12-25', name: 'Boże Narodzenie', nameEn: 'Christmas Day', isMoveable: false },
    { date: '2026-12-26', name: 'Drugi dzień Bożego Narodzenia', nameEn: 'St. Stephen Day', isMoveable: false },
  ],
};

// Tax deadline types configuration
const DEADLINE_TYPES: TaxDeadlineType[] = [
  {
    id: 'dt-jpk-v7m',
    code: 'JPK_V7M',
    name: 'Monthly VAT Declaration',
    namePl: 'Jednolity Plik Kontrolny VAT miesięczny',
    taxType: 'VAT',
    description: 'Monthly VAT declaration with purchase/sales register',
    legalBasis: 'Art. 99 ust. 1 ustawy o VAT',
    penaltyDescription: 'Late filing penalty',
    penaltyDailyRate: 500,
    baseDay: 25,
    appliesToMonthly: true,
    appliesToQuarterly: false,
    appliesToAnnual: false,
    requiresEmployees: false,
    requiresVatPayer: true,
    requiresCitPayer: false,
    requiresPitPayer: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-jpk-v7k',
    code: 'JPK_V7K',
    name: 'Quarterly VAT Declaration',
    namePl: 'Jednolity Plik Kontrolny VAT kwartalny',
    taxType: 'VAT',
    description: 'Quarterly VAT declaration with purchase/sales register',
    legalBasis: 'Art. 99 ust. 3 ustawy o VAT',
    penaltyDescription: 'Late filing penalty',
    penaltyDailyRate: 500,
    baseDay: 25,
    appliesToMonthly: false,
    appliesToQuarterly: true,
    appliesToAnnual: false,
    requiresEmployees: false,
    requiresVatPayer: true,
    requiresCitPayer: false,
    requiresPitPayer: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-vat-payment',
    code: 'VAT_PAYMENT',
    name: 'VAT Payment',
    namePl: 'Wpłata VAT',
    taxType: 'VAT',
    description: 'VAT payment to tax office',
    legalBasis: 'Art. 103 ust. 1 ustawy o VAT',
    penaltyDescription: null,
    penaltyDailyRate: null,
    baseDay: 25,
    appliesToMonthly: true,
    appliesToQuarterly: true,
    appliesToAnnual: false,
    requiresEmployees: false,
    requiresVatPayer: true,
    requiresCitPayer: false,
    requiresPitPayer: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-cit-advance',
    code: 'CIT_ADVANCE',
    name: 'CIT Advance Payment',
    namePl: 'Zaliczka na CIT',
    taxType: 'CIT',
    description: 'Monthly CIT advance payment',
    legalBasis: 'Art. 25 ust. 1 ustawy o CIT',
    penaltyDescription: null,
    penaltyDailyRate: null,
    baseDay: 20,
    appliesToMonthly: true,
    appliesToQuarterly: false,
    appliesToAnnual: false,
    requiresEmployees: false,
    requiresVatPayer: false,
    requiresCitPayer: true,
    requiresPitPayer: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-pit-advance',
    code: 'PIT_ADVANCE',
    name: 'PIT Advance Payment',
    namePl: 'Zaliczka na PIT',
    taxType: 'PIT',
    description: 'Monthly PIT advance payment',
    legalBasis: 'Art. 44 ust. 6 ustawy o PIT',
    penaltyDescription: null,
    penaltyDailyRate: null,
    baseDay: 20,
    appliesToMonthly: true,
    appliesToQuarterly: false,
    appliesToAnnual: false,
    requiresEmployees: false,
    requiresVatPayer: false,
    requiresCitPayer: false,
    requiresPitPayer: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-zus-dra-emp',
    code: 'ZUS_DRA_EMP',
    name: 'ZUS Declaration (employers)',
    namePl: 'Deklaracja ZUS DRA (pracodawcy)',
    taxType: 'ZUS',
    description: 'Monthly ZUS declaration for employers',
    legalBasis: 'Art. 47 ust. 1 pkt 1 ustawy o SUS',
    penaltyDescription: null,
    penaltyDailyRate: null,
    baseDay: 15,
    appliesToMonthly: true,
    appliesToQuarterly: false,
    appliesToAnnual: false,
    requiresEmployees: true,
    requiresVatPayer: false,
    requiresCitPayer: false,
    requiresPitPayer: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-zus-dra-self',
    code: 'ZUS_DRA_SELF',
    name: 'ZUS Declaration (self-employed)',
    namePl: 'Deklaracja ZUS DRA (samozatrudnieni)',
    taxType: 'ZUS',
    description: 'Monthly ZUS declaration for self-employed',
    legalBasis: 'Art. 47 ust. 1 pkt 2 ustawy o SUS',
    penaltyDescription: null,
    penaltyDailyRate: null,
    baseDay: 20,
    appliesToMonthly: true,
    appliesToQuarterly: false,
    appliesToAnnual: false,
    requiresEmployees: false,
    requiresVatPayer: false,
    requiresCitPayer: false,
    requiresPitPayer: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-cit-8',
    code: 'CIT_8',
    name: 'Annual CIT Declaration',
    namePl: 'Roczna deklaracja CIT-8',
    taxType: 'CIT',
    description: 'Annual CIT declaration',
    legalBasis: 'Art. 27 ust. 1 ustawy o CIT',
    penaltyDescription: null,
    penaltyDailyRate: null,
    baseDay: 31,
    appliesToMonthly: false,
    appliesToQuarterly: false,
    appliesToAnnual: true,
    requiresEmployees: false,
    requiresVatPayer: false,
    requiresCitPayer: true,
    requiresPitPayer: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'dt-pit-36',
    code: 'PIT_36',
    name: 'Annual PIT Declaration',
    namePl: 'Roczna deklaracja PIT-36',
    taxType: 'PIT',
    description: 'Annual PIT declaration',
    legalBasis: 'Art. 45 ust. 1 ustawy o PIT',
    penaltyDescription: null,
    penaltyDailyRate: null,
    baseDay: 30,
    appliesToMonthly: false,
    appliesToQuarterly: false,
    appliesToAnnual: true,
    requiresEmployees: false,
    requiresVatPayer: false,
    requiresCitPayer: false,
    requiresPitPayer: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Helper functions
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date): string {
  // Use local date components to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPolishDayName(date: Date): string {
  const days = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  return days[date.getDay()] ?? 'niedziela';
}

function diffDays(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date1.getTime() - date2.getTime()) / oneDay);
}

export class TaxDeadlinesService {
  constructor(private readonly _db: unknown) {
    // Suppress unused warning - reserved for future database integration
    void this._db;
  }

  // =========================================================================
  // DEADLINE RETRIEVAL
  // =========================================================================

  /**
   * Get deadlines with filters
   */
  async getDeadlines(_input: GetDeadlinesInput): Promise<ClientDeadlineWithRelations[]> {
    // In production, this would query the database
    // For now, return mock data
    return [];
  }

  /**
   * Get calendar view for a month
   */
  async getCalendar(input: GetCalendarInput): Promise<GetCalendarResult> {
    const holidays = await this.getHolidays({ year: input.year });

    // Filter holidays for the specific month
    const monthHolidays = holidays.filter(h => {
      const holidayDate = new Date(h.date);
      return holidayDate.getMonth() + 1 === input.month;
    });

    // In production, fetch from database
    const deadlines: ClientTaxDeadline[] = [];

    const summary = {
      total: deadlines.length,
      pending: deadlines.filter(d => d.status === 'PENDING').length,
      overdue: deadlines.filter(d => d.status === 'OVERDUE').length,
      submitted: deadlines.filter(d => d.status === 'SUBMITTED' || d.status === 'CONFIRMED').length,
      inProgress: deadlines.filter(d => d.status === 'IN_PROGRESS').length,
    };

    return {
      deadlines: deadlines.map(d => ({
        ...d,
        client: undefined,
        deadlineType: undefined,
      })),
      holidays: monthHolidays,
      summary,
    };
  }

  /**
   * Get Polish holidays for a year
   */
  async getHolidays(input: GetHolidaysInput): Promise<PolishHoliday[]> {
    const yearHolidays = POLISH_HOLIDAYS[input.year] || [];

    return yearHolidays.map((h, index) => ({
      id: `holiday-${input.year}-${index}`,
      date: new Date(h.date),
      name: h.name,
      nameEn: h.nameEn,
      isMoveable: h.isMoveable,
      year: input.year,
      createdAt: new Date(),
    }));
  }

  /**
   * Get deadline by ID
   */
  async getDeadlineById(_input: GetDeadlineByIdInput): Promise<ClientDeadlineWithRelations | null> {
    // In production, query database
    return null;
  }

  /**
   * Get deadline types
   */
  async getDeadlineTypes(input: GetDeadlineTypesInput): Promise<TaxDeadlineType[]> {
    let types = [...DEADLINE_TYPES];

    if (input.taxType) {
      types = types.filter(t => t.taxType === input.taxType);
    }

    if (input.isActive !== undefined) {
      types = types.filter(t => t.isActive === input.isActive);
    }

    return types;
  }

  /**
   * Get upcoming deadlines summary
   */
  async getUpcomingDeadlines(): Promise<UpcomingDeadlinesSummary> {
    // In production, fetch from database
    return {
      today: [],
      thisWeek: [],
      thisMonth: [],
      overdue: [],
      counts: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        overdue: 0,
      },
    };
  }

  // =========================================================================
  // DEADLINE MANAGEMENT
  // =========================================================================

  /**
   * Calculate adjusted deadline date considering holidays and weekends
   */
  async calculateAdjustedDeadline(input: CalculateAdjustedDeadlineInput): Promise<AdjustedDeadlineResult> {
    const holidays = await this.getHolidays({ year: input.year });

    // Create a map for quick holiday lookup using date string
    const holidayMap = new Map<string, { name: string; nameEn: string }>();
    for (const h of holidays) {
      holidayMap.set(formatDateKey(h.date), { name: h.name, nameEn: h.nameEn ?? h.name });
    }

    let adjustedDate = new Date(input.baseDate);
    let reason: string | null = null;
    let wasAdjusted = false;
    let originalReason: string | null = null; // Track the FIRST reason for adjustment

    // Check if date is a weekend or holiday and adjust
    while (isWeekend(adjustedDate) || holidayMap.has(formatDateKey(adjustedDate))) {
      wasAdjusted = true;

      // Only capture the first reason (the original cause for adjustment)
      if (originalReason === null) {
        const holidayInfo = holidayMap.get(formatDateKey(adjustedDate));
        if (holidayInfo && holidayInfo.name) {
          originalReason = `Przesunięto z powodu święta: ${holidayInfo.name}`;
        } else if (isWeekend(adjustedDate)) {
          const dayName = getPolishDayName(adjustedDate);
          originalReason = `Przesunięto z ${dayName}`;
        }
      }

      adjustedDate = addDays(adjustedDate, 1);
    }

    reason = originalReason;

    return {
      baseDate: input.baseDate,
      adjustedDate,
      reason,
      wasAdjusted,
    };
  }

  /**
   * Check if a deadline type applies to a client based on their tax configuration
   */
  isDeadlineApplicable(
    deadlineType: TaxDeadlineType,
    taxConfig: {
      vatPayerStatus?: string;
      vatPeriod?: string;
      citPayerStatus?: string;
      pitPayerStatus?: string;
      hasEmployees?: boolean;
    }
  ): boolean {
    // Check VAT payer requirement
    if (deadlineType.requiresVatPayer && taxConfig.vatPayerStatus !== 'ACTIVE') {
      return false;
    }

    // Check VAT period for monthly vs quarterly
    if (deadlineType.code === 'JPK_V7M' && taxConfig.vatPeriod !== 'MONTHLY') {
      return false;
    }
    if (deadlineType.code === 'JPK_V7K' && taxConfig.vatPeriod !== 'QUARTERLY') {
      return false;
    }

    // Check CIT payer requirement
    if (deadlineType.requiresCitPayer && taxConfig.citPayerStatus !== 'ACTIVE') {
      return false;
    }

    // Check PIT payer requirement
    if (deadlineType.requiresPitPayer && taxConfig.pitPayerStatus !== 'ACTIVE') {
      return false;
    }

    // Check employee requirement
    if (deadlineType.requiresEmployees && !taxConfig.hasEmployees) {
      return false;
    }

    // ZUS self-employed vs employer deadlines
    if (deadlineType.code === 'ZUS_DRA_EMP' && !taxConfig.hasEmployees) {
      return false;
    }
    if (deadlineType.code === 'ZUS_DRA_SELF' && taxConfig.hasEmployees) {
      return false;
    }

    return true;
  }

  /**
   * Generate deadlines for a client
   */
  async generateDeadlines(
    input: GenerateDeadlinesInput,
    organizationId: string,
    userId: string,
    taxConfig: {
      vatPayerStatus?: string;
      vatPeriod?: string;
      citPayerStatus?: string;
      pitPayerStatus?: string;
      hasEmployees?: boolean;
    }
  ): Promise<GenerateDeadlinesResult> {
    const generatedDeadlines: string[] = [];
    const errors: string[] = [];
    let skipped = 0;

    const deadlineTypes = await this.getDeadlineTypes({ isActive: true });

    for (const deadlineType of deadlineTypes) {
      // Check if deadline applies to this client
      if (!this.isDeadlineApplicable(deadlineType, taxConfig)) {
        skipped++;
        continue;
      }

      try {
        // Generate monthly deadlines
        if (deadlineType.appliesToMonthly) {
          for (let month = 1; month <= 12; month++) {
            const deadline = await this.generateMonthlyDeadline(
              input.clientId,
              deadlineType,
              input.year,
              month,
              organizationId,
              userId
            );
            if (deadline) {
              generatedDeadlines.push(deadline.id);
            } else {
              skipped++;
            }
          }
        }

        // Generate quarterly deadlines
        if (deadlineType.appliesToQuarterly) {
          for (let quarter = 1; quarter <= 4; quarter++) {
            const deadline = await this.generateQuarterlyDeadline(
              input.clientId,
              deadlineType,
              input.year,
              quarter,
              organizationId,
              userId
            );
            if (deadline) {
              generatedDeadlines.push(deadline.id);
            } else {
              skipped++;
            }
          }
        }

        // Generate annual deadlines
        if (deadlineType.appliesToAnnual) {
          const deadline = await this.generateAnnualDeadline(
            input.clientId,
            deadlineType,
            input.year,
            organizationId,
            userId
          );
          if (deadline) {
            generatedDeadlines.push(deadline.id);
          } else {
            skipped++;
          }
        }
      } catch (error) {
        errors.push(`Failed to generate ${deadlineType.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      generated: generatedDeadlines.length,
      deadlineIds: generatedDeadlines,
      skipped,
      errors,
    };
  }

  /**
   * Generate a monthly deadline
   */
  private async generateMonthlyDeadline(
    clientId: string,
    deadlineType: TaxDeadlineType,
    year: number,
    month: number,
    _organizationId: string,
    _userId: string
  ): Promise<{ id: string } | null> {
    // Calculate base deadline date
    // For most tax deadlines, the period refers to the previous month
    const deadlineMonth = month === 12 ? 1 : month + 1;
    const deadlineYear = month === 12 ? year + 1 : year;

    const baseDate = new Date(deadlineYear, deadlineMonth - 1, deadlineType.baseDay);
    // Calculate adjusted deadline (result used in production database insert)
    await this.calculateAdjustedDeadline({ baseDate, year: deadlineYear });

    // In production, insert into database
    const id = `deadline-${clientId}-${deadlineType.code}-${year}-${month}`;

    return { id };
  }

  /**
   * Generate a quarterly deadline
   */
  private async generateQuarterlyDeadline(
    clientId: string,
    deadlineType: TaxDeadlineType,
    year: number,
    quarter: number,
    _organizationId: string,
    _userId: string
  ): Promise<{ id: string } | null> {
    // Calculate deadline date (25th of month after quarter end)
    const quarterEndMonth = quarter * 3;
    const deadlineMonth = quarterEndMonth === 12 ? 1 : quarterEndMonth + 1;
    const deadlineYear = quarterEndMonth === 12 ? year + 1 : year;

    const baseDate = new Date(deadlineYear, deadlineMonth - 1, deadlineType.baseDay);
    // Calculate adjusted deadline (result used in production database insert)
    await this.calculateAdjustedDeadline({ baseDate, year: deadlineYear });

    // In production, insert into database
    const id = `deadline-${clientId}-${deadlineType.code}-${year}-Q${quarter}`;

    return { id };
  }

  /**
   * Generate an annual deadline
   */
  private async generateAnnualDeadline(
    clientId: string,
    deadlineType: TaxDeadlineType,
    year: number,
    _organizationId: string,
    _userId: string
  ): Promise<{ id: string } | null> {
    // Annual declarations are typically due at end of March (CIT) or April (PIT)
    const deadlineMonth = deadlineType.code === 'CIT_8' ? 3 : 4;
    const deadlineYear = year + 1;

    const baseDate = new Date(deadlineYear, deadlineMonth - 1, deadlineType.baseDay);
    // Calculate adjusted deadline (result used in production database insert)
    await this.calculateAdjustedDeadline({ baseDate, year: deadlineYear });

    // In production, insert into database
    const id = `deadline-${clientId}-${deadlineType.code}-${year}-annual`;

    return { id };
  }

  /**
   * Update deadline status
   */
  async updateDeadlineStatus(
    _input: UpdateDeadlineStatusInput,
    _organizationId: string,
    _userId: string
  ): Promise<{ success: boolean; deadline: ClientTaxDeadline | null }> {
    // In production, update in database
    return {
      success: true,
      deadline: null,
    };
  }

  /**
   * Update overdue deadlines
   */
  async updateOverdueDeadlines(
    _input: UpdateOverdueDeadlinesInput,
    _organizationId: string
  ): Promise<UpdateOverdueResult> {
    // In production, update in database
    return {
      updated: 0,
      deadlineIds: [],
    };
  }

  // =========================================================================
  // REMINDER CONFIGURATION
  // =========================================================================

  /**
   * Configure reminder settings
   */
  async configureReminders(
    _input: ConfigureRemindersInput,
    _organizationId: string,
    _userId: string
  ): Promise<{ success: boolean }> {
    // In production, upsert in database
    return { success: true };
  }

  /**
   * Get reminder configurations
   */
  async getReminderConfigs(
    _input: GetReminderConfigsInput,
    _organizationId: string,
    _userId: string
  ): Promise<DeadlineReminderConfig[]> {
    // In production, query database
    // Return default configurations
    return [
      {
        id: 'config-early',
        organizationId: _organizationId,
        userId: _userId,
        deadlineTypeId: null,
        reminderLevel: 'EARLY',
        daysBefore: 14,
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'config-standard',
        organizationId: _organizationId,
        userId: _userId,
        deadlineTypeId: null,
        reminderLevel: 'STANDARD',
        daysBefore: 7,
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'config-urgent',
        organizationId: _organizationId,
        userId: _userId,
        deadlineTypeId: null,
        reminderLevel: 'URGENT',
        daysBefore: 3,
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'config-critical',
        organizationId: _organizationId,
        userId: _userId,
        deadlineTypeId: null,
        reminderLevel: 'CRITICAL',
        daysBefore: 1,
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  /**
   * Snooze a reminder
   */
  async snoozeReminder(
    _input: SnoozeReminderInput,
    _userId: string
  ): Promise<{ success: boolean }> {
    // In production, update in database
    return { success: true };
  }

  /**
   * Get pending reminders
   */
  async getPendingReminders(
    _input: GetPendingRemindersInput,
    _organizationId: string
  ): Promise<any[]> {
    // In production, query database
    return [];
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Calculate potential penalty for an overdue deadline
   */
  calculatePotentialPenalty(
    deadline: ClientTaxDeadline,
    deadlineType: TaxDeadlineType
  ): number {
    if (deadline.status !== 'OVERDUE' || !deadlineType.penaltyDailyRate) {
      return 0;
    }

    const today = new Date();
    const daysOverdue = diffDays(today, deadline.adjustedDeadlineDate);

    if (daysOverdue <= 0) {
      return 0;
    }

    return daysOverdue * deadlineType.penaltyDailyRate;
  }

  /**
   * Get days until deadline
   */
  getDaysUntilDeadline(deadline: ClientTaxDeadline): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(deadline.adjustedDeadlineDate);
    deadlineDate.setHours(0, 0, 0, 0);

    return diffDays(deadlineDate, today);
  }
}
