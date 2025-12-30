# WFA-003: Scheduled Workflow Execution

> **Story ID**: WFA-003
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P0 (Critical)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 5, Week 18

---

## 📋 User Story

**As an** accountant,
**I want** workflows to run automatically on schedules,
**So that** recurring tasks are automated reliably without manual intervention.

---

## ✅ Acceptance Criteria

### Scenario 1: Schedule Configuration with Cron
```gherkin
Given I am configuring a scheduled trigger
When I enter a cron expression (e.g., "0 9 25 * *" for 9:00 on 25th)
Then I should see the expression validated in real-time
And I should see a human-readable description
And I should see the next 5 execution times
```

### Scenario 2: Visual Schedule Builder
```gherkin
Given I am configuring a scheduled trigger
When I use the visual schedule builder
Then I should be able to select:
  - Frequency (daily, weekly, monthly)
  - Time of execution
  - Days of week (for weekly)
  - Day of month (for monthly)
And the corresponding cron expression should be generated
```

### Scenario 3: Timezone Handling
```gherkin
Given I configure a schedule with timezone "Europe/Warsaw"
When the workflow is scheduled to run at 9:00
Then it should execute at 9:00 Warsaw time (CET/CEST)
And timezone changes (DST) should be handled automatically
And execution logs should show both local and UTC times
```

### Scenario 4: Holiday and Weekend Handling
```gherkin
Given I configure a workflow with "skip weekends" and "skip Polish holidays"
When a scheduled execution falls on a weekend or Polish holiday
Then the execution should be skipped
And the next valid execution should be calculated
And a notification should be sent about the skipped execution
```

### Scenario 5: Queue Management
```gherkin
Given multiple workflows are scheduled at the same time
When the schedules overlap
Then the system should queue executions based on priority
And high-priority workflows should execute first
And queue depth should not exceed configured limits
And backpressure should be applied if queue is full
```

### Scenario 6: Overlap Prevention
```gherkin
Given a workflow with "prevent overlap" enabled
When a scheduled execution is triggered
And a previous execution is still running
Then the new execution should be skipped
And a warning should be logged
And the next scheduled execution should proceed normally
```

### Scenario 7: Missed Execution Handling
```gherkin
Given a scheduled workflow execution was missed (system downtime)
When the system recovers
Then I should be notified of missed executions
And I should have the option to:
  - Run the missed execution immediately
  - Skip it and wait for next scheduled time
  - Run all missed executions in sequence
```

