import { z } from 'zod';

// ===========================================
// CRM-005: Client Timeline Schemas
// ===========================================

// Timeline event types
export const timelineEventTypeSchema = z.enum([
  'note',           // Manual note added
  'call',           // Phone call
  'meeting',        // Meeting (in-person or virtual)
  'email',          // Email communication
  'document',       // Document uploaded/linked
  'status_change',  // Client status changed
  'contact_added',  // Contact person added
  'contact_updated', // Contact person updated
  'vat_validated',  // VAT validation performed
  'task_created',   // Task created for client
  'task_completed', // Task completed
  'invoice',        // Invoice created/sent
  'payment',        // Payment received
  'custom',         // Custom event
]);

export type TimelineEventType = z.infer<typeof timelineEventTypeSchema>;

// Event importance/priority
export const timelineImportanceSchema = z.enum([
  'low',
  'normal',
  'high',
  'critical',
]);

export type TimelineImportance = z.infer<typeof timelineImportanceSchema>;

// ===========================================
// CREATE EVENT
// ===========================================

export const createTimelineEventSchema = z.object({
  clientId: z.string().uuid(),
  eventType: timelineEventTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  importance: timelineImportanceSchema.default('normal'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.date().optional(),
  dueAt: z.date().optional(),
  relatedContactId: z.string().uuid().optional(),
  relatedDocumentId: z.string().uuid().optional(),
});

export type CreateTimelineEventInput = z.infer<typeof createTimelineEventSchema>;

// ===========================================
// UPDATE EVENT
// ===========================================

export const updateTimelineEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  importance: timelineImportanceSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.date().nullable().optional(),
  dueAt: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
});

export type UpdateTimelineEventInput = z.infer<typeof updateTimelineEventSchema>;

// ===========================================
// GET EVENT
// ===========================================

export const getTimelineEventSchema = z.object({
  eventId: z.string().uuid(),
});

export type GetTimelineEventInput = z.infer<typeof getTimelineEventSchema>;

// ===========================================
// LIST EVENTS (TIMELINE)
// ===========================================

export const listTimelineEventsSchema = z.object({
  clientId: z.string().uuid(),
  eventTypes: z.array(timelineEventTypeSchema).optional(),
  importance: timelineImportanceSchema.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  search: z.string().min(2).max(100).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListTimelineEventsInput = z.infer<typeof listTimelineEventsSchema>;

// ===========================================
// DELETE EVENT
// ===========================================

export const deleteTimelineEventSchema = z.object({
  eventId: z.string().uuid(),
});

export type DeleteTimelineEventInput = z.infer<typeof deleteTimelineEventSchema>;

// ===========================================
// BULK CREATE EVENTS
// ===========================================

export const bulkCreateTimelineEventsSchema = z.object({
  clientId: z.string().uuid(),
  events: z.array(
    z.object({
      eventType: timelineEventTypeSchema,
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      importance: timelineImportanceSchema.default('normal'),
      metadata: z.record(z.string(), z.unknown()).optional(),
      scheduledAt: z.date().optional(),
    })
  ).min(1).max(50),
});

export type BulkCreateTimelineEventsInput = z.infer<typeof bulkCreateTimelineEventsSchema>;

// ===========================================
// GET TIMELINE STATS
// ===========================================

export const getTimelineStatsSchema = z.object({
  clientId: z.string().uuid(),
  period: z.enum(['week', 'month', 'quarter', 'year', 'all']).default('month'),
});

export type GetTimelineStatsInput = z.infer<typeof getTimelineStatsSchema>;

// ===========================================
// OUTPUT TYPES
// ===========================================

export interface TimelineEventOutput {
  id: string;
  clientId: string;
  eventType: TimelineEventType;
  title: string;
  description: string | null;
  importance: string;
  metadata: Record<string, unknown>;
  scheduledAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdById: string;
  relatedContactId: string | null;
  relatedDocumentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTimelineEvents {
  events: TimelineEventOutput[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface TimelineEventCreateResult {
  success: boolean;
  event: TimelineEventOutput;
  message: string;
}

export interface TimelineEventUpdateResult {
  success: boolean;
  event: TimelineEventOutput;
  message: string;
}

export interface TimelineEventDeleteResult {
  success: boolean;
  message: string;
}

export interface BulkCreateTimelineEventsResult {
  success: boolean;
  created: number;
  failed: number;
  events: TimelineEventOutput[];
  errors?: Array<{ index: number; error: string }>;
  message: string;
}

export interface TimelineStatsResult {
  clientId: string;
  period: string;
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByImportance: Record<string, number>;
  recentActivity: TimelineEventOutput[];
  lastEventAt: Date | null;
}
