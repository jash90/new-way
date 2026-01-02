import { router, protectedProcedure } from '../../trpc';
import {
  createClientSchema,
  updateClientSchema,
  getClientSchema,
  listClientsQuerySchema,
  deleteClientSchema,
  restoreClientSchema,
  searchByNipSchema,
  searchByRegonSchema,
  enrichFromGusSchema,
} from '@ksiegowacrm/shared';
import { ClientService } from '../../services/crm/client.service';
import { AuditLogger } from '../../utils/audit-logger';
import { z } from 'zod';

/**
 * Client Router (CRM-001)
 * Handles client profile management operations
 */
export const clientRouter = router({
  // =========================================================================
  // CREATE CLIENT
  // =========================================================================

  /**
   * Create a new client (company or individual)
   * Validates NIP/REGON uniqueness for company clients
   */
  createClient: protectedProcedure
    .input(createClientSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.createClient(input);
    }),

  // =========================================================================
  // GET CLIENT
  // =========================================================================

  /**
   * Get a client by ID
   * Returns full client data with ownership verification
   */
  getClient: protectedProcedure
    .input(getClientSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.getClient(input.clientId);
    }),

  // =========================================================================
  // UPDATE CLIENT
  // =========================================================================

  /**
   * Update client information
   * Supports partial updates for any client field
   */
  updateClient: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
      }).merge(updateClientSchema)
    )
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      const { clientId, ...updateData } = input;
      return clientService.updateClient(clientId, updateData);
    }),

  // =========================================================================
  // LIST CLIENTS
  // =========================================================================

  /**
   * List clients with filtering, pagination, and sorting
   * Supports filtering by type, status, tags, and text search
   */
  listClients: protectedProcedure
    .input(listClientsQuerySchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.listClients(input);
    }),

  // =========================================================================
  // DELETE CLIENT
  // =========================================================================

  /**
   * Delete or archive a client
   * Soft delete (archive) by default, permanent delete with flag
   */
  deleteClient: protectedProcedure
    .input(deleteClientSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.deleteClient(input);
    }),

  // =========================================================================
  // RESTORE CLIENT
  // =========================================================================

  /**
   * Restore an archived client
   * Changes status back to active and clears archivedAt
   */
  restoreClient: protectedProcedure
    .input(restoreClientSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.restoreClient(input);
    }),

  // =========================================================================
  // SEARCH BY NIP
  // =========================================================================

  /**
   * Search for a client by NIP (tax identification number)
   * Returns the client if found, null otherwise
   */
  searchByNip: protectedProcedure
    .input(searchByNipSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.searchByNip(input);
    }),

  // =========================================================================
  // SEARCH BY REGON
  // =========================================================================

  /**
   * Search for a client by REGON (business registry number)
   * Supports both 9-digit and 14-digit REGON
   */
  searchByRegon: protectedProcedure
    .input(searchByRegonSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.searchByRegon(input);
    }),

  // =========================================================================
  // ENRICH FROM GUS
  // =========================================================================

  /**
   * Enrich client data from GUS REGON API
   * Fetches company data by NIP or REGON and updates client fields
   */
  enrichFromGus: protectedProcedure
    .input(enrichFromGusSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const clientService = new ClientService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return clientService.enrichFromGus(input);
    }),
});

export type ClientRouter = typeof clientRouter;
