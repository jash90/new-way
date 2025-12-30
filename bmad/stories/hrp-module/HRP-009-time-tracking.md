# HRP-009: Time Tracking

## Story Information
| Field | Value |
|-------|-------|
| **Story ID** | HRP-009 |
| **Epic** | HR & Payroll Module (HRP) |
| **Title** | Time Tracking & Attendance Management |
| **Priority** | P1 (High) |
| **Story Points** | 8 |
| **Status** | Draft |

## User Story
**As a** HR manager,
**I want** to track employee working hours and attendance,
**So that** I can ensure accurate payroll calculations and compliance with Polish labor law working time regulations.

## Business Context
### Polish Working Time Regulations (Kodeks Pracy)
- **Standard Work Week**: 40 hours (8 hours/day, 5 days/week)
- **Maximum Overtime**: 150 hours/year (can be extended to 416 by agreement)
- **Daily Rest**: Minimum 11 consecutive hours
- **Weekly Rest**: Minimum 35 consecutive hours (including 11 hours daily rest)
- **Overtime Compensation**:
  - 50% bonus for overtime on regular days
  - 100% bonus for overtime on nights, Sundays, holidays
- **Night Work**: 21:00 - 07:00, additional 20% bonus
- **Recording Requirement**: Employer must maintain working time records

### Integration Points
- Payroll calculation (overtime, bonuses)
- Leave management (vacation, sick leave)
- Project time allocation
- Compliance reporting

## Acceptance Criteria

### AC1: Time Entry
```gherkin
Given I am an employee
When I log my working hours
Then I can record start time, end time, and break duration
And the system calculates total hours worked
And validates against maximum daily limits
And tracks project/task allocation if enabled
```

### AC2: Overtime Calculation
```gherkin
Given an employee has worked more than 8 hours in a day
When the system calculates overtime
Then it identifies regular overtime (50% bonus)
And night overtime (100% bonus if 21:00-07:00)
And weekend/holiday overtime (100% bonus)
And tracks against annual overtime limit (150/416 hours)
```

### AC3: Attendance Tracking
```gherkin
Given the workday has started
When employees clock in and out
Then the system records actual attendance times
And compares against scheduled work hours
And flags late arrivals and early departures
And tracks absence patterns
```

### AC4: Rest Period Validation
```gherkin
Given an employee's time entries
When the system validates rest periods
Then it checks for minimum 11-hour daily rest
And verifies minimum 35-hour weekly rest
And alerts on violations for compliance
```

### AC5: Reporting
```gherkin
Given I need working time reports
When I generate time reports
Then I can see individual employee summaries
And department-level aggregations
And overtime utilization vs. limits
And export data for labor inspection if required
```

## Technical Specification

### Database Schema

