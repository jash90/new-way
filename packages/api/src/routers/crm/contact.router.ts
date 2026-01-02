import { router, protectedProcedure } from '../../trpc';
import {
  createContactSchema,
  updateContactSchema,
  getContactSchema,
  listContactsSchema,
  deleteContactSchema,
  restoreContactSchema,
  setPrimaryContactSchema,
  bulkCreateContactsSchema,
  searchContactsSchema,
} from '@ksiegowacrm/shared';
import { ContactService } from '../../services/crm/contact.service';
import { AuditLogger } from '../../utils/audit-logger';
import { z } from 'zod';

/**
 * Contact Router (CRM-004)
 * Handles contact management operations for clients
 */
export const contactRouter = router({
  // =========================================================================
  // CREATE CONTACT
  // =========================================================================

  /**
   * Create a new contact for a client
   * Supports primary contact designation
   */
  createContact: protectedProcedure
    .input(createContactSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.createContact(input);
    }),

  // =========================================================================
  // GET CONTACT
  // =========================================================================

  /**
   * Get a contact by ID
   * Returns full contact data with ownership verification
   */
  getContact: protectedProcedure
    .input(getContactSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.getContact(input.contactId);
    }),

  // =========================================================================
  // UPDATE CONTACT
  // =========================================================================

  /**
   * Update contact information
   * Supports partial updates for any contact field
   */
  updateContact: protectedProcedure
    .input(
      z.object({
        contactId: z.string().uuid(),
      }).merge(updateContactSchema)
    )
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      const { contactId, ...updateData } = input;
      return contactService.updateContact(contactId, updateData);
    }),

  // =========================================================================
  // LIST CONTACTS
  // =========================================================================

  /**
   * List contacts for a client with filtering and pagination
   * Supports filtering by type, status, and text search
   */
  listContacts: protectedProcedure
    .input(listContactsSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.listContacts(input);
    }),

  // =========================================================================
  // DELETE CONTACT
  // =========================================================================

  /**
   * Delete or archive a contact
   * Soft delete (archive) by default, permanent delete with flag
   */
  deleteContact: protectedProcedure
    .input(deleteContactSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.deleteContact(input);
    }),

  // =========================================================================
  // RESTORE CONTACT
  // =========================================================================

  /**
   * Restore an archived contact
   * Changes status back to active and clears archivedAt
   */
  restoreContact: protectedProcedure
    .input(restoreContactSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.restoreContact(input);
    }),

  // =========================================================================
  // SET PRIMARY CONTACT
  // =========================================================================

  /**
   * Set a contact as the primary contact
   * Optionally can set primary for a specific contact type
   */
  setPrimaryContact: protectedProcedure
    .input(setPrimaryContactSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.setPrimaryContact(input);
    }),

  // =========================================================================
  // BULK CREATE CONTACTS
  // =========================================================================

  /**
   * Create multiple contacts for a client in batch
   * Maximum 50 contacts per request
   */
  bulkCreateContacts: protectedProcedure
    .input(bulkCreateContactsSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.bulkCreateContacts(input);
    }),

  // =========================================================================
  // SEARCH CONTACTS
  // =========================================================================

  /**
   * Search contacts across all accessible clients
   * Can filter by client ID and contact type
   */
  searchContacts: protectedProcedure
    .input(searchContactsSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const contactService = new ContactService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return contactService.searchContacts(input);
    }),
});

export type ContactRouter = typeof contactRouter;
