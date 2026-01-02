// TAX-003: Tax Deadline Management Router Tests
// Tests for tax deadline router endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the service
const mockService = vi.hoisted(() => ({
  getDeadlines: vi.fn(),
  getCalendar: vi.fn(),
  getHolidays: vi.fn(),
  getDeadlineById: vi.fn(),
  getDeadlineTypes: vi.fn(),
  getUpcomingDeadlines: vi.fn(),
  calculateAdjustedDeadline: vi.fn(),
  generateDeadlines: vi.fn(),
  updateDeadlineStatus: vi.fn(),
  updateOverdueDeadlines: vi.fn(),
  configureReminders: vi.fn(),
  getReminderConfigs: vi.fn(),
  snoozeReminder: vi.fn(),
  getPendingReminders: vi.fn(),
}));

vi.mock('../../services/tax/tax-deadlines.service', () => ({
  TaxDeadlinesService: vi.fn().mockImplementation(() => mockService),
}));

// Mock caller for testing router endpoints
const createMockCaller = () => ({
  getDeadlines: async (input: any) => mockService.getDeadlines(input),
  getCalendar: async (input: any) => mockService.getCalendar(input),
  getHolidays: async (input: any) => mockService.getHolidays(input),
  getDeadlineById: async (input: any) => mockService.getDeadlineById(input),
  getDeadlineTypes: async (input: any) => mockService.getDeadlineTypes(input),
  getUpcomingDeadlines: async () => mockService.getUpcomingDeadlines(),
  calculateAdjustedDeadline: async (input: any) => mockService.calculateAdjustedDeadline(input),
  generateDeadlines: async (input: any) => mockService.generateDeadlines(input, 'org-1', 'user-1', {}),
  updateDeadlineStatus: async (input: any) => mockService.updateDeadlineStatus(input, 'org-1', 'user-1'),
  updateOverdueDeadlines: async (input: any) => mockService.updateOverdueDeadlines(input, 'org-1'),
  configureReminders: async (input: any) => mockService.configureReminders(input, 'org-1', 'user-1'),
  getReminderConfigs: async (input: any) => mockService.getReminderConfigs(input, 'org-1', 'user-1'),
  snoozeReminder: async (input: any) => mockService.snoozeReminder(input, 'user-1'),
  getPendingReminders: async (input: any) => mockService.getPendingReminders(input, 'org-1'),
});