### Scenario 8: Execution History
```gherkin
Given a scheduled workflow has been running
When I view the execution history
Then I should see:
  - All scheduled execution times
  - Actual execution times
  - Execution duration
  - Success/failure status
  - Skipped executions with reasons
And I should be able to filter by date range
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- Scheduled jobs registry
CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    -- Schedule info
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Warsaw',

    -- Timing
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    last_run_duration_ms INTEGER,
    last_run_status VARCHAR(20),

    -- Configuration
    skip_weekends BOOLEAN DEFAULT false,
    skip_holidays BOOLEAN DEFAULT false,
    holiday_calendar VARCHAR(10) DEFAULT 'PL',
    prevent_overlap BOOLEAN DEFAULT true,
    catch_up_missed BOOLEAN DEFAULT false,

    -- Priority
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_running BOOLEAN DEFAULT false,

    -- Statistics
    total_runs INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    skipped_runs INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled execution log
CREATE TABLE scheduled_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES workflow_executions(id),

    -- Timing
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'missed')),

    -- Details
    skip_reason VARCHAR(100),
    error_message TEXT,
    execution_duration_ms INTEGER,

    -- Metadata
    triggered_by VARCHAR(50) DEFAULT 'scheduler', -- scheduler, manual, catch_up
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Polish holidays table
CREATE TABLE polish_holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    is_movable BOOLEAN DEFAULT false,
    year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)) STORED
);

-- Pre-populate Polish holidays for current and next year
INSERT INTO polish_holidays (date, name, name_en, is_movable) VALUES
    ('2024-01-01', 'Nowy Rok', 'New Year', false),
    ('2024-01-06', 'Święto Trzech Króli', 'Epiphany', false),
    ('2024-03-31', 'Wielkanoc', 'Easter Sunday', true),
    ('2024-04-01', 'Poniedziałek Wielkanocny', 'Easter Monday', true),
    ('2024-05-01', 'Święto Pracy', 'Labour Day', false),
    ('2024-05-03', 'Święto Konstytucji 3 Maja', 'Constitution Day', false),
    ('2024-05-19', 'Zielone Świątki', 'Whit Sunday', true),
    ('2024-05-30', 'Boże Ciało', 'Corpus Christi', true),
    ('2024-08-15', 'Wniebowzięcie NMP', 'Assumption of Mary', false),
    ('2024-11-01', 'Wszystkich Świętych', 'All Saints Day', false),
    ('2024-11-11', 'Święto Niepodległości', 'Independence Day', false),
    ('2024-12-25', 'Boże Narodzenie', 'Christmas Day', false),
    ('2024-12-26', 'Drugi dzień Bożego Narodzenia', 'Boxing Day', false);
    -- Add 2025 holidays similarly

-- Execution queue
CREATE TABLE execution_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id),

    -- Queue position
    priority INTEGER NOT NULL DEFAULT 100, -- Lower = higher priority
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Execution context
    trigger_data JSONB DEFAULT '{}',
    scheduled_time TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    picked_up_at TIMESTAMPTZ,
    worker_id VARCHAR(100),

    -- Constraints
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Indexes
CREATE INDEX idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_jobs_trigger ON scheduled_jobs(trigger_id);
CREATE INDEX idx_execution_log_job ON scheduled_execution_log(job_id);
CREATE INDEX idx_execution_log_scheduled ON scheduled_execution_log(scheduled_at);
CREATE INDEX idx_execution_queue_priority ON execution_queue(priority, queued_at) WHERE status = 'queued';
CREATE INDEX idx_polish_holidays_date ON polish_holidays(date);

-- RLS Policies
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_jobs_org_isolation ON scheduled_jobs
    USING (workflow_id IN (
        SELECT id FROM workflows
        WHERE organization_id = current_setting('app.current_organization_id')::UUID
    ));
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Schedule configuration
export const scheduleConfigSchema = z.object({
  cronExpression: z.string()
    .min(9, 'Wyrażenie cron jest za krótkie')
    .max(100, 'Wyrażenie cron jest za długie'),
  timezone: z.string().default('Europe/Warsaw'),
  skipWeekends: z.boolean().default(false),
  skipHolidays: z.boolean().default(false),
  holidayCalendar: z.enum(['PL', 'EU']).default('PL'),
  preventOverlap: z.boolean().default(true),
  catchUpMissed: z.boolean().default(false),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal')
});

// Visual schedule input
export const visualScheduleInputSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Nieprawidłowy format czasu'),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday
  dayOfMonth: z.number().min(1).max(31).optional(),
  lastDayOfMonth: z.boolean().optional(),
  specificDates: z.array(z.string().datetime()).optional()
});

// Create scheduled job
export const createScheduledJobSchema = z.object({
  triggerId: z.string().uuid(),
  workflowId: z.string().uuid(),
  config: scheduleConfigSchema
});

// Missed execution handling
export const handleMissedExecutionSchema = z.object({
  jobId: z.string().uuid(),
  missedExecutions: z.array(z.string().datetime()),
  action: z.enum(['run_all', 'run_latest', 'skip'])
});

// Queue entry
export const queueEntrySchema = z.object({
  jobId: z.string().uuid().optional(),
  workflowId: z.string().uuid(),
  priority: z.number().min(1).max(1000).default(100),
  triggerData: z.record(z.unknown()).default({}),
  scheduledTime: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional()
});

// Execution log query
export const executionLogQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped', 'missed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
});
```

### Service Implementation