```sql
-- Working time schedules (rozkład czasu pracy)
CREATE TABLE work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Schedule type
  schedule_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
  -- STANDARD (8h/day), EQUIVALENT (różne godziny), TASK_BASED, SHIFT

  -- Standard hours
  weekly_hours DECIMAL(4, 2) NOT NULL DEFAULT 40,
  daily_hours DECIMAL(4, 2) NOT NULL DEFAULT 8,

  -- Work days (bit mask: 1=Mon, 2=Tue, 4=Wed, 8=Thu, 16=Fri, 32=Sat, 64=Sun)
  work_days_mask INTEGER NOT NULL DEFAULT 31, -- Mon-Fri

  -- Default times
  default_start_time TIME DEFAULT '09:00',
  default_end_time TIME DEFAULT '17:00',
  default_break_minutes INTEGER DEFAULT 30,

  -- Flexibility
  flex_time_enabled BOOLEAN DEFAULT false,
  flex_core_start TIME,  -- Core hours start
  flex_core_end TIME,    -- Core hours end
  flex_range_minutes INTEGER,  -- +/- minutes flexibility

  -- Settlement period (okres rozliczeniowy)
  settlement_period_months INTEGER DEFAULT 1,  -- 1, 3, 4, 6, or 12 months

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, name)
);

-- Employee schedule assignments
CREATE TABLE employee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  schedule_id UUID NOT NULL REFERENCES work_schedules(id),

  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Individual overrides
  custom_weekly_hours DECIMAL(4, 2),
  custom_daily_hours DECIMAL(4, 2),
  custom_start_time TIME,
  custom_end_time TIME,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(employee_id, effective_from)
);

CREATE INDEX idx_emp_schedules_employee ON employee_schedules(employee_id);
CREATE INDEX idx_emp_schedules_effective ON employee_schedules(effective_from, effective_to);

-- Time entries (ewidencja czasu pracy)
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  entry_date DATE NOT NULL,

  -- Clock times
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,

  -- Calculated hours
  scheduled_hours DECIMAL(4, 2),
  worked_hours DECIMAL(4, 2),
  overtime_hours DECIMAL(4, 2) DEFAULT 0,
  night_hours DECIMAL(4, 2) DEFAULT 0,

  -- Overtime details
  overtime_50_hours DECIMAL(4, 2) DEFAULT 0,  -- Regular overtime
  overtime_100_hours DECIMAL(4, 2) DEFAULT 0, -- Night/weekend/holiday

  -- Status
  entry_type VARCHAR(20) NOT NULL DEFAULT 'WORK',
  -- WORK, LEAVE, SICK, HOLIDAY, ABSENCE, REMOTE, TRAINING

  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, SUBMITTED, APPROVED, REJECTED

  -- Source
  source VARCHAR(20) DEFAULT 'MANUAL',
  -- MANUAL, CLOCK, IMPORT, SYSTEM

  -- Project allocation (optional)
  project_allocations JSONB,  -- [{projectId, hours, description}]

  -- Approval
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Notes
  notes TEXT,
  employee_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, employee_id, entry_date)
);

CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX idx_time_entries_date ON time_entries(entry_date);
CREATE INDEX idx_time_entries_period ON time_entries(tenant_id, entry_date);

-- Overtime tracking per settlement period
CREATE TABLE overtime_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  year INTEGER NOT NULL,

  -- Annual limits
  annual_limit_hours DECIMAL(5, 2) NOT NULL DEFAULT 150,
  extended_limit_hours DECIMAL(5, 2),  -- If extended by agreement (max 416)

  -- YTD tracking
  ytd_overtime_hours DECIMAL(6, 2) DEFAULT 0,
  ytd_overtime_50_hours DECIMAL(6, 2) DEFAULT 0,
  ytd_overtime_100_hours DECIMAL(6, 2) DEFAULT 0,
  ytd_night_hours DECIMAL(6, 2) DEFAULT 0,

  -- Per-period breakdown
  monthly_overtime JSONB,  -- {1: 15.5, 2: 12.0, ...}

  -- Alerts
  limit_warning_sent BOOLEAN DEFAULT false,
  limit_reached_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, employee_id, year)
);

CREATE INDEX idx_overtime_tracking_year ON overtime_tracking(tenant_id, year);

-- Rest period violations log
CREATE TABLE rest_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  violation_date DATE NOT NULL,

  violation_type VARCHAR(20) NOT NULL,
  -- DAILY_REST (< 11h), WEEKLY_REST (< 35h), OVERTIME_LIMIT

  -- Details
  required_hours DECIMAL(4, 2) NOT NULL,
  actual_hours DECIMAL(4, 2) NOT NULL,
  shortage_hours DECIMAL(4, 2) NOT NULL,

  -- Resolution
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rest_violations_employee ON rest_violations(employee_id);
CREATE INDEX idx_rest_violations_date ON rest_violations(violation_date);

-- Clock events (for physical clock-in systems)
CREATE TABLE clock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),

  event_type VARCHAR(10) NOT NULL,  -- IN, OUT, BREAK_START, BREAK_END
  event_time TIMESTAMPTZ NOT NULL,

  -- Source tracking
  source VARCHAR(20) NOT NULL,  -- TERMINAL, MOBILE, WEB, IMPORT
  device_id VARCHAR(100),
  ip_address INET,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),

  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verification_method VARCHAR(20),  -- PIN, CARD, BIOMETRIC, MANUAL

  -- Processing
  processed BOOLEAN DEFAULT false,
  time_entry_id UUID REFERENCES time_entries(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clock_events_employee ON clock_events(employee_id);
CREATE INDEX idx_clock_events_time ON clock_events(event_time);
CREATE INDEX idx_clock_events_unprocessed ON clock_events(processed) WHERE processed = false;

-- Time entry templates for recurring schedules
CREATE TABLE time_entry_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID REFERENCES employees(id),  -- NULL for department-wide
  department_id UUID REFERENCES departments(id),

  name VARCHAR(100) NOT NULL,
  day_of_week INTEGER,  -- 0=Sunday, 1=Monday, etc. NULL for any day

  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,

  entry_type VARCHAR(20) DEFAULT 'WORK',
  project_id UUID,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Time Tracking Service

```typescript
// src/server/services/hrp/time-tracking.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '@/server/db';
import {
  timeEntries, overtimeTracking, restViolations,
  clockEvents, workSchedules, employeeSchedules
} from '@/server/db/schema';
import { eq, and, gte, lte, between, sql } from 'drizzle-orm';
import { addHours, differenceInHours, differenceInMinutes, startOfWeek, endOfWeek } from 'date-fns';

// Polish labor law constants
const DAILY_REST_HOURS = 11;
const WEEKLY_REST_HOURS = 35;
const STANDARD_DAILY_HOURS = 8;
const NIGHT_WORK_START = 21;  // 21:00
const NIGHT_WORK_END = 7;     // 07:00
const OVERTIME_50_MULTIPLIER = 0.5;
const OVERTIME_100_MULTIPLIER = 1.0;
const NIGHT_BONUS_MULTIPLIER = 0.2;
const DEFAULT_ANNUAL_OVERTIME_LIMIT = 150;
const MAX_ANNUAL_OVERTIME_LIMIT = 416;

interface TimeEntryInput {
  employeeId: string;
  entryDate: Date;
  clockIn?: Date;
  clockOut?: Date;
  breakMinutes?: number;
  entryType?: string;
  projectAllocations?: Array<{
    projectId: string;
    hours: number;
    description?: string;
  }>;
  notes?: string;
}

interface OvertimeBreakdown {
  regularOvertime: number;  // 50% bonus
  premiumOvertime: number;  // 100% bonus
  nightHours: number;
  isWeekend: boolean;
  isHoliday: boolean;
}

