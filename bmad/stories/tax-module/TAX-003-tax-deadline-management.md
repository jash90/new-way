# TAX-003: Tax Deadline Management

> **Story ID**: TAX-003
> **Epic**: [TAX - Tax Compliance Module](./epic.md)
> **Priority**: P0 (Critical)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 4, Week 13

---

## User Story

**As an** accountant managing multiple clients,
**I want** automatic tracking of tax deadlines with configurable reminders,
**So that** no filing dates are missed and clients remain compliant with Polish tax regulations.

---

## Acceptance Criteria

### AC1: Tax Deadline Calendar

```gherkin
Feature: Tax Deadline Calendar
  As an accountant
  I need a comprehensive calendar of tax deadlines
  So that I can plan my work and ensure timely filings

  Background:
    Given I am logged in as an accountant
    And I have clients with tax configurations

  Scenario: View monthly tax deadlines
    Given the current month is "January 2025"
    When I open the tax deadline calendar
    Then I should see the following deadlines:
      | Date       | Type      | Description                    |
      | 2025-01-07 | VAT       | VAT advance payment (quarterly)|
      | 2025-01-15 | ZUS       | ZUS DRA submission (employees) |
      | 2025-01-20 | ZUS       | ZUS DRA submission (company)   |
      | 2025-01-20 | PIT       | PIT advance payment            |
      | 2025-01-20 | CIT       | CIT advance payment            |
      | 2025-01-25 | VAT       | JPK_V7M submission             |
    And deadlines should be color-coded by urgency

  Scenario: Filter deadlines by client
    Given I have 10 clients with various tax obligations
    When I filter deadlines by client "ABC Sp. z o.o."
    Then I should see only deadlines applicable to that client
    And the count should reflect client-specific obligations

  Scenario: Filter deadlines by tax type
    When I filter deadlines by tax type "VAT"
    Then I should see only VAT-related deadlines
    And CIT, PIT, and ZUS deadlines should be hidden

  Scenario: View deadline details
    When I click on deadline "JPK_V7M submission"
    Then I should see:
      | Field          | Value                              |
      | Type           | JPK_V7M                            |
      | Legal basis    | Art. 99 ust. 1 ustawy o VAT       |
      | Penalty        | 500 PLN/day late                   |
      | Clients        | List of applicable clients         |
      | Status         | Pending/Submitted/Overdue          |
```

### AC2: Holiday and Weekend Adjustments

```gherkin
Feature: Holiday and Weekend Deadline Adjustments
  As an accountant
  I need deadlines to automatically adjust for holidays
  So that I know the actual filing dates

  Scenario: Deadline falls on Saturday
    Given the standard deadline is "2025-03-15" (Saturday)
    When the system calculates the actual deadline
    Then the deadline should be adjusted to "2025-03-17" (Monday)
    And the adjustment reason should be displayed

  Scenario: Deadline falls on Sunday
    Given the standard deadline is "2025-06-15" (Sunday)
    When the system calculates the actual deadline
    Then the deadline should be adjusted to "2025-06-16" (Monday)

  Scenario: Deadline falls on Polish national holiday
    Given the standard deadline is "2025-11-11" (Independence Day)
    And "2025-11-11" is a Tuesday
    When the system calculates the actual deadline
    Then the deadline should be adjusted to "2025-11-12" (Wednesday)
    And the holiday name "Święto Niepodległości" should be shown

  Scenario: Multiple consecutive non-working days
    Given the standard deadline is "2025-12-25" (Christmas Thursday)
    And "2025-12-26" is also a holiday (Boxing Day Friday)
    When the system calculates the actual deadline
    Then the deadline should be adjusted to "2025-12-29" (Monday)

  Scenario: Polish holidays calendar
    When I view the Polish holidays for 2025
    Then the system should include:
      | Date       | Holiday                              |
      | 2025-01-01 | Nowy Rok                             |
      | 2025-01-06 | Święto Trzech Króli                  |
      | 2025-04-20 | Wielkanoc                            |
      | 2025-04-21 | Poniedziałek Wielkanocny             |
      | 2025-05-01 | Święto Pracy                         |
      | 2025-05-03 | Święto Konstytucji 3 Maja            |
      | 2025-06-08 | Zielone Świątki                      |
      | 2025-06-19 | Boże Ciało                           |
      | 2025-08-15 | Wniebowzięcie NMP                    |
      | 2025-11-01 | Wszystkich Świętych                  |
      | 2025-11-11 | Święto Niepodległości                |
      | 2025-12-25 | Boże Narodzenie                      |
      | 2025-12-26 | Drugi dzień Bożego Narodzenia        |
```

### AC3: Configurable Reminder System

```gherkin
Feature: Tax Deadline Reminders
  As an accountant
  I need configurable reminders for upcoming deadlines
  So that I have sufficient time to prepare filings

  Background:
    Given I am logged in as an accountant
    And I have notification preferences configured

  Scenario: Configure reminder days
    When I configure reminder settings
    Then I should be able to set:
      | Reminder Level | Default Days | Description          |
      | Early          | 14           | Planning reminder    |
      | Standard       | 7            | Preparation reminder |
      | Urgent         | 3            | Final reminder       |
      | Critical       | 1            | Day before deadline  |
    And I can customize days per deadline type

  Scenario: Email notification
    Given I have email notifications enabled
    And there is a deadline in 7 days
    When the notification scheduler runs
    Then I should receive an email with:
      | Field    | Value                                      |
      | Subject  | [Reminder] JPK_V7M due in 7 days          |
      | Body     | List of clients requiring submission       |
      | Action   | Link to prepare filing                     |

  Scenario: SMS notification for critical deadlines
    Given I have SMS notifications enabled for critical reminders
    And there is a deadline tomorrow
    When the notification scheduler runs
    Then I should receive an SMS with deadline summary
    And the message should not exceed 160 characters

  Scenario: In-app notification
    Given I am logged into the system
    And there are upcoming deadlines within my reminder window
    Then I should see a notification badge
    And clicking it should show a list of upcoming deadlines

  Scenario: Bulk notification for multiple clients
    Given I have 15 clients with JPK_V7M due on the same date
    When the reminder is triggered
    Then I should receive one consolidated notification
    And it should list all 15 clients
    And include a link to bulk submission

  Scenario: Snooze notification
    Given I received a deadline reminder
    When I snooze the reminder for 2 days
    Then I should not receive another reminder for 2 days
    And the reminder should resume after snooze period
```