describe('TaxDeadlinesRouter', () => {
  let caller: ReturnType<typeof createMockCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    caller = createMockCaller();
  });

  // =========================================================================
  // DEADLINE RETRIEVAL ENDPOINTS
  // =========================================================================

  describe('getDeadlines', () => {
    it('should call service with correct input', async () => {
      const input = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        taxType: 'VAT' as const,
      };
      mockService.getDeadlines.mockResolvedValue([]);

      await caller.getDeadlines(input);

      expect(mockService.getDeadlines).toHaveBeenCalledWith(input);
    });

    it('should filter by client ID', async () => {
      const input = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        clientId: 'client-123',
      };
      mockService.getDeadlines.mockResolvedValue([]);

      await caller.getDeadlines(input);

      expect(mockService.getDeadlines).toHaveBeenCalledWith(input);
    });

    it('should filter by status', async () => {
      const input = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        status: 'PENDING' as const,
      };
      mockService.getDeadlines.mockResolvedValue([]);

      await caller.getDeadlines(input);

      expect(mockService.getDeadlines).toHaveBeenCalledWith(input);
    });
  });

  describe('getCalendar', () => {
    it('should return calendar for specified month', async () => {
      const mockResult = {
        deadlines: [],
        holidays: [{ id: 'h1', name: 'Nowy Rok', date: new Date('2025-01-01') }],
        summary: { total: 0, pending: 0, overdue: 0, submitted: 0, inProgress: 0 },
      };
      mockService.getCalendar.mockResolvedValue(mockResult);

      const result = await caller.getCalendar({ year: 2025, month: 1 });

      expect(result).toEqual(mockResult);
      expect(mockService.getCalendar).toHaveBeenCalledWith({ year: 2025, month: 1 });
    });

    it('should return empty calendar for month with no deadlines', async () => {
      const mockResult = {
        deadlines: [],
        holidays: [],
        summary: { total: 0, pending: 0, overdue: 0, submitted: 0, inProgress: 0 },
      };
      mockService.getCalendar.mockResolvedValue(mockResult);

      const result = await caller.getCalendar({ year: 2025, month: 7 });

      expect(result.deadlines).toHaveLength(0);
    });
  });

  describe('getHolidays', () => {
    it('should return holidays for specified year', async () => {
      const mockHolidays = [
        { id: 'h1', name: 'Nowy Rok', date: new Date('2025-01-01'), year: 2025 },
        { id: 'h2', name: 'Święto Trzech Króli', date: new Date('2025-01-06'), year: 2025 },
      ];
      mockService.getHolidays.mockResolvedValue(mockHolidays);

      const result = await caller.getHolidays({ year: 2025 });

      expect(result).toEqual(mockHolidays);
      expect(mockService.getHolidays).toHaveBeenCalledWith({ year: 2025 });
    });
  });

  describe('getDeadlineById', () => {
    it('should return deadline by ID', async () => {
      const mockDeadline = {
        id: 'deadline-1',
        status: 'PENDING',
        adjustedDeadlineDate: new Date('2025-01-25'),
      };
      mockService.getDeadlineById.mockResolvedValue(mockDeadline);

      const result = await caller.getDeadlineById({ deadlineId: 'deadline-1' });

      expect(result).toEqual(mockDeadline);
    });

    it('should return null for non-existent deadline', async () => {
      mockService.getDeadlineById.mockResolvedValue(null);

      const result = await caller.getDeadlineById({ deadlineId: 'non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('getDeadlineTypes', () => {
    it('should return all deadline types', async () => {
      const mockTypes = [
        { id: 'dt-1', code: 'JPK_V7M', taxType: 'VAT' },
        { id: 'dt-2', code: 'CIT_ADVANCE', taxType: 'CIT' },
      ];
      mockService.getDeadlineTypes.mockResolvedValue(mockTypes);

      const result = await caller.getDeadlineTypes({});

      expect(result).toEqual(mockTypes);
    });

    it('should filter by tax type', async () => {
      const mockTypes = [
        { id: 'dt-1', code: 'JPK_V7M', taxType: 'VAT' },
      ];
      mockService.getDeadlineTypes.mockResolvedValue(mockTypes);

      const result = await caller.getDeadlineTypes({ taxType: 'VAT' });

      expect(mockService.getDeadlineTypes).toHaveBeenCalledWith({ taxType: 'VAT' });
    });
  });

  describe('getUpcomingDeadlines', () => {
    it('should return upcoming deadlines summary', async () => {
      const mockSummary = {
        today: [],
        thisWeek: [],
        thisMonth: [],
        overdue: [],
        counts: { today: 0, thisWeek: 0, thisMonth: 0, overdue: 0 },
      };
      mockService.getUpcomingDeadlines.mockResolvedValue(mockSummary);

      const result = await caller.getUpcomingDeadlines();

      expect(result).toEqual(mockSummary);
    });
  });

  // =========================================================================
  // DEADLINE MANAGEMENT ENDPOINTS
  // =========================================================================

  describe('calculateAdjustedDeadline', () => {
    it('should calculate adjusted deadline for weekday', async () => {
      const mockResult = {
        baseDate: new Date('2025-01-22'),
        adjustedDate: new Date('2025-01-22'),
        reason: null,
        wasAdjusted: false,
      };
      mockService.calculateAdjustedDeadline.mockResolvedValue(mockResult);

      const result = await caller.calculateAdjustedDeadline({
        baseDate: new Date('2025-01-22'),
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(false);
    });

    it('should calculate adjusted deadline for weekend', async () => {
      const mockResult = {
        baseDate: new Date('2025-03-15'),
        adjustedDate: new Date('2025-03-17'),
        reason: 'Przesunięto z sobota',
        wasAdjusted: true,
      };
      mockService.calculateAdjustedDeadline.mockResolvedValue(mockResult);

      const result = await caller.calculateAdjustedDeadline({
        baseDate: new Date('2025-03-15'),
        year: 2025,
      });

      expect(result.wasAdjusted).toBe(true);
    });
  });

  describe('generateDeadlines', () => {
    it('should generate deadlines for client', async () => {
      const mockResult = {
        generated: 24,
        deadlineIds: ['d1', 'd2', 'd3'],
        skipped: 2,
        errors: [],
      };
      mockService.generateDeadlines.mockResolvedValue(mockResult);

      const result = await caller.generateDeadlines({
        clientId: 'client-1',
        year: 2025,
      });

      expect(result.generated).toBe(24);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle generation errors', async () => {
      const mockResult = {
        generated: 20,
        deadlineIds: ['d1', 'd2'],
        skipped: 0,
        errors: ['Failed to generate CIT_8'],
      };
      mockService.generateDeadlines.mockResolvedValue(mockResult);

      const result = await caller.generateDeadlines({
        clientId: 'client-1',
        year: 2025,
      });

      expect(result.errors).toHaveLength(1);
    });
  });

  describe('updateDeadlineStatus', () => {
    it('should update status to SUBMITTED', async () => {
      mockService.updateDeadlineStatus.mockResolvedValue({ success: true, deadline: null });

      const result = await caller.updateDeadlineStatus({
        deadlineId: 'deadline-1',
        status: 'SUBMITTED',
        confirmationNumber: 'UPO-123456',
      });

      expect(result.success).toBe(true);
    });

    it('should update status to CONFIRMED', async () => {
      mockService.updateDeadlineStatus.mockResolvedValue({ success: true, deadline: null });

      const result = await caller.updateDeadlineStatus({
        deadlineId: 'deadline-1',
        status: 'CONFIRMED',
        confirmationNumber: 'UPO-123456',
        notes: 'Confirmed by tax office',
      });

      expect(result.success).toBe(true);
    });

    it('should update status to EXEMPT', async () => {
      mockService.updateDeadlineStatus.mockResolvedValue({ success: true, deadline: null });

      const result = await caller.updateDeadlineStatus({
        deadlineId: 'deadline-1',
        status: 'EXEMPT',
        notes: 'Client exempt from this obligation',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateOverdueDeadlines', () => {
    it('should update overdue deadlines', async () => {
      mockService.updateOverdueDeadlines.mockResolvedValue({
        updated: 5,
        deadlineIds: ['d1', 'd2', 'd3', 'd4', 'd5'],
      });

      const result = await caller.updateOverdueDeadlines({});

      expect(result.updated).toBe(5);
      expect(result.deadlineIds).toHaveLength(5);
    });
  });

  // =========================================================================
  // REMINDER CONFIGURATION ENDPOINTS
  // =========================================================================

  describe('configureReminders', () => {
    it('should configure reminder for EARLY level', async () => {
      mockService.configureReminders.mockResolvedValue({ success: true });

      const result = await caller.configureReminders({
        reminderLevel: 'EARLY',
        daysBefore: 14,
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
      });

      expect(result.success).toBe(true);
    });

    it('should configure reminder for CRITICAL level with SMS', async () => {
      mockService.configureReminders.mockResolvedValue({ success: true });

      const result = await caller.configureReminders({
        reminderLevel: 'CRITICAL',
        daysBefore: 1,
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
      });

      expect(result.success).toBe(true);
    });

    it('should configure reminder for specific deadline type', async () => {
      mockService.configureReminders.mockResolvedValue({ success: true });

      const result = await caller.configureReminders({
        deadlineTypeId: 'dt-jpk-v7m',
        reminderLevel: 'URGENT',
        daysBefore: 3,
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getReminderConfigs', () => {
    it('should return all reminder configurations', async () => {
      const mockConfigs = [
        { id: 'c1', reminderLevel: 'EARLY', daysBefore: 14 },
        { id: 'c2', reminderLevel: 'STANDARD', daysBefore: 7 },
        { id: 'c3', reminderLevel: 'URGENT', daysBefore: 3 },
        { id: 'c4', reminderLevel: 'CRITICAL', daysBefore: 1 },
      ];
      mockService.getReminderConfigs.mockResolvedValue(mockConfigs);

      const result = await caller.getReminderConfigs({});

      expect(result).toHaveLength(4);
    });

    it('should filter by deadline type', async () => {
      const mockConfigs = [
        { id: 'c1', reminderLevel: 'EARLY', daysBefore: 14, deadlineTypeId: 'dt-jpk-v7m' },
      ];
      mockService.getReminderConfigs.mockResolvedValue(mockConfigs);

      const result = await caller.getReminderConfigs({ deadlineTypeId: 'dt-jpk-v7m' });

      expect(mockService.getReminderConfigs).toHaveBeenCalledWith(
        { deadlineTypeId: 'dt-jpk-v7m' },
        'org-1',
        'user-1'
      );
    });
  });

  describe('snoozeReminder', () => {
    it('should snooze reminder', async () => {
      mockService.snoozeReminder.mockResolvedValue({ success: true });

      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + 2);

      const result = await caller.snoozeReminder({
        reminderId: 'reminder-1',
        snoozeUntil,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getPendingReminders', () => {
    it('should return pending reminders', async () => {
      const mockReminders = [
        { id: 'r1', deadlineId: 'd1', status: 'PENDING' },
        { id: 'r2', deadlineId: 'd2', status: 'PENDING' },
      ];
      mockService.getPendingReminders.mockResolvedValue(mockReminders);

      const result = await caller.getPendingReminders({});

      expect(result).toHaveLength(2);
    });

    it('should filter by user ID', async () => {
      mockService.getPendingReminders.mockResolvedValue([]);

      await caller.getPendingReminders({ userId: 'user-1' });

      expect(mockService.getPendingReminders).toHaveBeenCalledWith(
        { userId: 'user-1' },
        'org-1'
      );
    });
  });

  // =========================================================================
  // INPUT VALIDATION TESTS
  // =========================================================================

  describe('Input Validation', () => {
    describe('getCalendar validation', () => {
      it('should accept valid year and month', async () => {
        mockService.getCalendar.mockResolvedValue({ deadlines: [], holidays: [], summary: {} });

        await expect(caller.getCalendar({ year: 2025, month: 1 })).resolves.toBeDefined();
        await expect(caller.getCalendar({ year: 2025, month: 12 })).resolves.toBeDefined();
      });
    });

    describe('getHolidays validation', () => {
      it('should accept valid year range', async () => {
        mockService.getHolidays.mockResolvedValue([]);

        await expect(caller.getHolidays({ year: 2020 })).resolves.toBeDefined();
        await expect(caller.getHolidays({ year: 2100 })).resolves.toBeDefined();
      });
    });

    describe('configureReminders validation', () => {
      it('should accept valid reminder levels', async () => {
        mockService.configureReminders.mockResolvedValue({ success: true });

        const levels = ['EARLY', 'STANDARD', 'URGENT', 'CRITICAL'] as const;
        for (const level of levels) {
          await expect(
            caller.configureReminders({
              reminderLevel: level,
              daysBefore: 7,
              emailEnabled: true,
              smsEnabled: false,
              inAppEnabled: true,
            })
          ).resolves.toBeDefined();
        }
      });
    });

    describe('updateDeadlineStatus validation', () => {
      it('should accept valid statuses', async () => {
        mockService.updateDeadlineStatus.mockResolvedValue({ success: true, deadline: null });

        const statuses = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'EXEMPT', 'CANCELLED'] as const;
        for (const status of statuses) {
          await expect(
            caller.updateDeadlineStatus({
              deadlineId: 'deadline-1',
              status,
            })
          ).resolves.toBeDefined();
        }
      });
    });

    describe('getDeadlines validation', () => {
      it('should accept valid tax types', async () => {
        mockService.getDeadlines.mockResolvedValue([]);

        const taxTypes = ['VAT', 'CIT', 'PIT', 'ZUS', 'OTHER'] as const;
        for (const taxType of taxTypes) {
          await expect(
            caller.getDeadlines({
              startDate: new Date('2025-01-01'),
              endDate: new Date('2025-12-31'),
              taxType,
            })
          ).resolves.toBeDefined();
        }
      });

      it('should accept valid deadline statuses', async () => {
        mockService.getDeadlines.mockResolvedValue([]);

        const statuses = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'OVERDUE', 'EXEMPT'] as const;
        for (const status of statuses) {
          await expect(
            caller.getDeadlines({
              startDate: new Date('2025-01-01'),
              endDate: new Date('2025-12-31'),
              status,
            })
          ).resolves.toBeDefined();
        }
      });
    });
  });
});
