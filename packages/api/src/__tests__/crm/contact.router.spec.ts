import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

const mockContactServiceMethods = vi.hoisted(() => ({
  createContact: vi.fn(),
  getContact: vi.fn(),
  updateContact: vi.fn(),
  listContacts: vi.fn(),
  deleteContact: vi.fn(),
  restoreContact: vi.fn(),
  setPrimaryContact: vi.fn(),
  bulkCreateContacts: vi.fn(),
  searchContacts: vi.fn(),
}));

// Mock ContactService module
vi.mock('../../services/crm/contact.service', () => ({
  ContactService: vi.fn(() => mockContactServiceMethods),
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

// Alias for cleaner access in tests
const mocks = {
  createContact: mockContactServiceMethods.createContact,
  getContact: mockContactServiceMethods.getContact,
  updateContact: mockContactServiceMethods.updateContact,
  listContacts: mockContactServiceMethods.listContacts,
  deleteContact: mockContactServiceMethods.deleteContact,
  restoreContact: mockContactServiceMethods.restoreContact,
  setPrimaryContact: mockContactServiceMethods.setPrimaryContact,
  bulkCreateContacts: mockContactServiceMethods.bulkCreateContacts,
  searchContacts: mockContactServiceMethods.searchContacts,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  client: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  contact: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
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

// ==========================================================================
// TEST SUITE
// ==========================================================================

describe('Contact Router (CRM-004)', () => {
  // UUIDs
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440100';
  const CONTACT_ID = '550e8400-e29b-41d4-a716-446655440200';
  const CONTACT_ID_2 = '550e8400-e29b-41d4-a716-446655440201';

  // Mock contact data
  const mockContact = {
    id: CONTACT_ID,
    clientId: CLIENT_ID,
    firstName: 'Jan',
    lastName: 'Kowalski',
    fullName: 'Jan Kowalski',
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
  };

  const mockContact2 = {
    ...mockContact,
    id: CONTACT_ID_2,
    firstName: 'Anna',
    lastName: 'Nowak',
    fullName: 'Anna Nowak',
    email: 'anna.nowak@example.com',
    contactType: 'billing',
    isPrimary: false,
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
        url: '/api/trpc/crm.contact',
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
        url: '/api/trpc/crm.contact',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('Authentication', () => {
    it('should require authentication for createContact', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.contact.createContact({
          clientId: CLIENT_ID,
          firstName: 'Jan',
          lastName: 'Kowalski',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should require authentication for getContact', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.contact.getContact({ contactId: CONTACT_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should require authentication for listContacts', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.contact.listContacts({ clientId: CLIENT_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // CREATE CONTACT
  // ===========================================================================

  describe('createContact', () => {
    it('should create a contact successfully', async () => {
      mocks.createContact.mockResolvedValue({
        success: true,
        contact: mockContact,
        message: 'Kontakt utworzony pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.createContact({
        clientId: CLIENT_ID,
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan.kowalski@example.com',
        phone: '+48123456789',
        contactType: 'primary',
        isPrimary: true,
      });

      expect(result.success).toBe(true);
      expect(result.contact.firstName).toBe('Jan');
      expect(result.contact.lastName).toBe('Kowalski');
      expect(mocks.createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: CLIENT_ID,
          firstName: 'Jan',
          lastName: 'Kowalski',
        })
      );
    });

    it('should create contact with minimal data', async () => {
      const minimalContact = {
        ...mockContact,
        email: null,
        phone: null,
        position: null,
      };
      mocks.createContact.mockResolvedValue({
        success: true,
        contact: minimalContact,
        message: 'Kontakt utworzony pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.createContact({
        clientId: CLIENT_ID,
        firstName: 'Jan',
        lastName: 'Kowalski',
      });

      expect(result.success).toBe(true);
      expect(result.contact.firstName).toBe('Jan');
    });

    it('should validate email format', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.createContact({
          clientId: CLIENT_ID,
          firstName: 'Jan',
          lastName: 'Kowalski',
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });

    it('should validate clientId is UUID', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.createContact({
          clientId: 'not-a-uuid',
          firstName: 'Jan',
          lastName: 'Kowalski',
        })
      ).rejects.toThrow();
    });

    it('should validate firstName min length', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.createContact({
          clientId: CLIENT_ID,
          firstName: 'J',
          lastName: 'Kowalski',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET CONTACT
  // ===========================================================================

  describe('getContact', () => {
    it('should get a contact by ID', async () => {
      mocks.getContact.mockResolvedValue(mockContact);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.getContact({
        contactId: CONTACT_ID,
      });

      expect(result.id).toBe(CONTACT_ID);
      expect(result.firstName).toBe('Jan');
      expect(mocks.getContact).toHaveBeenCalledWith(CONTACT_ID);
    });

    it('should validate contactId is UUID', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.getContact({ contactId: 'not-a-uuid' })
      ).rejects.toThrow();
    });

    it('should propagate NOT_FOUND error', async () => {
      mocks.getContact.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Kontakt nie znaleziony' })
      );
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.getContact({ contactId: CONTACT_ID })
      ).rejects.toThrow('Kontakt nie znaleziony');
    });
  });

  // ===========================================================================
  // UPDATE CONTACT
  // ===========================================================================

  describe('updateContact', () => {
    it('should update contact successfully', async () => {
      const updatedContact = { ...mockContact, firstName: 'Janusz' };
      mocks.updateContact.mockResolvedValue({
        success: true,
        contact: updatedContact,
        message: 'Kontakt zaktualizowany pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.updateContact({
        contactId: CONTACT_ID,
        firstName: 'Janusz',
      });

      expect(result.success).toBe(true);
      expect(result.contact.firstName).toBe('Janusz');
      expect(mocks.updateContact).toHaveBeenCalledWith(
        CONTACT_ID,
        expect.objectContaining({ firstName: 'Janusz' })
      );
    });

    it('should update multiple fields', async () => {
      const updatedContact = {
        ...mockContact,
        email: 'new.email@example.com',
        position: 'Director',
      };
      mocks.updateContact.mockResolvedValue({
        success: true,
        contact: updatedContact,
        message: 'Kontakt zaktualizowany pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.updateContact({
        contactId: CONTACT_ID,
        email: 'new.email@example.com',
        position: 'Director',
      });

      expect(result.success).toBe(true);
      expect(result.contact.email).toBe('new.email@example.com');
      expect(result.contact.position).toBe('Director');
    });

    it('should validate email on update', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.updateContact({
          contactId: CONTACT_ID,
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // LIST CONTACTS
  // ===========================================================================

  describe('listContacts', () => {
    it('should list contacts with pagination', async () => {
      mocks.listContacts.mockResolvedValue({
        contacts: [mockContact, mockContact2],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.listContacts({
        clientId: CLIENT_ID,
      });

      expect(result.contacts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(mocks.listContacts).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: CLIENT_ID })
      );
    });

    it('should filter by contact type', async () => {
      mocks.listContacts.mockResolvedValue({
        contacts: [mockContact],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.listContacts({
        clientId: CLIENT_ID,
        contactType: 'primary',
      });

      expect(result.contacts).toHaveLength(1);
      expect(mocks.listContacts).toHaveBeenCalledWith(
        expect.objectContaining({ contactType: 'primary' })
      );
    });

    it('should filter by status', async () => {
      mocks.listContacts.mockResolvedValue({
        contacts: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.listContacts({
        clientId: CLIENT_ID,
        status: 'archived',
      });

      expect(mocks.listContacts).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'archived' })
      );
    });

    it('should support search', async () => {
      mocks.listContacts.mockResolvedValue({
        contacts: [mockContact],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.contact.listContacts({
        clientId: CLIENT_ID,
        search: 'Jan',
      });

      expect(mocks.listContacts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Jan' })
      );
    });

    it('should support pagination parameters', async () => {
      mocks.listContacts.mockResolvedValue({
        contacts: [mockContact],
        total: 50,
        page: 2,
        limit: 10,
        totalPages: 5,
        hasMore: true,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.listContacts({
        clientId: CLIENT_ID,
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('should support sorting', async () => {
      mocks.listContacts.mockResolvedValue({
        contacts: [mockContact2, mockContact],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.contact.listContacts({
        clientId: CLIENT_ID,
        sortBy: 'fullName',
        sortOrder: 'asc',
      });

      expect(mocks.listContacts).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'fullName', sortOrder: 'asc' })
      );
    });
  });

  // ===========================================================================
  // DELETE CONTACT
  // ===========================================================================

  describe('deleteContact', () => {
    it('should soft delete (archive) contact by default', async () => {
      mocks.deleteContact.mockResolvedValue({
        success: true,
        archived: true,
        message: 'Kontakt zarchiwizowany',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.deleteContact({
        contactId: CONTACT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(true);
      expect(mocks.deleteContact).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: CONTACT_ID })
      );
    });

    it('should permanently delete contact when permanent=true', async () => {
      mocks.deleteContact.mockResolvedValue({
        success: true,
        archived: false,
        message: 'Kontakt usunięty trwale',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.deleteContact({
        contactId: CONTACT_ID,
        permanent: true,
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(false);
      expect(mocks.deleteContact).toHaveBeenCalledWith(
        expect.objectContaining({ permanent: true })
      );
    });
  });

  // ===========================================================================
  // RESTORE CONTACT
  // ===========================================================================

  describe('restoreContact', () => {
    it('should restore archived contact', async () => {
      const restoredContact = { ...mockContact, status: 'active', archivedAt: null };
      mocks.restoreContact.mockResolvedValue({
        success: true,
        contact: restoredContact,
        message: 'Kontakt przywrócony',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.restoreContact({
        contactId: CONTACT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.contact.status).toBe('active');
      expect(mocks.restoreContact).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: CONTACT_ID })
      );
    });

    it('should fail for non-archived contact', async () => {
      mocks.restoreContact.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Kontakt nie jest zarchiwizowany' })
      );
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.restoreContact({ contactId: CONTACT_ID })
      ).rejects.toThrow('Kontakt nie jest zarchiwizowany');
    });
  });

  // ===========================================================================
  // SET PRIMARY CONTACT
  // ===========================================================================

  describe('setPrimaryContact', () => {
    it('should set contact as primary', async () => {
      const newPrimaryContact = { ...mockContact2, isPrimary: true };
      mocks.setPrimaryContact.mockResolvedValue({
        success: true,
        contact: newPrimaryContact,
        previousPrimary: mockContact,
        message: 'Kontakt ustawiony jako główny',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.setPrimaryContact({
        contactId: CONTACT_ID_2,
      });

      expect(result.success).toBe(true);
      expect(result.contact.isPrimary).toBe(true);
      expect(result.previousPrimary).toBeDefined();
      expect(mocks.setPrimaryContact).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: CONTACT_ID_2 })
      );
    });

    it('should set primary for specific contact type', async () => {
      mocks.setPrimaryContact.mockResolvedValue({
        success: true,
        contact: { ...mockContact2, isPrimary: true },
        previousPrimary: null,
        message: 'Kontakt ustawiony jako główny',
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.contact.setPrimaryContact({
        contactId: CONTACT_ID_2,
        contactType: 'billing',
      });

      expect(mocks.setPrimaryContact).toHaveBeenCalledWith(
        expect.objectContaining({ contactType: 'billing' })
      );
    });

    it('should fail if contact is already primary', async () => {
      mocks.setPrimaryContact.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Kontakt jest już głównym kontaktem' })
      );
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.setPrimaryContact({ contactId: CONTACT_ID })
      ).rejects.toThrow('Kontakt jest już głównym kontaktem');
    });
  });

  // ===========================================================================
  // BULK CREATE CONTACTS
  // ===========================================================================

  describe('bulkCreateContacts', () => {
    it('should bulk create contacts', async () => {
      mocks.bulkCreateContacts.mockResolvedValue({
        success: true,
        created: 2,
        failed: 0,
        contacts: [mockContact, mockContact2],
        message: 'Utworzono 2 z 2 kontaktów',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.bulkCreateContacts({
        clientId: CLIENT_ID,
        contacts: [
          { firstName: 'Jan', lastName: 'Kowalski' },
          { firstName: 'Anna', lastName: 'Nowak' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.contacts).toHaveLength(2);
      expect(mocks.bulkCreateContacts).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: CLIENT_ID,
          contacts: expect.arrayContaining([
            expect.objectContaining({ firstName: 'Jan' }),
            expect.objectContaining({ firstName: 'Anna' }),
          ]),
        })
      );
    });

    it('should handle partial failures', async () => {
      mocks.bulkCreateContacts.mockResolvedValue({
        success: false,
        created: 1,
        failed: 1,
        contacts: [mockContact],
        errors: [{ index: 1, error: 'Duplicate email' }],
        message: 'Utworzono 1 z 2 kontaktów',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.bulkCreateContacts({
        clientId: CLIENT_ID,
        contacts: [
          { firstName: 'Jan', lastName: 'Kowalski' },
          { firstName: 'Anna', lastName: 'Nowak' },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toBeDefined();
    });

    it('should validate minimum 1 contact', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.bulkCreateContacts({
          clientId: CLIENT_ID,
          contacts: [],
        })
      ).rejects.toThrow();
    });

    it('should validate maximum 50 contacts', async () => {
      const caller = appRouter.createCaller(createUserContext());
      const tooManyContacts = Array(51).fill({ firstName: 'Test', lastName: 'User' });

      await expect(
        caller.crm.contact.bulkCreateContacts({
          clientId: CLIENT_ID,
          contacts: tooManyContacts,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // SEARCH CONTACTS
  // ===========================================================================

  describe('searchContacts', () => {
    it('should search contacts by query', async () => {
      mocks.searchContacts.mockResolvedValue({
        contacts: [mockContact],
        total: 1,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.contact.searchContacts({
        query: 'Jan',
      });

      expect(result.contacts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mocks.searchContacts).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'Jan' })
      );
    });

    it('should search within specific client', async () => {
      mocks.searchContacts.mockResolvedValue({
        contacts: [mockContact],
        total: 1,
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.contact.searchContacts({
        query: 'Kowalski',
        clientId: CLIENT_ID,
      });

      expect(mocks.searchContacts).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: CLIENT_ID })
      );
    });

    it('should filter by contact type in search', async () => {
      mocks.searchContacts.mockResolvedValue({
        contacts: [mockContact],
        total: 1,
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.contact.searchContacts({
        query: 'Manager',
        contactType: 'primary',
      });

      expect(mocks.searchContacts).toHaveBeenCalledWith(
        expect.objectContaining({ contactType: 'primary' })
      );
    });

    it('should respect limit parameter', async () => {
      mocks.searchContacts.mockResolvedValue({
        contacts: [mockContact],
        total: 1,
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.contact.searchContacts({
        query: 'Jan',
        limit: 5,
      });

      expect(mocks.searchContacts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 })
      );
    });

    it('should validate minimum query length', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.searchContacts({ query: 'J' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // INPUT VALIDATION
  // ===========================================================================

  describe('Input Validation', () => {
    it('should validate contact type enum', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.createContact({
          clientId: CLIENT_ID,
          firstName: 'Jan',
          lastName: 'Kowalski',
          contactType: 'invalid' as any,
        })
      ).rejects.toThrow();
    });

    it('should validate status enum in list', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.contact.listContacts({
          clientId: CLIENT_ID,
          status: 'invalid' as any,
        })
      ).rejects.toThrow();
    });

    it('should validate notes max length', async () => {
      const caller = appRouter.createCaller(createUserContext());
      const longNotes = 'a'.repeat(2001);

      await expect(
        caller.crm.contact.createContact({
          clientId: CLIENT_ID,
          firstName: 'Jan',
          lastName: 'Kowalski',
          notes: longNotes,
        })
      ).rejects.toThrow();
    });
  });
});
