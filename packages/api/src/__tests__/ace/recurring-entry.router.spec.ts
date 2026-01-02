/**
 * ACC-010: Recurring Entry Router Tests
 * TDD tests for recurring entry schedule router endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { router } from '../../trpc';
import { recurringEntryRouter } from '../../routers/ace/recurring-entry.router';
import { createCallerFactory } from '../../trpc';

// Mock the RecurringEntryService
import { RecurringEntryService } from '../../services/ace/recurring-entry.service';

vi.mock('../../services/ace/recurring-entry.service');

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_SCHEDULE_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_HOLIDAY_ID = '550e8400-e29b-41d4-a716-446655440004';

const mockContext = {
  prisma: {},
  redis: {},
  auditLogger: { log: vi.fn() },
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
  },
};

const testSchedule = {
  id: TEST_SCHEDULE_ID,
  organizationId: TEST_ORG_ID,
  scheduleCode: 'RS-001',
  scheduleName: 'Monthly Rent',
  description: 'Monthly rent payment',
  templateId: TEST_TEMPLATE_ID,
  frequency: 'MONTHLY',
  frequencyInterval: 1,
  dayOfMonth: 1,
  status: 'ACTIVE',
  nextRunDate: new Date('2024-02-01'),
  template: {
    id: TEST_TEMPLATE_ID,
    templateName: 'Monthly Rent Payment',
    templateCode: 'TPL-001',
  },
};

const testExecution = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  scheduleId: TEST_SCHEDULE_ID,
  executionDate: new Date('2024-01-01'),
  scheduledDate: new Date('2024-01-01'),
  executionType: 'AUTOMATIC',
  status: 'SUCCESS',
  journalEntry: {
    id: '770e8400-e29b-41d4-a716-446655440001',
    entryNumber: 'JE-001',
    status: 'DRAFT',
  },
};

const testHoliday = {
  id: TEST_HOLIDAY_ID,
  organizationId: TEST_ORG_ID,
  holidayDate: new Date('2024-12-25'),
  holidayName: 'Christmas',
  isBankingHoliday: true,
  countryCode: 'PL',
};

describe('RecurringEntryRouter', () => {
  const createCaller = createCallerFactory(router({ recurringEntry: recurringEntryRouter }));
  const caller = createCaller(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // SCHEDULE CRUD ENDPOINTS
  // ===========================================================================

  describe('createSchedule', () => {
    it('should create a new recurring schedule', async () => {
      vi.mocked(RecurringEntryService.prototype.createSchedule).mockResolvedValue(testSchedule);

      const result = await caller.recurringEntry.createSchedule({
        scheduleName: 'Monthly Rent',
        templateId: TEST_TEMPLATE_ID,
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        startDate: new Date('2024-01-01'),
      });

      expect(result).toBeDefined();
      expect(vi.mocked(RecurringEntryService.prototype.createSchedule)).toHaveBeenCalled();
    });

    it('should create a weekly schedule', async () => {
      vi.mocked(RecurringEntryService.prototype.createSchedule).mockResolvedValue({
        ...testSchedule,
        frequency: 'WEEKLY',
        dayOfWeek: 1,
      });

      const result = await caller.recurringEntry.createSchedule({
        scheduleName: 'Weekly Payroll',
        templateId: TEST_TEMPLATE_ID,
        frequency: 'WEEKLY',
        dayOfWeek: 1,
        startDate: new Date('2024-01-01'),
      });

      expect(result.frequency).toBe('WEEKLY');
    });
  });

  describe('getSchedule', () => {
    it('should retrieve schedule by ID', async () => {
      vi.mocked(RecurringEntryService.prototype.getSchedule).mockResolvedValue(testSchedule);

      const result = await caller.recurringEntry.getSchedule({
        scheduleId: TEST_SCHEDULE_ID,
      });

      expect(result.id).toBe(TEST_SCHEDULE_ID);
      expect(result.template).toBeDefined();
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule properties', async () => {
      vi.mocked(RecurringEntryService.prototype.updateSchedule).mockResolvedValue({
        ...testSchedule,
        scheduleName: 'Updated Rent Schedule',
      });

      const result = await caller.recurringEntry.updateSchedule({
        scheduleId: TEST_SCHEDULE_ID,
        scheduleName: 'Updated Rent Schedule',
      });

      expect(result.scheduleName).toBe('Updated Rent Schedule');
    });
  });

  describe('pauseSchedule', () => {
    it('should pause an active schedule', async () => {
      vi.mocked(RecurringEntryService.prototype.pauseSchedule).mockResolvedValue({
        ...testSchedule,
        status: 'PAUSED',
        pausedAt: new Date(),
      });

      const result = await caller.recurringEntry.pauseSchedule({
        scheduleId: TEST_SCHEDULE_ID,
      });

      expect(result.status).toBe('PAUSED');
    });
  });

  describe('resumeSchedule', () => {
    it('should resume a paused schedule', async () => {
      vi.mocked(RecurringEntryService.prototype.resumeSchedule).mockResolvedValue({
        schedule: { ...testSchedule, status: 'ACTIVE' },
        missedEntriesGenerated: 0,
      });

      const result = await caller.recurringEntry.resumeSchedule({
        scheduleId: TEST_SCHEDULE_ID,
      });

      expect(result.schedule.status).toBe('ACTIVE');
    });

    it('should resume and generate missed entries', async () => {
      vi.mocked(RecurringEntryService.prototype.resumeSchedule).mockResolvedValue({
        schedule: { ...testSchedule, status: 'ACTIVE' },
        missedEntriesGenerated: 3,
      });

      const result = await caller.recurringEntry.resumeSchedule({
        scheduleId: TEST_SCHEDULE_ID,
        generateMissed: true,
      });

      expect(result.missedEntriesGenerated).toBe(3);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      vi.mocked(RecurringEntryService.prototype.deleteSchedule).mockResolvedValue({
        success: true,
        scheduleId: TEST_SCHEDULE_ID,
      });

      const result = await caller.recurringEntry.deleteSchedule({
        scheduleId: TEST_SCHEDULE_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // LIST AND SEARCH ENDPOINTS
  // ===========================================================================

  describe('listSchedules', () => {
    it('should list schedules with pagination', async () => {
      vi.mocked(RecurringEntryService.prototype.listSchedules).mockResolvedValue({
        schedules: [testSchedule],
        total: 1,
        hasMore: false,
      });

      const result = await caller.recurringEntry.listSchedules({
        limit: 10,
        offset: 0,
      });

      expect(result.schedules).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      vi.mocked(RecurringEntryService.prototype.listSchedules).mockResolvedValue({
        schedules: [testSchedule],
        total: 1,
        hasMore: false,
      });

      await caller.recurringEntry.listSchedules({
        status: 'ACTIVE',
        limit: 10,
        offset: 0,
      });

      expect(vi.mocked(RecurringEntryService.prototype.listSchedules)).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })
      );
    });

    it('should search by name', async () => {
      vi.mocked(RecurringEntryService.prototype.listSchedules).mockResolvedValue({
        schedules: [testSchedule],
        total: 1,
        hasMore: false,
      });

      await caller.recurringEntry.listSchedules({
        search: 'Rent',
        limit: 10,
        offset: 0,
      });

      expect(vi.mocked(RecurringEntryService.prototype.listSchedules)).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Rent' })
      );
    });
  });

  // ===========================================================================
  // ENTRY GENERATION ENDPOINTS
  // ===========================================================================

  describe('manualGenerate', () => {
    it('should manually generate an entry', async () => {
      vi.mocked(RecurringEntryService.prototype.manualGenerate).mockResolvedValue({
        id: '880e8400-e29b-41d4-a716-446655440001',
        entryNumber: 'JE-002',
        status: 'DRAFT',
      });

      const result = await caller.recurringEntry.manualGenerate({
        scheduleId: TEST_SCHEDULE_ID,
      });

      expect(result).toBeDefined();
      expect(vi.mocked(RecurringEntryService.prototype.manualGenerate)).toHaveBeenCalled();
    });

    it('should generate with custom date and overrides', async () => {
      vi.mocked(RecurringEntryService.prototype.manualGenerate).mockResolvedValue({
        id: '880e8400-e29b-41d4-a716-446655440001',
        entryNumber: 'JE-002',
        status: 'DRAFT',
      });

      await caller.recurringEntry.manualGenerate({
        scheduleId: TEST_SCHEDULE_ID,
        entryDate: new Date('2024-01-15'),
        variableOverrides: { amount: 6000 },
      });

      expect(vi.mocked(RecurringEntryService.prototype.manualGenerate)).toHaveBeenCalledWith(
        expect.objectContaining({
          entryDate: expect.any(Date),
          variableOverrides: { amount: 6000 },
        })
      );
    });
  });

  describe('batchGenerateMissed', () => {
    it('should generate missed entries for date range', async () => {
      vi.mocked(RecurringEntryService.prototype.batchGenerateMissed).mockResolvedValue({
        total: 3,
        successful: 3,
        failed: 0,
        results: [
          { date: new Date('2024-01-01'), success: true, entryId: 'entry-1' },
          { date: new Date('2024-02-01'), success: true, entryId: 'entry-2' },
          { date: new Date('2024-03-01'), success: true, entryId: 'entry-3' },
        ],
      });

      const result = await caller.recurringEntry.batchGenerateMissed({
        scheduleId: TEST_SCHEDULE_ID,
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-03-01'),
      });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
    });
  });

  // ===========================================================================
  // PREVIEW AND HISTORY ENDPOINTS
  // ===========================================================================

  describe('previewUpcoming', () => {
    it('should preview upcoming entries for a schedule', async () => {
      vi.mocked(RecurringEntryService.prototype.previewUpcoming).mockResolvedValue([
        {
          scheduleId: TEST_SCHEDULE_ID,
          scheduleName: 'Monthly Rent',
          templateName: 'Monthly Rent Payment',
          scheduledDate: new Date('2024-02-01'),
          autoPost: false,
        },
        {
          scheduleId: TEST_SCHEDULE_ID,
          scheduleName: 'Monthly Rent',
          templateName: 'Monthly Rent Payment',
          scheduledDate: new Date('2024-03-01'),
          autoPost: false,
        },
      ]);

      const result = await caller.recurringEntry.previewUpcoming({
        scheduleId: TEST_SCHEDULE_ID,
        toDate: new Date('2024-06-01'),
      });

      expect(result).toHaveLength(2);
    });

    it('should preview upcoming entries for all schedules', async () => {
      vi.mocked(RecurringEntryService.prototype.previewUpcoming).mockResolvedValue([
        {
          scheduleId: TEST_SCHEDULE_ID,
          scheduleName: 'Monthly Rent',
          templateName: 'Monthly Rent Payment',
          scheduledDate: new Date('2024-02-01'),
          autoPost: false,
        },
      ]);

      const result = await caller.recurringEntry.previewUpcoming({
        toDate: new Date('2024-06-01'),
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history', async () => {
      vi.mocked(RecurringEntryService.prototype.getExecutionHistory).mockResolvedValue({
        executions: [testExecution],
        total: 1,
        hasMore: false,
      });

      const result = await caller.recurringEntry.getExecutionHistory({
        scheduleId: TEST_SCHEDULE_ID,
      });

      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].journalEntry).toBeDefined();
    });
  });

  // ===========================================================================
  // HOLIDAY MANAGEMENT ENDPOINTS
  // ===========================================================================

  describe('addHoliday', () => {
    it('should add a holiday', async () => {
      vi.mocked(RecurringEntryService.prototype.addHoliday).mockResolvedValue(testHoliday);

      const result = await caller.recurringEntry.addHoliday({
        holidayDate: new Date('2024-12-25'),
        holidayName: 'Christmas',
        isBankingHoliday: true,
        countryCode: 'PL',
      });

      expect(result.holidayName).toBe('Christmas');
    });
  });

  describe('deleteHoliday', () => {
    it('should delete a holiday', async () => {
      vi.mocked(RecurringEntryService.prototype.deleteHoliday).mockResolvedValue({
        success: true,
        holidayId: TEST_HOLIDAY_ID,
      });

      const result = await caller.recurringEntry.deleteHoliday({
        holidayId: TEST_HOLIDAY_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('listHolidays', () => {
    it('should list holidays for a year', async () => {
      vi.mocked(RecurringEntryService.prototype.listHolidays).mockResolvedValue([testHoliday]);

      const result = await caller.recurringEntry.listHolidays({
        year: 2024,
      });

      expect(result).toHaveLength(1);
    });
  });

  // ===========================================================================
  // SCHEDULER ENDPOINTS
  // ===========================================================================

  describe('processDueSchedules', () => {
    it('should process due schedules', async () => {
      vi.mocked(RecurringEntryService.prototype.processDueSchedules).mockResolvedValue({
        processed: 2,
        successful: 2,
        failed: 0,
        results: [
          { scheduleId: TEST_SCHEDULE_ID, status: 'success', entryId: 'entry-1' },
          { scheduleId: 'schedule-2', status: 'success', entryId: 'entry-2' },
        ],
      });

      const result = await caller.recurringEntry.processDueSchedules({});

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
    });

    it('should process for specific date', async () => {
      vi.mocked(RecurringEntryService.prototype.processDueSchedules).mockResolvedValue({
        processed: 1,
        successful: 1,
        failed: 0,
        results: [{ scheduleId: TEST_SCHEDULE_ID, status: 'success', entryId: 'entry-1' }],
      });

      await caller.recurringEntry.processDueSchedules({
        forDate: new Date('2024-02-01'),
      });

      expect(vi.mocked(RecurringEntryService.prototype.processDueSchedules)).toHaveBeenCalledWith(
        expect.objectContaining({ forDate: expect.any(Date) })
      );
    });
  });
});