### AC4: Per-Client Deadline Tracking

```gherkin
Feature: Per-Client Deadline Tracking
  As an accountant
  I need to track deadline status for each client
  So that I can manage compliance efficiently

  Scenario: View client deadline status
    Given client "ABC Sp. z o.o." has the following deadlines
    When I view the client's tax dashboard
    Then I should see deadline statuses:
      | Deadline   | Due Date   | Status     | Action          |
      | JPK_V7M    | 2025-01-25 | Pending    | Prepare         |
      | ZUS DRA    | 2025-01-20 | Submitted  | View UPO        |
      | CIT advance| 2025-01-20 | Overdue    | Submit urgently |

  Scenario: Mark deadline as submitted
    Given there is a pending JPK_V7M deadline
    When I mark the deadline as submitted
    Then the status should change to "Submitted"
    And I should be prompted to enter UPO number
    And the submission timestamp should be recorded

  Scenario: Automatic status update from e-Declaration
    Given JPK_V7M was submitted through e-Declaration
    When the system receives UPO confirmation
    Then the deadline status should automatically update to "Confirmed"
    And the UPO number should be stored

  Scenario: Overdue deadline handling
    Given the deadline date has passed
    And the filing was not submitted
    When I view the deadline
    Then the status should be "Overdue"
    And days overdue should be displayed
    And potential penalty should be calculated

  Scenario: Exemption from deadline
    Given client "Nowa Firma" is exempt from monthly VAT
    When the system generates deadlines
    Then monthly JPK_V7M should not be generated for this client
    And only quarterly JPK_V7K should appear
```

### AC5: Deadline Generation Rules

```gherkin
Feature: Deadline Generation Rules
  As an accountant
  I need the system to generate correct deadlines
  Based on each client's tax configuration

  Scenario: Monthly VAT payer deadlines
    Given client has VAT period "MONTHLY"
    When the system generates deadlines for January 2025
    Then JPK_V7M deadline should be 2025-01-25
    And VAT payment deadline should be 2025-01-25

  Scenario: Quarterly VAT payer deadlines
    Given client has VAT period "QUARTERLY"
    And client is in Q4 2024
    When the system generates deadlines for January 2025
    Then JPK_V7K deadline should be 2025-01-25
    And no monthly JPK deadline should be generated

  Scenario: CIT advance payment deadlines
    Given client is a CIT payer
    And uses monthly advance payment method
    When the system generates deadlines
    Then CIT advance deadline should be 20th of each month

  Scenario: ZUS deadlines based on company type
    Given client has employees
    When the system generates ZUS deadlines
    Then DRA deadline should be 15th of each month
    And RCA and RSA deadlines should be included

  Scenario: ZUS deadlines for self-employed
    Given client is self-employed (jednoosobowa działalność)
    When the system generates ZUS deadlines
    Then DRA deadline should be 20th of each month

  Scenario: Annual declaration deadlines
    Given client is a CIT payer
    And fiscal year is calendar year
    When the system generates annual deadlines
    Then CIT-8 deadline should be end of March
    And deadline should appear in Q1 calendar
```

---

## Technical Specification

### Database Schema

