import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  CreateContactInput,
  UpdateContactInput,
  ListContactsInput,
  DeleteContactInput,
  RestoreContactInput,
  SetPrimaryContactInput,
  BulkCreateContactsInput,
  SearchContactsInput,
  ContactOutput,
  PaginatedContacts,
  ContactCreateResult,
  ContactUpdateResult,
  ContactDeleteResult,
  ContactRestoreResult,
  BulkCreateContactsResult,
  ContactSearchResult,
  SetPrimaryContactResult,
} from '@ksiegowacrm/shared';

/**
 * ContactService (CRM-004)
 * Handles contact management operations for clients
 *
 * TODO: This service requires the following Prisma schema addition:
 * - Contact model for storing client contact persons
 *
 * All methods in this service require the Contact model to be added to the schema.
 */

class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model which is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

export class ContactService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string | null
  ) {
    // Suppress unused warnings - reserved for future Contact model implementation
    void this.prisma;
    void this.redis;
    void this.auditLogger;
    void this.userId;
    void this.organizationId;
  }

  // ===========================================
  // STUBBED METHODS - Require Contact Prisma Model
  // ===========================================

  // All methods below require the Contact model to be added to the Prisma schema.
  // They are stubbed to throw NotImplementedError until the schema is updated.

  async createContact(_input: CreateContactInput): Promise<ContactCreateResult> {
    void _input;
    throw new NotImplementedError('createContact', 'Contact');
  }

  async getContact(_contactId: string): Promise<ContactOutput> {
    void _contactId;
    throw new NotImplementedError('getContact', 'Contact');
  }

  async updateContact(
    _contactId: string,
    _input: UpdateContactInput
  ): Promise<ContactUpdateResult> {
    void _contactId;
    void _input;
    throw new NotImplementedError('updateContact', 'Contact');
  }

  async listContacts(_input: ListContactsInput): Promise<PaginatedContacts> {
    void _input;
    throw new NotImplementedError('listContacts', 'Contact');
  }

  async deleteContact(_input: DeleteContactInput): Promise<ContactDeleteResult> {
    void _input;
    throw new NotImplementedError('deleteContact', 'Contact');
  }

  async restoreContact(_input: RestoreContactInput): Promise<ContactRestoreResult> {
    void _input;
    throw new NotImplementedError('restoreContact', 'Contact');
  }

  async setPrimaryContact(_input: SetPrimaryContactInput): Promise<SetPrimaryContactResult> {
    void _input;
    throw new NotImplementedError('setPrimaryContact', 'Contact');
  }

  async bulkCreateContacts(_input: BulkCreateContactsInput): Promise<BulkCreateContactsResult> {
    void _input;
    throw new NotImplementedError('bulkCreateContacts', 'Contact');
  }

  async searchContacts(_input: SearchContactsInput): Promise<ContactSearchResult> {
    void _input;
    throw new NotImplementedError('searchContacts', 'Contact');
  }
}
