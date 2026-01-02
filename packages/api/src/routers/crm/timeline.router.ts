import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { TimelineService } from '../../services/crm/timeline.service';
import {
  createTimelineEventSchema,
  updateTimelineEventSchema,
  getTimelineEventSchema,
  listTimelineEventsSchema,
  deleteTimelineEventSchema,
  bulkCreateTimelineEventsSchema,
  getTimelineStatsSchema,
} from '@ksiegowacrm/shared';

/**
 * Timeline Router (CRM-005)
 * Handles client timeline event management endpoints
 */
export const timelineRouter = router({
  /**
   * Create a new timeline event
   */
  create: protectedProcedure
    .input(createTimelineEventSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TimelineService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.createEvent(input);
    }),

  /**
   * Get a timeline event by ID
   */
  get: protectedProcedure
    .input(getTimelineEventSchema)
    .query(async ({ ctx, input }) => {
      const service = new TimelineService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getEvent(input.eventId);
    }),

  /**
   * Update a timeline event
   */
  update: protectedProcedure
    .input(
      z.object({
        eventId: z.string().uuid(),
        ...updateTimelineEventSchema.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { eventId, ...updateData } = input;
      const service = new TimelineService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.updateEvent(eventId, updateData);
    }),

  /**
   * List timeline events with filters and pagination
   */
  list: protectedProcedure
    .input(listTimelineEventsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TimelineService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.listEvents(input);
    }),

  /**
   * Delete a timeline event
   */
  delete: protectedProcedure
    .input(deleteTimelineEventSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TimelineService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.deleteEvent(input);
    }),

  /**
   * Bulk create timeline events
   */
  bulkCreate: protectedProcedure
    .input(bulkCreateTimelineEventsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TimelineService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkCreateEvents(input);
    }),

  /**
   * Get timeline statistics for a client
   */
  getStats: protectedProcedure
    .input(getTimelineStatsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TimelineService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getTimelineStats(input);
    }),
});

export type TimelineRouter = typeof timelineRouter;
