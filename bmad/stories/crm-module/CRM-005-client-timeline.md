# CRM-005: Client Timeline

> **Story ID**: CRM-005
> **Epic**: Core CRM Module (CRM)
> **Priority**: P1
> **Story Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 6

---

## User Story

**As an** accountant,
**I want to** view chronological history of all client interactions,
**So that** I can track relationship progress and have full context for client communication.

---

## Acceptance Criteria

### AC1: Timeline Event Types

```gherkin
Feature: Timeline Event Types
  As an accountant
  I want to see different types of events in the timeline
  So that I can understand all client activities

  Scenario: Display system-generated events
    Given a client "ABC Sp. z o.o." exists in the system
    When I view the client timeline
    Then I should see events for:
      | Event Type | Description |
      | CLIENT_CREATED | Client profile was created |
      | CLIENT_UPDATED | Client data was modified |
      | STATUS_CHANGED | Client status changed |
      | DATA_ENRICHED | Data fetched from GUS/VIES |
      | VAT_VALIDATED | VAT status was verified |
      | CONTACT_ADDED | New contact was added |
      | CONTACT_UPDATED | Contact was modified |
      | DOCUMENT_UPLOADED | Document was attached |
      | TAG_ADDED | Tag was assigned |
      | TAG_REMOVED | Tag was removed |

  Scenario: Display manual events
    Given a client "XYZ S.A." exists
    When I add a manual note "Rozmowa telefoniczna - ustalenie terminu spotkania"
    Then the note should appear in the timeline
    And it should be marked as "NOTE" type
    And it should show my name as the author

  Scenario: Display communication events
    Given a client with email communication history
    When I view the timeline
    Then I should see email events with:
      | Field | Value |
      | type | EMAIL_SENT / EMAIL_RECEIVED |
      | subject | Email subject line |
      | direction | OUTBOUND / INBOUND |
```

### AC2: Timeline Display and Navigation

```gherkin
Feature: Timeline Display
  As an accountant
  I want to navigate through timeline efficiently
  So that I can find relevant events quickly

  Scenario: Chronological ordering
    Given a client with 50+ timeline events
    When I view the timeline
    Then events should be displayed in reverse chronological order
    And the most recent event should be at the top

  Scenario: Timeline pagination
    Given a client with 100+ timeline events
    When I load the timeline
    Then I should see the first 20 events
    And I should be able to load more events on scroll
    And performance should be under 200ms per page

  Scenario: Event grouping by date
    Given a client with events from multiple days
    When I view the timeline
    Then events should be grouped by date
    And each group should show the date header
    And today's events should show "Dzisiaj"
    And yesterday's events should show "Wczoraj"

  Scenario: Event detail expansion
    Given a timeline event with detailed changes
    When I click on the event
    Then I should see the full event details
    And for update events, I should see before/after values
    And I should see the user who made the change
```

### AC3: Timeline Filtering

```gherkin
Feature: Timeline Filtering
  As an accountant
  I want to filter timeline events
  So that I can focus on specific activity types

  Scenario: Filter by event type
    Given a client with various event types
    When I filter by "STATUS_CHANGED" type
    Then I should only see status change events
    And the filter should be clearly indicated

  Scenario: Filter by date range
    Given a client with events spanning 6 months
    When I set date range from "2024-01-01" to "2024-03-31"
    Then I should only see events from Q1 2024

  Scenario: Filter by user
    Given a client with events from multiple users
    When I filter by user "jan.kowalski@firma.pl"
    Then I should only see events created by that user

  Scenario: Combined filters
    Given a client with diverse timeline
    When I apply multiple filters:
      | Filter | Value |
      | type | NOTE |
      | dateFrom | 2024-01-01 |
      | dateTo | 2024-06-30 |
    Then results should match all filter criteria
```

### AC4: Manual Event Creation

```gherkin
Feature: Manual Timeline Events
  As an accountant
  I want to add manual events to the timeline
  So that I can record client interactions

  Scenario: Add a note
    Given I am viewing client "ABC Sp. z o.o."
    When I click "Dodaj notatkę"
    And I enter content "Spotkanie w siedzibie klienta - omówienie rozliczeń VAT"
    And I optionally add tags: ["spotkanie", "VAT"]
    And I click "Zapisz"
    Then the note should appear in the timeline
    And it should be timestamped with current time
    And it should show my user name

  Scenario: Add a task/reminder
    Given I am viewing a client timeline
    When I add a task with:
      | Field | Value |
      | title | Przygotować zestawienie VAT |
      | dueDate | 2024-02-15 |
      | priority | HIGH |
    Then the task should appear in the timeline
    And it should be marked as "TASK" type
    And it should show the due date

  Scenario: Record a phone call
    Given I am on client timeline
    When I log a phone call with:
      | Field | Value |
      | direction | OUTBOUND |
      | duration | 15 min |
      | summary | Uzgodnienie terminu dostarczenia faktur |
      | contactPerson | Anna Nowak |
    Then the call should appear as "CALL" event
    And it should show call details
```

### AC5: Event Attachments

```gherkin
Feature: Timeline Event Attachments
  As an accountant
  I want to attach files to timeline events
  So that I can keep related documents together

  Scenario: Attach file to note
    Given I am creating a timeline note
    When I attach a file "notatka_spotkanie.pdf"
    And I save the note
    Then the file should be linked to the event
    And I should be able to download it from the timeline

  Scenario: View document upload events
    Given a document was uploaded to the client
    When I view the timeline
    Then I should see a DOCUMENT_UPLOADED event
    And it should link to the document
    And it should show document metadata (type, size)
```

### AC6: Timeline Export

```gherkin
Feature: Timeline Export
  As an accountant
  I want to export timeline history
  So that I can share it or archive it

  Scenario: Export to PDF
    Given a client with timeline events
    When I click "Eksportuj" and select "PDF"
    Then a PDF file should be generated
    And it should include all visible events
    And it should be formatted for printing

  Scenario: Export to CSV
    Given a client timeline
    When I export to CSV
    Then I should get a file with columns:
      | Column | Description |
      | date | Event timestamp |
      | type | Event type code |
      | title | Event title |
      | description | Full description |
      | user | User who created |
      | changes | JSON of changes (if applicable) |
```

