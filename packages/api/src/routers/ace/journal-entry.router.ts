import { router, protectedProcedure } from '../../trpc';
import { JournalEntryService } from '../../services/ace/journal-entry.service';
import {
  createJournalEntrySchema,
  getJournalEntrySchema,
  updateJournalEntrySchema,
  deleteJournalEntrySchema,
  postJournalEntrySchema,
  queryJournalEntriesSchema,
  validateJournalEntrySchema,
  getJournalEntryStatsSchema,
  copyJournalEntrySchema,
  getNextEntryNumberSchema,
  attachDocumentSchema,
  detachDocumentSchema,
  bulkPostEntriesSchema,
  bulkDeleteEntriesSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-006: Journal Entry Router
 * Manages journal entries for double-entry bookkeeping
 */
export const journalEntryRouter = router({
  // =========================================================================
  // CRUD OPERATIONS
  // =========================================================================

  /**
   * Create a new journal entry
   * Validates balanced debits/credits at schema level
   */
  createEntry: protectedProcedure
    .input(createJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createEntry(input);
    }),

  /**
   * Get journal entry by ID
   * Optionally includes lines
   */
  getEntry: protectedProcedure
    .input(getJournalEntrySchema)
    .query(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getEntry(input);
    }),

  /**
   * Update draft journal entry
   * Only draft entries can be modified
   */
  updateEntry: protectedProcedure
    .input(updateJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateEntry(input);
    }),

  /**
   * Delete draft journal entry
   * Only draft entries can be deleted
   */
  deleteEntry: protectedProcedure
    .input(deleteJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteEntry(input);
    }),

  // =========================================================================
  // POSTING
  // =========================================================================

  /**
   * Post journal entry to general ledger
   * Creates GL entries and updates account balances
   */
  postEntry: protectedProcedure
    .input(postJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.postEntry(input);
    }),

  // =========================================================================
  // QUERIES
  // =========================================================================

  /**
   * Query journal entries with filters
   * Supports pagination, date ranges, status, entry type, search
   */
  queryEntries: protectedProcedure
    .input(queryJournalEntriesSchema)
    .query(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.queryEntries(input);
    }),

  /**
   * Validate entry before posting
   * Returns validation errors and warnings
   */
  validateEntry: protectedProcedure
    .input(validateJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.validateEntry(input);
    }),

  /**
   * Get entry statistics
   * Counts by status and type, totals
   */
  getStats: protectedProcedure
    .input(getJournalEntryStatsSchema)
    .query(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getStats(input);
    }),

  // =========================================================================
  // UTILITY
  // =========================================================================

  /**
   * Copy/duplicate journal entry
   * Creates new draft entry with same lines
   */
  copyEntry: protectedProcedure
    .input(copyJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.copyEntry(input);
    }),

  /**
   * Get next entry number preview
   * Shows what the next entry number will be
   */
  getNextEntryNumber: protectedProcedure
    .input(getNextEntryNumberSchema)
    .query(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getNextEntryNumber(input);
    }),

  // =========================================================================
  // ATTACHMENTS
  // =========================================================================

  /**
   * Attach document to entry
   */
  attachDocument: protectedProcedure
    .input(attachDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.attachDocument(input);
    }),

  /**
   * Detach document from entry
   */
  detachDocument: protectedProcedure
    .input(detachDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.detachDocument(input);
    }),

  // =========================================================================
  // BULK OPERATIONS
  // =========================================================================

  /**
   * Bulk post multiple entries
   * Posts entries individually with partial failure support
   */
  bulkPostEntries: protectedProcedure
    .input(bulkPostEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.bulkPostEntries(input);
    }),

  /**
   * Bulk delete draft entries
   * Deletes entries individually, skipping non-draft
   */
  bulkDeleteEntries: protectedProcedure
    .input(bulkDeleteEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JournalEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.bulkDeleteEntries(input);
    }),
});

export type JournalEntryRouter = typeof journalEntryRouter;