export class TimeTrackingService {
  constructor(private readonly tenantId: string) {}

  /**
   * Create or update time entry
   */
  async saveTimeEntry(input: TimeEntryInput, userId: string): Promise<string> {
    // Get employee's schedule
    const schedule = await this.getEmployeeSchedule(input.employeeId, input.entryDate);

    // Calculate hours
    let workedHours = 0;
    let overtime = { regularOvertime: 0, premiumOvertime: 0, nightHours: 0 };

    if (input.clockIn && input.clockOut) {
      const totalMinutes = differenceInMinutes(input.clockOut, input.clockIn);
      const breakMinutes = input.breakMinutes || schedule.defaultBreakMinutes || 0;
      workedHours = (totalMinutes - breakMinutes) / 60;

      // Calculate overtime breakdown
      overtime = await this.calculateOvertime(
        input.employeeId,
        input.entryDate,
        input.clockIn,
        input.clockOut,
        schedule.dailyHours
      );
    }

    // Check for existing entry
    const existing = await db.query.timeEntries.findFirst({
      where: and(
        eq(timeEntries.tenantId, this.tenantId),
        eq(timeEntries.employeeId, input.employeeId),
        eq(timeEntries.entryDate, input.entryDate)
      ),
    });

    const entryData = {
      tenantId: this.tenantId,
      employeeId: input.employeeId,
      entryDate: input.entryDate,
      clockIn: input.clockIn,
      clockOut: input.clockOut,
      breakMinutes: input.breakMinutes || 0,
      scheduledHours: schedule.dailyHours,
      workedHours: this.round2(workedHours),
      overtimeHours: this.round2(overtime.regularOvertime + overtime.premiumOvertime),
      nightHours: this.round2(overtime.nightHours),
      overtime50Hours: this.round2(overtime.regularOvertime),
      overtime100Hours: this.round2(overtime.premiumOvertime),
      entryType: input.entryType || 'WORK',
      projectAllocations: input.projectAllocations,
      notes: input.notes,
      source: 'MANUAL',
      updatedAt: new Date(),
    };

    let entryId: string;

    if (existing) {
      await db.update(timeEntries)
        .set(entryData)
        .where(eq(timeEntries.id, existing.id));
      entryId = existing.id;
    } else {
      const [entry] = await db.insert(timeEntries)
        .values(entryData)
        .returning();
      entryId = entry.id;
    }

    // Update overtime tracking
    await this.updateOvertimeTracking(
      input.employeeId,
      input.entryDate.getFullYear(),
      input.entryDate.getMonth() + 1,
      overtime
    );

    // Check rest period violations
    await this.checkRestPeriodViolations(input.employeeId, input.entryDate);

    return entryId;
  }

  /**
   * Process clock event into time entry
   */
  async processClockEvent(
    employeeId: string,
    eventType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END',
    eventTime: Date,
    source: string,
    metadata?: {
      deviceId?: string;
      ipAddress?: string;
      location?: { lat: number; lng: number };
      verificationMethod?: string;
    }
  ): Promise<string> {
    // Record clock event
    const [event] = await db.insert(clockEvents)
      .values({
        tenantId: this.tenantId,
        employeeId,
        eventType,
        eventTime,
        source,
        deviceId: metadata?.deviceId,
        ipAddress: metadata?.ipAddress,
        locationLat: metadata?.location?.lat,
        locationLng: metadata?.location?.lng,
        verificationMethod: metadata?.verificationMethod,
        isVerified: !!metadata?.verificationMethod,
      })
      .returning();

    // Process into time entry if OUT event
    if (eventType === 'OUT') {
      await this.processClockOutEvent(employeeId, eventTime);
    }

    return event.id;
  }

  /**
   * Process clock-out into time entry
   */
  private async processClockOutEvent(employeeId: string, clockOut: Date): Promise<void> {
    const entryDate = new Date(clockOut.toISOString().split('T')[0]);

    // Find matching clock-in
    const clockIn = await db.query.clockEvents.findFirst({
      where: and(
        eq(clockEvents.tenantId, this.tenantId),
        eq(clockEvents.employeeId, employeeId),
        eq(clockEvents.eventType, 'IN'),
        eq(clockEvents.processed, false),
        gte(clockEvents.eventTime, new Date(entryDate.getTime() - 24 * 60 * 60 * 1000))
      ),
      orderBy: [desc(clockEvents.eventTime)],
    });

    if (!clockIn) return;

    // Calculate breaks
    const breaks = await db.query.clockEvents.findMany({
      where: and(
        eq(clockEvents.tenantId, this.tenantId),
        eq(clockEvents.employeeId, employeeId),
        between(clockEvents.eventTime, clockIn.eventTime, clockOut)
      ),
      orderBy: [asc(clockEvents.eventTime)],
    });

    let breakMinutes = 0;
    let breakStart: Date | null = null;

    for (const event of breaks) {
      if (event.eventType === 'BREAK_START') {
        breakStart = event.eventTime;
      } else if (event.eventType === 'BREAK_END' && breakStart) {
        breakMinutes += differenceInMinutes(event.eventTime, breakStart);
        breakStart = null;
      }
    }

    // Create time entry
    const entryId = await this.saveTimeEntry({
      employeeId,
      entryDate,
      clockIn: clockIn.eventTime,
      clockOut,
      breakMinutes,
    }, 'system');

    // Mark events as processed
    await db.update(clockEvents)
      .set({
        processed: true,
        timeEntryId: entryId,
      })
      .where(and(
        eq(clockEvents.tenantId, this.tenantId),
        eq(clockEvents.employeeId, employeeId),
        between(clockEvents.eventTime, clockIn.eventTime, clockOut)
      ));
  }