```typescript
// src/server/services/scheduler.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '@/server/db';
import { eq, and, lt, gt, isNull, desc, asc } from 'drizzle-orm';
import {
  scheduledJobs,
  scheduledExecutionLog,
  executionQueue,
  polishHolidays,
  workflows
} from '@/server/db/schema';
import { scheduleConfigSchema, handleMissedExecutionSchema } from './scheduler.schemas';
import { CronParser } from './cron-parser';
import { WorkflowExecutionService } from './workflow-execution.service';
import { auditLog } from '@/server/services/audit.service';
import { Redis } from 'ioredis';

export class SchedulerService {
  private cronParser: CronParser;
  private executionService: WorkflowExecutionService;
  private redis: Redis;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cronParser = new CronParser();
    this.executionService = new WorkflowExecutionService();
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Start the scheduler polling
   */
  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Scheduler started');

    // Poll every 10 seconds
    this.pollInterval = setInterval(() => this.poll(), 10000);

    // Initial poll
    await this.poll();
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  /**
   * Poll for due jobs
   */
  private async poll() {
    try {
      // Use distributed lock to prevent multiple instances processing same jobs
      const lockKey = 'scheduler:poll:lock';
      const lockAcquired = await this.redis.set(lockKey, 'locked', 'EX', 30, 'NX');

      if (!lockAcquired) {
        return; // Another instance is processing
      }

      try {
        // Find due jobs
        const dueJobs = await db.query.scheduledJobs.findMany({
          where: and(
            eq(scheduledJobs.isActive, true),
            lt(scheduledJobs.nextRunAt, new Date()),
            eq(scheduledJobs.isRunning, false)
          ),
          orderBy: [
            asc(scheduledJobs.priority),
            asc(scheduledJobs.nextRunAt)
          ],
          limit: 10
        });

        for (const job of dueJobs) {
          await this.processJob(job);
        }

      } finally {
        await this.redis.del(lockKey);
      }

    } catch (error) {
      console.error('Scheduler poll error:', error);
    }
  }

  /**
   * Process a single scheduled job
   */
  private async processJob(job: typeof scheduledJobs.$inferSelect) {
    // Check for overlap
    if (job.preventOverlap && job.isRunning) {
      await this.logSkippedExecution(job.id, job.nextRunAt, 'overlap');
      await this.updateNextRun(job);
      return;
    }

    // Check if weekend/holiday
    const shouldSkip = await this.shouldSkipDate(
      job.nextRunAt,
      job.skipWeekends,
      job.skipHolidays,
      job.holidayCalendar
    );

    if (shouldSkip.skip) {
      await this.logSkippedExecution(job.id, job.nextRunAt, shouldSkip.reason!);
      await this.updateNextRun(job);
      return;
    }

    // Mark as running
    await db.update(scheduledJobs)
      .set({ isRunning: true, lastRunAt: new Date() })
      .where(eq(scheduledJobs.id, job.id));

    // Create execution log entry
    const [logEntry] = await db.insert(scheduledExecutionLog).values({
      jobId: job.id,
      scheduledAt: job.nextRunAt,
      startedAt: new Date(),
      status: 'running'
    }).returning();

    try {
      // Execute workflow
      const startTime = Date.now();
      const execution = await this.executionService.execute(job.workflowId, {
        triggerType: 'scheduled',
        triggerId: job.triggerId,
        scheduledAt: job.nextRunAt.toISOString(),
        jobId: job.id
      });

      const duration = Date.now() - startTime;

      // Update log entry
      await db.update(scheduledExecutionLog)
        .set({
          executionId: execution.id,
          status: 'completed',
          completedAt: new Date(),
          executionDurationMs: duration
        })
        .where(eq(scheduledExecutionLog.id, logEntry.id));

      // Update job statistics
      await db.update(scheduledJobs)
        .set({
          isRunning: false,
          lastRunDurationMs: duration,
          lastRunStatus: 'completed',
          totalRuns: job.totalRuns + 1,
          successfulRuns: job.successfulRuns + 1
        })
        .where(eq(scheduledJobs.id, job.id));

    } catch (error) {
      // Handle failure
      await db.update(scheduledExecutionLog)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(scheduledExecutionLog.id, logEntry.id));

      await db.update(scheduledJobs)
        .set({
          isRunning: false,
          lastRunStatus: 'failed',
          totalRuns: job.totalRuns + 1,
          failedRuns: job.failedRuns + 1
        })
        .where(eq(scheduledJobs.id, job.id));

      console.error(`Scheduled job ${job.id} failed:`, error);
    }

    // Calculate next run
    await this.updateNextRun(job);
  }

  /**
   * Update next run time for job
   */
  private async updateNextRun(job: typeof scheduledJobs.$inferSelect) {
    let nextRun = this.cronParser.getNextExecution(
      job.cronExpression,
      job.timezone,
      new Date()
    );

    // Skip weekends/holidays if configured
    while (true) {
      const shouldSkip = await this.shouldSkipDate(
        nextRun,
        job.skipWeekends,
        job.skipHolidays,
        job.holidayCalendar
      );

      if (!shouldSkip.skip) break;

      nextRun = this.cronParser.getNextExecution(
        job.cronExpression,
        job.timezone,
        nextRun
      );
    }

    await db.update(scheduledJobs)
      .set({ nextRunAt: nextRun, updatedAt: new Date() })
      .where(eq(scheduledJobs.id, job.id));
  }

  /**
   * Check if date should be skipped
   */
  private async shouldSkipDate(
    date: Date,
    skipWeekends: boolean,
    skipHolidays: boolean,
    holidayCalendar: string
  ): Promise<{ skip: boolean; reason?: string }> {
    // Check weekend
    if (skipWeekends) {
      const day = date.getDay();
      if (day === 0 || day === 6) {
        return { skip: true, reason: 'weekend' };
      }
    }

    // Check holiday
    if (skipHolidays) {
      const dateStr = date.toISOString().split('T')[0];
      const holiday = await db.query.polishHolidays.findFirst({
        where: eq(polishHolidays.date, dateStr)
      });

      if (holiday) {
        return { skip: true, reason: `holiday:${holiday.name}` };
      }
    }

    return { skip: false };
  }

  /**
   * Log skipped execution
   */
  private async logSkippedExecution(
    jobId: string,
    scheduledAt: Date,
    reason: string
  ) {
    await db.insert(scheduledExecutionLog).values({
      jobId,
      scheduledAt,
      status: 'skipped',
      skipReason: reason,
      completedAt: new Date()
    });

    // Update job statistics
    await db.update(scheduledJobs)
      .set({
        skippedRuns: scheduledJobs.skippedRuns + 1
      })
      .where(eq(scheduledJobs.id, jobId));
  }

  /**
   * Check for missed executions
   */
  async checkMissedExecutions(
    jobId: string,
    context: { userId: string; organizationId: string }
  ) {
    const job = await this.getJob(jobId, context);

    // Find gaps in execution log
    const lastSuccessful = await db.query.scheduledExecutionLog.findFirst({
      where: and(
        eq(scheduledExecutionLog.jobId, jobId),
        eq(scheduledExecutionLog.status, 'completed')
      ),
      orderBy: desc(scheduledExecutionLog.scheduledAt)
    });

    if (!lastSuccessful) {
      return { missedCount: 0, missedExecutions: [] };
    }

    // Calculate expected executions since last successful
    const expected = this.cronParser.getExecutionsBetween(
      job.cronExpression,
      job.timezone,
      lastSuccessful.scheduledAt,
      new Date()
    );

    // Find actual executions
    const actual = await db.query.scheduledExecutionLog.findMany({
      where: and(
        eq(scheduledExecutionLog.jobId, jobId),
        gt(scheduledExecutionLog.scheduledAt, lastSuccessful.scheduledAt)
      )
    });

    const actualTimes = new Set(actual.map(a => a.scheduledAt.getTime()));
    const missed = expected.filter(e => !actualTimes.has(e.getTime()));

    return {
      missedCount: missed.length,
      missedExecutions: missed.map(d => d.toISOString())
    };
  }

  /**
   * Handle missed executions
   */
  async handleMissedExecutions(
    input: z.infer<typeof handleMissedExecutionSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const job = await this.getJob(input.jobId, context);

    if (input.action === 'skip') {
      // Mark all as skipped
      for (const missed of input.missedExecutions) {
        await db.insert(scheduledExecutionLog).values({
          jobId: job.id,
          scheduledAt: new Date(missed),
          status: 'missed',
          skipReason: 'manually_skipped',
          completedAt: new Date()
        });
      }
      return { processed: input.missedExecutions.length, action: 'skipped' };
    }

    const toExecute = input.action === 'run_latest'
      ? [input.missedExecutions[input.missedExecutions.length - 1]]
      : input.missedExecutions;

    const results = [];
    for (const missed of toExecute) {
      try {
        const execution = await this.executionService.execute(job.workflowId, {
          triggerType: 'scheduled',
          triggerId: job.triggerId,
          scheduledAt: missed,
          isCatchUp: true
        });

        await db.insert(scheduledExecutionLog).values({
          jobId: job.id,
          executionId: execution.id,
          scheduledAt: new Date(missed),
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'completed',
          metadata: { triggeredBy: 'catch_up' }
        });

        results.push({ time: missed, success: true });
      } catch (error) {
        results.push({
          time: missed,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { processed: results.length, action: input.action, results };
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(
    jobId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
      limit?: number;
      offset?: number;
    },
    context: { userId: string; organizationId: string }
  ) {
    await this.getJob(jobId, context); // Verify access

    const conditions = [eq(scheduledExecutionLog.jobId, jobId)];

    if (options.startDate) {
      conditions.push(gt(scheduledExecutionLog.scheduledAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lt(scheduledExecutionLog.scheduledAt, options.endDate));
    }
    if (options.status) {
      conditions.push(eq(scheduledExecutionLog.status, options.status));
    }

    const logs = await db.query.scheduledExecutionLog.findMany({
      where: and(...conditions),
      orderBy: desc(scheduledExecutionLog.scheduledAt),
      limit: options.limit || 100,
      offset: options.offset || 0,
      with: {
        execution: true
      }
    });

    const total = await db.select({ count: count() })
      .from(scheduledExecutionLog)
      .where(and(...conditions));

    return {
      logs,
      total: total[0].count,
      limit: options.limit || 100,
      offset: options.offset || 0
    };
  }

  /**
   * Get next scheduled executions
   */
  async getNextExecutions(
    jobId: string,
    count: number = 5,
    context: { userId: string; organizationId: string }
  ) {
    const job = await this.getJob(jobId, context);

    const executions = [];
    let current = new Date();

    for (let i = 0; i < count; i++) {
      let next = this.cronParser.getNextExecution(
        job.cronExpression,
        job.timezone,
        current
      );

      // Apply weekend/holiday skipping
      while (true) {
        const shouldSkip = await this.shouldSkipDate(
          next,
          job.skipWeekends,
          job.skipHolidays,
          job.holidayCalendar
        );

        if (!shouldSkip.skip) break;

        next = this.cronParser.getNextExecution(
          job.cronExpression,
          job.timezone,
          next
        );
      }

      executions.push({
        scheduledAt: next.toISOString(),
        localTime: next.toLocaleString('pl-PL', { timeZone: job.timezone }),
        dayOfWeek: next.toLocaleDateString('pl-PL', { weekday: 'long', timeZone: job.timezone })
      });

      current = next;
    }

    return executions;
  }

  /**
   * Register a trigger with the scheduler
   */
  async registerTrigger(triggerId: string) {
    const trigger = await db.query.workflowTriggers.findFirst({
      where: eq(workflowTriggers.id, triggerId),
      with: { workflow: true }
    });

    if (!trigger || trigger.triggerType !== 'scheduled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy trigger'
      });
    }

    const config = trigger.config as z.infer<typeof scheduleConfigSchema>;

    // Create or update scheduled job
    await db.insert(scheduledJobs)
      .values({
        triggerId: trigger.id,
        workflowId: trigger.workflowId,
        cronExpression: config.cronExpression,
        timezone: config.timezone,
        skipWeekends: config.skipWeekends,
        skipHolidays: config.skipHolidays,
        holidayCalendar: config.holidayCalendar,
        preventOverlap: config.preventOverlap,
        catchUpMissed: config.catchUpMissed,
        priority: config.priority,
        nextRunAt: this.cronParser.getNextExecution(config.cronExpression, config.timezone)
      })
      .onConflictDoUpdate({
        target: scheduledJobs.triggerId,
        set: {
          cronExpression: config.cronExpression,
          timezone: config.timezone,
          skipWeekends: config.skipWeekends,
          skipHolidays: config.skipHolidays,
          holidayCalendar: config.holidayCalendar,
          preventOverlap: config.preventOverlap,
          catchUpMissed: config.catchUpMissed,
          priority: config.priority,
          nextRunAt: this.cronParser.getNextExecution(config.cronExpression, config.timezone),
          updatedAt: new Date()
        }
      });

    return { success: true };
  }

  // Private helper
  private async getJob(
    jobId: string,
    context: { userId: string; organizationId: string }
  ) {
    const job = await db.query.scheduledJobs.findFirst({
      where: eq(scheduledJobs.id, jobId),
      with: {
        workflow: true
      }
    });

    if (!job || job.workflow.organizationId !== context.organizationId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Zaplanowane zadanie nie znalezione'
      });
    }

    return job;
  }
}
```

