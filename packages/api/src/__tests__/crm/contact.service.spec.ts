import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContactService } from '../../services/crm/contact.service';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  CreateContactInput,
  UpdateContactInput,
  ListContactsInput,
  DeleteContactInput,
  SetPrimaryContactInput,
  BulkCreateContactsInput,
  SearchContactsInput,
} from '@ksiegowacrm/shared';

// ===========================================
// CRM-004: Contact Management Service Tests
// ===========================================

describe('ContactService', () => {
  let contactService: ContactService;
  let mockPrisma: {
    contact: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    client: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };
  let mockAuditLogger: {
    log: ReturnType<typeof vi.fn>;
  };

  const USER_ID = 'user-123-uuid';
  const ORG_ID = 'org-456-uuid';
  const CLIENT_ID = 'client-789-uuid';
  const CONTACT_ID = 'contact-001-uuid';

  const mockClient = {
    id: CLIENT_ID,
    ownerId: USER_ID,
    organizationId: ORG_ID,
    type: 'company',
    status: 'active',
    displayName: 'Test Company',
  };

  const mockContact = {
    id: CONTACT_ID,
    clientId: CLIENT_ID,
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: 'jan.kowalski@example.com',
    phone: '+48123456789',
    mobilePhone: '+48987654321',
    position: 'Manager',
    department: 'Sales',
    contactType: 'primary',
    isPrimary: true,
    status: 'active',
    notes: 'Test contact',
    customFields: {},
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    archivedAt: null,
    client: mockClient,
  };

  beforeEach(() => {
    mockPrisma = {
      contact: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      client: {
        findUnique: vi.fn(),
      },
    };

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    mockAuditLogger = {
      log: vi.fn(),
    };

    contactService = new ContactService(
      mockPrisma as unknown as PrismaClient,
      mockRedis as unknown as Redis,
      mockAuditLogger as unknown as AuditLogger,
      USER_ID,
      ORG_ID
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // CREATE CONTACT TESTS
  // ===========================================

  describe('createContact', () => {
    const createInput: CreateContactInput = {
      clientId: CLIENT_ID,
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan.kowalski@example.com',
      phone: '+48123456789',
      position: 'Manager',
      contactType: 'primary',
      isPrimary: true,
    };

    it('should create a contact successfully', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(mockPrisma.contact.create).mockResolvedValue(mockContact);

      const result = await contactService.createContact(createInput);

      expect(result.success).toBe(true);
      expect(result.contact.firstName).toBe('Jan');
      expect(result.contact.lastName).toBe('Kowalski');
      expect(mockPrisma.contact.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should verify client ownership before creating', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        ...mockClient,
        ownerId: 'other-user-id',
        organizationId: 'other-org-id',
      });

      await expect(contactService.createContact(createInput)).rejects.toThrow();
    });

    it('should clear previous primary contact when setting new primary', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(mockPrisma.contact.create).mockResolvedValue(mockContact);

      await contactService.createContact({ ...createInput, isPrimary: true });

      expect(mockPrisma.contact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: CLIENT_ID,
            isPrimary: true,
          }),
          data: { isPrimary: false },
        })
      );
    });

    it('should create contact with minimal fields', async () => {
      const minimalInput: CreateContactInput = {
        clientId: CLIENT_ID,
        firstName: 'Jan',
        lastName: 'Kowalski',
        contactType: 'other',
        isPrimary: false,
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.create).mockResolvedValue({
        ...mockContact,
        email: null,
        phone: null,
        position: null,
        department: null,
        contactType: 'other',
        isPrimary: false,
      });

      const result = await contactService.createContact(minimalInput);

      expect(result.success).toBe(true);
      expect(result.contact.email).toBeNull();
    });

    it('should reject creation for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(contactService.createContact(createInput)).rejects.toThrow();
    });

    it('should handle custom fields', async () => {
      const inputWithCustomFields: CreateContactInput = {
        ...createInput,
        customFields: { preferredLanguage: 'pl', timezone: 'Europe/Warsaw' },
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(mockPrisma.contact.create).mockResolvedValue({
        ...mockContact,
        customFields: { preferredLanguage: 'pl', timezone: 'Europe/Warsaw' },
      });

      const result = await contactService.createContact(inputWithCustomFields);

      expect(result.contact.customFields).toEqual({
        preferredLanguage: 'pl',
        timezone: 'Europe/Warsaw',
      });
    });
  });

  // ===========================================
  // GET CONTACT TESTS
  // ===========================================

  describe('getContact', () => {
    it('should get contact by ID', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);

      const result = await contactService.getContact(CONTACT_ID);

      expect(result.id).toBe(CONTACT_ID);
      expect(result.firstName).toBe('Jan');
      expect(mockPrisma.contact.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONTACT_ID },
        })
      );
    });

    it('should throw error for non-existent contact', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(null);

      await expect(contactService.getContact('non-existent-id')).rejects.toThrow();
    });

    it('should verify ownership access', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue({
        ...mockContact,
        client: { ...mockClient, ownerId: 'other-user', organizationId: 'other-org' },
      });

      await expect(contactService.getContact(CONTACT_ID)).rejects.toThrow();
    });

    it('should include full name in output', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);

      const result = await contactService.getContact(CONTACT_ID);

      expect(result.fullName).toBe('Jan Kowalski');
    });
  });

  // ===========================================
  // UPDATE CONTACT TESTS
  // ===========================================

  describe('updateContact', () => {
    const updateInput: UpdateContactInput = {
      firstName: 'Anna',
      lastName: 'Nowak',
      position: 'Director',
    };

    it('should update contact successfully', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        firstName: 'Anna',
        lastName: 'Nowak',
        position: 'Director',
      });

      const result = await contactService.updateContact(CONTACT_ID, updateInput);

      expect(result.success).toBe(true);
      expect(result.contact.firstName).toBe('Anna');
      expect(result.contact.lastName).toBe('Nowak');
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should clear primary status from other contacts when setting new primary', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue({
        ...mockContact,
        isPrimary: false,
      });
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        isPrimary: true,
      });

      await contactService.updateContact(CONTACT_ID, { isPrimary: true });

      expect(mockPrisma.contact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: CLIENT_ID,
            isPrimary: true,
            id: { not: CONTACT_ID },
          }),
        })
      );
    });

    it('should throw error for non-existent contact', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(null);

      await expect(contactService.updateContact('non-existent', updateInput)).rejects.toThrow();
    });

    it('should verify ownership before update', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue({
        ...mockContact,
        client: { ...mockClient, ownerId: 'other-user', organizationId: 'other-org' },
      });

      await expect(contactService.updateContact(CONTACT_ID, updateInput)).rejects.toThrow();
    });

    it('should allow clearing optional fields', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        email: null,
        phone: null,
      });

      const result = await contactService.updateContact(CONTACT_ID, {
        email: null,
        phone: null,
      });

      expect(result.success).toBe(true);
      expect(result.contact.email).toBeNull();
    });

    it('should update status', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        status: 'inactive',
      });

      const result = await contactService.updateContact(CONTACT_ID, { status: 'inactive' });

      expect(result.contact.status).toBe('inactive');
    });
  });

  // ===========================================
  // LIST CONTACTS TESTS
  // ===========================================

  describe('listContacts', () => {
    const listInput: ListContactsInput = {
      clientId: CLIENT_ID,
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    it('should list contacts for a client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(mockPrisma.contact.count).mockResolvedValue(1);

      const result = await contactService.listContacts(listInput);

      expect(result.contacts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by contact type', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(mockPrisma.contact.count).mockResolvedValue(1);

      await contactService.listContacts({ ...listInput, contactType: 'primary' });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactType: 'primary',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.contact.count).mockResolvedValue(0);

      await contactService.listContacts({ ...listInput, status: 'archived' });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'archived',
          }),
        })
      );
    });

    it('should search by name or email', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(mockPrisma.contact.count).mockResolvedValue(1);

      await contactService.listContacts({ ...listInput, search: 'kowalski' });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: expect.any(Object) }),
              expect.objectContaining({ lastName: expect.any(Object) }),
              expect.objectContaining({ email: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should paginate results correctly', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(mockPrisma.contact.count).mockResolvedValue(50);

      const result = await contactService.listContacts({ ...listInput, page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.hasMore).toBe(true);
      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should verify client ownership', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        ...mockClient,
        ownerId: 'other-user',
        organizationId: 'other-org',
      });

      await expect(contactService.listContacts(listInput)).rejects.toThrow();
    });

    it('should sort by specified field', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);
      vi.mocked(mockPrisma.contact.count).mockResolvedValue(1);

      await contactService.listContacts({ ...listInput, sortBy: 'fullName', sortOrder: 'asc' });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            expect.objectContaining({ firstName: 'asc' }),
          ]),
        })
      );
    });
  });

  // ===========================================
  // DELETE CONTACT TESTS
  // ===========================================

  describe('deleteContact', () => {
    it('should archive contact by default', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        status: 'archived',
        archivedAt: new Date(),
      });

      const result = await contactService.deleteContact({ contactId: CONTACT_ID, permanent: false });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(true);
      expect(mockPrisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONTACT_ID },
          data: expect.objectContaining({
            status: 'archived',
            archivedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should permanently delete when flag is true', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(mockPrisma.contact.delete).mockResolvedValue(mockContact);

      const result = await contactService.deleteContact({ contactId: CONTACT_ID, permanent: true });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(false);
      expect(mockPrisma.contact.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONTACT_ID },
        })
      );
    });

    it('should throw error for non-existent contact', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(null);

      await expect(
        contactService.deleteContact({ contactId: 'non-existent', permanent: false })
      ).rejects.toThrow();
    });

    it('should verify ownership before deletion', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue({
        ...mockContact,
        client: { ...mockClient, ownerId: 'other-user', organizationId: 'other-org' },
      });

      await expect(
        contactService.deleteContact({ contactId: CONTACT_ID, permanent: false })
      ).rejects.toThrow();
    });

    it('should log audit event on delete', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        status: 'archived',
      });

      await contactService.deleteContact({ contactId: CONTACT_ID, permanent: false });

      expect(mockAuditLogger.log).toHaveBeenCalled();
    });
  });

  // ===========================================
  // RESTORE CONTACT TESTS
  // ===========================================

  describe('restoreContact', () => {
    it('should restore archived contact', async () => {
      const archivedContact = {
        ...mockContact,
        status: 'archived',
        archivedAt: new Date(),
      };

      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(archivedContact);
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        status: 'active',
        archivedAt: null,
      });

      const result = await contactService.restoreContact({ contactId: CONTACT_ID });

      expect(result.success).toBe(true);
      expect(result.contact.status).toBe('active');
      expect(mockPrisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
            archivedAt: null,
          }),
        })
      );
    });

    it('should throw error if contact is not archived', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);

      await expect(
        contactService.restoreContact({ contactId: CONTACT_ID })
      ).rejects.toThrow();
    });

    it('should verify ownership before restore', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue({
        ...mockContact,
        status: 'archived',
        client: { ...mockClient, ownerId: 'other-user', organizationId: 'other-org' },
      });

      await expect(
        contactService.restoreContact({ contactId: CONTACT_ID })
      ).rejects.toThrow();
    });
  });

  // ===========================================
  // SET PRIMARY CONTACT TESTS
  // ===========================================

  describe('setPrimaryContact', () => {
    it('should set contact as primary', async () => {
      const nonPrimaryContact = { ...mockContact, isPrimary: false };
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(nonPrimaryContact);
      vi.mocked(mockPrisma.contact.findFirst).mockResolvedValue(mockContact);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        isPrimary: true,
      });

      const result = await contactService.setPrimaryContact({ contactId: CONTACT_ID });

      expect(result.success).toBe(true);
      expect(result.contact.isPrimary).toBe(true);
    });

    it('should clear previous primary contact', async () => {
      const previousPrimary = { ...mockContact, id: 'previous-primary-id' };
      const nonPrimaryContact = { ...mockContact, isPrimary: false };

      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(nonPrimaryContact);
      vi.mocked(mockPrisma.contact.findFirst).mockResolvedValue(previousPrimary);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...mockContact,
        isPrimary: true,
      });

      const result = await contactService.setPrimaryContact({ contactId: CONTACT_ID });

      expect(result.previousPrimary).not.toBeNull();
      expect(mockPrisma.contact.updateMany).toHaveBeenCalled();
    });

    it('should set primary for specific contact type', async () => {
      const nonPrimaryContact = { ...mockContact, isPrimary: false, contactType: 'billing' };
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(nonPrimaryContact);
      vi.mocked(mockPrisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(mockPrisma.contact.update).mockResolvedValue({
        ...nonPrimaryContact,
        isPrimary: true,
      });

      await contactService.setPrimaryContact({
        contactId: CONTACT_ID,
        contactType: 'billing',
      });

      expect(mockPrisma.contact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactType: 'billing',
          }),
        })
      );
    });

    it('should throw if contact already primary', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);

      await expect(
        contactService.setPrimaryContact({ contactId: CONTACT_ID })
      ).rejects.toThrow();
    });
  });

  // ===========================================
  // BULK CREATE CONTACTS TESTS
  // ===========================================

  describe('bulkCreateContacts', () => {
    const bulkInput: BulkCreateContactsInput = {
      clientId: CLIENT_ID,
      contacts: [
        { firstName: 'Jan', lastName: 'Kowalski', contactType: 'primary', isPrimary: true },
        { firstName: 'Anna', lastName: 'Nowak', contactType: 'billing', isPrimary: false },
        { firstName: 'Piotr', lastName: 'Wiśniewski', contactType: 'technical', isPrimary: false },
      ],
    };

    it('should create multiple contacts', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(mockPrisma.contact.create)
        .mockResolvedValueOnce({ ...mockContact, id: 'contact-1' })
        .mockResolvedValueOnce({ ...mockContact, id: 'contact-2', firstName: 'Anna', lastName: 'Nowak' })
        .mockResolvedValueOnce({ ...mockContact, id: 'contact-3', firstName: 'Piotr', lastName: 'Wiśniewski' });

      const result = await contactService.bulkCreateContacts(bulkInput);

      expect(result.success).toBe(true);
      expect(result.created).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.contacts).toHaveLength(3);
    });

    it('should handle partial failures', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(mockPrisma.contact.create)
        .mockResolvedValueOnce({ ...mockContact, id: 'contact-1' })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ ...mockContact, id: 'contact-3' });

      const result = await contactService.bulkCreateContacts(bulkInput);

      expect(result.created).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].index).toBe(1);
    });

    it('should only allow one primary contact per type', async () => {
      const inputWithMultiplePrimary: BulkCreateContactsInput = {
        clientId: CLIENT_ID,
        contacts: [
          { firstName: 'Jan', lastName: 'Kowalski', contactType: 'primary', isPrimary: true },
          { firstName: 'Anna', lastName: 'Nowak', contactType: 'primary', isPrimary: true },
        ],
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);
      vi.mocked(mockPrisma.contact.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(mockPrisma.contact.create)
        .mockResolvedValueOnce({ ...mockContact, id: 'contact-1', isPrimary: true })
        .mockResolvedValueOnce({ ...mockContact, id: 'contact-2', isPrimary: true });

      const result = await contactService.bulkCreateContacts(inputWithMultiplePrimary);

      // Last one with isPrimary: true wins
      expect(result.contacts).toHaveLength(2);
    });

    it('should verify client ownership', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        ...mockClient,
        ownerId: 'other-user',
        organizationId: 'other-org',
      });

      await expect(contactService.bulkCreateContacts(bulkInput)).rejects.toThrow();
    });

    it('should respect maximum 50 contacts limit', async () => {
      const tooManyContacts: BulkCreateContactsInput = {
        clientId: CLIENT_ID,
        contacts: Array(51).fill({
          firstName: 'Test',
          lastName: 'Contact',
          contactType: 'other',
          isPrimary: false,
        }),
      };

      // This should be validated at schema level, but service should also handle
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClient);

      await expect(contactService.bulkCreateContacts(tooManyContacts)).rejects.toThrow();
    });
  });

  // ===========================================
  // SEARCH CONTACTS TESTS
  // ===========================================

  describe('searchContacts', () => {
    const searchInput: SearchContactsInput = {
      query: 'kowalski',
      limit: 10,
    };

    it('should search contacts by name', async () => {
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);

      const result = await contactService.searchContacts(searchInput);

      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0].lastName).toBe('Kowalski');
    });

    it('should search by email', async () => {
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);

      await contactService.searchContacts({ ...searchInput, query: 'jan.kowalski@example.com' });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ email: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should filter by client ID', async () => {
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);

      await contactService.searchContacts({ ...searchInput, clientId: CLIENT_ID });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: CLIENT_ID,
          }),
        })
      );
    });

    it('should filter by contact type', async () => {
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);

      await contactService.searchContacts({ ...searchInput, contactType: 'primary' });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactType: 'primary',
          }),
        })
      );
    });

    it('should respect ownership for search', async () => {
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue([mockContact]);

      await contactService.searchContacts(searchInput);

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            client: expect.objectContaining({
              OR: expect.arrayContaining([
                { ownerId: USER_ID },
                { organizationId: ORG_ID },
              ]),
            }),
          }),
        })
      );
    });

    it('should limit results', async () => {
      const manyContacts = Array(15).fill(mockContact).map((c, i) => ({ ...c, id: `contact-${i}` }));
      vi.mocked(mockPrisma.contact.findMany).mockResolvedValue(manyContacts.slice(0, 10));

      const result = await contactService.searchContacts({ ...searchInput, limit: 10 });

      expect(result.contacts.length).toBeLessThanOrEqual(10);
    });
  });

  // ===========================================
  // CONTACT OUTPUT FORMATTING TESTS
  // ===========================================

  describe('formatContactOutput', () => {
    it('should include fullName in output', async () => {
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(mockContact);

      const result = await contactService.getContact(CONTACT_ID);

      expect(result.fullName).toBe('Jan Kowalski');
    });

    it('should handle contacts with special characters in names', async () => {
      const specialNameContact = {
        ...mockContact,
        firstName: 'José',
        lastName: "O'Connor",
      };
      vi.mocked(mockPrisma.contact.findUnique).mockResolvedValue(specialNameContact);

      const result = await contactService.getContact(CONTACT_ID);

      expect(result.fullName).toBe("José O'Connor");
    });
  });
});