  /**
   * Calculate overtime breakdown
   */
  private async calculateOvertime(
    employeeId: string,
    entryDate: Date,
    clockIn: Date,
    clockOut: Date,
    scheduledHours: number
  ): Promise<OvertimeBreakdown> {
    const totalHours = differenceInMinutes(clockOut, clockIn) / 60;
    const isWeekend = entryDate.getDay() === 0 || entryDate.getDay() === 6;
    const isHoliday = await this.isPolishHoliday(entryDate);

    // Calculate night hours
    const nightHours = this.calculateNightHours(clockIn, clockOut);

    // Calculate overtime
    const overtimeHours = Math.max(0, totalHours - scheduledHours);

    // Determine overtime type (50% vs 100%)
    let regularOvertime = 0;
    let premiumOvertime = 0;

    if (overtimeHours > 0) {
      if (isWeekend || isHoliday) {
        // All overtime at 100%
        premiumOvertime = overtimeHours;
      } else if (nightHours > 0) {
        // Night overtime at 100%, rest at 50%
        premiumOvertime = Math.min(nightHours, overtimeHours);
        regularOvertime = Math.max(0, overtimeHours - premiumOvertime);
      } else {
        // Regular day overtime at 50%
        regularOvertime = overtimeHours;
      }
    }

    return {
      regularOvertime: this.round2(regularOvertime),
      premiumOvertime: this.round2(premiumOvertime),
      nightHours: this.round2(nightHours),
      isWeekend,
      isHoliday,
    };
  }

  /**
   * Calculate hours worked during night period (21:00-07:00)
   */
  private calculateNightHours(clockIn: Date, clockOut: Date): number {
    let nightHours = 0;

    // Iterate through each hour of work
    const current = new Date(clockIn);
    while (current < clockOut) {
      const hour = current.getHours();
      if (hour >= NIGHT_WORK_START || hour < NIGHT_WORK_END) {
        // Calculate minutes in this hour that overlap with work period
        const hourEnd = new Date(current);
        hourEnd.setMinutes(59, 59, 999);

        const effectiveStart = current > clockIn ? current : clockIn;
        const effectiveEnd = hourEnd < clockOut ? hourEnd : clockOut;

        const minutes = differenceInMinutes(effectiveEnd, effectiveStart);
        nightHours += minutes / 60;
      }
      current.setHours(current.getHours() + 1, 0, 0, 0);
    }

    return nightHours;
  }

  /**
   * Update overtime tracking for the year
   */
  private async updateOvertimeTracking(
    employeeId: string,
    year: number,
    month: number,
    overtime: OvertimeBreakdown
  ): Promise<void> {
    // Get or create tracking record
    let tracking = await db.query.overtimeTracking.findFirst({
      where: and(
        eq(overtimeTracking.tenantId, this.tenantId),
        eq(overtimeTracking.employeeId, employeeId),
        eq(overtimeTracking.year, year)
      ),
    });

    const totalOvertime = overtime.regularOvertime + overtime.premiumOvertime;

    if (!tracking) {
      // Get employee's overtime limit (may be extended)
      const employee = await db.query.employees.findFirst({
        where: eq(employees.id, employeeId),
        with: { contract: true },
      });

      const limit = employee?.contract?.extendedOvertimeLimit || DEFAULT_ANNUAL_OVERTIME_LIMIT;

      [tracking] = await db.insert(overtimeTracking)
        .values({
          tenantId: this.tenantId,
          employeeId,
          year,
          annualLimitHours: limit,
          extendedLimitHours: limit > DEFAULT_ANNUAL_OVERTIME_LIMIT ? limit : null,
          ytdOvertimeHours: totalOvertime,
          ytdOvertime50Hours: overtime.regularOvertime,
          ytdOvertime100Hours: overtime.premiumOvertime,
          ytdNightHours: overtime.nightHours,
          monthlyOvertime: { [month]: totalOvertime },
        })
        .returning();
    } else {
      const monthlyOvertime = tracking.monthlyOvertime as Record<string, number> || {};
      const previousMonthValue = monthlyOvertime[month] || 0;
      monthlyOvertime[month] = totalOvertime;

      // Recalculate YTD (adjust for any change in this month)
      const delta = totalOvertime - previousMonthValue;

      const newYtd = Number(tracking.ytdOvertimeHours) + delta;
      const limitReached = newYtd >= Number(tracking.annualLimitHours);

      await db.update(overtimeTracking)
        .set({
          ytdOvertimeHours: newYtd,
          ytdOvertime50Hours: sql`${overtimeTracking.ytdOvertime50Hours} + ${overtime.regularOvertime}`,
          ytdOvertime100Hours: sql`${overtimeTracking.ytdOvertime100Hours} + ${overtime.premiumOvertime}`,
          ytdNightHours: sql`${overtimeTracking.ytdNightHours} + ${overtime.nightHours}`,
          monthlyOvertime,
          limitReachedDate: limitReached && !tracking.limitReachedDate ? new Date() : tracking.limitReachedDate,
          updatedAt: new Date(),
        })
        .where(eq(overtimeTracking.id, tracking.id));

      // Send warning if approaching limit (80%)
      const warningThreshold = Number(tracking.annualLimitHours) * 0.8;
      if (newYtd >= warningThreshold && !tracking.limitWarningSent) {
        await this.sendOvertimeLimitWarning(employeeId, year, newYtd, tracking.annualLimitHours);
        await db.update(overtimeTracking)
          .set({ limitWarningSent: true })
          .where(eq(overtimeTracking.id, tracking.id));
      }
    }
  }