```sql
-- Tax deadlines reference table
CREATE TABLE tax_deadline_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    name_pl VARCHAR(200) NOT NULL,
    tax_type VARCHAR(20) NOT NULL CHECK (tax_type IN ('VAT', 'CIT', 'PIT', 'ZUS', 'OTHER')),
    description TEXT,
    legal_basis TEXT,
    penalty_description TEXT,
    penalty_daily_rate DECIMAL(10, 2),
    base_day INTEGER NOT NULL CHECK (base_day BETWEEN 1 AND 31),
    applies_to_monthly BOOLEAN DEFAULT false,
    applies_to_quarterly BOOLEAN DEFAULT false,
    applies_to_annual BOOLEAN DEFAULT false,
    requires_employees BOOLEAN DEFAULT false,
    requires_vat_payer BOOLEAN DEFAULT false,
    requires_cit_payer BOOLEAN DEFAULT false,
    requires_pit_payer BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Polish holidays table
CREATE TABLE polish_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    name VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    is_moveable BOOLEAN DEFAULT false,
    year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (date)
);

-- Client-specific deadlines
CREATE TABLE client_tax_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    deadline_type_id UUID NOT NULL REFERENCES tax_deadline_types(id),
    period_year INTEGER NOT NULL,
    period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
    period_quarter INTEGER CHECK (period_quarter BETWEEN 1 AND 4),
    base_deadline_date DATE NOT NULL,
    adjusted_deadline_date DATE NOT NULL,
    adjustment_reason VARCHAR(200),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'OVERDUE', 'EXEMPT', 'CANCELLED'
    )),
    submission_date TIMESTAMPTZ,
    confirmation_number VARCHAR(100),
    confirmation_date TIMESTAMPTZ,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (client_id, deadline_type_id, period_year, period_month)
);

-- Deadline reminder configuration
CREATE TABLE deadline_reminder_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    deadline_type_id UUID REFERENCES tax_deadline_types(id),
    reminder_level VARCHAR(20) NOT NULL CHECK (reminder_level IN (
        'EARLY', 'STANDARD', 'URGENT', 'CRITICAL'
    )),
    days_before INTEGER NOT NULL CHECK (days_before > 0 AND days_before <= 90),
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    in_app_enabled BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, user_id, deadline_type_id, reminder_level)
);

-- Sent reminders log
CREATE TABLE deadline_reminders_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    deadline_id UUID NOT NULL REFERENCES client_tax_deadlines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    reminder_level VARCHAR(20) NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'IN_APP', 'PUSH')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    message_id VARCHAR(200),
    status VARCHAR(20) DEFAULT 'SENT' CHECK (status IN (
        'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SNOOZED'
    )),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_client_deadlines_org ON client_tax_deadlines(organization_id);
CREATE INDEX idx_client_deadlines_client ON client_tax_deadlines(client_id);
CREATE INDEX idx_client_deadlines_date ON client_tax_deadlines(adjusted_deadline_date);
CREATE INDEX idx_client_deadlines_status ON client_tax_deadlines(status);
CREATE INDEX idx_client_deadlines_period ON client_tax_deadlines(period_year, period_month);
CREATE INDEX idx_holidays_date ON polish_holidays(date);
CREATE INDEX idx_holidays_year ON polish_holidays(year);
CREATE INDEX idx_reminders_sent_deadline ON deadline_reminders_sent(deadline_id);
CREATE INDEX idx_reminders_sent_user ON deadline_reminders_sent(user_id);

-- RLS Policies
ALTER TABLE client_tax_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_reminder_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_deadlines_org_isolation ON client_tax_deadlines
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY reminder_configs_org_isolation ON deadline_reminder_configs
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY reminders_sent_org_isolation ON deadline_reminders_sent
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### Seed Data

```sql
-- Tax deadline types
INSERT INTO tax_deadline_types (code, name, name_pl, tax_type, base_day, legal_basis, penalty_daily_rate, applies_to_monthly, applies_to_quarterly, requires_vat_payer) VALUES
('JPK_V7M', 'Monthly VAT Declaration', 'Jednolity Plik Kontrolny VAT miesięczny', 'VAT', 25, 'Art. 99 ust. 1 ustawy o VAT', 500.00, true, false, true),
('JPK_V7K', 'Quarterly VAT Declaration', 'Jednolity Plik Kontrolny VAT kwartalny', 'VAT', 25, 'Art. 99 ust. 3 ustawy o VAT', 500.00, false, true, true),
('VAT_PAYMENT', 'VAT Payment', 'Wpłata VAT', 'VAT', 25, 'Art. 103 ust. 1 ustawy o VAT', NULL, true, true, true),
('CIT_ADVANCE', 'CIT Advance Payment', 'Zaliczka na CIT', 'CIT', 20, 'Art. 25 ust. 1 ustawy o CIT', NULL, true, false, false),
('PIT_ADVANCE', 'PIT Advance Payment', 'Zaliczka na PIT', 'PIT', 20, 'Art. 44 ust. 6 ustawy o PIT', NULL, true, false, false),
('ZUS_DRA_EMP', 'ZUS Declaration (employers)', 'Deklaracja ZUS DRA (pracodawcy)', 'ZUS', 15, 'Art. 47 ust. 1 pkt 1 ustawy o SUS', NULL, true, false, false),
('ZUS_DRA_SELF', 'ZUS Declaration (self-employed)', 'Deklaracja ZUS DRA (samozatrudnieni)', 'ZUS', 20, 'Art. 47 ust. 1 pkt 2 ustawy o SUS', NULL, true, false, false),
('CIT_8', 'Annual CIT Declaration', 'Roczna deklaracja CIT-8', 'CIT', 31, 'Art. 27 ust. 1 ustawy o CIT', NULL, false, false, false),
('PIT_36', 'Annual PIT Declaration', 'Roczna deklaracja PIT-36', 'PIT', 30, 'Art. 45 ust. 1 ustawy o PIT', NULL, false, false, false);

-- Polish holidays 2025
INSERT INTO polish_holidays (date, name, name_en, is_moveable) VALUES
('2025-01-01', 'Nowy Rok', 'New Year', false),
('2025-01-06', 'Święto Trzech Króli', 'Epiphany', false),
('2025-04-20', 'Wielkanoc', 'Easter Sunday', true),
('2025-04-21', 'Poniedziałek Wielkanocny', 'Easter Monday', true),
('2025-05-01', 'Święto Pracy', 'Labour Day', false),
('2025-05-03', 'Święto Konstytucji 3 Maja', 'Constitution Day', false),
('2025-06-08', 'Zielone Świątki', 'Pentecost', true),
('2025-06-19', 'Boże Ciało', 'Corpus Christi', true),
('2025-08-15', 'Wniebowzięcie Najświętszej Maryi Panny', 'Assumption of Mary', false),
('2025-11-01', 'Wszystkich Świętych', 'All Saints Day', false),
('2025-11-11', 'Święto Niepodległości', 'Independence Day', false),
('2025-12-25', 'Boże Narodzenie', 'Christmas Day', false),
('2025-12-26', 'Drugi dzień Bożego Narodzenia', 'St. Stephen Day', false);
```

### API Endpoints (tRPC)

```typescript
// src/server/api/routers/tax-deadlines.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

// Input schemas
const deadlineFilterSchema = z.object({
  clientId: z.string().uuid().optional(),
  taxType: z.enum(['VAT', 'CIT', 'PIT', 'ZUS', 'OTHER']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'OVERDUE', 'EXEMPT']).optional(),
  startDate: z.date(),
  endDate: z.date(),
});

const reminderConfigSchema = z.object({
  deadlineTypeId: z.string().uuid().optional(),
  reminderLevel: z.enum(['EARLY', 'STANDARD', 'URGENT', 'CRITICAL']),
  daysBefore: z.number().min(1).max(90),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  inAppEnabled: z.boolean().default(true),
});

