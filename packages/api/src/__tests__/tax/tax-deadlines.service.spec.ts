// TAX-003: Tax Deadline Management Service Tests
// Tests for Polish tax deadline management, calendar, and reminder functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaxDeadlinesService } from '../../services/tax/tax-deadlines.service';

// Mock database
const mockDb = vi.hoisted(() => ({
  query: {
    polishHolidays: {
      findMany: vi.fn(),
    },
    clientTaxDeadlines: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    taxDeadlineTypes: {
      findMany: vi.fn(),
    },
    deadlineReminderConfigs: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
}));

describe('TaxDeadlinesService', () => {
  let service: TaxDeadlinesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaxDeadlinesService(mockDb);
  });

  // =========================================================================
  // HOLIDAYS RETRIEVAL
  // =========================================================================

  describe('getHolidays', () => {
    it('should return Polish holidays for 2025', async () => {
      const result = await service.getHolidays({ year: 2025 });

      expect(result).toBeDefined();
      expect(result.length).toBe(13); // 13 Polish national holidays
      expect(result[0].name).toBe('Nowy Rok');
      expect(result[0].year).toBe(2025);
    });

    it('should return Polish holidays for 2024', async () => {
      const result = await service.getHolidays({ year: 2024 });

      expect(result).toBeDefined();
      expect(result.length).toBe(13);
    });

    it('should include moveable holidays', async () => {
      const result = await service.getHolidays({ year: 2025 });

      const easter = result.find(h => h.name === 'Wielkanoc');
      expect(easter).toBeDefined();
      expect(easter?.isMoveable).toBe(true);
    });

    it('should include all major Polish holidays', async () => {
      const result = await service.getHolidays({ year: 2025 });

      const holidayNames = result.map(h => h.name);
      expect(holidayNames).toContain('Nowy Rok');
      expect(holidayNames).toContain('Święto Trzech Króli');
      expect(holidayNames).toContain('Wielkanoc');
      expect(holidayNames).toContain('Poniedziałek Wielkanocny');
      expect(holidayNames).toContain('Święto Pracy');
      expect(holidayNames).toContain('Święto Konstytucji 3 Maja');
      expect(holidayNames).toContain('Zielone Świątki');
      expect(holidayNames).toContain('Boże Ciało');
      expect(holidayNames).toContain('Wniebowzięcie NMP');
      expect(holidayNames).toContain('Wszystkich Świętych');
      expect(holidayNames).toContain('Święto Niepodległości');
      expect(holidayNames).toContain('Boże Narodzenie');
      expect(holidayNames).toContain('Drugi dzień Bożego Narodzenia');
    });

    it('should return empty array for unsupported year', async () => {
      const result = await service.getHolidays({ year: 2030 });

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });

    it('should have correct dates for fixed holidays', async () => {
      const result = await service.getHolidays({ year: 2025 });

      const newYear = result.find(h => h.name === 'Nowy Rok');
      expect(newYear?.date.toISOString().split('T')[0]).toBe('2025-01-01');

      const independence = result.find(h => h.name === 'Święto Niepodległości');
      expect(independence?.date.toISOString().split('T')[0]).toBe('2025-11-11');
    });
  });

  // =========================================================================
  // DEADLINE DATE CALCULATION
  // =========================================================================

  describe('calculateAdjustedDeadline', () => {
    it('should not adjust a weekday deadline', async () => {
      // January 22, 2025 is Wednesday
      const baseDate = new Date(2025, 0, 22);

      const result = await service.calculateAdjustedDeadline({
        baseDate,
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(false);
      expect(result.adjustedDate.getDate()).toBe(22);
      expect(result.reason).toBeNull();
    });

    it('should adjust Saturday deadline to Monday', async () => {
      // March 15, 2025 is Saturday
      const baseDate = new Date(2025, 2, 15);

      const result = await service.calculateAdjustedDeadline({
        baseDate,
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(true);
      expect(result.adjustedDate.getDate()).toBe(17); // Monday
      expect(result.reason).toContain('sobota');
    });

    it('should adjust Sunday deadline to Monday', async () => {
      // June 15, 2025 is Sunday
      const baseDate = new Date(2025, 5, 15);

      const result = await service.calculateAdjustedDeadline({
        baseDate,
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(true);
      expect(result.adjustedDate.getDate()).toBe(16); // Monday
      expect(result.reason).toContain('niedziela');
    });

    it('should adjust Polish holiday to next working day', async () => {
      // November 11, 2025 is Tuesday (Independence Day)
      const baseDate = new Date(2025, 10, 11);

      const result = await service.calculateAdjustedDeadline({
        baseDate,
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(true);
      expect(result.adjustedDate.getDate()).toBe(12); // Wednesday
      expect(result.reason).toContain('Święto Niepodległości');
    });

    it('should handle consecutive non-working days (Christmas)', async () => {
      // December 25, 2025 is Thursday (Christmas)
      // December 26, 2025 is Friday (Boxing Day)
      // December 27, 2025 is Saturday
      // December 28, 2025 is Sunday
      const baseDate = new Date(2025, 11, 25);

      const result = await service.calculateAdjustedDeadline({
        baseDate,
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(true);
      expect(result.adjustedDate.getDate()).toBe(29); // Monday
    });

    it('should handle Easter Monday adjustment', async () => {
      // April 21, 2025 is Easter Monday
      const baseDate = new Date(2025, 3, 21);

      const result = await service.calculateAdjustedDeadline({
        baseDate,
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(true);
      expect(result.adjustedDate.getDate()).toBe(22); // Tuesday
      expect(result.reason).toContain('Poniedziałek Wielkanocny');
    });

    it('should return original date as baseDate', async () => {
      const baseDate = new Date(2025, 0, 22);

      const result = await service.calculateAdjustedDeadline({
        baseDate,
        year: 2025,
      });

      expect(result.baseDate).toEqual(baseDate);
    });
  });

  // =========================================================================
  // DEADLINE TYPE APPLICABILITY
  // =========================================================================

  describe('isDeadlineApplicable', () => {
    it('should return true for JPK_V7M if client is monthly VAT payer', () => {
      const deadlineType = {
        code: 'JPK_V7M',
        requiresVatPayer: true,
        requiresEmployees: false,
        requiresCitPayer: false,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'MONTHLY',
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(true);
    });

    it('should return false for JPK_V7M if client is quarterly VAT payer', () => {
      const deadlineType = {
        code: 'JPK_V7M',
        requiresVatPayer: true,
        requiresEmployees: false,
        requiresCitPayer: false,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'QUARTERLY',
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(false);
    });

    it('should return true for JPK_V7K if client is quarterly VAT payer', () => {
      const deadlineType = {
        code: 'JPK_V7K',
        requiresVatPayer: true,
        requiresEmployees: false,
        requiresCitPayer: false,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'QUARTERLY',
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(true);
    });

    it('should return false for ZUS employer deadline if client has no employees', () => {
      const deadlineType = {
        code: 'ZUS_DRA_EMP',
        requiresVatPayer: false,
        requiresEmployees: true,
        requiresCitPayer: false,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        hasEmployees: false,
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(false);
    });

    it('should return true for ZUS employer deadline if client has employees', () => {
      const deadlineType = {
        code: 'ZUS_DRA_EMP',
        requiresVatPayer: false,
        requiresEmployees: true,
        requiresCitPayer: false,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        hasEmployees: true,
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(true);
    });

    it('should return true for ZUS self-employed deadline if no employees', () => {
      const deadlineType = {
        code: 'ZUS_DRA_SELF',
        requiresVatPayer: false,
        requiresEmployees: false,
        requiresCitPayer: false,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        hasEmployees: false,
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(true);
    });

    it('should return false for ZUS self-employed deadline if has employees', () => {
      const deadlineType = {
        code: 'ZUS_DRA_SELF',
        requiresVatPayer: false,
        requiresEmployees: false,
        requiresCitPayer: false,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        hasEmployees: true,
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(false);
    });

    it('should return false for CIT advance if client is not CIT payer', () => {
      const deadlineType = {
        code: 'CIT_ADVANCE',
        requiresVatPayer: false,
        requiresEmployees: false,
        requiresCitPayer: true,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        citPayerStatus: 'INACTIVE',
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(false);
    });

    it('should return true for CIT advance if client is CIT payer', () => {
      const deadlineType = {
        code: 'CIT_ADVANCE',
        requiresVatPayer: false,
        requiresEmployees: false,
        requiresCitPayer: true,
        requiresPitPayer: false,
      } as any;

      const taxConfig = {
        citPayerStatus: 'ACTIVE',
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // DEADLINE TYPES
  // =========================================================================

  describe('getDeadlineTypes', () => {
    it('should return all active deadline types', async () => {
      const result = await service.getDeadlineTypes({ isActive: true });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by tax type VAT', async () => {
      const result = await service.getDeadlineTypes({ taxType: 'VAT' });

      expect(result).toBeDefined();
      expect(result.every(t => t.taxType === 'VAT')).toBe(true);
    });

    it('should filter by tax type CIT', async () => {
      const result = await service.getDeadlineTypes({ taxType: 'CIT' });

      expect(result).toBeDefined();
      expect(result.every(t => t.taxType === 'CIT')).toBe(true);
    });

    it('should filter by tax type ZUS', async () => {
      const result = await service.getDeadlineTypes({ taxType: 'ZUS' });

      expect(result).toBeDefined();
      expect(result.every(t => t.taxType === 'ZUS')).toBe(true);
    });

    it('should include JPK_V7M deadline type', async () => {
      const result = await service.getDeadlineTypes({});

      const jpkV7m = result.find(t => t.code === 'JPK_V7M');
      expect(jpkV7m).toBeDefined();
      expect(jpkV7m?.namePl).toBe('Jednolity Plik Kontrolny VAT miesięczny');
      expect(jpkV7m?.baseDay).toBe(25);
    });

    it('should include ZUS deadlines with correct base days', async () => {
      const result = await service.getDeadlineTypes({ taxType: 'ZUS' });

      const zusEmp = result.find(t => t.code === 'ZUS_DRA_EMP');
      expect(zusEmp?.baseDay).toBe(15);

      const zusSelf = result.find(t => t.code === 'ZUS_DRA_SELF');
      expect(zusSelf?.baseDay).toBe(20);
    });
  });

  // =========================================================================
  // DEADLINE GENERATION
  // =========================================================================

  describe('generateDeadlines', () => {
    it('should generate monthly VAT deadlines for VAT payer', async () => {
      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'MONTHLY',
        citPayerStatus: undefined,
        pitPayerStatus: undefined,
        hasEmployees: false,
      };

      const result = await service.generateDeadlines(
        { clientId: 'client-1', year: 2025 },
        'org-1',
        'user-1',
        taxConfig
      );

      expect(result.generated).toBeGreaterThan(0);
      expect(result.deadlineIds.length).toBe(result.generated);
    });

    it('should generate quarterly VAT deadlines for quarterly payer', async () => {
      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'QUARTERLY',
        citPayerStatus: undefined,
        pitPayerStatus: undefined,
        hasEmployees: false,
      };

      const result = await service.generateDeadlines(
        { clientId: 'client-1', year: 2025 },
        'org-1',
        'user-1',
        taxConfig
      );

      // Should have quarterly JPK_V7K (4) and VAT_PAYMENT (4)
      expect(result.generated).toBeGreaterThan(0);
    });

    it('should generate ZUS employer deadlines if has employees', async () => {
      const taxConfig = {
        vatPayerStatus: undefined,
        vatPeriod: undefined,
        citPayerStatus: undefined,
        pitPayerStatus: undefined,
        hasEmployees: true,
      };

      const result = await service.generateDeadlines(
        { clientId: 'client-1', year: 2025 },
        'org-1',
        'user-1',
        taxConfig
      );

      // Should include ZUS_DRA_EMP (12 monthly)
      expect(result.generated).toBeGreaterThan(0);
      expect(result.deadlineIds.some(id => id.includes('ZUS_DRA_EMP'))).toBe(true);
    });

    it('should generate ZUS self-employed deadlines if no employees', async () => {
      const taxConfig = {
        vatPayerStatus: undefined,
        vatPeriod: undefined,
        citPayerStatus: undefined,
        pitPayerStatus: undefined,
        hasEmployees: false,
      };

      const result = await service.generateDeadlines(
        { clientId: 'client-1', year: 2025 },
        'org-1',
        'user-1',
        taxConfig
      );

      // Should include ZUS_DRA_SELF (12 monthly)
      expect(result.generated).toBeGreaterThan(0);
      expect(result.deadlineIds.some(id => id.includes('ZUS_DRA_SELF'))).toBe(true);
    });

    it('should not generate CIT deadlines if not CIT payer', async () => {
      const taxConfig = {
        vatPayerStatus: undefined,
        vatPeriod: undefined,
        citPayerStatus: 'INACTIVE',
        pitPayerStatus: undefined,
        hasEmployees: false,
      };

      const result = await service.generateDeadlines(
        { clientId: 'client-1', year: 2025 },
        'org-1',
        'user-1',
        taxConfig
      );

      expect(result.deadlineIds.filter(id => id.includes('CIT')).length).toBe(0);
    });

    it('should generate CIT deadlines if CIT payer', async () => {
      const taxConfig = {
        vatPayerStatus: undefined,
        vatPeriod: undefined,
        citPayerStatus: 'ACTIVE',
        pitPayerStatus: undefined,
        hasEmployees: false,
      };

      const result = await service.generateDeadlines(
        { clientId: 'client-1', year: 2025 },
        'org-1',
        'user-1',
        taxConfig
      );

      expect(result.deadlineIds.filter(id => id.includes('CIT')).length).toBeGreaterThan(0);
    });

    it('should track skipped deadlines', async () => {
      const taxConfig = {
        vatPayerStatus: 'INACTIVE',
        vatPeriod: undefined,
        citPayerStatus: 'INACTIVE',
        pitPayerStatus: 'INACTIVE',
        hasEmployees: false,
      };

      const result = await service.generateDeadlines(
        { clientId: 'client-1', year: 2025 },
        'org-1',
        'user-1',
        taxConfig
      );

      expect(result.skipped).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // CALENDAR
  // =========================================================================

  describe('getCalendar', () => {
    it('should return calendar with holidays for January 2025', async () => {
      const result = await service.getCalendar({ year: 2025, month: 1 });

      expect(result).toBeDefined();
      expect(result.holidays).toBeDefined();
      expect(result.deadlines).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should filter holidays to the requested month', async () => {
      const result = await service.getCalendar({ year: 2025, month: 1 });

      // January 2025 has New Year (1st) and Epiphany (6th)
      expect(result.holidays.length).toBe(2);
    });

    it('should return summary counts', async () => {
      const result = await service.getCalendar({ year: 2025, month: 1 });

      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('pending');
      expect(result.summary).toHaveProperty('overdue');
      expect(result.summary).toHaveProperty('submitted');
      expect(result.summary).toHaveProperty('inProgress');
    });
  });

  // =========================================================================
  // REMINDER CONFIGURATIONS
  // =========================================================================

  describe('getReminderConfigs', () => {
    it('should return default reminder configurations', async () => {
      const result = await service.getReminderConfigs(
        {},
        'org-1',
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(4); // EARLY, STANDARD, URGENT, CRITICAL
    });

    it('should have correct days before for each level', async () => {
      const result = await service.getReminderConfigs(
        {},
        'org-1',
        'user-1'
      );

      const early = result.find(r => r.reminderLevel === 'EARLY');
      expect(early?.daysBefore).toBe(14);

      const standard = result.find(r => r.reminderLevel === 'STANDARD');
      expect(standard?.daysBefore).toBe(7);

      const urgent = result.find(r => r.reminderLevel === 'URGENT');
      expect(urgent?.daysBefore).toBe(3);

      const critical = result.find(r => r.reminderLevel === 'CRITICAL');
      expect(critical?.daysBefore).toBe(1);
    });

    it('should have SMS enabled only for critical reminders by default', async () => {
      const result = await service.getReminderConfigs(
        {},
        'org-1',
        'user-1'
      );

      const nonCritical = result.filter(r => r.reminderLevel !== 'CRITICAL');
      expect(nonCritical.every(r => r.smsEnabled === false)).toBe(true);

      const critical = result.find(r => r.reminderLevel === 'CRITICAL');
      expect(critical?.smsEnabled).toBe(true);
    });
  });

  // =========================================================================
  // STATUS UPDATE
  // =========================================================================

  describe('updateDeadlineStatus', () => {
    it('should update deadline status to SUBMITTED', async () => {
      const result = await service.updateDeadlineStatus(
        {
          deadlineId: 'deadline-1',
          status: 'SUBMITTED',
          confirmationNumber: 'UPO-123456',
        },
        'org-1',
        'user-1'
      );

      expect(result.success).toBe(true);
    });

    it('should update deadline status to CONFIRMED', async () => {
      const result = await service.updateDeadlineStatus(
        {
          deadlineId: 'deadline-1',
          status: 'CONFIRMED',
          confirmationNumber: 'UPO-123456',
          notes: 'Filed successfully',
        },
        'org-1',
        'user-1'
      );

      expect(result.success).toBe(true);
    });

    it('should update deadline status to EXEMPT', async () => {
      const result = await service.updateDeadlineStatus(
        {
          deadlineId: 'deadline-1',
          status: 'EXEMPT',
          notes: 'Client is exempt from this obligation',
        },
        'org-1',
        'user-1'
      );

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // SNOOZE REMINDER
  // =========================================================================

  describe('snoozeReminder', () => {
    it('should snooze reminder successfully', async () => {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + 2);

      const result = await service.snoozeReminder(
        {
          reminderId: 'reminder-1',
          snoozeUntil,
        },
        'user-1'
      );

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // OVERDUE DEADLINES
  // =========================================================================

  describe('updateOverdueDeadlines', () => {
    it('should update overdue deadlines', async () => {
      const result = await service.updateOverdueDeadlines(
        {},
        'org-1'
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('deadlineIds');
    });
  });

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  describe('calculatePotentialPenalty', () => {
    it('should return 0 for non-overdue deadline', () => {
      const deadline = {
        status: 'PENDING',
        adjustedDeadlineDate: new Date(),
      } as any;

      const deadlineType = {
        penaltyDailyRate: 500,
      } as any;

      const result = service.calculatePotentialPenalty(deadline, deadlineType);
      expect(result).toBe(0);
    });

    it('should return 0 for deadline type without penalty', () => {
      const deadline = {
        status: 'OVERDUE',
        adjustedDeadlineDate: new Date('2025-01-01'),
      } as any;

      const deadlineType = {
        penaltyDailyRate: null,
      } as any;

      const result = service.calculatePotentialPenalty(deadline, deadlineType);
      expect(result).toBe(0);
    });

    it('should calculate penalty for overdue deadline', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      const deadline = {
        status: 'OVERDUE',
        adjustedDeadlineDate: pastDate,
      } as any;

      const deadlineType = {
        penaltyDailyRate: 500,
      } as any;

      const result = service.calculatePotentialPenalty(deadline, deadlineType);
      expect(result).toBe(2500); // 5 days * 500 PLN
    });
  });

  describe('getDaysUntilDeadline', () => {
    it('should return positive days for future deadline', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const deadline = {
        adjustedDeadlineDate: futureDate,
      } as any;

      const result = service.getDaysUntilDeadline(deadline);
      expect(result).toBe(10);
    });

    it('should return negative days for past deadline', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const deadline = {
        adjustedDeadlineDate: pastDate,
      } as any;

      const result = service.getDaysUntilDeadline(deadline);
      expect(result).toBe(-5);
    });

    it('should return 0 for today deadline', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      const deadline = {
        adjustedDeadlineDate: today,
      } as any;

      const result = service.getDaysUntilDeadline(deadline);
      expect(result).toBe(0);
    });
  });
});