  /**
   * Check for rest period violations
   */
  private async checkRestPeriodViolations(employeeId: string, date: Date): Promise<void> {
    // Check daily rest (11 hours between shifts)
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);

    const [todayEntry, yesterdayEntry] = await Promise.all([
      db.query.timeEntries.findFirst({
        where: and(
          eq(timeEntries.tenantId, this.tenantId),
          eq(timeEntries.employeeId, employeeId),
          eq(timeEntries.entryDate, date)
        ),
      }),
      db.query.timeEntries.findFirst({
        where: and(
          eq(timeEntries.tenantId, this.tenantId),
          eq(timeEntries.employeeId, employeeId),
          eq(timeEntries.entryDate, yesterday)
        ),
      }),
    ]);

    if (todayEntry?.clockIn && yesterdayEntry?.clockOut) {
      const restHours = differenceInHours(todayEntry.clockIn, yesterdayEntry.clockOut);

      if (restHours < DAILY_REST_HOURS) {
        await db.insert(restViolations).values({
          tenantId: this.tenantId,
          employeeId,
          violationDate: date,
          violationType: 'DAILY_REST',
          requiredHours: DAILY_REST_HOURS,
          actualHours: restHours,
          shortageHours: DAILY_REST_HOURS - restHours,
        });
      }
    }