const updateDeadlineStatusSchema = z.object({
  deadlineId: z.string().uuid(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'EXEMPT', 'CANCELLED']),
  confirmationNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const snoozeReminderSchema = z.object({
  reminderId: z.string().uuid(),
  snoozeUntil: z.date(),
});

export const taxDeadlinesRouter = createTRPCRouter({
  // Get deadlines with filters
  getDeadlines: protectedProcedure
    .input(deadlineFilterSchema)
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;

      const deadlines = await db.query.clientTaxDeadlines.findMany({
        where: and(
          eq(clientTaxDeadlines.organizationId, session.organizationId),
          gte(clientTaxDeadlines.adjustedDeadlineDate, input.startDate),
          lte(clientTaxDeadlines.adjustedDeadlineDate, input.endDate),
          input.clientId ? eq(clientTaxDeadlines.clientId, input.clientId) : undefined,
          input.status ? eq(clientTaxDeadlines.status, input.status) : undefined,
        ),
        with: {
          client: true,
          deadlineType: true,
        },
        orderBy: [asc(clientTaxDeadlines.adjustedDeadlineDate)],
      });

      // Filter by tax type if specified
      if (input.taxType) {
        return deadlines.filter(d => d.deadlineType.taxType === input.taxType);
      }

      return deadlines;
    }),

  // Get calendar view
  getCalendar: protectedProcedure
    .input(z.object({
      year: z.number().min(2020).max(2100),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;

      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0);

      const [deadlines, holidays] = await Promise.all([
        db.query.clientTaxDeadlines.findMany({
          where: and(
            eq(clientTaxDeadlines.organizationId, session.organizationId),
            gte(clientTaxDeadlines.adjustedDeadlineDate, startDate),
            lte(clientTaxDeadlines.adjustedDeadlineDate, endDate),
          ),
          with: {
            client: true,
            deadlineType: true,
          },
        }),
        db.query.polishHolidays.findMany({
          where: and(
            gte(polishHolidays.date, startDate),
            lte(polishHolidays.date, endDate),
          ),
        }),
      ]);

      return {
        deadlines,
        holidays,
        summary: {
          total: deadlines.length,
          pending: deadlines.filter(d => d.status === 'PENDING').length,
          overdue: deadlines.filter(d => d.status === 'OVERDUE').length,
          submitted: deadlines.filter(d => d.status === 'SUBMITTED' || d.status === 'CONFIRMED').length,
        },
      };
    }),

  // Update deadline status
  updateStatus: protectedProcedure
    .input(updateDeadlineStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      const deadline = await db.query.clientTaxDeadlines.findFirst({
        where: and(
          eq(clientTaxDeadlines.id, input.deadlineId),
          eq(clientTaxDeadlines.organizationId, session.organizationId),
        ),
      });

      if (!deadline) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deadline not found' });
      }

      const updateData: Partial<typeof clientTaxDeadlines.$inferInsert> = {
        status: input.status,
        updatedBy: session.userId,
        updatedAt: new Date(),
      };

      if (input.status === 'SUBMITTED' || input.status === 'CONFIRMED') {
        updateData.submissionDate = new Date();
        if (input.confirmationNumber) {
          updateData.confirmationNumber = input.confirmationNumber;
          updateData.confirmationDate = new Date();
        }
      }

      if (input.notes) {
        updateData.notes = input.notes;
      }

      await db.update(clientTaxDeadlines)
        .set(updateData)
        .where(eq(clientTaxDeadlines.id, input.deadlineId));

      // Log audit event
      await ctx.auditLog.log({
        action: 'TAX_DEADLINE_STATUS_UPDATED',
        entityType: 'tax_deadline',
        entityId: input.deadlineId,
        details: {
          previousStatus: deadline.status,
          newStatus: input.status,
          confirmationNumber: input.confirmationNumber,
        },
      });

      return { success: true };
    }),

  // Generate deadlines for client
  generateDeadlines: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      year: z.number().min(2020).max(2100),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      // Get client's tax configuration
      const taxConfig = await db.query.taxConfigurations.findFirst({
        where: and(
          eq(taxConfigurations.clientId, input.clientId),
          eq(taxConfigurations.isActive, true),
        ),
      });

      if (!taxConfig) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Client has no active tax configuration'
        });
      }

      // Get applicable deadline types
      const deadlineTypes = await db.query.taxDeadlineTypes.findMany({
        where: eq(taxDeadlineTypes.isActive, true),
      });

      const generatedDeadlines: string[] = [];

      for (const deadlineType of deadlineTypes) {
        // Check if deadline applies to this client
        if (!isDeadlineApplicable(deadlineType, taxConfig)) {
          continue;
        }

        // Generate monthly or quarterly deadlines
        if (deadlineType.appliesToMonthly) {
          for (let month = 1; month <= 12; month++) {
            const deadline = await generateMonthlyDeadline(
              db, session, input.clientId, deadlineType, input.year, month
            );
            if (deadline) generatedDeadlines.push(deadline.id);
          }
        }

        if (deadlineType.appliesToQuarterly) {
          for (let quarter = 1; quarter <= 4; quarter++) {
            const deadline = await generateQuarterlyDeadline(
              db, session, input.clientId, deadlineType, input.year, quarter
            );
            if (deadline) generatedDeadlines.push(deadline.id);
          }
        }
      }

      return {
        generated: generatedDeadlines.length,
        deadlineIds: generatedDeadlines,
      };
    }),

  // Configure reminders
  configureReminders: protectedProcedure
    .input(reminderConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      await db.insert(deadlineReminderConfigs)
        .values({
          organizationId: session.organizationId,
          userId: session.userId,
          deadlineTypeId: input.deadlineTypeId,
          reminderLevel: input.reminderLevel,
          daysBefore: input.daysBefore,
          emailEnabled: input.emailEnabled,
          smsEnabled: input.smsEnabled,
          inAppEnabled: input.inAppEnabled,
        })
        .onConflictDoUpdate({
          target: [
            deadlineReminderConfigs.organizationId,
            deadlineReminderConfigs.userId,
            deadlineReminderConfigs.deadlineTypeId,
            deadlineReminderConfigs.reminderLevel,
          ],
          set: {
            daysBefore: input.daysBefore,
            emailEnabled: input.emailEnabled,
            smsEnabled: input.smsEnabled,
            inAppEnabled: input.inAppEnabled,
            updatedAt: new Date(),
          },
        });

      return { success: true };
    }),

  // Snooze reminder
  snoozeReminder: protectedProcedure
    .input(snoozeReminderSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      await db.update(deadlineRemindersSent)
        .set({
          status: 'SNOOZED',
          snoozedUntil: input.snoozeUntil,
        })
        .where(and(
          eq(deadlineRemindersSent.id, input.reminderId),
          eq(deadlineRemindersSent.userId, session.userId),
        ));

      return { success: true };
    }),

  // Get Polish holidays
  getHolidays: protectedProcedure
    .input(z.object({
      year: z.number().min(2020).max(2100),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.polishHolidays.findMany({
        where: eq(polishHolidays.year, input.year),
        orderBy: [asc(polishHolidays.date)],
      });
    }),
});
```

### Deadline Service Implementation

```typescript
// src/server/services/deadline.service.ts
import { addDays, isWeekend, format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface DeadlineType {
  id: string;
  code: string;
  baseDay: number;
  appliesToMonthly: boolean;
  appliesToQuarterly: boolean;
  requiresVatPayer: boolean;
  requiresCitPayer: boolean;
  requiresEmployees: boolean;
}

interface TaxConfiguration {
  vatPayerStatus: string;
  vatPeriod: string;
  citPayerStatus: string;
  pitPayerStatus: string;
  hasEmployees: boolean;
}

export class DeadlineService {
  constructor(private db: Database) {}

  /**
   * Check if a deadline type applies to a client based on their tax configuration
   */
  isDeadlineApplicable(deadlineType: DeadlineType, taxConfig: TaxConfiguration): boolean {
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
   * Calculate the adjusted deadline date considering holidays and weekends
   */
  async calculateAdjustedDeadline(
    baseDate: Date,
    year: number
  ): Promise<{ adjustedDate: Date; reason: string | null }> {
    // Get holidays for the year
    const holidays = await this.db.query.polishHolidays.findMany({
      where: eq(polishHolidays.year, year),
    });
    const holidayDates = new Set(holidays.map(h => format(h.date, 'yyyy-MM-dd')));

    let adjustedDate = baseDate;
    let reason: string | null = null;

    // Check if date is a weekend or holiday and adjust
    while (isWeekend(adjustedDate) || holidayDates.has(format(adjustedDate, 'yyyy-MM-dd'))) {
      if (isWeekend(adjustedDate)) {
        const dayName = format(adjustedDate, 'EEEE', { locale: pl });
        reason = `Przesunięto z ${dayName}`;
      } else {
        const holiday = holidays.find(
          h => format(h.date, 'yyyy-MM-dd') === format(adjustedDate, 'yyyy-MM-dd')
        );
        reason = `Przesunięto z powodu święta: ${holiday?.name}`;
      }
      adjustedDate = addDays(adjustedDate, 1);
    }

    return { adjustedDate, reason };
  }

  /**
   * Generate a monthly deadline
   */
  async generateMonthlyDeadline(
    clientId: string,
    deadlineType: DeadlineType,
    year: number,
    month: number,
    organizationId: string,
    userId: string
  ): Promise<{ id: string } | null> {
    // Check if deadline already exists
    const existing = await this.db.query.clientTaxDeadlines.findFirst({
      where: and(
        eq(clientTaxDeadlines.clientId, clientId),
        eq(clientTaxDeadlines.deadlineTypeId, deadlineType.id),
        eq(clientTaxDeadlines.periodYear, year),
        eq(clientTaxDeadlines.periodMonth, month),
      ),
    });

    if (existing) {
      return null; // Already exists
    }

    // Calculate base deadline date
    // For most tax deadlines, the period refers to the previous month
    const deadlineMonth = month === 12 ? 1 : month + 1;
    const deadlineYear = month === 12 ? year + 1 : year;

    const baseDate = new Date(deadlineYear, deadlineMonth - 1, deadlineType.baseDay);
    const { adjustedDate, reason } = await this.calculateAdjustedDeadline(baseDate, deadlineYear);

    const [result] = await this.db.insert(clientTaxDeadlines)
      .values({
        organizationId,
        clientId,
        deadlineTypeId: deadlineType.id,
        periodYear: year,
        periodMonth: month,
        baseDeadlineDate: baseDate,
        adjustedDeadlineDate: adjustedDate,
        adjustmentReason: reason,
        status: 'PENDING',
        createdBy: userId,
      })
      .returning({ id: clientTaxDeadlines.id });

    return result;
  }

  /**
   * Generate a quarterly deadline
   */
  async generateQuarterlyDeadline(
    clientId: string,
    deadlineType: DeadlineType,
    year: number,
    quarter: number,
    organizationId: string,
    userId: string
  ): Promise<{ id: string } | null> {
    // Check if deadline already exists
    const existing = await this.db.query.clientTaxDeadlines.findFirst({
      where: and(
        eq(clientTaxDeadlines.clientId, clientId),
        eq(clientTaxDeadlines.deadlineTypeId, deadlineType.id),
        eq(clientTaxDeadlines.periodYear, year),
        eq(clientTaxDeadlines.periodQuarter, quarter),
      ),
    });

    if (existing) {
      return null;
    }

    // Calculate deadline date (25th of month after quarter end)
    const quarterEndMonth = quarter * 3;
    const deadlineMonth = quarterEndMonth === 12 ? 1 : quarterEndMonth + 1;
    const deadlineYear = quarterEndMonth === 12 ? year + 1 : year;

    const baseDate = new Date(deadlineYear, deadlineMonth - 1, deadlineType.baseDay);
    const { adjustedDate, reason } = await this.calculateAdjustedDeadline(baseDate, deadlineYear);

    const [result] = await this.db.insert(clientTaxDeadlines)
      .values({
        organizationId,
        clientId,
        deadlineTypeId: deadlineType.id,
        periodYear: year,
        periodQuarter: quarter,
        baseDeadlineDate: baseDate,
        adjustedDeadlineDate: adjustedDate,
        adjustmentReason: reason,
        status: 'PENDING',
        createdBy: userId,
      })
      .returning({ id: clientTaxDeadlines.id });

    return result;
  }

  /**
   * Check and update overdue deadlines
   */
  async updateOverdueDeadlines(organizationId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.db.update(clientTaxDeadlines)
      .set({ status: 'OVERDUE', updatedAt: new Date() })
      .where(and(
        eq(clientTaxDeadlines.organizationId, organizationId),
        eq(clientTaxDeadlines.status, 'PENDING'),
        lt(clientTaxDeadlines.adjustedDeadlineDate, today),
      ))
      .returning({ id: clientTaxDeadlines.id });

    return result.length;
  }
}
```

### Notification Service

```typescript
// src/server/services/deadline-notification.service.ts
import { subDays } from 'date-fns';

interface ReminderConfig {
  reminderLevel: string;
  daysBefore: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

export class DeadlineNotificationService {
  constructor(
    private db: Database,
    private emailService: EmailService,
    private smsService: SMSService,
    private pushService: PushNotificationService
  ) {}

  /**
   * Process pending reminders for all organizations
   */
  async processReminders(): Promise<{
    emailsSent: number;
    smsSent: number;
    inAppSent: number;
  }> {
    const stats = { emailsSent: 0, smsSent: 0, inAppSent: 0 };

    // Get all active reminder configurations
    const configs = await this.db.query.deadlineReminderConfigs.findMany({
      where: eq(deadlineReminderConfigs.isActive, true),
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const config of configs) {
      const targetDate = subDays(today, -config.daysBefore); // future date

      // Find deadlines due on the target date
      const deadlines = await this.findDeadlinesForReminder(
        config.organizationId,
        targetDate,
        config.deadlineTypeId
      );

      for (const deadline of deadlines) {
        // Check if reminder was already sent
        const alreadySent = await this.wasReminderSent(
          deadline.id,
          config.userId,
          config.reminderLevel
        );

        if (alreadySent) continue;

        // Send notifications based on config
        if (config.emailEnabled) {
          await this.sendEmailReminder(deadline, config);
          stats.emailsSent++;
        }

        if (config.smsEnabled) {
          await this.sendSMSReminder(deadline, config);
          stats.smsSent++;
        }

        if (config.inAppEnabled) {
          await this.sendInAppReminder(deadline, config);
          stats.inAppSent++;
        }
      }
    }

    return stats;
  }

  /**
   * Send email reminder
   */
  private async sendEmailReminder(
    deadline: ClientTaxDeadline,
    config: ReminderConfig
  ): Promise<void> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, config.userId),
    });

    if (!user?.email) return;

    const subject = this.getEmailSubject(deadline, config);
    const body = this.getEmailBody(deadline, config);

    const messageId = await this.emailService.send({
      to: user.email,
      subject,
      html: body,
    });

    await this.logReminderSent(deadline.id, config, 'EMAIL', messageId);
  }

  /**
   * Send SMS reminder (critical deadlines only)
   */
  private async sendSMSReminder(
    deadline: ClientTaxDeadline,
    config: ReminderConfig
  ): Promise<void> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, config.userId),
    });

    if (!user?.phoneNumber) return;

    // SMS should be concise (max 160 chars)
    const message = `Termin ${deadline.deadlineType.code} ${deadline.client.name} - ${format(deadline.adjustedDeadlineDate, 'dd.MM')}`;

    const messageId = await this.smsService.send({
      to: user.phoneNumber,
      message: message.substring(0, 160),
    });

    await this.logReminderSent(deadline.id, config, 'SMS', messageId);
  }

  /**
   * Send in-app notification
   */
  private async sendInAppReminder(
    deadline: ClientTaxDeadline,
    config: ReminderConfig
  ): Promise<void> {
    const notification = {
      userId: config.userId,
      type: 'TAX_DEADLINE_REMINDER',
      title: `Termin: ${deadline.deadlineType.namePl}`,
      message: `${deadline.client.name} - do ${format(deadline.adjustedDeadlineDate, 'dd.MM.yyyy')}`,
      data: {
        deadlineId: deadline.id,
        clientId: deadline.clientId,
        deadlineType: deadline.deadlineType.code,
      },
      priority: this.mapReminderLevelToPriority(config.reminderLevel),
    };

    await this.pushService.send(notification);
    await this.logReminderSent(deadline.id, config, 'IN_APP', null);
  }

  /**
   * Generate consolidated reminder for multiple clients
   */
  async sendConsolidatedReminder(
    userId: string,
    deadlineTypeCode: string,
    deadlines: ClientTaxDeadline[]
  ): Promise<void> {
    if (deadlines.length === 0) return;

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.email) return;

    const subject = `[Reminder] ${deadlineTypeCode} - ${deadlines.length} klientów do ${format(deadlines[0].adjustedDeadlineDate, 'dd.MM.yyyy')}`;

    const clientList = deadlines
      .map(d => `• ${d.client.name} (NIP: ${d.client.nip})`)
      .join('\n');

    const body = `
      <h2>Zbliżający się termin: ${deadlines[0].deadlineType.namePl}</h2>
      <p>Data: <strong>${format(deadlines[0].adjustedDeadlineDate, 'dd MMMM yyyy', { locale: pl })}</strong></p>
      <p>Liczba klientów: ${deadlines.length}</p>
      <h3>Lista klientów:</h3>
      <pre>${clientList}</pre>
      <p><a href="${process.env.APP_URL}/tax/deadlines?type=${deadlineTypeCode}">Przejdź do złożenia deklaracji</a></p>
    `;

    await this.emailService.send({
      to: user.email,
      subject,
      html: body,
    });
  }

  private getEmailSubject(deadline: ClientTaxDeadline, config: ReminderConfig): string {
    const prefix = config.reminderLevel === 'CRITICAL' ? '🚨 PILNE: ' : '';
    return `${prefix}[Reminder] ${deadline.deadlineType.code} - ${deadline.client.name} za ${config.daysBefore} dni`;
  }

  private mapReminderLevelToPriority(level: string): 'low' | 'medium' | 'high' | 'urgent' {
    switch (level) {
      case 'EARLY': return 'low';
      case 'STANDARD': return 'medium';
      case 'URGENT': return 'high';
      case 'CRITICAL': return 'urgent';
      default: return 'medium';
    }
  }

  private async logReminderSent(
    deadlineId: string,
    config: ReminderConfig,
    channel: string,
    messageId: string | null
  ): Promise<void> {
    await this.db.insert(deadlineRemindersSent).values({
      organizationId: config.organizationId,
      deadlineId,
      userId: config.userId,
      reminderLevel: config.reminderLevel,
      channel,
      messageId,
      status: 'SENT',
    });
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/server/services/__tests__/deadline.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeadlineService } from '../deadline.service';

