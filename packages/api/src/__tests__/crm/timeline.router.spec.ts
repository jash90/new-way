import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ===========================================
// CRM-005: Timeline Router Tests
// ===========================================

// Mock setup - MUST use vi.hoisted for correct timing
const mockTimelineServiceMethods = vi.hoisted(() => ({
  createEvent: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  listEvents: vi.fn(),
  deleteEvent: vi.fn(),
  bulkCreateEvents: vi.fn(),
  getTimelineStats: vi.fn(),
  createSystemEvent: vi.fn(),
}));

vi.mock('../../services/crm/timeline.service', () => ({
  TimelineService: vi.fn(() => mockTimelineServiceMethods),
}));

// Mock @ksiegowacrm/auth
vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
  argon2Service: {
    verify: vi.fn().mockResolvedValue(true),
  },
  TotpService: vi.fn().mockImplementation(() => ({
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  })),
  totpService: {
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  },
}));

// Alias for cleaner access
const mocks = mockTimelineServiceMethods;

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  client: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
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
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

describe('Timeline Router (CRM-005)', () => {
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440100';
  const EVENT_ID = '550e8400-e29b-41d4-a716-446655440300';
  const CONTACT_ID = '550e8400-e29b-41d4-a716-446655440200';

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
    createdById: TEST_USER_ID,
    relatedContactId: null,
    relatedDocumentId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mocks for Redis
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);

    // Default mocks for Prisma
    mockPrisma.authAuditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
      status: 'ACTIVE',
      isEmailVerified: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // CONTEXT HELPERS
  // ===========================================================================

  function createUserContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer user-token',
        },
        url: '/api/trpc/crm.timeline',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: TEST_USER_ID,
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: ORG_ID,
      },
    };
  }

  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/crm.timeline',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ===========================================
  // AUTHENTICATION TESTS
  // ===========================================

  describe('Authentication', () => {
    it('should require authentication for create', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.timeline.create({
          clientId: CLIENT_ID,
          eventType: 'note',
          title: 'Test note',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================
  // CREATE EVENT
  // ===========================================

  describe('create', () => {
    it('should create a timeline event successfully', async () => {
      mocks.createEvent.mockResolvedValue({
        success: true,
        event: mockEvent,
        message: 'Zdarzenie utworzone pomyślnie',
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.create({
        clientId: CLIENT_ID,
        eventType: 'note',
        title: 'Client meeting notes',
        description: 'Discussed Q1 planning',
      });

      expect(result.success).toBe(true);
      expect(result.event.title).toBe('Client meeting notes');
      expect(mocks.createEvent).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        eventType: 'note',
        title: 'Client meeting notes',
        description: 'Discussed Q1 planning',
        importance: 'normal',
      });
    });

    it('should create event with optional fields', async () => {
      const eventWithOptions = {
        ...mockEvent,
        importance: 'high',
        scheduledAt: new Date('2025-01-20'),
        relatedContactId: CONTACT_ID,
      };

      mocks.createEvent.mockResolvedValue({
        success: true,
        event: eventWithOptions,
        message: 'Zdarzenie utworzone pomyślnie',
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.create({
        clientId: CLIENT_ID,
        eventType: 'meeting',
        title: 'Q1 Review Meeting',
        importance: 'high',
        scheduledAt: new Date('2025-01-20'),
        relatedContactId: CONTACT_ID,
      });

      expect(result.success).toBe(true);
      expect(mocks.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          importance: 'high',
          relatedContactId: CONTACT_ID,
        })
      );
    });
  });

  // ===========================================
  // GET EVENT
  // ===========================================

  describe('get', () => {
    it('should get a timeline event by ID', async () => {
      mocks.getEvent.mockResolvedValue(mockEvent);

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.get({
        eventId: EVENT_ID,
      });

      expect(result.id).toBe(EVENT_ID);
      expect(result.title).toBe('Client meeting notes');
      expect(mocks.getEvent).toHaveBeenCalledWith(EVENT_ID);
    });

    it('should throw NOT_FOUND if event does not exist', async () => {
      mocks.getEvent.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Zdarzenie nie znalezione',
        })
      );

      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.timeline.get({ eventId: EVENT_ID })
      ).rejects.toThrow('Zdarzenie nie znalezione');
    });
  });

  // ===========================================
  // UPDATE EVENT
  // ===========================================

  describe('update', () => {
    it('should update a timeline event successfully', async () => {
      const updatedEvent = { ...mockEvent, title: 'Updated meeting notes' };
      mocks.updateEvent.mockResolvedValue({
        success: true,
        event: updatedEvent,
        message: 'Zdarzenie zaktualizowane pomyślnie',
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.update({
        eventId: EVENT_ID,
        title: 'Updated meeting notes',
      });

      expect(result.success).toBe(true);
      expect(result.event.title).toBe('Updated meeting notes');
      expect(mocks.updateEvent).toHaveBeenCalledWith(
        EVENT_ID,
        { title: 'Updated meeting notes' }
      );
    });

    it('should update multiple fields', async () => {
      const updatedEvent = {
        ...mockEvent,
        title: 'New title',
        description: 'New description',
        importance: 'high',
      };
      mocks.updateEvent.mockResolvedValue({
        success: true,
        event: updatedEvent,
        message: 'Zdarzenie zaktualizowane pomyślnie',
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.update({
        eventId: EVENT_ID,
        title: 'New title',
        description: 'New description',
        importance: 'high',
      });

      expect(result.success).toBe(true);
      expect(mocks.updateEvent).toHaveBeenCalledWith(
        EVENT_ID,
        expect.objectContaining({
          title: 'New title',
          description: 'New description',
          importance: 'high',
        })
      );
    });
  });

  // ===========================================
  // LIST EVENTS (TIMELINE)
  // ===========================================

  describe('list', () => {
    it('should list timeline events with pagination', async () => {
      mocks.listEvents.mockResolvedValue({
        events: [mockEvent],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.list({
        clientId: CLIENT_ID,
      });

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mocks.listEvents).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        page: 1,
        limit: 20,
        sortOrder: 'desc',
      });
    });

    it('should filter by event types', async () => {
      mocks.listEvents.mockResolvedValue({
        events: [mockEvent],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });

      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.timeline.list({
        clientId: CLIENT_ID,
        eventTypes: ['note', 'meeting'],
      });

      expect(mocks.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          eventTypes: ['note', 'meeting'],
        })
      );
    });

    it('should filter by importance', async () => {
      mocks.listEvents.mockResolvedValue({
        events: [mockEvent],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });

      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.timeline.list({
        clientId: CLIENT_ID,
        importance: 'high',
      });

      expect(mocks.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          importance: 'high',
        })
      );
    });

    it('should filter by date range', async () => {
      mocks.listEvents.mockResolvedValue({
        events: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
      });

      const caller = appRouter.createCaller(createUserContext());

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await caller.crm.timeline.list({
        clientId: CLIENT_ID,
        startDate,
        endDate,
      });

      expect(mocks.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate,
          endDate,
        })
      );
    });

    it('should search by text', async () => {
      mocks.listEvents.mockResolvedValue({
        events: [mockEvent],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });

      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.timeline.list({
        clientId: CLIENT_ID,
        search: 'meeting',
      });

      expect(mocks.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'meeting',
        })
      );
    });

    it('should handle pagination parameters', async () => {
      mocks.listEvents.mockResolvedValue({
        events: [mockEvent],
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasMore: true,
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.list({
        clientId: CLIENT_ID,
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
      expect(mocks.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 10,
        })
      );
    });

    it('should sort in ascending order when specified', async () => {
      mocks.listEvents.mockResolvedValue({
        events: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
      });

      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.timeline.list({
        clientId: CLIENT_ID,
        sortOrder: 'asc',
      });

      expect(mocks.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 'asc',
        })
      );
    });
  });

  // ===========================================
  // DELETE EVENT
  // ===========================================

  describe('delete', () => {
    it('should delete a timeline event successfully', async () => {
      mocks.deleteEvent.mockResolvedValue({
        success: true,
        message: 'Zdarzenie usunięte',
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.delete({
        eventId: EVENT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Zdarzenie usunięte');
      expect(mocks.deleteEvent).toHaveBeenCalledWith({
        eventId: EVENT_ID,
      });
    });

    it('should throw NOT_FOUND if event does not exist', async () => {
      mocks.deleteEvent.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Zdarzenie nie znalezione',
        })
      );

      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.timeline.delete({ eventId: EVENT_ID })
      ).rejects.toThrow('Zdarzenie nie znalezione');
    });
  });

  // ===========================================
  // BULK CREATE EVENTS
  // ===========================================

  describe('bulkCreate', () => {
    it('should bulk create events successfully', async () => {
      mocks.bulkCreateEvents.mockResolvedValue({
        success: true,
        created: 2,
        failed: 0,
        events: [mockEvent, { ...mockEvent, id: 'event-2', eventType: 'call' }],
        message: 'Utworzono 2 z 2 zdarzeń',
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.bulkCreate({
        clientId: CLIENT_ID,
        events: [
          { eventType: 'note', title: 'Note 1' },
          { eventType: 'call', title: 'Call 1' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.failed).toBe(0);
      expect(mocks.bulkCreateEvents).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        events: [
          { eventType: 'note', title: 'Note 1', importance: 'normal' },
          { eventType: 'call', title: 'Call 1', importance: 'normal' },
        ],
      });
    });

    it('should handle partial failures', async () => {
      mocks.bulkCreateEvents.mockResolvedValue({
        success: false,
        created: 1,
        failed: 1,
        events: [mockEvent],
        errors: [{ index: 1, error: 'Database error' }],
        message: 'Utworzono 1 z 2 zdarzeń',
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.bulkCreate({
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
    });

    it('should throw BAD_REQUEST if events array exceeds limit', async () => {
      mocks.bulkCreateEvents.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Maksymalnie można utworzyć 50 zdarzeń jednocześnie',
        })
      );

      const caller = appRouter.createCaller(createUserContext());

      const tooManyEvents = Array(51).fill({
        eventType: 'note',
        title: 'Test',
      });

      await expect(
        caller.crm.timeline.bulkCreate({
          clientId: CLIENT_ID,
          events: tooManyEvents,
        })
      ).rejects.toThrow(); // Zod schema validates max 50 events
    });
  });

  // ===========================================
  // GET TIMELINE STATS
  // ===========================================

  describe('getStats', () => {
    it('should return timeline statistics for a client', async () => {
      mocks.getTimelineStats.mockResolvedValue({
        clientId: CLIENT_ID,
        period: 'month',
        totalEvents: 15,
        eventsByType: { note: 8, call: 5, meeting: 2 },
        eventsByImportance: { normal: 10, high: 5 },
        recentActivity: [mockEvent],
        lastEventAt: mockEvent.createdAt,
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.getStats({
        clientId: CLIENT_ID,
        period: 'month',
      });

      expect(result.clientId).toBe(CLIENT_ID);
      expect(result.period).toBe('month');
      expect(result.totalEvents).toBe(15);
      expect(result.eventsByType.note).toBe(8);
      expect(result.eventsByImportance.normal).toBe(10);
      expect(result.recentActivity).toHaveLength(1);
      expect(mocks.getTimelineStats).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        period: 'month',
      });
    });

    it('should filter stats by different periods', async () => {
      mocks.getTimelineStats.mockResolvedValue({
        clientId: CLIENT_ID,
        period: 'week',
        totalEvents: 5,
        eventsByType: {},
        eventsByImportance: {},
        recentActivity: [],
        lastEventAt: null,
      });

      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.timeline.getStats({
        clientId: CLIENT_ID,
        period: 'week',
      });

      expect(mocks.getTimelineStats).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        period: 'week',
      });
    });

    it('should handle empty timeline', async () => {
      mocks.getTimelineStats.mockResolvedValue({
        clientId: CLIENT_ID,
        period: 'month',
        totalEvents: 0,
        eventsByType: {},
        eventsByImportance: {},
        recentActivity: [],
        lastEventAt: null,
      });

      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.timeline.getStats({
        clientId: CLIENT_ID,
      });

      expect(result.totalEvents).toBe(0);
      expect(result.eventsByType).toEqual({});
      expect(result.recentActivity).toEqual([]);
      expect(result.lastEventAt).toBeNull();
    });
  });
});
