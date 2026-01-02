import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { SearchService } from '../../services/crm/search.service';
import {
  advancedSearchInputSchema,
  searchSuggestionInputSchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  deleteSavedSearchSchema,
  listSavedSearchesSchema,
} from '@ksiegowacrm/shared';

/**
 * Search Router (CRM-008)
 * Handles advanced search and saved searches
 */
export const searchRouter = router({
  /**
   * Advanced search across clients and contacts
   */
  advancedSearch: protectedProcedure
    .input(advancedSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new SearchService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.advancedSearch(input);
    }),

  /**
   * Get search suggestions for autocomplete
   */
  getSuggestions: protectedProcedure
    .input(searchSuggestionInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new SearchService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getSearchSuggestions(input);
    }),

  /**
   * Create a saved search
   */
  createSavedSearch: protectedProcedure
    .input(createSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SearchService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.createSavedSearch(input);
    }),

  /**
   * Update a saved search
   */
  updateSavedSearch: protectedProcedure
    .input(updateSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SearchService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.updateSavedSearch(input);
    }),

  /**
   * Delete a saved search
   */
  deleteSavedSearch: protectedProcedure
    .input(deleteSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new SearchService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.deleteSavedSearch(input);
    }),

  /**
   * List user's saved searches
   */
  listSavedSearches: protectedProcedure
    .input(listSavedSearchesSchema)
    .query(async ({ ctx, input }) => {
      const service = new SearchService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.listSavedSearches(input);
    }),

  /**
   * Execute a saved search
   */
  executeSavedSearch: protectedProcedure
    .input(
      z.object({
        searchId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { searchId, page, limit } = input;
      const service = new SearchService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.executeSavedSearch(searchId, { page, limit });
    }),
});

export type SearchRouter = typeof searchRouter;