### tRPC Router

```typescript
// src/server/api/routers/scheduler.router.ts
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { SchedulerService } from '@/server/services/scheduler.service';
import {
  scheduleConfigSchema,
  handleMissedExecutionSchema,
  executionLogQuerySchema,
  visualScheduleInputSchema
} from '@/server/services/scheduler.schemas';
import { z } from 'zod';

const service = new SchedulerService();

export const schedulerRouter = createTRPCRouter({
  // Get scheduled job by ID
  getJob: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return service.getJob(input.jobId, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Get jobs for workflow
  getJobsForWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return service.getJobsForWorkflow(input.workflowId, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Get execution history
  getExecutionHistory: protectedProcedure
    .input(executionLogQuerySchema)
    .query(async ({ input, ctx }) => {
      return service.getExecutionHistory(input.jobId!, {
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        status: input.status,
        limit: input.limit,
        offset: input.offset
      }, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Get next executions
  getNextExecutions: protectedProcedure
    .input(z.object({
      jobId: z.string().uuid(),
      count: z.number().min(1).max(20).default(5)
    }))
    .query(async ({ input, ctx }) => {
      return service.getNextExecutions(input.jobId, input.count, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Check for missed executions
  checkMissedExecutions: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return service.checkMissedExecutions(input.jobId, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Handle missed executions
  handleMissedExecutions: protectedProcedure
    .input(handleMissedExecutionSchema)
    .mutation(async ({ input, ctx }) => {
      return service.handleMissedExecutions(input, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Pause scheduled job
  pauseJob: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return service.setJobActive(input.jobId, false, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Resume scheduled job
  resumeJob: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return service.setJobActive(input.jobId, true, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Convert visual schedule to cron
  visualToCron: protectedProcedure
    .input(visualScheduleInputSchema)
    .query(async ({ input }) => {
      return service.visualToCron(input);
    }),

  // Parse cron expression
  parseCron: protectedProcedure
    .input(z.object({
      cronExpression: z.string(),
      timezone: z.string().default('Europe/Warsaw')
    }))
    .query(async ({ input }) => {
      return service.parseCron(input.cronExpression, input.timezone);
    }),

  // Get Polish holidays
  getHolidays: protectedProcedure
    .input(z.object({ year: z.number().min(2020).max(2030) }))
    .query(async ({ input }) => {
      return service.getPolishHolidays(input.year);
    })
});
```