---

## Technical Specification

### Database Schema

```sql
-- Timeline events table
CREATE TABLE client_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',

    -- Event content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Change tracking (for update events)
    changes JSONB,
    entity_type VARCHAR(50),
    entity_id UUID,

    -- Attachments
    attachments JSONB DEFAULT '[]',

    -- Task/reminder specific
    due_date TIMESTAMPTZ,
    priority VARCHAR(20),
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),

    -- Tags for filtering
    tags TEXT[] DEFAULT '{}',

    -- User tracking
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Soft delete
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_timeline_client_id ON client_timeline(client_id);
CREATE INDEX idx_timeline_organization ON client_timeline(organization_id);
CREATE INDEX idx_timeline_event_type ON client_timeline(event_type);
CREATE INDEX idx_timeline_created_at ON client_timeline(created_at DESC);
CREATE INDEX idx_timeline_entity ON client_timeline(entity_type, entity_id);
CREATE INDEX idx_timeline_tags ON client_timeline USING GIN(tags);
CREATE INDEX idx_timeline_due_date ON client_timeline(due_date) WHERE due_date IS NOT NULL;

-- Full-text search index
CREATE INDEX idx_timeline_search ON client_timeline
    USING GIN(to_tsvector('polish', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Row Level Security
ALTER TABLE client_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY timeline_isolation ON client_timeline
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Comments
COMMENT ON TABLE client_timeline IS 'Chronological history of all client-related events and interactions';
COMMENT ON COLUMN client_timeline.event_category IS 'SYSTEM (auto-generated), MANUAL (user-created), COMMUNICATION (emails, calls)';
COMMENT ON COLUMN client_timeline.changes IS 'JSON object with before/after values for update events';
COMMENT ON COLUMN client_timeline.metadata IS 'Additional event-specific data in JSON format';
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Event types enum
export const TimelineEventTypeSchema = z.enum([
  // System events
  'CLIENT_CREATED',
  'CLIENT_UPDATED',
  'CLIENT_DELETED',
  'CLIENT_RESTORED',
  'STATUS_CHANGED',
  'DATA_ENRICHED',
  'VAT_VALIDATED',
  'WHITELIST_CHECKED',
  'RISK_ASSESSED',

  // Contact events
  'CONTACT_ADDED',
  'CONTACT_UPDATED',
  'CONTACT_DELETED',
  'PORTAL_ACCESS_GRANTED',
  'PORTAL_ACCESS_REVOKED',

  // Document events
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
  'DOCUMENT_CATEGORIZED',

  // Tag events
  'TAG_ADDED',
  'TAG_REMOVED',

  // Manual events
  'NOTE',
  'TASK',
  'CALL',
  'MEETING',
  'EMAIL_SENT',
  'EMAIL_RECEIVED',

  // Custom field events
  'CUSTOM_FIELD_SET',
  'CUSTOM_FIELD_REMOVED'
]);

export const TimelineEventCategorySchema = z.enum([
  'SYSTEM',
  'MANUAL',
  'COMMUNICATION',
  'DOCUMENT',
  'INTEGRATION'
]);

export const TaskPrioritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
]);

// Create note input
export const CreateTimelineNoteSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  attachments: z.array(z.object({
    fileId: z.string().uuid(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number()
  })).max(10).default([])
});

// Create task input
export const CreateTimelineTaskSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
  priority: TaskPrioritySchema.default('MEDIUM'),
  tags: z.array(z.string().max(50)).max(10).default([]),
  assigneeId: z.string().uuid().optional()
});

// Log call input
export const LogCallSchema = z.object({
  clientId: z.string().uuid(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  duration: z.number().min(0).max(480).optional(), // max 8 hours in minutes
  contactPersonId: z.string().uuid().optional(),
  contactPersonName: z.string().max(200).optional(),
  summary: z.string().max(5000),
  tags: z.array(z.string().max(50)).max(10).default([])
});

// Log meeting input
export const LogMeetingSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(500),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  location: z.string().max(500).optional(),
  attendees: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    contactId: z.string().uuid().optional()
  })).default([]),
  summary: z.string().max(10000).optional(),
  tags: z.array(z.string().max(50)).max(10).default([])
});

// Timeline query input
export const TimelineQuerySchema = z.object({
  clientId: z.string().uuid(),
  eventTypes: z.array(TimelineEventTypeSchema).optional(),
  categories: z.array(TimelineEventCategorySchema).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().max(200).optional(),
  includeDeleted: z.boolean().default(false),

  // Pagination
  cursor: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(20),

  // Sorting
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Timeline event response
export const TimelineEventSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  eventType: TimelineEventTypeSchema,
  eventCategory: TimelineEventCategorySchema,
  title: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.unknown()),
  changes: z.object({
    before: z.record(z.unknown()),
    after: z.record(z.unknown())
  }).nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().uuid().nullable(),
  attachments: z.array(z.object({
    fileId: z.string().uuid(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number()
  })),
  dueDate: z.string().datetime().nullable(),
  priority: TaskPrioritySchema.nullable(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  tags: z.array(z.string()),
  createdBy: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string()
  }).nullable(),
  createdAt: z.string().datetime()
});

// Paginated response
export const TimelineResponseSchema = z.object({
  events: z.array(TimelineEventSchema),
  nextCursor: z.string().uuid().nullable(),
  hasMore: z.boolean(),
  totalCount: z.number()
});

// Export types
export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>;
export type TimelineEventCategory = z.infer<typeof TimelineEventCategorySchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type CreateTimelineNote = z.infer<typeof CreateTimelineNoteSchema>;
export type CreateTimelineTask = z.infer<typeof CreateTimelineTaskSchema>;
export type LogCall = z.infer<typeof LogCallSchema>;
export type LogMeeting = z.infer<typeof LogMeetingSchema>;
export type TimelineQuery = z.infer<typeof TimelineQuerySchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type TimelineResponse = z.infer<typeof TimelineResponseSchema>;
```

