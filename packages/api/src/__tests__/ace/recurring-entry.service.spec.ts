/**
 * ACC-010: Recurring Entry Service Tests
 * TDD tests for recurring journal entry schedule operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecurringEntryService } from '../../services/ace/recurring-entry.service';
import { TRPCError } from '@trpc/server';

// Mock Prisma client
const mockPrisma = {
  recurringSchedule: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  scheduleExecution: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  holidayCalendar: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  entryTemplate: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  journalEntry: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  journalLine: {
    createMany: vi.fn(),
  },
  accountingPeriod: {
    findFirst: vi.fn(),
  },
  entryNumberSequence: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
};

// Mock Audit Logger
const mockAuditLogger = {
  log: vi.fn(),
};

// Test data
const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_SCHEDULE_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_PERIOD_ID = '550e8400-e29b-41d4-a716-446655440004';
const TEST_EXECUTION_ID = '550e8400-e29b-41d4-a716-446655440005';
const TEST_HOLIDAY_ID = '550e8400-e29b-41d4-a716-446655440006';
const TEST_ENTRY_ID = '550e8400-e29b-41d4-a716-446655440007';

const testTemplate = {
  id: TEST_TEMPLATE_ID,
  organizationId: TEST_ORG_ID,
  templateCode: 'TPL-001',
  templateName: 'Monthly Rent Payment',
  description: 'Monthly rent payment template',
  entryType: 'STANDARD',
  defaultDescription: 'Monthly rent',
  status: 'ACTIVE',
  version: 1,
  usageCount: 0,
  lines: [
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      lineNumber: 1,
      accountId: '770e8400-e29b-41d4-a716-446655440001',
      amountType: 'FIXED',
      fixedDebitAmount: 5000,
      fixedCreditAmount: 0,
      description: 'Rent expense',
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440002',
      lineNumber: 2,
      accountId: '770e8400-e29b-41d4-a716-446655440002',
      amountType: 'FIXED',
      fixedDebitAmount: 0,
      fixedCreditAmount: 5000,
      description: 'Bank payment',
    },
  ],
  variables: [],
};

const testSchedule = {
  id: TEST_SCHEDULE_ID,
  organizationId: TEST_ORG_ID,
  scheduleCode: 'RS-001',
  scheduleName: 'Monthly Rent',
  description: 'Monthly rent payment schedule',
  templateId: TEST_TEMPLATE_ID,
  frequency: 'MONTHLY',
  frequencyInterval: 1,
  dayOfWeek: null,
  dayOfMonth: 1,
  monthOfYear: null,
  endOfMonthHandling: 'LAST_DAY',
  skipWeekends: false,
  skipHolidays: false,
  weekendAdjustment: 'PREVIOUS',
  startDate: new Date('2024-01-01'),
  endDate: null,
  nextRunDate: new Date('2024-02-01'),
  lastRunDate: new Date('2024-01-01'),
  autoPost: false,
  maxOccurrences: null,
  occurrencesCount: 1,
  defaultVariableValues: {},
  status: 'ACTIVE',
  pausedAt: null,
  pausedBy: null,
  errorMessage: null,
  retryCount: 0,
  maxRetries: 3,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  notificationEmails: ['user@example.com'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  createdBy: TEST_USER_ID,
  updatedBy: null,
};

const testScheduleWithTemplate = {
  ...testSchedule,
  template: {
    id: TEST_TEMPLATE_ID,
    templateName: 'Monthly Rent Payment',
    templateCode: 'TPL-001',
  },
  createdByUser: {
    id: TEST_USER_ID,
    name: 'Test User',
  },
};

const testExecution = {
  id: TEST_EXECUTION_ID,
  scheduleId: TEST_SCHEDULE_ID,
  executionDate: new Date('2024-01-01'),
  scheduledDate: new Date('2024-01-01'),
  executionType: 'AUTOMATIC',
  status: 'SUCCESS',
  errorMessage: null,
  journalEntryId: TEST_ENTRY_ID,
  startedAt: new Date('2024-01-01T08:00:00'),
  completedAt: new Date('2024-01-01T08:00:05'),
  executionTimeMs: 5000,
  variableValuesUsed: {},
  createdAt: new Date('2024-01-01'),
};

const testHoliday = {
  id: TEST_HOLIDAY_ID,
  organizationId: TEST_ORG_ID,
  holidayDate: new Date('2024-01-01'),
  holidayName: 'New Year',
  isBankingHoliday: true,
  countryCode: 'PL',
  createdAt: new Date('2024-01-01'),
  createdBy: TEST_USER_ID,
};

const testPeriod = {
  id: TEST_PERIOD_ID,
  organizationId: TEST_ORG_ID,
  fiscalYearId: '880e8400-e29b-41d4-a716-446655440001',
  periodNumber: 1,
  periodName: 'January 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'OPEN',
};

describe('RecurringEntryService', () => {
  let service: RecurringEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecurringEntryService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // ===========================================================================
  // CREATE SCHEDULE TESTS
  // ===========================================================================

  describe('createSchedule', () => {
    it('should create a monthly recurring schedule', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplate);
      mockPrisma.recurringSchedule.count.mockResolvedValue(0);
      mockPrisma.recurringSchedule.create.mockResolvedValue(testScheduleWithTemplate);

      const result = await service.createSchedule({
        scheduleName: 'Monthly Rent',
        description: 'Monthly rent payment schedule',
        templateId: TEST_TEMPLATE_ID,
        frequency: 'MONTHLY',
        frequencyInterval: 1,
        dayOfMonth: 1,
        endOfMonthHandling: 'LAST_DAY',
        skipWeekends: false,
        skipHolidays: false,
        weekendAdjustment: 'PREVIOUS',
        startDate: new Date('2024-01-01'),
        autoPost: false,
        notifyOnSuccess: true,
        notifyOnFailure: true,
        notificationEmails: ['user@example.com'],
      });

      expect(result).toBeDefined();
      expect(result.scheduleName).toBe('Monthly Rent');
      expect(mockPrisma.recurringSchedule.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should create a weekly recurring schedule', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplate);
      mockPrisma.recurringSchedule.count.mockResolvedValue(1);
      mockPrisma.recurringSchedule.create.mockResolvedValue({
        ...testScheduleWithTemplate,
        frequency: 'WEEKLY',
        dayOfWeek: 1, // Monday
        dayOfMonth: null,
      });

      const result = await service.createSchedule({
        scheduleName: 'Weekly Payroll',
        templateId: TEST_TEMPLATE_ID,
        frequency: 'WEEKLY',
        frequencyInterval: 1,
        dayOfWeek: 1,
        startDate: new Date('2024-01-01'),
        autoPost: false,
      });

      expect(result.frequency).toBe('WEEKLY');
      expect(mockPrisma.recurringSchedule.create).toHaveBeenCalled();
    });

    it('should throw error if template not found', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.createSchedule({
          scheduleName: 'Test Schedule',
          templateId: 'invalid-template-id',
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          startDate: new Date('2024-01-01'),
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if template is archived', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue({
        ...testTemplate,
        status: 'ARCHIVED',
      });

      await expect(
        service.createSchedule({
          scheduleName: 'Test Schedule',
          templateId: TEST_TEMPLATE_ID,
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          startDate: new Date('2024-01-01'),
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should validate end date is after start date', async () => {
      mockPrisma.entryTemplate.findFirst.mockResolvedValue(testTemplate);

      await expect(
        service.createSchedule({
          scheduleName: 'Test Schedule',
          templateId: TEST_TEMPLATE_ID,
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-01-01'), // Before start
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // GET SCHEDULE TESTS
  // ===========================================================================

  describe('getSchedule', () => {
    it('should retrieve schedule by ID', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testScheduleWithTemplate);

      const result = await service.getSchedule({ scheduleId: TEST_SCHEDULE_ID });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_SCHEDULE_ID);
      expect(result.template).toBeDefined();
    });

    it('should throw error if schedule not found', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.getSchedule({ scheduleId: 'invalid-id' })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // UPDATE SCHEDULE TESTS
  // ===========================================================================

  describe('updateSchedule', () => {
    it('should update schedule name and description', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);
      mockPrisma.recurringSchedule.update.mockResolvedValue({
        ...testScheduleWithTemplate,
        scheduleName: 'Updated Rent Schedule',
        description: 'Updated description',
      });

      const result = await service.updateSchedule({
        scheduleId: TEST_SCHEDULE_ID,
        scheduleName: 'Updated Rent Schedule',
        description: 'Updated description',
      });

      expect(result.scheduleName).toBe('Updated Rent Schedule');
      expect(mockPrisma.recurringSchedule.update).toHaveBeenCalled();
    });

    it('should update frequency configuration', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);
      mockPrisma.recurringSchedule.update.mockResolvedValue({
        ...testScheduleWithTemplate,
        frequency: 'WEEKLY',
        dayOfWeek: 5,
        dayOfMonth: null,
      });

      const result = await service.updateSchedule({
        scheduleId: TEST_SCHEDULE_ID,
        frequency: 'WEEKLY',
        dayOfWeek: 5,
      });

      expect(result.frequency).toBe('WEEKLY');
    });

    it('should throw error when updating non-existent schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSchedule({
          scheduleId: 'invalid-id',
          scheduleName: 'New Name',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // PAUSE/RESUME TESTS
  // ===========================================================================

  describe('pauseSchedule', () => {
    it('should pause an active schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);
      mockPrisma.recurringSchedule.update.mockResolvedValue({
        ...testScheduleWithTemplate,
        status: 'PAUSED',
        pausedAt: new Date(),
        pausedBy: TEST_USER_ID,
      });

      const result = await service.pauseSchedule({ scheduleId: TEST_SCHEDULE_ID });

      expect(result.status).toBe('PAUSED');
      expect(result.pausedAt).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error when pausing already paused schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue({
        ...testSchedule,
        status: 'PAUSED',
      });

      await expect(
        service.pauseSchedule({ scheduleId: TEST_SCHEDULE_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('resumeSchedule', () => {
    it('should resume a paused schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue({
        ...testSchedule,
        status: 'PAUSED',
        pausedAt: new Date('2024-01-15'),
      });
      mockPrisma.recurringSchedule.update.mockResolvedValue({
        ...testScheduleWithTemplate,
        status: 'ACTIVE',
        pausedAt: null,
        pausedBy: null,
      });

      const result = await service.resumeSchedule({
        scheduleId: TEST_SCHEDULE_ID,
        generateMissed: false,
      });

      expect(result.schedule.status).toBe('ACTIVE');
      expect(result.missedEntriesGenerated).toBe(0);
    });

    it('should resume and generate missed entries when requested', async () => {
      const pausedDate = new Date('2024-01-15');
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue({
        ...testSchedule,
        status: 'PAUSED',
        pausedAt: pausedDate,
        nextRunDate: new Date('2024-01-01'),
      });
      mockPrisma.recurringSchedule.update.mockResolvedValue({
        ...testScheduleWithTemplate,
        status: 'ACTIVE',
      });
      mockPrisma.entryTemplate.findUnique.mockResolvedValue(testTemplate);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_ENTRY_ID });
      mockPrisma.scheduleExecution.create.mockResolvedValue(testExecution);
      mockPrisma.holidayCalendar.findMany.mockResolvedValue([]);

      const result = await service.resumeSchedule({
        scheduleId: TEST_SCHEDULE_ID,
        generateMissed: true,
      });

      expect(result.schedule.status).toBe('ACTIVE');
    });

    it('should throw error when resuming non-paused schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);

      await expect(
        service.resumeSchedule({ scheduleId: TEST_SCHEDULE_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // DELETE SCHEDULE TESTS
  // ===========================================================================

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);
      mockPrisma.recurringSchedule.delete.mockResolvedValue(testSchedule);

      const result = await service.deleteSchedule({ scheduleId: TEST_SCHEDULE_ID });

      expect(result.success).toBe(true);
      expect(result.scheduleId).toBe(TEST_SCHEDULE_ID);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error when deleting non-existent schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteSchedule({ scheduleId: 'invalid-id' })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // LIST SCHEDULES TESTS
  // ===========================================================================

  describe('listSchedules', () => {
    it('should list schedules with pagination', async () => {
      mockPrisma.recurringSchedule.findMany.mockResolvedValue([testScheduleWithTemplate]);
      mockPrisma.recurringSchedule.count.mockResolvedValue(1);

      const result = await service.listSchedules({
        limit: 10,
        offset: 0,
      });

      expect(result.schedules).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by status', async () => {
      mockPrisma.recurringSchedule.findMany.mockResolvedValue([testScheduleWithTemplate]);
      mockPrisma.recurringSchedule.count.mockResolvedValue(1);

      await service.listSchedules({
        status: 'ACTIVE',
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.recurringSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should filter by template ID', async () => {
      mockPrisma.recurringSchedule.findMany.mockResolvedValue([testScheduleWithTemplate]);
      mockPrisma.recurringSchedule.count.mockResolvedValue(1);

      await service.listSchedules({
        templateId: TEST_TEMPLATE_ID,
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.recurringSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            templateId: TEST_TEMPLATE_ID,
          }),
        })
      );
    });

    it('should search by schedule name', async () => {
      mockPrisma.recurringSchedule.findMany.mockResolvedValue([testScheduleWithTemplate]);
      mockPrisma.recurringSchedule.count.mockResolvedValue(1);

      await service.listSchedules({
        search: 'Rent',
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.recurringSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ scheduleName: expect.any(Object) }),
            ]),
          }),
        })
      );
    });
  });

  // ===========================================================================
  // MANUAL GENERATE TESTS
  // ===========================================================================

  describe('manualGenerate', () => {
    it('should manually generate an entry from schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);
      mockPrisma.entryTemplate.findUnique.mockResolvedValue(testTemplate);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue({ lastNumber: 0 });
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({ lastNumber: 1 });
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: TEST_ENTRY_ID,
        entryNumber: 'JE-001',
      });
      mockPrisma.scheduleExecution.create.mockResolvedValue(testExecution);
      mockPrisma.recurringSchedule.update.mockResolvedValue(testSchedule);

      const result = await service.manualGenerate({
        scheduleId: TEST_SCHEDULE_ID,
        entryDate: new Date('2024-01-15'),
      });

      expect(result).toBeDefined();
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
      expect(mockPrisma.scheduleExecution.create).toHaveBeenCalled();
    });

    it('should throw error for paused schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue({
        ...testSchedule,
        status: 'PAUSED',
      });

      await expect(
        service.manualGenerate({ scheduleId: TEST_SCHEDULE_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // BATCH GENERATE MISSED TESTS
  // ===========================================================================

  describe('batchGenerateMissed', () => {
    it('should generate missed entries for date range', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);
      mockPrisma.entryTemplate.findUnique.mockResolvedValue(testTemplate);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue({ lastNumber: 0 });
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({ lastNumber: 1 });
      mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_ENTRY_ID });
      mockPrisma.scheduleExecution.create.mockResolvedValue(testExecution);
      mockPrisma.holidayCalendar.findMany.mockResolvedValue([]);

      const result = await service.batchGenerateMissed({
        scheduleId: TEST_SCHEDULE_ID,
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-03-01'),
        createAsDraft: true,
      });

      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.results).toBeDefined();
    });
  });

  // ===========================================================================
  // PREVIEW UPCOMING TESTS
  // ===========================================================================

  describe('previewUpcoming', () => {
    it('should preview upcoming entries for a schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue({
        ...testScheduleWithTemplate,
        template: { templateName: 'Monthly Rent Payment' },
      });
      mockPrisma.holidayCalendar.findMany.mockResolvedValue([]);

      const result = await service.previewUpcoming({
        scheduleId: TEST_SCHEDULE_ID,
        toDate: new Date('2024-06-01'),
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should preview upcoming entries for all schedules', async () => {
      mockPrisma.recurringSchedule.findMany.mockResolvedValue([{
        ...testScheduleWithTemplate,
        template: { templateName: 'Monthly Rent Payment' },
      }]);
      mockPrisma.holidayCalendar.findMany.mockResolvedValue([]);

      const result = await service.previewUpcoming({
        toDate: new Date('2024-06-01'),
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ===========================================================================
  // EXECUTION HISTORY TESTS
  // ===========================================================================

  describe('getExecutionHistory', () => {
    it('should return execution history for schedule', async () => {
      mockPrisma.recurringSchedule.findFirst.mockResolvedValue(testSchedule);
      mockPrisma.scheduleExecution.findMany.mockResolvedValue([
        {
          ...testExecution,
          journalEntry: {
            id: TEST_ENTRY_ID,
            entryNumber: 'JE-001',
            status: 'DRAFT',
          },
        },
      ]);
      mockPrisma.scheduleExecution.count.mockResolvedValue(1);

      const result = await service.getExecutionHistory({
        scheduleId: TEST_SCHEDULE_ID,
        limit: 20,
        offset: 0,
      });

      expect(result.executions).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ===========================================================================
  // HOLIDAY MANAGEMENT TESTS
  // ===========================================================================

  describe('addHoliday', () => {
    it('should add a holiday to the calendar', async () => {
      const christmasHoliday = {
        ...testHoliday,
        holidayDate: new Date('2024-12-25'),
        holidayName: 'Christmas',
      };
      mockPrisma.holidayCalendar.findFirst.mockResolvedValue(null);
      mockPrisma.holidayCalendar.create.mockResolvedValue(christmasHoliday);

      const result = await service.addHoliday({
        holidayDate: new Date('2024-12-25'),
        holidayName: 'Christmas',
        isBankingHoliday: true,
        countryCode: 'PL',
      });

      expect(result).toBeDefined();
      expect(result.holidayName).toBe('Christmas');
      expect(mockPrisma.holidayCalendar.create).toHaveBeenCalled();
    });

    it('should throw error for duplicate holiday', async () => {
      mockPrisma.holidayCalendar.findFirst.mockResolvedValue(testHoliday);

      await expect(
        service.addHoliday({
          holidayDate: new Date('2024-01-01'),
          holidayName: 'New Year',
          isBankingHoliday: true,
          countryCode: 'PL',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('deleteHoliday', () => {
    it('should delete a holiday', async () => {
      mockPrisma.holidayCalendar.findFirst.mockResolvedValue(testHoliday);
      mockPrisma.holidayCalendar.delete.mockResolvedValue(testHoliday);

      const result = await service.deleteHoliday({ holidayId: TEST_HOLIDAY_ID });

      expect(result.success).toBe(true);
    });

    it('should throw error for non-existent holiday', async () => {
      mockPrisma.holidayCalendar.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteHoliday({ holidayId: 'invalid-id' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('listHolidays', () => {
    it('should list holidays for a year', async () => {
      mockPrisma.holidayCalendar.findMany.mockResolvedValue([testHoliday]);

      const result = await service.listHolidays({ year: 2024 });

      expect(result).toHaveLength(1);
      expect(mockPrisma.holidayCalendar.findMany).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // PROCESS DUE SCHEDULES TESTS
  // ===========================================================================

  describe('processDueSchedules', () => {
    it('should process due schedules for today', async () => {
      mockPrisma.recurringSchedule.findMany.mockResolvedValue([testSchedule]);
      mockPrisma.entryTemplate.findUnique.mockResolvedValue(testTemplate);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue({ lastNumber: 0 });
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({ lastNumber: 1 });
      mockPrisma.journalEntry.create.mockResolvedValue({ id: TEST_ENTRY_ID });
      mockPrisma.scheduleExecution.create.mockResolvedValue(testExecution);
      mockPrisma.recurringSchedule.update.mockResolvedValue(testSchedule);

      const result = await service.processDueSchedules({});

      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.results).toBeDefined();
    });

    it('should process due schedules for specific date', async () => {
      mockPrisma.recurringSchedule.findMany.mockResolvedValue([]);

      const result = await service.processDueSchedules({
        forDate: new Date('2024-02-01'),
      });

      expect(result.processed).toBe(0);
    });
  });

  // ===========================================================================
  // DATE CALCULATION TESTS
  // ===========================================================================

  describe('calculateNextRunDate', () => {
    it('should calculate next daily run date', async () => {
      const schedule = {
        ...testSchedule,
        frequency: 'DAILY',
        frequencyInterval: 1,
        nextRunDate: new Date('2024-01-01'),
      };

      const nextDate = service.calculateNextRunDate(schedule as any);

      expect(nextDate.getDate()).toBe(2);
      expect(nextDate.getMonth()).toBe(0); // January
    });

    it('should calculate next weekly run date', async () => {
      const schedule = {
        ...testSchedule,
        frequency: 'WEEKLY',
        frequencyInterval: 1,
        dayOfWeek: 1, // Monday
        nextRunDate: new Date('2024-01-01'), // Monday
      };

      const nextDate = service.calculateNextRunDate(schedule as any);

      expect(nextDate.getDay()).toBe(1); // Should be Monday
    });

    it('should calculate next monthly run date', async () => {
      const schedule = {
        ...testSchedule,
        frequency: 'MONTHLY',
        frequencyInterval: 1,
        dayOfMonth: 15,
        nextRunDate: new Date('2024-01-15'),
      };

      const nextDate = service.calculateNextRunDate(schedule as any);

      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getMonth()).toBe(1); // February
    });

    it('should handle end of month edge cases', async () => {
      const schedule = {
        ...testSchedule,
        frequency: 'MONTHLY',
        frequencyInterval: 1,
        dayOfMonth: 31,
        endOfMonthHandling: 'LAST_DAY',
        nextRunDate: new Date('2024-01-31'),
      };

      const nextDate = service.calculateNextRunDate(schedule as any);

      // February doesn't have 31 days, should use last day
      expect(nextDate.getMonth()).toBe(1); // February
    });
  });

  describe('adjustForWeekends', () => {
    it('should adjust Saturday to Friday when PREVIOUS', async () => {
      const saturday = new Date('2024-01-06'); // Saturday

      const adjusted = service.adjustForWeekends(saturday, 'PREVIOUS');

      expect(adjusted.getDay()).toBe(5); // Friday
    });

    it('should adjust Sunday to Monday when NEXT', async () => {
      const sunday = new Date('2024-01-07'); // Sunday

      const adjusted = service.adjustForWeekends(sunday, 'NEXT');

      expect(adjusted.getDay()).toBe(1); // Monday
    });

    it('should not adjust weekday', async () => {
      const wednesday = new Date('2024-01-03'); // Wednesday

      const adjusted = service.adjustForWeekends(wednesday, 'PREVIOUS');

      expect(adjusted).toEqual(wednesday);
    });
  });
});