---

## 🧪 Test Specification

### Unit Tests

```typescript
describe('SchedulerService', () => {
  describe('shouldSkipDate', () => {
    it('should skip weekends when configured', async () => {
      const saturday = new Date('2024-01-06T10:00:00'); // Saturday
      const result = await service.shouldSkipDate(saturday, true, false, 'PL');
      expect(result.skip).toBe(true);
      expect(result.reason).toBe('weekend');
    });

    it('should skip Polish holidays', async () => {
      const christmas = new Date('2024-12-25T10:00:00');
      const result = await service.shouldSkipDate(christmas, false, true, 'PL');
      expect(result.skip).toBe(true);
      expect(result.reason).toContain('Boże Narodzenie');
    });

    it('should not skip regular workday', async () => {
      const monday = new Date('2024-01-08T10:00:00'); // Monday, not holiday
      const result = await service.shouldSkipDate(monday, true, true, 'PL');
      expect(result.skip).toBe(false);
    });
  });

  describe('getNextExecutions', () => {
    it('should return correct next executions', async () => {
      const job = await createTestJob({ cronExpression: '0 9 * * 1-5' }); // 9:00 weekdays

      const result = await service.getNextExecutions(job.id, 5, context);

      expect(result).toHaveLength(5);
      result.forEach(execution => {
        const date = new Date(execution.scheduledAt);
        expect(date.getDay()).toBeGreaterThan(0);
        expect(date.getDay()).toBeLessThan(6);
      });
    });
  });

  describe('handleMissedExecutions', () => {
    it('should run all missed executions when action is run_all', async () => {
      const job = await createTestJob();
      const missed = ['2024-01-01T09:00:00Z', '2024-01-02T09:00:00Z'];

      const result = await service.handleMissedExecutions({
        jobId: job.id,
        missedExecutions: missed,
        action: 'run_all'
      }, context);

      expect(result.processed).toBe(2);
      expect(result.action).toBe('run_all');
    });
  });
});
```