### tRPC Router Implementation

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  CreateTimelineNoteSchema,
  CreateTimelineTaskSchema,
  LogCallSchema,
  LogMeetingSchema,
  TimelineQuerySchema,
  TimelineEventSchema,
  TimelineResponseSchema
} from './schemas';

export const timelineRouter = router({
  // Get timeline events with pagination and filtering
  getTimeline: protectedProcedure
    .input(TimelineQuerySchema)
    .output(TimelineResponseSchema)
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      // Build query conditions
      const where: any = {
        clientId: input.clientId,
        isDeleted: input.includeDeleted ? undefined : false
      };

      if (input.eventTypes?.length) {
        where.eventType = { in: input.eventTypes };
      }

      if (input.categories?.length) {
        where.eventCategory = { in: input.categories };
      }

      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) where.createdAt.gte = new Date(input.dateFrom);
        if (input.dateTo) where.createdAt.lte = new Date(input.dateTo);
      }

      if (input.userId) {
        where.createdBy = input.userId;
      }

      if (input.tags?.length) {
        where.tags = { hasEvery: input.tags };
      }

      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } }
        ];
      }

      // Cursor-based pagination
      const cursorCondition = input.cursor
        ? { cursor: { id: input.cursor }, skip: 1 }
        : {};

      // Fetch events
      const [events, totalCount] = await Promise.all([
        db.clientTimeline.findMany({
          where,
          include: {
            createdByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: input.sortOrder },
          take: input.limit + 1, // Fetch one extra to check for more
          ...cursorCondition
        }),
        db.clientTimeline.count({ where })
      ]);

      // Check if there are more results
      const hasMore = events.length > input.limit;
      if (hasMore) events.pop();

      const nextCursor = hasMore ? events[events.length - 1]?.id : null;

      return {
        events: events.map(e => ({
          id: e.id,
          clientId: e.clientId,
          eventType: e.eventType,
          eventCategory: e.eventCategory,
          title: e.title,
          description: e.description,
          metadata: e.metadata as Record<string, unknown>,
          changes: e.changes as { before: Record<string, unknown>; after: Record<string, unknown> } | null,
          entityType: e.entityType,
          entityId: e.entityId,
          attachments: e.attachments as any[],
          dueDate: e.dueDate?.toISOString() ?? null,
          priority: e.priority,
          isCompleted: e.isCompleted,
          completedAt: e.completedAt?.toISOString() ?? null,
          tags: e.tags,
          createdBy: e.createdByUser ? {
            id: e.createdByUser.id,
            name: e.createdByUser.name,
            email: e.createdByUser.email
          } : null,
          createdAt: e.createdAt.toISOString()
        })),
        nextCursor,
        hasMore,
        totalCount
      };
    }),

  // Add a note to timeline
  addNote: protectedProcedure
    .input(CreateTimelineNoteSchema)
    .output(TimelineEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      const event = await db.clientTimeline.create({
        data: {
          clientId: input.clientId,
          organizationId: user.organizationId,
          eventType: 'NOTE',
          eventCategory: 'MANUAL',
          title: input.title,
          description: input.description,
          tags: input.tags,
          attachments: input.attachments,
          metadata: {},
          createdBy: user.id
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Create audit event
      await createAuditLog(db, {
        eventType: 'TIMELINE_NOTE_ADDED',
        entityType: 'CLIENT_TIMELINE',
        entityId: event.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { clientId: input.clientId, title: input.title }
      });

      return mapTimelineEvent(event);
    }),

  // Add a task to timeline
  addTask: protectedProcedure
    .input(CreateTimelineTaskSchema)
    .output(TimelineEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      const event = await db.clientTimeline.create({
        data: {
          clientId: input.clientId,
          organizationId: user.organizationId,
          eventType: 'TASK',
          eventCategory: 'MANUAL',
          title: input.title,
          description: input.description,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          priority: input.priority,
          isCompleted: false,
          tags: input.tags,
          metadata: {
            assigneeId: input.assigneeId
          },
          createdBy: user.id
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Create audit event
      await createAuditLog(db, {
        eventType: 'TIMELINE_TASK_ADDED',
        entityType: 'CLIENT_TIMELINE',
        entityId: event.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: {
          clientId: input.clientId,
          title: input.title,
          dueDate: input.dueDate,
          priority: input.priority
        }
      });

      return mapTimelineEvent(event);
    }),

  // Log a phone call
  logCall: protectedProcedure
    .input(LogCallSchema)
    .output(TimelineEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      const directionLabel = input.direction === 'INBOUND' ? 'Połączenie przychodzące' : 'Połączenie wychodzące';
      const durationStr = input.duration ? ` (${input.duration} min)` : '';
      const contactStr = input.contactPersonName ? ` z ${input.contactPersonName}` : '';

      const event = await db.clientTimeline.create({
        data: {
          clientId: input.clientId,
          organizationId: user.organizationId,
          eventType: 'CALL',
          eventCategory: 'COMMUNICATION',
          title: `${directionLabel}${contactStr}${durationStr}`,
          description: input.summary,
          tags: input.tags,
          metadata: {
            direction: input.direction,
            duration: input.duration,
            contactPersonId: input.contactPersonId,
            contactPersonName: input.contactPersonName
          },
          createdBy: user.id
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Create audit event
      await createAuditLog(db, {
        eventType: 'TIMELINE_CALL_LOGGED',
        entityType: 'CLIENT_TIMELINE',
        entityId: event.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: {
          clientId: input.clientId,
          direction: input.direction,
          duration: input.duration
        }
      });

      return mapTimelineEvent(event);
    }),

  // Log a meeting
  logMeeting: protectedProcedure
    .input(LogMeetingSchema)
    .output(TimelineEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      const event = await db.clientTimeline.create({
        data: {
          clientId: input.clientId,
          organizationId: user.organizationId,
          eventType: 'MEETING',
          eventCategory: 'COMMUNICATION',
          title: input.title,
          description: input.summary,
          tags: input.tags,
          metadata: {
            startTime: input.startTime,
            endTime: input.endTime,
            location: input.location,
            attendees: input.attendees
          },
          createdBy: user.id
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Create audit event
      await createAuditLog(db, {
        eventType: 'TIMELINE_MEETING_LOGGED',
        entityType: 'CLIENT_TIMELINE',
        entityId: event.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: {
          clientId: input.clientId,
          title: input.title,
          startTime: input.startTime
        }
      });

      return mapTimelineEvent(event);
    }),

  // Complete a task
  completeTask: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid()
    }))
    .output(TimelineEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const event = await db.clientTimeline.findFirst({
        where: {
          id: input.eventId,
          organizationId: user.organizationId,
          eventType: 'TASK',
          isDeleted: false
        }
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Zadanie nie zostało znalezione'
        });
      }

      if (event.isCompleted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Zadanie jest już ukończone'
        });
      }

      const updated = await db.clientTimeline.update({
        where: { id: input.eventId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
          completedBy: user.id
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Create audit event
      await createAuditLog(db, {
        eventType: 'TIMELINE_TASK_COMPLETED',
        entityType: 'CLIENT_TIMELINE',
        entityId: event.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { clientId: event.clientId, title: event.title }
      });

      return mapTimelineEvent(updated);
    }),

  // Delete timeline event (soft delete)
  deleteEvent: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid()
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const event = await db.clientTimeline.findFirst({
        where: {
          id: input.eventId,
          organizationId: user.organizationId,
          eventCategory: 'MANUAL', // Only manual events can be deleted
          isDeleted: false
        }
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wydarzenie nie zostało znalezione lub nie może być usunięte'
        });
      }

      await db.clientTimeline.update({
        where: { id: input.eventId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user.id
        }
      });

      // Create audit event
      await createAuditLog(db, {
        eventType: 'TIMELINE_EVENT_DELETED',
        entityType: 'CLIENT_TIMELINE',
        entityId: event.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { clientId: event.clientId, eventType: event.eventType }
      });

      return { success: true };
    }),

  // Export timeline
  exportTimeline: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      format: z.enum(['PDF', 'CSV']),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      eventTypes: z.array(TimelineEventTypeSchema).optional()
    }))
    .output(z.object({
      downloadUrl: z.string(),
      expiresAt: z.string().datetime()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, user, storage } = ctx;

      // Verify client access
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: user.organizationId,
          isDeleted: false
        },
        select: { id: true, companyName: true }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Klient nie został znaleziony'
        });
      }

      // Build query
      const where: any = {
        clientId: input.clientId,
        isDeleted: false
      };

      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) where.createdAt.gte = new Date(input.dateFrom);
        if (input.dateTo) where.createdAt.lte = new Date(input.dateTo);
      }

      if (input.eventTypes?.length) {
        where.eventType = { in: input.eventTypes };
      }

      const events = await db.clientTimeline.findMany({
        where,
        include: {
          createdByUser: {
            select: { name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Generate export
      let fileBuffer: Buffer;
      let fileName: string;
      let contentType: string;

      if (input.format === 'CSV') {
        fileBuffer = generateTimelineCSV(events);
        fileName = `timeline_${client.companyName}_${Date.now()}.csv`;
        contentType = 'text/csv';
      } else {
        fileBuffer = await generateTimelinePDF(events, client);
        fileName = `timeline_${client.companyName}_${Date.now()}.pdf`;
        contentType = 'application/pdf';
      }

      // Upload to temporary storage
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const downloadUrl = await storage.uploadTemporary(fileBuffer, fileName, contentType, expiresAt);

      // Create audit event
      await createAuditLog(db, {
        eventType: 'TIMELINE_EXPORTED',
        entityType: 'CLIENT',
        entityId: input.clientId,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: {
          format: input.format,
          eventCount: events.length
        }
      });

      return {
        downloadUrl,
        expiresAt: expiresAt.toISOString()
      };
    })
});

// Helper function to map database event to response schema
function mapTimelineEvent(event: any): TimelineEvent {
  return {
    id: event.id,
    clientId: event.clientId,
    eventType: event.eventType,
    eventCategory: event.eventCategory,
    title: event.title,
    description: event.description,
    metadata: event.metadata || {},
    changes: event.changes,
    entityType: event.entityType,
    entityId: event.entityId,
    attachments: event.attachments || [],
    dueDate: event.dueDate?.toISOString() ?? null,
    priority: event.priority,
    isCompleted: event.isCompleted,
    completedAt: event.completedAt?.toISOString() ?? null,
    tags: event.tags || [],
    createdBy: event.createdByUser ? {
      id: event.createdByUser.id,
      name: event.createdByUser.name,
      email: event.createdByUser.email
    } : null,
    createdAt: event.createdAt.toISOString()
  };
}
```

### Timeline Service for System Events

```typescript
// services/timeline.service.ts
import { PrismaClient } from '@prisma/client';

interface SystemEventParams {
  clientId: string;
  organizationId: string;
  eventType: string;
  title: string;
  description?: string;
  changes?: { before: Record<string, any>; after: Record<string, any> };
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export class TimelineService {
  constructor(private db: PrismaClient) {}

  /**
   * Record a system-generated event in the timeline
   */
  async recordSystemEvent(params: SystemEventParams): Promise<void> {
    await this.db.clientTimeline.create({
      data: {
        clientId: params.clientId,
        organizationId: params.organizationId,
        eventType: params.eventType,
        eventCategory: 'SYSTEM',
        title: params.title,
        description: params.description,
        changes: params.changes,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata || {},
        createdBy: params.userId
      }
    });
  }

  /**
   * Record client creation
   */
  async recordClientCreated(
    clientId: string,
    organizationId: string,
    clientName: string,
    userId: string
  ): Promise<void> {
    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'CLIENT_CREATED',
      title: `Utworzono klienta "${clientName}"`,
      entityType: 'CLIENT',
      entityId: clientId,
      userId
    });
  }

  /**
   * Record client update with changes
   */
  async recordClientUpdated(
    clientId: string,
    organizationId: string,
    changes: { before: Record<string, any>; after: Record<string, any> },
    userId: string
  ): Promise<void> {
    const changedFields = Object.keys(changes.after).filter(
      key => changes.before[key] !== changes.after[key]
    );

    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'CLIENT_UPDATED',
      title: `Zaktualizowano dane klienta (${changedFields.join(', ')})`,
      changes,
      entityType: 'CLIENT',
      entityId: clientId,
      userId
    });
  }

  /**
   * Record status change
   */
  async recordStatusChanged(
    clientId: string,
    organizationId: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const statusLabels: Record<string, string> = {
      'ACTIVE': 'Aktywny',
      'INACTIVE': 'Nieaktywny',
      'SUSPENDED': 'Zawieszony',
      'PENDING': 'Oczekujący',
      'ARCHIVED': 'Zarchiwizowany'
    };

    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'STATUS_CHANGED',
      title: `Zmiana statusu: ${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}`,
      description: reason,
      changes: {
        before: { status: oldStatus },
        after: { status: newStatus }
      },
      entityType: 'CLIENT',
      entityId: clientId,
      userId
    });
  }

  /**
   * Record data enrichment from external source
   */
  async recordDataEnriched(
    clientId: string,
    organizationId: string,
    source: 'GUS' | 'VIES' | 'WHITELIST',
    enrichedFields: string[],
    userId?: string
  ): Promise<void> {
    const sourceLabels = {
      'GUS': 'GUS/REGON',
      'VIES': 'VIES (EU VAT)',
      'WHITELIST': 'Biała Lista VAT'
    };

    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'DATA_ENRICHED',
      title: `Wzbogacono dane z ${sourceLabels[source]}`,
      description: `Zaktualizowane pola: ${enrichedFields.join(', ')}`,
      metadata: {
        source,
        enrichedFields
      },
      userId
    });
  }

  /**
   * Record VAT validation
   */
  async recordVatValidated(
    clientId: string,
    organizationId: string,
    vatNumber: string,
    isValid: boolean,
    source: 'VIES' | 'WHITELIST',
    userId?: string
  ): Promise<void> {
    const status = isValid ? 'prawidłowy' : 'nieprawidłowy';

    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'VAT_VALIDATED',
      title: `Sprawdzono VAT ${vatNumber} - ${status}`,
      metadata: {
        vatNumber,
        isValid,
        source,
        validatedAt: new Date().toISOString()
      },
      userId
    });
  }

  /**
   * Record contact added
   */
  async recordContactAdded(
    clientId: string,
    organizationId: string,
    contactId: string,
    contactName: string,
    roles: string[],
    userId: string
  ): Promise<void> {
    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'CONTACT_ADDED',
      title: `Dodano kontakt: ${contactName}`,
      description: `Role: ${roles.join(', ')}`,
      entityType: 'CLIENT_CONTACT',
      entityId: contactId,
      metadata: { contactName, roles },
      userId
    });
  }

  /**
   * Record portal access granted
   */
  async recordPortalAccessGranted(
    clientId: string,
    organizationId: string,
    contactId: string,
    contactName: string,
    contactEmail: string,
    userId: string
  ): Promise<void> {
    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'PORTAL_ACCESS_GRANTED',
      title: `Przyznano dostęp do portalu: ${contactName}`,
      description: `Zaproszenie wysłane na: ${contactEmail}`,
      entityType: 'CLIENT_CONTACT',
      entityId: contactId,
      metadata: { contactName, contactEmail },
      userId
    });
  }

  /**
   * Record document upload
   */
  async recordDocumentUploaded(
    clientId: string,
    organizationId: string,
    documentId: string,
    documentName: string,
    documentType: string,
    userId: string
  ): Promise<void> {
    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'DOCUMENT_UPLOADED',
      title: `Dodano dokument: ${documentName}`,
      description: `Typ: ${documentType}`,
      entityType: 'DOCUMENT',
      entityId: documentId,
      metadata: { documentName, documentType },
      userId
    });
  }

  /**
   * Record tag added
   */
  async recordTagAdded(
    clientId: string,
    organizationId: string,
    tagName: string,
    userId: string
  ): Promise<void> {
    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'TAG_ADDED',
      title: `Dodano tag: ${tagName}`,
      metadata: { tagName },
      userId
    });
  }

  /**
   * Record tag removed
   */
  async recordTagRemoved(
    clientId: string,
    organizationId: string,
    tagName: string,
    userId: string
  ): Promise<void> {
    await this.recordSystemEvent({
      clientId,
      organizationId,
      eventType: 'TAG_REMOVED',
      title: `Usunięto tag: ${tagName}`,
      metadata: { tagName },
      userId
    });
  }

  /**
   * Get pending tasks for user across all clients
   */
  async getPendingTasks(
    organizationId: string,
    userId?: string,
    limit: number = 20
  ): Promise<any[]> {
    const where: any = {
      organizationId,
      eventType: 'TASK',
      isCompleted: false,
      isDeleted: false
    };

    if (userId) {
      where.OR = [
        { createdBy: userId },
        { metadata: { path: ['assigneeId'], equals: userId } }
      ];
    }

    return this.db.clientTimeline.findMany({
      where,
      include: {
        client: {
          select: { id: true, companyName: true }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit
    });
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(organizationId: string): Promise<any[]> {
    return this.db.clientTimeline.findMany({
      where: {
        organizationId,
        eventType: 'TASK',
        isCompleted: false,
        isDeleted: false,
        dueDate: { lt: new Date() }
      },
      include: {
        client: {
          select: { id: true, companyName: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });
  }
}
```

---

## Test Specification

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimelineService } from './timeline.service';

describe('TimelineService', () => {
  let service: TimelineService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      clientTimeline: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn()
      }
    };
    service = new TimelineService(mockDb);
  });

  describe('recordSystemEvent', () => {
    it('should create timeline event with all parameters', async () => {
      const params = {
        clientId: 'client-123',
        organizationId: 'org-456',
        eventType: 'CLIENT_UPDATED',
        title: 'Test event',
        description: 'Test description',
        changes: { before: { name: 'Old' }, after: { name: 'New' } },
        entityType: 'CLIENT',
        entityId: 'client-123',
        userId: 'user-789'
      };

      mockDb.clientTimeline.create.mockResolvedValue({ id: 'event-1' });

      await service.recordSystemEvent(params);

      expect(mockDb.clientTimeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'client-123',
          eventType: 'CLIENT_UPDATED',
          eventCategory: 'SYSTEM',
          title: 'Test event'
        })
      });
    });
  });

  describe('recordClientCreated', () => {
    it('should create CLIENT_CREATED event', async () => {
      mockDb.clientTimeline.create.mockResolvedValue({ id: 'event-1' });

      await service.recordClientCreated(
        'client-123',
        'org-456',
        'ABC Sp. z o.o.',
        'user-789'
      );

      expect(mockDb.clientTimeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'CLIENT_CREATED',
          title: 'Utworzono klienta "ABC Sp. z o.o."'
        })
      });
    });
  });

  describe('recordStatusChanged', () => {
    it('should record status change with Polish labels', async () => {
      mockDb.clientTimeline.create.mockResolvedValue({ id: 'event-1' });

      await service.recordStatusChanged(
        'client-123',
        'org-456',
        'ACTIVE',
        'SUSPENDED',
        'user-789',
        'Brak płatności'
      );

      expect(mockDb.clientTimeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'STATUS_CHANGED',
          title: 'Zmiana statusu: Aktywny → Zawieszony',
          description: 'Brak płatności'
        })
      });
    });
  });

  describe('getPendingTasks', () => {
    it('should return pending tasks ordered by due date', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', dueDate: new Date('2024-01-15') },
        { id: 'task-2', title: 'Task 2', dueDate: new Date('2024-01-10') }
      ];

      mockDb.clientTimeline.findMany.mockResolvedValue(mockTasks);

      const tasks = await service.getPendingTasks('org-456');

      expect(mockDb.clientTimeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'TASK',
            isCompleted: false
          }),
          orderBy: expect.arrayContaining([
            { dueDate: 'asc' }
          ])
        })
      );
    });
  });

  describe('getOverdueTasks', () => {
    it('should return tasks with past due dates', async () => {
      mockDb.clientTimeline.findMany.mockResolvedValue([]);

      await service.getOverdueTasks('org-456');

      expect(mockDb.clientTimeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isCompleted: false,
            dueDate: { lt: expect.any(Date) }
          })
        })
      );
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '../test-utils';

describe('Timeline Router Integration', () => {
  let ctx: any;
  let testClient: any;
  let testUser: any;

  beforeAll(async () => {
    ctx = await createTestContext();
    testUser = await ctx.createTestUser();
    testClient = await ctx.createTestClient({
      companyName: 'Test Timeline Client',
      nip: '1234567890'
    });
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  beforeEach(async () => {
    // Clean timeline events before each test
    await ctx.db.clientTimeline.deleteMany({
      where: { clientId: testClient.id }
    });
  });

  describe('getTimeline', () => {
    it('should return empty timeline for new client', async () => {
      const result = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id
      });

      expect(result.events).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.totalCount).toBe(0);
    });

    it('should return events in reverse chronological order', async () => {
      // Create events
      await ctx.db.clientTimeline.createMany({
        data: [
          {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'NOTE',
            eventCategory: 'MANUAL',
            title: 'First note',
            createdAt: new Date('2024-01-01'),
            createdBy: testUser.id
          },
          {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'NOTE',
            eventCategory: 'MANUAL',
            title: 'Second note',
            createdAt: new Date('2024-01-02'),
            createdBy: testUser.id
          }
        ]
      });

      const result = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id
      });

      expect(result.events).toHaveLength(2);
      expect(result.events[0].title).toBe('Second note');
      expect(result.events[1].title).toBe('First note');
    });

    it('should paginate results correctly', async () => {
      // Create 25 events
      for (let i = 0; i < 25; i++) {
        await ctx.db.clientTimeline.create({
          data: {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'NOTE',
            eventCategory: 'MANUAL',
            title: `Note ${i + 1}`,
            createdBy: testUser.id
          }
        });
      }

      // First page
      const page1 = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id,
        limit: 10
      });

      expect(page1.events).toHaveLength(10);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeTruthy();

      // Second page
      const page2 = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id,
        limit: 10,
        cursor: page1.nextCursor
      });

      expect(page2.events).toHaveLength(10);
      expect(page2.hasMore).toBe(true);

      // Third page
      const page3 = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id,
        limit: 10,
        cursor: page2.nextCursor
      });

      expect(page3.events).toHaveLength(5);
      expect(page3.hasMore).toBe(false);
    });

    it('should filter by event type', async () => {
      await ctx.db.clientTimeline.createMany({
        data: [
          {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'NOTE',
            eventCategory: 'MANUAL',
            title: 'A note',
            createdBy: testUser.id
          },
          {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'TASK',
            eventCategory: 'MANUAL',
            title: 'A task',
            createdBy: testUser.id
          },
          {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'CALL',
            eventCategory: 'COMMUNICATION',
            title: 'A call',
            createdBy: testUser.id
          }
        ]
      });

      const result = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id,
        eventTypes: ['NOTE', 'TASK']
      });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => ['NOTE', 'TASK'].includes(e.eventType))).toBe(true);
    });

    it('should filter by date range', async () => {
      await ctx.db.clientTimeline.createMany({
        data: [
          {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'NOTE',
            eventCategory: 'MANUAL',
            title: 'Old note',
            createdAt: new Date('2023-06-01'),
            createdBy: testUser.id
          },
          {
            clientId: testClient.id,
            organizationId: testUser.organizationId,
            eventType: 'NOTE',
            eventCategory: 'MANUAL',
            title: 'New note',
            createdAt: new Date('2024-01-15'),
            createdBy: testUser.id
          }
        ]
      });

      const result = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id,
        dateFrom: '2024-01-01T00:00:00.000Z',
        dateTo: '2024-12-31T23:59:59.999Z'
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('New note');
    });
  });

  describe('addNote', () => {
    it('should create note with all fields', async () => {
      const result = await ctx.caller.timeline.addNote({
        clientId: testClient.id,
        title: 'Test note title',
        description: 'Detailed description of the note',
        tags: ['important', 'meeting']
      });

      expect(result.id).toBeTruthy();
      expect(result.eventType).toBe('NOTE');
      expect(result.eventCategory).toBe('MANUAL');
      expect(result.title).toBe('Test note title');
      expect(result.description).toBe('Detailed description of the note');
      expect(result.tags).toEqual(['important', 'meeting']);
      expect(result.createdBy?.id).toBe(testUser.id);
    });

    it('should reject note for non-existent client', async () => {
      await expect(
        ctx.caller.timeline.addNote({
          clientId: '00000000-0000-0000-0000-000000000000',
          title: 'Test note'
        })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  describe('addTask', () => {
    it('should create task with due date and priority', async () => {
      const dueDate = new Date('2024-02-15T12:00:00.000Z');

      const result = await ctx.caller.timeline.addTask({
        clientId: testClient.id,
        title: 'Przygotować deklarację VAT',
        description: 'Do 25 dnia miesiąca',
        dueDate: dueDate.toISOString(),
        priority: 'HIGH',
        tags: ['VAT', 'termin']
      });

      expect(result.eventType).toBe('TASK');
      expect(result.title).toBe('Przygotować deklarację VAT');
      expect(result.dueDate).toBe(dueDate.toISOString());
      expect(result.priority).toBe('HIGH');
      expect(result.isCompleted).toBe(false);
    });

    it('should default priority to MEDIUM', async () => {
      const result = await ctx.caller.timeline.addTask({
        clientId: testClient.id,
        title: 'Simple task'
      });

      expect(result.priority).toBe('MEDIUM');
    });
  });

  describe('logCall', () => {
    it('should log outbound call with all details', async () => {
      const result = await ctx.caller.timeline.logCall({
        clientId: testClient.id,
        direction: 'OUTBOUND',
        duration: 15,
        contactPersonName: 'Anna Nowak',
        summary: 'Omówienie terminu dostarczenia faktur',
        tags: ['faktury']
      });

      expect(result.eventType).toBe('CALL');
      expect(result.eventCategory).toBe('COMMUNICATION');
      expect(result.title).toContain('Połączenie wychodzące');
      expect(result.title).toContain('Anna Nowak');
      expect(result.title).toContain('15 min');
      expect(result.metadata.direction).toBe('OUTBOUND');
      expect(result.metadata.duration).toBe(15);
    });

    it('should log inbound call', async () => {
      const result = await ctx.caller.timeline.logCall({
        clientId: testClient.id,
        direction: 'INBOUND',
        summary: 'Pytanie o stan rozliczeń'
      });

      expect(result.title).toContain('Połączenie przychodzące');
      expect(result.metadata.direction).toBe('INBOUND');
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      const task = await ctx.caller.timeline.addTask({
        clientId: testClient.id,
        title: 'Task to complete'
      });

      const result = await ctx.caller.timeline.completeTask({
        eventId: task.id
      });

      expect(result.isCompleted).toBe(true);
      expect(result.completedAt).toBeTruthy();
    });

    it('should reject completing non-task event', async () => {
      const note = await ctx.caller.timeline.addNote({
        clientId: testClient.id,
        title: 'Not a task'
      });

      await expect(
        ctx.caller.timeline.completeTask({ eventId: note.id })
      ).rejects.toThrow('Zadanie nie zostało znalezione');
    });

    it('should reject completing already completed task', async () => {
      const task = await ctx.caller.timeline.addTask({
        clientId: testClient.id,
        title: 'Already completed'
      });

      await ctx.caller.timeline.completeTask({ eventId: task.id });

      await expect(
        ctx.caller.timeline.completeTask({ eventId: task.id })
      ).rejects.toThrow('Zadanie jest już ukończone');
    });
  });

  describe('deleteEvent', () => {
    it('should soft delete manual event', async () => {
      const note = await ctx.caller.timeline.addNote({
        clientId: testClient.id,
        title: 'Note to delete'
      });

      const result = await ctx.caller.timeline.deleteEvent({
        eventId: note.id
      });

      expect(result.success).toBe(true);

      // Verify it's not visible in timeline
      const timeline = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id
      });
      expect(timeline.events.find(e => e.id === note.id)).toBeUndefined();

      // Verify it exists with includeDeleted
      const timelineWithDeleted = await ctx.caller.timeline.getTimeline({
        clientId: testClient.id,
        includeDeleted: true
      });
      expect(timelineWithDeleted.events.find(e => e.id === note.id)).toBeTruthy();
    });

    it('should reject deleting system event', async () => {
      // Create system event directly
      const systemEvent = await ctx.db.clientTimeline.create({
        data: {
          clientId: testClient.id,
          organizationId: testUser.organizationId,
          eventType: 'CLIENT_UPDATED',
          eventCategory: 'SYSTEM',
          title: 'System event'
        }
      });

      await expect(
        ctx.caller.timeline.deleteEvent({ eventId: systemEvent.id })
      ).rejects.toThrow('nie może być usunięte');
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Client Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Navigate to test client
    await page.goto('/clients/test-client-id');
    await page.click('[data-testid="timeline-tab"]');
  });

  test('should display timeline events', async ({ page }) => {
    await expect(page.locator('[data-testid="timeline-container"]')).toBeVisible();

    // Check for date grouping
    await expect(page.locator('[data-testid="date-group"]').first()).toBeVisible();
  });

  test('should add a note', async ({ page }) => {
    await page.click('[data-testid="add-note-button"]');

    await page.fill('[data-testid="note-title"]', 'Test note from E2E');
    await page.fill('[data-testid="note-description"]', 'This is a test description');
    await page.click('[data-testid="tag-input"]');
    await page.fill('[data-testid="tag-input"]', 'e2e-test');
    await page.keyboard.press('Enter');

    await page.click('[data-testid="save-note-button"]');

    // Wait for note to appear in timeline
    await expect(page.locator('text=Test note from E2E')).toBeVisible({ timeout: 5000 });
  });

  test('should add and complete a task', async ({ page }) => {
    // Add task
    await page.click('[data-testid="add-task-button"]');

    await page.fill('[data-testid="task-title"]', 'E2E Test Task');
    await page.fill('[data-testid="task-due-date"]', '2024-12-31');
    await page.selectOption('[data-testid="task-priority"]', 'HIGH');

    await page.click('[data-testid="save-task-button"]');

    // Wait for task to appear
    const taskElement = page.locator('[data-testid="timeline-event"]').filter({ hasText: 'E2E Test Task' });
    await expect(taskElement).toBeVisible({ timeout: 5000 });

    // Complete task
    await taskElement.locator('[data-testid="complete-task-button"]').click();

    // Verify completion
    await expect(taskElement.locator('[data-testid="task-completed-badge"]')).toBeVisible();
  });

  test('should log a phone call', async ({ page }) => {
    await page.click('[data-testid="log-call-button"]');

    await page.selectOption('[data-testid="call-direction"]', 'OUTBOUND');
    await page.fill('[data-testid="call-duration"]', '15');
    await page.fill('[data-testid="call-contact"]', 'Jan Kowalski');
    await page.fill('[data-testid="call-summary"]', 'Discussed quarterly report');

    await page.click('[data-testid="save-call-button"]');

    await expect(page.locator('text=Połączenie wychodzące')).toBeVisible({ timeout: 5000 });
  });

  test('should filter timeline by event type', async ({ page }) => {
    await page.click('[data-testid="filter-dropdown"]');
    await page.click('[data-testid="filter-type-NOTE"]');
    await page.click('[data-testid="apply-filters"]');

    // All visible events should be notes
    const events = page.locator('[data-testid="timeline-event"]');
    const count = await events.count();

    for (let i = 0; i < count; i++) {
      await expect(events.nth(i).locator('[data-testid="event-type-badge"]')).toHaveText('NOTE');
    }
  });

  test('should filter timeline by date range', async ({ page }) => {
    await page.click('[data-testid="filter-dropdown"]');
    await page.fill('[data-testid="filter-date-from"]', '2024-01-01');
    await page.fill('[data-testid="filter-date-to"]', '2024-06-30');
    await page.click('[data-testid="apply-filters"]');

    // Verify filter is applied
    await expect(page.locator('[data-testid="active-filter-badge"]')).toContainText('2024-01-01 - 2024-06-30');
  });

  test('should expand event details', async ({ page }) => {
    const firstEvent = page.locator('[data-testid="timeline-event"]').first();
    await firstEvent.click();

    await expect(page.locator('[data-testid="event-details-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="event-metadata"]')).toBeVisible();
  });

  test('should load more events on scroll', async ({ page }) => {
    // Initial count
    const initialCount = await page.locator('[data-testid="timeline-event"]').count();

    // Scroll to bottom
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="timeline-container"]');
      container?.scrollTo(0, container.scrollHeight);
    });

    // Wait for more events to load
    await page.waitForTimeout(1000);

    const newCount = await page.locator('[data-testid="timeline-event"]').count();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should export timeline to CSV', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv-button"]')
    ]);

    expect(download.suggestedFilename()).toMatch(/timeline_.*\.csv$/);
  });
});
```

---

## Security Checklist

- [x] Row Level Security enabled on client_timeline table
- [x] Organization isolation verified via RLS policy
- [x] Client access verification before all operations
- [x] Only manual events can be deleted (system events preserved)
- [x] User tracking on all create/delete operations
- [x] Soft delete preserves audit trail
- [x] Input validation via Zod schemas
- [x] SQL injection prevented via parameterized queries
- [x] XSS prevention via proper output encoding
- [x] File attachment validation (type, size limits)
- [x] Export rate limiting to prevent abuse

---

## Audit Events

| Event Type | Trigger | Data Captured |
|------------|---------|---------------|
| TIMELINE_NOTE_ADDED | Note created | clientId, title |
| TIMELINE_TASK_ADDED | Task created | clientId, title, dueDate, priority |
| TIMELINE_TASK_COMPLETED | Task marked done | eventId, clientId |
| TIMELINE_CALL_LOGGED | Call recorded | clientId, direction, duration |
| TIMELINE_MEETING_LOGGED | Meeting recorded | clientId, title, startTime |
| TIMELINE_EVENT_DELETED | Event soft deleted | eventId, eventType |
| TIMELINE_EXPORTED | Timeline exported | clientId, format, eventCount |

---

## Performance Considerations

- Cursor-based pagination for efficient large dataset navigation
- GIN index on tags for fast tag filtering
- Full-text search index with Polish dictionary
- Composite indexes for common query patterns
- Limit of 100 events per page to prevent memory issues
- Temporary file storage with 24h expiry for exports

---

## Implementation Notes

1. **Event Creation**: System events created automatically via TimelineService hooks integrated with client operations
2. **Real-time Updates**: Consider WebSocket subscription for live timeline updates
3. **Search Optimization**: Polish full-text search configuration for accurate results
4. **Export Performance**: Large exports should be processed asynchronously with download link sent via email
5. **Mobile Optimization**: Virtualized list rendering for performance on mobile devices

---

*Last updated: December 2024*