describe('DeadlineService', () => {
  let service: DeadlineService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: {
        polishHolidays: {
          findMany: vi.fn(),
        },
        clientTaxDeadlines: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    };
    service = new DeadlineService(mockDb);
  });

  describe('isDeadlineApplicable', () => {
    it('should return false for JPK_V7M if client is quarterly VAT payer', () => {
      const deadlineType = {
        code: 'JPK_V7M',
        requiresVatPayer: true,
      };
      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'QUARTERLY',
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(false);
    });

    it('should return true for JPK_V7M if client is monthly VAT payer', () => {
      const deadlineType = {
        code: 'JPK_V7M',
        requiresVatPayer: true,
      };
      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'MONTHLY',
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(true);
    });

    it('should return false for ZUS employer deadline if client has no employees', () => {
      const deadlineType = {
        code: 'ZUS_DRA_EMP',
        requiresEmployees: true,
      };
      const taxConfig = {
        hasEmployees: false,
      };

      const result = service.isDeadlineApplicable(deadlineType, taxConfig);
      expect(result).toBe(false);
    });
  });

  describe('calculateAdjustedDeadline', () => {
    it('should adjust Saturday deadline to Monday', async () => {
      mockDb.query.polishHolidays.findMany.mockResolvedValue([]);

      // March 15, 2025 is Saturday
      const baseDate = new Date(2025, 2, 15);

      const { adjustedDate, reason } = await service.calculateAdjustedDeadline(baseDate, 2025);

      expect(adjustedDate.getDate()).toBe(17); // Monday
      expect(reason).toContain('sobota');
    });

    it('should adjust Polish holiday to next working day', async () => {
      mockDb.query.polishHolidays.findMany.mockResolvedValue([
        { date: new Date(2025, 10, 11), name: 'Święto Niepodległości' },
      ]);

      // November 11, 2025 is Tuesday (Independence Day)
      const baseDate = new Date(2025, 10, 11);

      const { adjustedDate, reason } = await service.calculateAdjustedDeadline(baseDate, 2025);

      expect(adjustedDate.getDate()).toBe(12); // Wednesday
      expect(reason).toContain('Święto Niepodległości');
    });

    it('should handle consecutive non-working days', async () => {
      mockDb.query.polishHolidays.findMany.mockResolvedValue([
        { date: new Date(2025, 11, 25), name: 'Boże Narodzenie' },
        { date: new Date(2025, 11, 26), name: 'Drugi dzień Bożego Narodzenia' },
      ]);

      // December 25, 2025 is Thursday (Christmas)
      const baseDate = new Date(2025, 11, 25);

      const { adjustedDate, reason } = await service.calculateAdjustedDeadline(baseDate, 2025);

      // Should skip Thu (25), Fri (26 holiday), Sat (27), Sun (28) → Monday 29
      expect(adjustedDate.getDate()).toBe(29);
    });
  });

  describe('generateMonthlyDeadline', () => {
    it('should not create duplicate deadline', async () => {
      mockDb.query.clientTaxDeadlines.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await service.generateMonthlyDeadline(
        'client-1',
        { id: 'type-1', baseDay: 25 },
        2025,
        1,
        'org-1',
        'user-1'
      );

      expect(result).toBeNull();
    });

    it('should create deadline for next month', async () => {
      mockDb.query.clientTaxDeadlines.findFirst.mockResolvedValue(null);
      mockDb.query.polishHolidays.findMany.mockResolvedValue([]);
      mockDb.returning.mockResolvedValue([{ id: 'new-deadline' }]);

      const result = await service.generateMonthlyDeadline(
        'client-1',
        { id: 'type-1', baseDay: 25, code: 'JPK_V7M' },
        2025,
        1, // January
        'org-1',
        'user-1'
      );

      expect(result).toEqual({ id: 'new-deadline' });
      // Verify the deadline date is February 25 (for January period)
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          periodMonth: 1,
        })
      );
    });
  });
});
```

### Integration Tests

```typescript
// src/server/api/routers/__tests__/tax-deadlines.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '@/test/helpers';

