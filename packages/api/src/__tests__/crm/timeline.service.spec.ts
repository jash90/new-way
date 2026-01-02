import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { TimelineService } from '../../services/crm/timeline.service';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';

// ===========================================
// CRM-005: Timeline Service Tests
// ===========================================

describe('Timeline Service (CRM-005)', () => {
  let timelineService: TimelineService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockAuditLogger: any;

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440100';
  const EVENT_ID = '550e8400-e29b-41d4-a716-446655440300';
  const EVENT_ID_2 = '550e8400-e29b-41d4-a716-446655440301';
  const CONTACT_ID = '550e8400-e29b-41d4-a716-446655440200';

  const mockClient = {
    id: CLIENT_ID,
    ownerId: USER_ID,
    organizationId: ORG_ID,
    type: 'COMPANY',
    status: 'active',
    displayName: 'Test Company',
  };

  const mockEvent = {
    id: EVENT_ID,
    clientId: CLIENT_ID,
    eventType: 'note',
    title: 'Client meeting notes',
    description: 'Discussed Q1 planning',
    importance: 'normal',
    metadata: {},
    scheduledAt: null,
    dueAt: null,
    completedAt: null,
    createdById: USER_ID,
    relatedContactId: null,
    relatedDocumentId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockEvent2 = {
    ...mockEvent,
    id: EVENT_ID_2,
    eventType: 'call',
    title: 'Follow-up call',
    importance: 'high',
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-02'),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    mockPrisma = {
      client: {
        findUnique: vi.fn(),
      },
      timelineEvent: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    mockAuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    timelineService = new TimelineService(
      mockPrisma as unknown as PrismaClient,
      mockRedis as unknown as Redis,
      mockAuditLogger as unknown as AuditLogger,
      USER_ID,
      ORG_ID
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================
  // CREATE EVENT
  // ===========================================

  describe('createEvent', () => {
    it('should create a timeline event successfully', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.create.mockResolvedValue(mockEvent);

      const result = await timelineService.createEvent({
        clientId: CLIENT_ID,
        eventType: 'note',
        title: 'Client meeting notes',
        description: 'Discussed Q1 planning',
      });

      expect(result.success).toBe(true);
      expect(result.event.title).toBe('Client meeting notes');
      expect(result.event.eventType).toBe('note');
      expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: CLIENT_ID,
          eventType: 'note',
          title: 'Client meeting notes',
          createdById: USER_ID,
        }),
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TIMELINE_EVENT_CREATED',
          resourceType: 'TimelineEvent',
        })
      );
    });

    it('should create event with all optional fields', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const eventWithAllFields = {
        ...mockEvent,
        relatedContactId: CONTACT_ID,
        scheduledAt: new Date('2025-01-20'),
        dueAt: new Date('2025-01-25'),
        metadata: { meetingType: 'quarterly_review' },
      };
      mockPrisma.timelineEvent.create.mockResolvedValue(eventWithAllFields);

      const result = await timelineService.createEvent({
        clientId: CLIENT_ID,
        eventType: 'meeting',
        title: 'Q1 Review Meeting',
        importance: 'high',
        relatedContactId: CONTACT_ID,
        scheduledAt: new Date('2025-01-20'),
        dueAt: new Date('2025-01-25'),
        metadata: { meetingType: 'quarterly_review' },
      });

      expect(result.success).toBe(true);
      expect(result.event.importance).toBe('normal'); // from mockEvent
      expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          relatedContactId: CONTACT_ID,
          scheduledAt: expect.any(Date),
          dueAt: expect.any(Date),
          metadata: expect.objectContaining({ meetingType: 'quarterly_review' }),
        }),
      });
    });

    it('should throw NOT_FOUND if client does not exist', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(
        timelineService.createEvent({
          clientId: CLIENT_ID,
          eventType: 'note',
          title: 'Test note',
        })
      ).rejects.toThrow(TRPCError);

      await expect(
        timelineService.createEvent({
          clientId: CLIENT_ID,
          eventType: 'note',
          title: 'Test note',
        })
      ).rejects.toThrow('Klient nie znaleziony');
    });

    it('should throw FORBIDDEN if user has no access to client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        ownerId: 'other-user-id',
        organizationId: 'other-org-id',
      });

      await expect(
        timelineService.createEvent({
          clientId: CLIENT_ID,
          eventType: 'note',
          title: 'Test note',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should allow access via organization membership', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        ownerId: 'other-user-id', // Different owner
        organizationId: ORG_ID, // Same organization
      });
      mockPrisma.timelineEvent.create.mockResolvedValue(mockEvent);

      const result = await timelineService.createEvent({
        clientId: CLIENT_ID,
        eventType: 'note',
        title: 'Test note',
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================
  // GET EVENT
  // ===========================================

  describe('getEvent', () => {
    it('should get a timeline event by ID', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue({
        ...mockEvent,
        client: mockClient,
      });

      const result = await timelineService.getEvent(EVENT_ID);

      expect(result.id).toBe(EVENT_ID);
      expect(result.title).toBe('Client meeting notes');
      expect(mockPrisma.timelineEvent.findUnique).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        include: { client: true },
      });
    });

    it('should throw NOT_FOUND if event does not exist', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue(null);

      await expect(
        timelineService.getEvent(EVENT_ID)
      ).rejects.toThrow('Zdarzenie nie znalezione');
    });

    it('should throw FORBIDDEN if user has no access', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue({
        ...mockEvent,
        client: {
          ...mockClient,
          ownerId: 'other-user-id',
          organizationId: 'other-org-id',
        },
      });

      await expect(
        timelineService.getEvent(EVENT_ID)
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================
  // UPDATE EVENT
  // ===========================================

  describe('updateEvent', () => {
    it('should update a timeline event successfully', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue({
        ...mockEvent,
        client: mockClient,
      });
      const updatedEvent = { ...mockEvent, title: 'Updated meeting notes' };
      mockPrisma.timelineEvent.update.mockResolvedValue(updatedEvent);

      const result = await timelineService.updateEvent(EVENT_ID, {
        title: 'Updated meeting notes',
      });

      expect(result.success).toBe(true);
      expect(result.event.title).toBe('Updated meeting notes');
      expect(mockPrisma.timelineEvent.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: expect.objectContaining({ title: 'Updated meeting notes' }),
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TIMELINE_EVENT_UPDATED',
        })
      );
    });

    it('should update multiple fields', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue({
        ...mockEvent,
        client: mockClient,
      });
      const updatedEvent = {
        ...mockEvent,
        title: 'New title',
        description: 'New description',
        importance: 'high',
      };
      mockPrisma.timelineEvent.update.mockResolvedValue(updatedEvent);

      const result = await timelineService.updateEvent(EVENT_ID, {
        title: 'New title',
        description: 'New description',
        importance: 'high',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.timelineEvent.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: expect.objectContaining({
          title: 'New title',
          description: 'New description',
          importance: 'high',
        }),
      });
    });

    it('should mark event as completed', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue({
        ...mockEvent,
        client: mockClient,
      });
      const completedEvent = {
        ...mockEvent,
        completedAt: new Date('2025-01-15'),
      };
      mockPrisma.timelineEvent.update.mockResolvedValue(completedEvent);

      const result = await timelineService.updateEvent(EVENT_ID, {
        completedAt: new Date('2025-01-15'),
      });

      expect(result.success).toBe(true);
      expect(result.event.completedAt).toEqual(new Date('2025-01-15'));
    });

    it('should throw NOT_FOUND if event does not exist', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue(null);

      await expect(
        timelineService.updateEvent(EVENT_ID, { title: 'New title' })
      ).rejects.toThrow('Zdarzenie nie znalezione');
    });
  });

  // ===========================================
  // LIST EVENTS (TIMELINE)
  // ===========================================

  describe('listEvents', () => {
    it('should list timeline events with pagination', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent, mockEvent2]);
      mockPrisma.timelineEvent.count.mockResolvedValue(2);

      const result = await timelineService.listEvents({
        clientId: CLIENT_ID,
      });

      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: CLIENT_ID },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by event types', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent]);
      mockPrisma.timelineEvent.count.mockResolvedValue(1);

      const result = await timelineService.listEvents({
        clientId: CLIENT_ID,
        eventTypes: ['note', 'meeting'],
      });

      expect(result.events).toHaveLength(1);
      expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: { in: ['note', 'meeting'] },
          }),
        })
      );
    });

    it('should filter by importance', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent2]);
      mockPrisma.timelineEvent.count.mockResolvedValue(1);

      const result = await timelineService.listEvents({
        clientId: CLIENT_ID,
        importance: 'high',
      });

      expect(result.events).toHaveLength(1);
      expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            importance: 'high',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent]);
      mockPrisma.timelineEvent.count.mockResolvedValue(1);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await timelineService.listEvents({
        clientId: CLIENT_ID,
        startDate,
        endDate,
      });

      expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should search by title and description', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent]);
      mockPrisma.timelineEvent.count.mockResolvedValue(1);

      await timelineService.listEvents({
        clientId: CLIENT_ID,
        search: 'meeting',
      });

      expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'meeting', mode: 'insensitive' } },
              { description: { contains: 'meeting', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent]);
      mockPrisma.timelineEvent.count.mockResolvedValue(25);

      const result = await timelineService.listEvents({
        clientId: CLIENT_ID,
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
      expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should sort in ascending order when specified', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent]);
      mockPrisma.timelineEvent.count.mockResolvedValue(1);

      await timelineService.listEvents({
        clientId: CLIENT_ID,
        sortOrder: 'asc',
      });

      expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });
  });

  // ===========================================
  // DELETE EVENT
  // ===========================================

  describe('deleteEvent', () => {
    it('should delete a timeline event successfully', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue({
        ...mockEvent,
        client: mockClient,
      });
      mockPrisma.timelineEvent.delete.mockResolvedValue(mockEvent);

      const result = await timelineService.deleteEvent({
        eventId: EVENT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Zdarzenie usunięte');
      expect(mockPrisma.timelineEvent.delete).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TIMELINE_EVENT_DELETED',
        })
      );
    });

    it('should throw NOT_FOUND if event does not exist', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue(null);

      await expect(
        timelineService.deleteEvent({ eventId: EVENT_ID })
      ).rejects.toThrow('Zdarzenie nie znalezione');
    });

    it('should throw FORBIDDEN if user has no access', async () => {
      mockPrisma.timelineEvent.findUnique.mockResolvedValue({
        ...mockEvent,
        client: {
          ...mockClient,
          ownerId: 'other-user-id',
          organizationId: 'other-org-id',
        },
      });

      await expect(
        timelineService.deleteEvent({ eventId: EVENT_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================
  // BULK CREATE EVENTS
  // ===========================================

  describe('bulkCreateEvents', () => {
    it('should bulk create events successfully', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.create
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(mockEvent2);

      const result = await timelineService.bulkCreateEvents({
        clientId: CLIENT_ID,
        events: [
          { eventType: 'note', title: 'Note 1' },
          { eventType: 'call', title: 'Call 1' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.events).toHaveLength(2);
      expect(mockPrisma.timelineEvent.create).toHaveBeenCalledTimes(2);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TIMELINE_EVENTS_BULK_CREATED',
        })
      );
    });

    it('should handle partial failures', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.create
        .mockResolvedValueOnce(mockEvent)
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await timelineService.bulkCreateEvents({
        clientId: CLIENT_ID,
        events: [
          { eventType: 'note', title: 'Note 1' },
          { eventType: 'call', title: 'Call 1' },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].index).toBe(1);
    });

    it('should throw BAD_REQUEST if events array exceeds limit', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      const tooManyEvents = Array(51).fill({
        eventType: 'note',
        title: 'Test',
      });

      await expect(
        timelineService.bulkCreateEvents({
          clientId: CLIENT_ID,
          events: tooManyEvents,
        })
      ).rejects.toThrow('Maksymalnie można utworzyć 50 zdarzeń jednocześnie');
    });
  });

  // ===========================================
  // GET TIMELINE STATS
  // ===========================================

  describe('getTimelineStats', () => {
    it('should return timeline statistics for a client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.count.mockResolvedValue(15);
      mockPrisma.timelineEvent.groupBy
        .mockResolvedValueOnce([
          { eventType: 'note', _count: 8 },
          { eventType: 'call', _count: 5 },
          { eventType: 'meeting', _count: 2 },
        ])
        .mockResolvedValueOnce([
          { importance: 'normal', _count: 10 },
          { importance: 'high', _count: 5 },
        ]);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent2, mockEvent]);

      const result = await timelineService.getTimelineStats({
        clientId: CLIENT_ID,
        period: 'month',
      });

      expect(result.clientId).toBe(CLIENT_ID);
      expect(result.period).toBe('month');
      expect(result.totalEvents).toBe(15);
      expect(result.eventsByType).toEqual({
        note: 8,
        call: 5,
        meeting: 2,
      });
      expect(result.eventsByImportance).toEqual({
        normal: 10,
        high: 5,
      });
      expect(result.recentActivity).toHaveLength(2);
    });

    it('should filter stats by period', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.timelineEvent.groupBy.mockResolvedValue([]);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([]);

      await timelineService.getTimelineStats({
        clientId: CLIENT_ID,
        period: 'week',
      });

      // Should filter by last 7 days
      expect(mockPrisma.timelineEvent.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          clientId: CLIENT_ID,
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      });
    });

    it('should handle all period option', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.count.mockResolvedValue(100);
      mockPrisma.timelineEvent.groupBy.mockResolvedValue([]);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([]);

      await timelineService.getTimelineStats({
        clientId: CLIENT_ID,
        period: 'all',
      });

      // Should not filter by date for 'all' period
      expect(mockPrisma.timelineEvent.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          clientId: CLIENT_ID,
        }),
      });
    });

    it('should return last event date', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.count.mockResolvedValue(10);
      mockPrisma.timelineEvent.groupBy.mockResolvedValue([]);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([mockEvent2]);

      const result = await timelineService.getTimelineStats({
        clientId: CLIENT_ID,
        period: 'month',
      });

      expect(result.lastEventAt).toEqual(mockEvent2.createdAt);
    });

    it('should handle empty timeline', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.timelineEvent.count.mockResolvedValue(0);
      mockPrisma.timelineEvent.groupBy.mockResolvedValue([]);
      mockPrisma.timelineEvent.findMany.mockResolvedValue([]);

      const result = await timelineService.getTimelineStats({
        clientId: CLIENT_ID,
        period: 'month',
      });

      expect(result.totalEvents).toBe(0);
      expect(result.eventsByType).toEqual({});
      expect(result.eventsByImportance).toEqual({});
      expect(result.recentActivity).toEqual([]);
      expect(result.lastEventAt).toBeNull();
    });
  });

  // ===========================================
  // SYSTEM EVENT CREATION
  // ===========================================

  describe('createSystemEvent', () => {
    it('should create automatic system events', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const systemEvent = {
        ...mockEvent,
        eventType: 'status_change',
        title: 'Status zmieniony na aktywny',
        metadata: { previousStatus: 'pending', newStatus: 'active' },
      };
      mockPrisma.timelineEvent.create.mockResolvedValue(systemEvent);

      const result = await timelineService.createSystemEvent(CLIENT_ID, {
        eventType: 'status_change',
        title: 'Status zmieniony na aktywny',
        metadata: { previousStatus: 'pending', newStatus: 'active' },
      });

      expect(result.success).toBe(true);
      expect(result.event.eventType).toBe('status_change');
    });

    it('should create VAT validation event', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const vatEvent = {
        ...mockEvent,
        eventType: 'vat_validated',
        title: 'Walidacja VAT: PL1234567890',
        metadata: { vatNumber: 'PL1234567890', status: 'ACTIVE' },
      };
      mockPrisma.timelineEvent.create.mockResolvedValue(vatEvent);

      const result = await timelineService.createSystemEvent(CLIENT_ID, {
        eventType: 'vat_validated',
        title: 'Walidacja VAT: PL1234567890',
        metadata: { vatNumber: 'PL1234567890', status: 'ACTIVE' },
      });

      expect(result.success).toBe(true);
      expect(result.event.eventType).toBe('vat_validated');
    });

    it('should create contact added event', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const contactEvent = {
        ...mockEvent,
        eventType: 'contact_added',
        title: 'Dodano kontakt: Jan Kowalski',
        relatedContactId: CONTACT_ID,
      };
      mockPrisma.timelineEvent.create.mockResolvedValue(contactEvent);

      const result = await timelineService.createSystemEvent(CLIENT_ID, {
        eventType: 'contact_added',
        title: 'Dodano kontakt: Jan Kowalski',
        relatedContactId: CONTACT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.event.relatedContactId).toBe(CONTACT_ID);
    });
  });
});