### Integration Tests

```typescript
describe('Scheduler Integration', () => {
  it('should execute workflow on schedule', async () => {
    // Create workflow with scheduled trigger
    const workflow = await createTestWorkflow();
    const trigger = await caller.trigger.create({
      workflowId: workflow.id,
      triggerType: 'scheduled',
      config: {
        cronExpression: '* * * * *', // Every minute
        timezone: 'Europe/Warsaw'
      }
    });

    // Start scheduler
    await scheduler.start();

    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 65000));

    // Check execution log
    const history = await caller.scheduler.getExecutionHistory({
      jobId: trigger.scheduledJobId
    });

    expect(history.logs.length).toBeGreaterThan(0);
    expect(history.logs[0].status).toBe('completed');

    scheduler.stop();
  });
});
```

---

## 🔒 Security Checklist

- [ ] Distributed locking prevents duplicate execution
- [ ] Job ownership verified before operations
- [ ] Cron expressions validated for safety
- [ ] Priority escalation restricted by role
- [ ] Execution history access controlled
- [ ] Missed execution handling logged
- [ ] Holiday data source verified
- [ ] Queue depth limits enforced
- [ ] Resource usage monitored

---

## 📊 Audit Events

```typescript
const AUDIT_EVENTS = {
  'schedule.job_created': 'Utworzono zaplanowane zadanie',
  'schedule.job_updated': 'Zaktualizowano zaplanowane zadanie',
  'schedule.job_paused': 'Wstrzymano zaplanowane zadanie',
  'schedule.job_resumed': 'Wznowiono zaplanowane zadanie',
  'schedule.executed': 'Wykonano zaplanowane zadanie',
  'schedule.skipped': 'Pominięto zaplanowane wykonanie',
  'schedule.failed': 'Błąd zaplanowanego wykonania',
  'schedule.missed_handled': 'Obsłużono pominięte wykonania'
};
```

---

*Story created: December 2024*