describe('Tax Deadlines Router Integration', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await ctx.seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('getCalendar', () => {
    it('should return deadlines and holidays for month', async () => {
      const result = await ctx.caller.taxDeadlines.getCalendar({
        year: 2025,
        month: 1,
      });

      expect(result.deadlines).toBeDefined();
      expect(result.holidays).toBeDefined();
      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('pending');
      expect(result.summary).toHaveProperty('overdue');
    });
  });

  describe('generateDeadlines', () => {
    it('should generate correct deadlines based on client config', async () => {
      // Create client with monthly VAT
      const client = await ctx.createClient({
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'MONTHLY',
        hasEmployees: true,
      });

      const result = await ctx.caller.taxDeadlines.generateDeadlines({
        clientId: client.id,
        year: 2025,
      });

      expect(result.generated).toBeGreaterThan(0);

      // Verify JPK_V7M deadlines were created (12 monthly)
      const deadlines = await ctx.db.query.clientTaxDeadlines.findMany({
        where: eq(clientTaxDeadlines.clientId, client.id),
      });

      const jpkDeadlines = deadlines.filter(d =>
        d.deadlineType.code === 'JPK_V7M'
      );
      expect(jpkDeadlines.length).toBe(12);

      // Verify ZUS DRA employer deadlines were created
      const zusDeadlines = deadlines.filter(d =>
        d.deadlineType.code === 'ZUS_DRA_EMP'
      );
      expect(zusDeadlines.length).toBe(12);
    });

    it('should generate quarterly deadlines for quarterly VAT payer', async () => {
      const client = await ctx.createClient({
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'QUARTERLY',
      });

      await ctx.caller.taxDeadlines.generateDeadlines({
        clientId: client.id,
        year: 2025,
      });

      const deadlines = await ctx.db.query.clientTaxDeadlines.findMany({
        where: and(
          eq(clientTaxDeadlines.clientId, client.id),
          like(clientTaxDeadlines.deadlineTypeId, '%JPK%'),
        ),
      });

      // Should have 4 quarterly JPK_V7K, not 12 monthly
      expect(deadlines.length).toBe(4);
    });
  });

  describe('updateStatus', () => {
    it('should update deadline status and log audit', async () => {
      const deadline = await ctx.createDeadline({
        status: 'PENDING',
      });

      await ctx.caller.taxDeadlines.updateStatus({
        deadlineId: deadline.id,
        status: 'SUBMITTED',
        confirmationNumber: 'UPO-123456',
      });

      const updated = await ctx.db.query.clientTaxDeadlines.findFirst({
        where: eq(clientTaxDeadlines.id, deadline.id),
      });

      expect(updated.status).toBe('SUBMITTED');
      expect(updated.confirmationNumber).toBe('UPO-123456');
      expect(updated.submissionDate).toBeDefined();

      // Verify audit log
      const auditLog = await ctx.db.query.auditLogs.findFirst({
        where: and(
          eq(auditLogs.entityType, 'tax_deadline'),
          eq(auditLogs.entityId, deadline.id),
        ),
      });
      expect(auditLog.action).toBe('TAX_DEADLINE_STATUS_UPDATED');
    });
  });
});
```

### E2E Tests

```typescript
// e2e/tax-deadlines.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tax Deadlines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display deadline calendar', async ({ page }) => {
    await page.goto('/tax/deadlines');

    // Check calendar is visible
    await expect(page.locator('[data-testid="deadline-calendar"]')).toBeVisible();

    // Check month navigation
    await expect(page.locator('[data-testid="current-month"]')).toContainText(/January|February|March/);

    // Check deadline items
    const deadlineItems = page.locator('[data-testid="deadline-item"]');
    await expect(deadlineItems.first()).toBeVisible();
  });

  test('should filter deadlines by client', async ({ page }) => {
    await page.goto('/tax/deadlines');

    // Open client filter
    await page.click('[data-testid="client-filter"]');
    await page.click('[data-testid="client-option-abc"]');

    // Verify filter applied
    await expect(page.locator('[data-testid="active-filter"]')).toContainText('ABC');

    // Verify deadlines are filtered
    const deadlineClients = page.locator('[data-testid="deadline-client-name"]');
    const count = await deadlineClients.count();
    for (let i = 0; i < count; i++) {
      await expect(deadlineClients.nth(i)).toContainText('ABC');
    }
  });

  test('should mark deadline as submitted', async ({ page }) => {
    await page.goto('/tax/deadlines');

    // Find pending deadline
    const pendingDeadline = page.locator('[data-testid="deadline-item"][data-status="PENDING"]').first();
    await pendingDeadline.click();

    // Open status dialog
    await page.click('[data-testid="mark-submitted"]');

    // Enter confirmation number
    await page.fill('[data-testid="confirmation-number"]', 'UPO-123456');
    await page.click('[data-testid="confirm-submission"]');

    // Verify status changed
    await expect(page.locator('[data-testid="deadline-status"]')).toContainText('Submitted');
    await expect(page.locator('[data-testid="confirmation-number"]')).toContainText('UPO-123456');
  });

  test('should configure reminders', async ({ page }) => {
    await page.goto('/tax/deadlines/settings');

    // Set reminder days
    await page.fill('[data-testid="early-reminder-days"]', '14');
    await page.fill('[data-testid="standard-reminder-days"]', '7');
    await page.fill('[data-testid="urgent-reminder-days"]', '3');
    await page.fill('[data-testid="critical-reminder-days"]', '1');

    // Enable SMS for critical
    await page.check('[data-testid="critical-sms-enabled"]');

    // Save
    await page.click('[data-testid="save-reminders"]');

    // Verify saved
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('should show holiday adjustments', async ({ page }) => {
    await page.goto('/tax/deadlines?month=11&year=2025');

    // Find deadline around November 11 (Independence Day)
    const adjustedDeadline = page.locator('[data-testid="deadline-item"][data-adjusted="true"]');

    if (await adjustedDeadline.count() > 0) {
      await adjustedDeadline.first().click();

      // Check adjustment reason is shown
      await expect(page.locator('[data-testid="adjustment-reason"]')).toContainText('Święto Niepodległości');
    }
  });
});
```

---

## Security Checklist

- [x] All deadline data isolated by organization_id via RLS
- [x] Audit logging for all status changes
- [x] Rate limiting on notification endpoints
- [x] SMS/Email templates sanitized against injection
- [x] User can only configure their own reminders
- [x] Deadline generation requires authenticated user
- [x] UPO numbers validated for format before storage
- [x] No PII exposed in notification subject lines

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `TAX_DEADLINE_GENERATED` | New deadline created | deadline_id, client_id, type, dates |
| `TAX_DEADLINE_STATUS_UPDATED` | Status changed | previous_status, new_status, user_id |
| `TAX_DEADLINE_SUBMISSION_CONFIRMED` | UPO received | upo_number, confirmation_date |
| `TAX_REMINDER_SENT` | Notification dispatched | channel, recipient, deadline_id |
| `TAX_REMINDER_SNOOZED` | User snoozed reminder | reminder_id, snooze_until |
| `TAX_REMINDER_CONFIG_CHANGED` | Settings updated | old_config, new_config |

---

## Performance Requirements

| Operation | Target | Max |
|-----------|--------|-----|
| Calendar load | <200ms | 500ms |
| Deadline generation (per client) | <500ms | 2s |
| Status update | <100ms | 300ms |
| Holiday calculation | <50ms | 100ms |
| Reminder processing (batch) | <5s | 30s |

---

## Dependencies

- **TAX-001**: Client tax configuration (determines applicable deadlines)
- **TAX-002**: Tax rates reference (deadline types)
- **CRM**: Client data for deadline association
- **AIM**: User authentication and notification preferences

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Database schema implemented with RLS
- [ ] Polish holidays seeded for 2024-2030
- [ ] tRPC endpoints implemented and tested
- [ ] Deadline service with holiday adjustment
- [ ] Notification service with email/SMS/in-app support
- [ ] Unit test coverage ≥80%
- [ ] Integration tests passing
- [ ] E2E tests for critical flows
- [ ] Security checklist completed
- [ ] Audit logging implemented
- [ ] Performance benchmarks met
- [ ] Code review approved

---

*Story created: December 2024*
*Last updated: December 2024*