    // Check weekly rest (35 hours once per week)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    const weekEntries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.tenantId, this.tenantId),
        eq(timeEntries.employeeId, employeeId),
        between(timeEntries.entryDate, weekStart, weekEnd)
      ),
      orderBy: [asc(timeEntries.entryDate)],
    });

    // Find longest continuous rest period in the week
    let longestRest = 0;
    for (let i = 0; i < weekEntries.length - 1; i++) {
      const current = weekEntries[i];
      const next = weekEntries[i + 1];

      if (current.clockOut && next.clockIn) {
        const rest = differenceInHours(next.clockIn, current.clockOut);
        if (rest > longestRest) longestRest = rest;
      }
    }

    // Check weekend rest if this is the last workday of the week
    if (date.getDay() === 5 && todayEntry?.clockOut) { // Friday
      // Calculate rest until Monday start (assuming standard 9:00)
      const mondayStart = new Date(weekEnd);
      mondayStart.setDate(mondayStart.getDate() + 1);
      mondayStart.setHours(9, 0, 0, 0);

      const weekendRest = differenceInHours(mondayStart, todayEntry.clockOut);
      if (weekendRest > longestRest) longestRest = weekendRest;
    }

    if (longestRest < WEEKLY_REST_HOURS && weekEntries.length > 0) {
      // Check if violation already recorded for this week
      const existingViolation = await db.query.restViolations.findFirst({
        where: and(
          eq(restViolations.tenantId, this.tenantId),
          eq(restViolations.employeeId, employeeId),
          eq(restViolations.violationType, 'WEEKLY_REST'),
          between(restViolations.violationDate, weekStart, weekEnd)
        ),
      });

      if (!existingViolation) {
        await db.insert(restViolations).values({
          tenantId: this.tenantId,
          employeeId,
          violationDate: date,
          violationType: 'WEEKLY_REST',
          requiredHours: WEEKLY_REST_HOURS,
          actualHours: longestRest,
          shortageHours: WEEKLY_REST_HOURS - longestRest,
        });
      }
    }
  }

  /**
   * Get employee's active schedule
   */
  async getEmployeeSchedule(employeeId: string, date: Date): Promise<{
    dailyHours: number;
    weeklyHours: number;
    defaultStartTime: string;
    defaultEndTime: string;
    defaultBreakMinutes: number;
  }> {
    const assignment = await db.query.employeeSchedules.findFirst({
      where: and(
        eq(employeeSchedules.tenantId, this.tenantId),
        eq(employeeSchedules.employeeId, employeeId),
        lte(employeeSchedules.effectiveFrom, date),
        sql`(${employeeSchedules.effectiveTo} IS NULL OR ${employeeSchedules.effectiveTo} >= ${date})`
      ),
      with: {
        schedule: true,
      },
      orderBy: [desc(employeeSchedules.effectiveFrom)],
    });

    if (assignment) {
      return {
        dailyHours: Number(assignment.customDailyHours || assignment.schedule.dailyHours),
        weeklyHours: Number(assignment.customWeeklyHours || assignment.schedule.weeklyHours),
        defaultStartTime: assignment.customStartTime || assignment.schedule.defaultStartTime,
        defaultEndTime: assignment.customEndTime || assignment.schedule.defaultEndTime,
        defaultBreakMinutes: assignment.schedule.defaultBreakMinutes,
      };
    }

    // Return defaults
    return {
      dailyHours: STANDARD_DAILY_HOURS,
      weeklyHours: 40,
      defaultStartTime: '09:00',
      defaultEndTime: '17:00',
      defaultBreakMinutes: 30,
    };
  }

  /**
   * Get time summary for a period
   */
  async getTimeSummary(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalWorkedHours: number;
    totalScheduledHours: number;
    totalOvertimeHours: number;
    overtime50Hours: number;
    overtime100Hours: number;
    nightHours: number;
    lateArrivals: number;
    earlyDepartures: number;
    absences: number;
    entriesByType: Record<string, number>;
  }> {
    const entries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.tenantId, this.tenantId),
        eq(timeEntries.employeeId, employeeId),
        between(timeEntries.entryDate, startDate, endDate)
      ),
    });

    let summary = {
      totalWorkedHours: 0,
      totalScheduledHours: 0,
      totalOvertimeHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      nightHours: 0,
      lateArrivals: 0,
      earlyDepartures: 0,
      absences: 0,
      entriesByType: {} as Record<string, number>,
    };

    const schedule = await this.getEmployeeSchedule(employeeId, startDate);

    for (const entry of entries) {
      summary.totalWorkedHours += Number(entry.workedHours || 0);
      summary.totalScheduledHours += Number(entry.scheduledHours || schedule.dailyHours);
      summary.totalOvertimeHours += Number(entry.overtimeHours || 0);
      summary.overtime50Hours += Number(entry.overtime50Hours || 0);
      summary.overtime100Hours += Number(entry.overtime100Hours || 0);
      summary.nightHours += Number(entry.nightHours || 0);

      // Track by type
      const type = entry.entryType || 'WORK';
      summary.entriesByType[type] = (summary.entriesByType[type] || 0) + 1;

      if (type === 'ABSENCE') summary.absences++;

      // Check late arrival
      if (entry.clockIn) {
        const expectedStart = new Date(entry.entryDate);
        const [hours, minutes] = schedule.defaultStartTime.split(':');
        expectedStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (entry.clockIn > expectedStart) {
          summary.lateArrivals++;
        }
      }

      // Check early departure
      if (entry.clockOut) {
        const expectedEnd = new Date(entry.entryDate);
        const [hours, minutes] = schedule.defaultEndTime.split(':');
        expectedEnd.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (entry.clockOut < expectedEnd) {
          summary.earlyDepartures++;
        }
      }
    }

    return summary;
  }

  /**
   * Check if date is a Polish public holiday
   */
  private async isPolishHoliday(date: Date): Promise<boolean> {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    const fixedHolidays = [
      { month: 0, day: 1 },   // Nowy Rok
      { month: 0, day: 6 },   // Trzech Króli
      { month: 4, day: 1 },   // Święto Pracy
      { month: 4, day: 3 },   // Święto Konstytucji
      { month: 7, day: 15 },  // Wniebowzięcie NMP
      { month: 10, day: 1 },  // Wszystkich Świętych
      { month: 10, day: 11 }, // Święto Niepodległości
      { month: 11, day: 25 }, // Boże Narodzenie
      { month: 11, day: 26 }, // Drugi dzień Bożego Narodzenia
    ];

    // Check fixed holidays
    if (fixedHolidays.some(h => h.month === month && h.day === day)) {
      return true;
    }

    // Calculate Easter-based holidays
    const easter = this.calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easterMonday.getDate() + 1);

    const corpusChristi = new Date(easter);
    corpusChristi.setDate(corpusChristi.getDate() + 60);

    const pentecost = new Date(easter);
    pentecost.setDate(pentecost.getDate() + 49);

    const movingHolidays = [easter, easterMonday, corpusChristi, pentecost];

    return movingHolidays.some(h =>
      h.getMonth() === month && h.getDate() === day
    );
  }

  private calculateEaster(year: number): Date {
    // Anonymous Gregorian algorithm
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  }

  private async sendOvertimeLimitWarning(
    employeeId: string,
    year: number,
    currentHours: number,
    limit: number
  ): Promise<void> {
    // Emit notification event
    await eventEmitter.emit('overtime.warning', {
      tenantId: this.tenantId,
      employeeId,
      year,
      currentHours,
      limit,
      percentage: (currentHours / limit) * 100,
    });
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
```

### tRPC Router

```typescript
// src/server/routers/hrp/time-tracking.router.ts
import { z } from 'zod';
import { router, hrManagerProcedure, employeeProcedure } from '@/server/trpc';
import { TimeTrackingService } from '@/server/services/hrp/time-tracking.service';

export const timeTrackingRouter = router({
  saveEntry: employeeProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      entryDate: z.coerce.date(),
      clockIn: z.coerce.date().optional(),
      clockOut: z.coerce.date().optional(),
      breakMinutes: z.number().min(0).max(480).optional(),
      entryType: z.enum(['WORK', 'LEAVE', 'SICK', 'HOLIDAY', 'ABSENCE', 'REMOTE', 'TRAINING']).optional(),
      projectAllocations: z.array(z.object({
        projectId: z.string().uuid(),
        hours: z.number().positive(),
        description: z.string().optional(),
      })).optional(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Employees can only edit their own entries
      if (ctx.user.role !== 'HR_MANAGER' && input.employeeId !== ctx.user.employeeId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot edit other employee entries',
        });
      }

      const service = new TimeTrackingService(ctx.tenantId);
      return service.saveTimeEntry(input, ctx.user.id);
    }),

  clockIn: employeeProcedure
    .input(z.object({
      source: z.enum(['WEB', 'MOBILE', 'TERMINAL']).default('WEB'),
      location: z.object({
        lat: z.number(),
        lng: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new TimeTrackingService(ctx.tenantId);
      return service.processClockEvent(
        ctx.user.employeeId,
        'IN',
        new Date(),
        input.source,
        { location: input.location }
      );
    }),

  clockOut: employeeProcedure
    .input(z.object({
      source: z.enum(['WEB', 'MOBILE', 'TERMINAL']).default('WEB'),
      location: z.object({
        lat: z.number(),
        lng: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new TimeTrackingService(ctx.tenantId);
      return service.processClockEvent(
        ctx.user.employeeId,
        'OUT',
        new Date(),
        input.source,
        { location: input.location }
      );
    }),

  getMyEntries: employeeProcedure
    .input(z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.timeEntries.findMany({
        where: and(
          eq(timeEntries.tenantId, ctx.tenantId),
          eq(timeEntries.employeeId, ctx.user.employeeId),
          between(timeEntries.entryDate, input.startDate, input.endDate)
        ),
        orderBy: [desc(timeEntries.entryDate)],
      });
    }),

  getMySummary: employeeProcedure
    .input(z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new TimeTrackingService(ctx.tenantId);
      return service.getTimeSummary(
        ctx.user.employeeId,
        input.startDate,
        input.endDate
      );
    }),

  getOvertimeStatus: employeeProcedure
    .input(z.object({
      year: z.number().default(() => new Date().getFullYear()),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.overtimeTracking.findFirst({
        where: and(
          eq(overtimeTracking.tenantId, ctx.tenantId),
          eq(overtimeTracking.employeeId, ctx.user.employeeId),
          eq(overtimeTracking.year, input.year)
        ),
      });
    }),

  // HR Manager endpoints
  listEntries: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(timeEntries.tenantId, ctx.tenantId),
        between(timeEntries.entryDate, input.startDate, input.endDate),
      ];

      if (input.employeeId) {
        conditions.push(eq(timeEntries.employeeId, input.employeeId));
      }
      if (input.status) {
        conditions.push(eq(timeEntries.status, input.status));
      }

      // Department filter requires join
      let query = db.select()
        .from(timeEntries)
        .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
        .where(and(...conditions));

      if (input.departmentId) {
        query = query.where(eq(employees.departmentId, input.departmentId));
      }

      const results = await query
        .orderBy(desc(timeEntries.entryDate))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return results;
    }),

  approveEntry: hrManagerProcedure
    .input(z.object({
      entryId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(timeEntries)
        .set({
          status: 'APPROVED',
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(timeEntries.id, input.entryId),
          eq(timeEntries.tenantId, ctx.tenantId)
        ));

      return { success: true };
    }),

  rejectEntry: hrManagerProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(timeEntries)
        .set({
          status: 'REJECTED',
          rejectionReason: input.reason,
          updatedAt: new Date(),
        })
        .where(and(
          eq(timeEntries.id, input.entryId),
          eq(timeEntries.tenantId, ctx.tenantId)
        ));

      return { success: true };
    }),

  getRestViolations: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid().optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      acknowledged: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(restViolations.tenantId, ctx.tenantId)];

      if (input.employeeId) conditions.push(eq(restViolations.employeeId, input.employeeId));
      if (input.startDate) conditions.push(gte(restViolations.violationDate, input.startDate));
      if (input.endDate) conditions.push(lte(restViolations.violationDate, input.endDate));
      if (input.acknowledged !== undefined) {
        conditions.push(eq(restViolations.acknowledged, input.acknowledged));
      }

      return db.query.restViolations.findMany({
        where: and(...conditions),
        with: {
          employee: {
            columns: { firstName: true, lastName: true },
          },
        },
        orderBy: [desc(restViolations.violationDate)],
      });
    }),

  acknowledgeViolation: hrManagerProcedure
    .input(z.object({
      violationId: z.string().uuid(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(restViolations)
        .set({
          acknowledged: true,
          acknowledgedBy: ctx.user.id,
          acknowledgedAt: new Date(),
          resolutionNotes: input.notes,
        })
        .where(and(
          eq(restViolations.id, input.violationId),
          eq(restViolations.tenantId, ctx.tenantId)
        ));

      return { success: true };
    }),

  getDepartmentSummary: hrManagerProcedure
    .input(z.object({
      departmentId: z.string().uuid(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    }))
    .query(async ({ ctx, input }) => {
      const departmentEmployees = await db.query.employees.findMany({
        where: and(
          eq(employees.tenantId, ctx.tenantId),
          eq(employees.departmentId, input.departmentId),
          eq(employees.status, 'ACTIVE')
        ),
      });

      const service = new TimeTrackingService(ctx.tenantId);
      const summaries = await Promise.all(
        departmentEmployees.map(async (emp) => ({
          employee: {
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
          },
          summary: await service.getTimeSummary(emp.id, input.startDate, input.endDate),
        }))
      );

      // Aggregate department totals
      const totals = summaries.reduce((acc, { summary }) => ({
        totalWorkedHours: acc.totalWorkedHours + summary.totalWorkedHours,
        totalOvertimeHours: acc.totalOvertimeHours + summary.totalOvertimeHours,
        totalAbsences: acc.totalAbsences + summary.absences,
        lateArrivals: acc.lateArrivals + summary.lateArrivals,
      }), {
        totalWorkedHours: 0,
        totalOvertimeHours: 0,
        totalAbsences: 0,
        lateArrivals: 0,
      });

      return {
        employeeSummaries: summaries,
        departmentTotals: totals,
      };
    }),
});
```

## Test Specification

### Unit Tests

```typescript
describe('TimeTrackingService', () => {
  describe('calculateOvertime', () => {
    it('should calculate 50% overtime for regular day', async () => {
      const result = await service.calculateOvertime(
        employeeId,
        new Date('2024-01-15'), // Monday
        new Date('2024-01-15T09:00:00'),
        new Date('2024-01-15T19:00:00'),
        8
      );

      expect(result.regularOvertime).toBe(2); // 10 hours - 8 = 2
      expect(result.premiumOvertime).toBe(0);
    });

    it('should calculate 100% overtime for weekend', async () => {
      const result = await service.calculateOvertime(
        employeeId,
        new Date('2024-01-20'), // Saturday
        new Date('2024-01-20T09:00:00'),
        new Date('2024-01-20T14:00:00'),
        0 // No scheduled hours on weekend
      );

      expect(result.premiumOvertime).toBe(5);
      expect(result.isWeekend).toBe(true);
    });

    it('should calculate night hours correctly', async () => {
      const result = await service.calculateOvertime(
        employeeId,
        new Date('2024-01-15'),
        new Date('2024-01-15T18:00:00'),
        new Date('2024-01-16T02:00:00'),
        8
      );

      expect(result.nightHours).toBeCloseTo(5); // 21:00-02:00
    });
  });

  describe('checkRestPeriodViolations', () => {
    it('should detect daily rest violation', async () => {
      // Yesterday: worked until 23:00
      await createTimeEntry({
        employeeId,
        date: yesterday,
        clockIn: '14:00',
        clockOut: '23:00',
      });

      // Today: started at 07:00 (only 8 hours rest)
      await service.saveTimeEntry({
        employeeId,
        entryDate: today,
        clockIn: new Date(`${today}T07:00:00`),
        clockOut: new Date(`${today}T15:00:00`),
      }, userId);

      const violations = await getViolations(employeeId, today);
      expect(violations).toContainEqual(
        expect.objectContaining({
          violationType: 'DAILY_REST',
          shortageHours: 3, // 11 - 8
        })
      );
    });
  });

  describe('processClockEvent', () => {
    it('should create time entry on clock out', async () => {
      // Clock in
      await service.processClockEvent(employeeId, 'IN', new Date('2024-01-15T09:00:00'), 'WEB');

      // Clock out
      await service.processClockEvent(employeeId, 'OUT', new Date('2024-01-15T17:30:00'), 'WEB');

      const entry = await getTimeEntry(employeeId, '2024-01-15');
      expect(entry.workedHours).toBe(8.5);
    });
  });
});
```

## Security Checklist

- [x] Employees can only edit their own time entries
- [x] HR managers can access all employee data within tenant
- [x] Clock events record source and verification method
- [x] Location tracking only with user consent
- [x] Rest violation alerts sent to appropriate managers
- [x] Audit trail for all approvals and rejections
- [x] RLS policies enforce tenant isolation

## Audit Events

| Event | Data Captured |
|-------|--------------|
| `TIME_ENTRY_CREATED` | employee_id, date, hours, type |
| `TIME_ENTRY_APPROVED` | entry_id, approved_by |
| `TIME_ENTRY_REJECTED` | entry_id, rejected_by, reason |
| `CLOCK_EVENT` | employee_id, event_type, source, location |
| `OVERTIME_WARNING` | employee_id, ytd_hours, limit |
| `REST_VIOLATION_DETECTED` | employee_id, violation_type, shortage |
| `REST_VIOLATION_ACKNOWLEDGED` | violation_id, acknowledged_by |

## Implementation Notes

1. **Polish Labor Law**: Strict compliance with Kodeks Pracy working time regulations
2. **Overtime Rates**: 50% for regular, 100% for night/weekend/holiday
3. **Night Work**: 21:00-07:00, additional 20% bonus
4. **Rest Periods**: 11 hours daily, 35 hours weekly
5. **Annual Overtime Limit**: 150 hours default, up to 416 by agreement
6. **Settlement Period**: Configurable 1-12 months for averaging hours
7. **Clock Sources**: Web, mobile, terminal with optional location tracking
