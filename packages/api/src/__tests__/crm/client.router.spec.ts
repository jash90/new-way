import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

const mockClientServiceMethods = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClient: vi.fn(),
  updateClient: vi.fn(),
  listClients: vi.fn(),
  deleteClient: vi.fn(),
  restoreClient: vi.fn(),
  searchByNip: vi.fn(),
  searchByRegon: vi.fn(),
  enrichFromGus: vi.fn(),
}));

// Mock ClientService module
vi.mock('../../services/crm/client.service', () => ({
  ClientService: vi.fn(() => mockClientServiceMethods),
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
  createClient: mockClientServiceMethods.createClient,
  getClient: mockClientServiceMethods.getClient,
  updateClient: mockClientServiceMethods.updateClient,
  listClients: mockClientServiceMethods.listClients,
  deleteClient: mockClientServiceMethods.deleteClient,
  restoreClient: mockClientServiceMethods.restoreClient,
  searchByNip: mockClientServiceMethods.searchByNip,
  searchByRegon: mockClientServiceMethods.searchByRegon,
  enrichFromGus: mockClientServiceMethods.enrichFromGus,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  client: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

describe('Client Router (CRM-001)', () => {
  // UUIDs
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440100';
  const CLIENT_ID_2 = '550e8400-e29b-41d4-a716-446655440101';
  const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655449999';

  // Test data - Company client
  const companyClientOutput = {
    id: CLIENT_ID,
    type: 'company' as const,
    status: 'active' as const,
    displayName: 'Testowa Firma Sp. z o.o.',
    companyName: 'Testowa Firma Sp. z o.o.',
    nip: '5213017228',
    regon: '123456785',
    krs: '0000123456',
    legalForm: 'Spółka z ograniczoną odpowiedzialnością',
    pkdCodes: ['62.01.Z', '62.02.Z'],
    firstName: null,
    lastName: null,
    pesel: null,
    email: 'kontakt@testowa-firma.pl',
    phone: '+48123456789',
    website: 'https://testowa-firma.pl',
    street: 'Marszałkowska',
    buildingNumber: '100',
    apartmentNumber: '5A',
    postalCode: '00-001',
    city: 'Warszawa',
    voivodeship: 'mazowieckie',
    country: 'PL',
    gusEnrichedAt: null,
    gusData: null,
    ownerId: TEST_USER_ID,
    organizationId: ORG_ID,
    tags: ['vip', 'enterprise'],
    customFields: { industry: 'IT', employees: '50-100' },
    notes: 'Klient premium',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15'),
    archivedAt: null,
  };

  // Test data - Individual client
  const individualClientOutput = {
    id: CLIENT_ID_2,
    type: 'individual' as const,
    status: 'active' as const,
    displayName: 'Jan Kowalski',
    companyName: null,
    nip: null,
    regon: null,
    krs: null,
    legalForm: null,
    pkdCodes: [],
    firstName: 'Jan',
    lastName: 'Kowalski',
    pesel: '90010112345',
    email: 'jan.kowalski@example.com',
    phone: '+48987654321',
    website: null,
    street: 'Krakowska',
    buildingNumber: '50',
    apartmentNumber: null,
    postalCode: '30-001',
    city: 'Kraków',
    voivodeship: 'małopolskie',
    country: 'PL',
    gusEnrichedAt: null,
    gusData: null,
    ownerId: TEST_USER_ID,
    organizationId: ORG_ID,
    tags: ['retail'],
    customFields: {},
    notes: null,
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-02'),
    archivedAt: null,
  };

  // Paginated response
  const paginatedClients = {
    clients: [companyClientOutput, individualClientOutput],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasMore: false,
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
        url: '/api/trpc/crm.client',
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
        url: '/api/trpc/crm.client',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ===========================================================================
  // CREATE CLIENT
  // ===========================================================================

  describe('createClient', () => {
    it('should create a company client', async () => {
      mocks.createClient.mockResolvedValue({
        success: true,
        client: companyClientOutput,
        message: 'Klient został utworzony',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.createClient({
        type: 'company',
        companyName: 'Testowa Firma Sp. z o.o.',
        nip: '5213017228',
        regon: '123456785',
        email: 'kontakt@testowa-firma.pl',
        phone: '+48123456789',
      });

      expect(result.success).toBe(true);
      expect(result.client.type).toBe('company');
      expect(result.client.companyName).toBe('Testowa Firma Sp. z o.o.');
      expect(mocks.createClient).toHaveBeenCalled();
    });

    it('should create an individual client', async () => {
      mocks.createClient.mockResolvedValue({
        success: true,
        client: individualClientOutput,
        message: 'Klient został utworzony',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.createClient({
        type: 'individual',
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan.kowalski@example.com',
        phone: '+48987654321',
      });

      expect(result.success).toBe(true);
      expect(result.client.type).toBe('individual');
      expect(result.client.firstName).toBe('Jan');
      expect(result.client.lastName).toBe('Kowalski');
    });

    it('should create company client with full details', async () => {
      mocks.createClient.mockResolvedValue({
        success: true,
        client: companyClientOutput,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.createClient({
        type: 'company',
        companyName: 'Testowa Firma Sp. z o.o.',
        nip: '5213017228',
        regon: '123456785',
        krs: '0000123456',
        legalForm: 'Spółka z ograniczoną odpowiedzialnością',
        pkdCodes: ['62.01.Z', '62.02.Z'],
        email: 'kontakt@testowa-firma.pl',
        phone: '+48123456789',
        website: 'https://testowa-firma.pl',
        street: 'Marszałkowska',
        buildingNumber: '100',
        apartmentNumber: '5A',
        postalCode: '00-001',
        city: 'Warszawa',
        voivodeship: 'mazowieckie',
        country: 'PL',
        tags: ['vip', 'enterprise'],
        customFields: { industry: 'IT' },
        notes: 'Klient premium',
      });

      expect(result.success).toBe(true);
      expect(result.client.website).toBe('https://testowa-firma.pl');
    });

    it('should reject invalid NIP format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          nip: 'invalid-nip',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid REGON format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          regon: 'invalid',
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate NIP', async () => {
      mocks.createClient.mockRejectedValue(
        new TRPCError({ code: 'CONFLICT', message: 'Klient z tym NIP już istnieje' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Duplicate',
          nip: '5213017228',
        })
      ).rejects.toThrow('Klient z tym NIP już istnieje');
    });
  });

  // ===========================================================================
  // GET CLIENT
  // ===========================================================================

  describe('getClient', () => {
    it('should return client by ID', async () => {
      mocks.getClient.mockResolvedValue(companyClientOutput);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.getClient({
        clientId: CLIENT_ID,
      });

      expect(result.id).toBe(CLIENT_ID);
      expect(result.type).toBe('company');
      expect(mocks.getClient).toHaveBeenCalledWith(CLIENT_ID);
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.getClient.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.getClient({ clientId: NON_EXISTENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });

    it('should validate UUID format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.getClient({ clientId: 'invalid-uuid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // UPDATE CLIENT
  // ===========================================================================

  describe('updateClient', () => {
    it('should update client basic info', async () => {
      mocks.updateClient.mockResolvedValue({
        success: true,
        client: {
          ...companyClientOutput,
          email: 'nowy@testowa-firma.pl',
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.updateClient({
        clientId: CLIENT_ID,
        email: 'nowy@testowa-firma.pl',
      });

      expect(result.success).toBe(true);
      expect(result.client.email).toBe('nowy@testowa-firma.pl');
    });

    it('should update client address', async () => {
      mocks.updateClient.mockResolvedValue({
        success: true,
        client: {
          ...companyClientOutput,
          city: 'Kraków',
          postalCode: '30-001',
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.updateClient({
        clientId: CLIENT_ID,
        city: 'Kraków',
        postalCode: '30-001',
      });

      expect(result.success).toBe(true);
      expect(result.client.city).toBe('Kraków');
    });

    it('should update client status', async () => {
      mocks.updateClient.mockResolvedValue({
        success: true,
        client: {
          ...companyClientOutput,
          status: 'inactive',
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.updateClient({
        clientId: CLIENT_ID,
        status: 'inactive',
      });

      expect(result.success).toBe(true);
      expect(result.client.status).toBe('inactive');
    });

    it('should update client tags', async () => {
      mocks.updateClient.mockResolvedValue({
        success: true,
        client: {
          ...companyClientOutput,
          tags: ['vip', 'enterprise', 'priority'],
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.updateClient({
        clientId: CLIENT_ID,
        tags: ['vip', 'enterprise', 'priority'],
      });

      expect(result.success).toBe(true);
      expect(result.client.tags).toContain('priority');
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.updateClient.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.updateClient({
          clientId: NON_EXISTENT_ID,
          email: 'test@test.pl',
        })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  // ===========================================================================
  // LIST CLIENTS
  // ===========================================================================

  describe('listClients', () => {
    it('should return paginated list of clients', async () => {
      mocks.listClients.mockResolvedValue(paginatedClients);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.listClients({});

      expect(result.clients).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by client type', async () => {
      mocks.listClients.mockResolvedValue({
        ...paginatedClients,
        clients: [companyClientOutput],
        total: 1,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.listClients({
        type: 'company',
      });

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].type).toBe('company');
    });

    it('should filter by status', async () => {
      mocks.listClients.mockResolvedValue({
        ...paginatedClients,
        clients: [companyClientOutput],
        total: 1,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.listClients({
        status: 'active',
      });

      expect(result.clients[0].status).toBe('active');
    });

    it('should search by text', async () => {
      mocks.listClients.mockResolvedValue({
        ...paginatedClients,
        clients: [companyClientOutput],
        total: 1,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.listClients({
        search: 'Testowa',
      });

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].companyName).toContain('Testowa');
    });

    it('should filter by tags', async () => {
      mocks.listClients.mockResolvedValue({
        ...paginatedClients,
        clients: [companyClientOutput],
        total: 1,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.listClients({
        tags: ['vip'],
      });

      expect(result.clients[0].tags).toContain('vip');
    });

    it('should paginate results', async () => {
      mocks.listClients.mockResolvedValue({
        clients: [companyClientOutput],
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasMore: true,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.listClients({
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by different fields', async () => {
      mocks.listClients.mockResolvedValue(paginatedClients);
      const userCaller = appRouter.createCaller(createUserContext());

      await userCaller.crm.client.listClients({
        sortBy: 'displayName',
        sortOrder: 'asc',
      });

      expect(mocks.listClients).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // DELETE CLIENT
  // ===========================================================================

  describe('deleteClient', () => {
    it('should soft delete (archive) client by default', async () => {
      mocks.deleteClient.mockResolvedValue({
        success: true,
        archived: true,
        message: 'Klient został zarchiwizowany',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.deleteClient({
        clientId: CLIENT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(true);
    });

    it('should permanently delete client when permanent flag is true', async () => {
      mocks.deleteClient.mockResolvedValue({
        success: true,
        archived: false,
        message: 'Klient został trwale usunięty',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.deleteClient({
        clientId: CLIENT_ID,
        permanent: true,
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(false);
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.deleteClient.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.deleteClient({ clientId: NON_EXISTENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  // ===========================================================================
  // RESTORE CLIENT
  // ===========================================================================

  describe('restoreClient', () => {
    it('should restore archived client', async () => {
      mocks.restoreClient.mockResolvedValue({
        success: true,
        client: {
          ...companyClientOutput,
          status: 'active',
          archivedAt: null,
        },
        message: 'Klient został przywrócony',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.restoreClient({
        clientId: CLIENT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.client.status).toBe('active');
      expect(result.client.archivedAt).toBeNull();
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.restoreClient.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.restoreClient({ clientId: NON_EXISTENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });

    it('should throw error when client is not archived', async () => {
      mocks.restoreClient.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Klient nie jest zarchiwizowany' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.restoreClient({ clientId: CLIENT_ID })
      ).rejects.toThrow('Klient nie jest zarchiwizowany');
    });
  });

  // ===========================================================================
  // SEARCH BY NIP
  // ===========================================================================

  describe('searchByNip', () => {
    it('should find client by NIP', async () => {
      mocks.searchByNip.mockResolvedValue({
        found: true,
        client: companyClientOutput,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.searchByNip({
        nip: '5213017228',
      });

      expect(result.found).toBe(true);
      expect(result.client?.nip).toBe('5213017228');
    });

    it('should return not found when NIP does not exist', async () => {
      mocks.searchByNip.mockResolvedValue({
        found: false,
        client: null,
        message: 'Nie znaleziono klienta',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.searchByNip({
        nip: '0000000000',
      });

      expect(result.found).toBe(false);
      expect(result.client).toBeNull();
    });

    it('should validate NIP format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.searchByNip({ nip: 'invalid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // SEARCH BY REGON
  // ===========================================================================

  describe('searchByRegon', () => {
    it('should find client by REGON (9 digits)', async () => {
      mocks.searchByRegon.mockResolvedValue({
        found: true,
        client: companyClientOutput,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.searchByRegon({
        regon: '123456785',
      });

      expect(result.found).toBe(true);
      expect(result.client?.regon).toBe('123456785');
    });

    it('should find client by REGON (14 digits)', async () => {
      mocks.searchByRegon.mockResolvedValue({
        found: true,
        client: { ...companyClientOutput, regon: '12345678512347' },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.searchByRegon({
        regon: '12345678512347',
      });

      expect(result.found).toBe(true);
    });

    it('should return not found when REGON does not exist', async () => {
      mocks.searchByRegon.mockResolvedValue({
        found: false,
        client: null,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.searchByRegon({
        regon: '000000000',
      });

      expect(result.found).toBe(false);
    });

    it('should validate REGON format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.searchByRegon({ regon: 'invalid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // ENRICH FROM GUS
  // ===========================================================================

  describe('enrichFromGus', () => {
    it('should enrich client data from GUS by NIP', async () => {
      mocks.enrichFromGus.mockResolvedValue({
        success: true,
        client: {
          ...companyClientOutput,
          gusEnrichedAt: new Date('2025-01-15'),
          gusData: { source: 'GUS REGON API' },
        },
        enrichedFields: ['companyName', 'street', 'city', 'postalCode', 'legalForm'],
        message: 'Dane zostały wzbogacone z GUS',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.enrichFromGus({
        clientId: CLIENT_ID,
        nip: '5213017228',
      });

      expect(result.success).toBe(true);
      expect(result.enrichedFields).toContain('companyName');
      expect(result.client.gusEnrichedAt).toBeTruthy();
    });

    it('should enrich client data from GUS by REGON', async () => {
      mocks.enrichFromGus.mockResolvedValue({
        success: true,
        client: {
          ...companyClientOutput,
          gusEnrichedAt: new Date('2025-01-15'),
        },
        enrichedFields: ['companyName', 'street'],
        message: 'Dane zostały wzbogacone z GUS',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.client.enrichFromGus({
        clientId: CLIENT_ID,
        regon: '123456785',
      });

      expect(result.success).toBe(true);
      expect(result.enrichedFields.length).toBeGreaterThan(0);
    });

    it('should require either NIP or REGON', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.enrichFromGus({
          clientId: CLIENT_ID,
        })
      ).rejects.toThrow();
    });

    it('should handle GUS API errors gracefully', async () => {
      mocks.enrichFromGus.mockRejectedValue(
        new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'GUS API niedostępne' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.enrichFromGus({
          clientId: CLIENT_ID,
          nip: '5213017228',
        })
      ).rejects.toThrow('GUS API niedostępne');
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.enrichFromGus.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.enrichFromGus({
          clientId: NON_EXISTENT_ID,
          nip: '5213017228',
        })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  // ===========================================================================
  // AUTHENTICATION REQUIREMENTS
  // ===========================================================================

  describe('authentication', () => {
    it('should require authentication for createClient', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should require authentication for getClient', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.client.getClient({ clientId: CLIENT_ID })
      ).rejects.toThrow();
    });

    it('should require authentication for listClients', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.client.listClients({})
      ).rejects.toThrow();
    });

    it('should require authentication for updateClient', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.client.updateClient({
          clientId: CLIENT_ID,
          email: 'test@test.pl',
        })
      ).rejects.toThrow();
    });

    it('should require authentication for deleteClient', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.client.deleteClient({ clientId: CLIENT_ID })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mocks.getClient.mockRejectedValue(new Error('Database connection failed'));
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.getClient({ clientId: CLIENT_ID })
      ).rejects.toThrow();
    });

    it('should handle validation errors', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      // Invalid postal code format
      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          postalCode: 'invalid',
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent update conflicts', async () => {
      mocks.updateClient.mockRejectedValue(
        new TRPCError({ code: 'CONFLICT', message: 'Klient został zmodyfikowany przez innego użytkownika' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.updateClient({
          clientId: CLIENT_ID,
          email: 'test@test.pl',
        })
      ).rejects.toThrow('Klient został zmodyfikowany przez innego użytkownika');
    });
  });

  // ===========================================================================
  // INPUT VALIDATION
  // ===========================================================================

  describe('input validation', () => {
    it('should validate email format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });

    it('should validate phone format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          phone: '123',
        })
      ).rejects.toThrow();
    });

    it('should validate website URL format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          website: 'not-a-url',
        })
      ).rejects.toThrow();
    });

    it('should validate KRS format (10 digits)', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          krs: '12345',
        })
      ).rejects.toThrow();
    });

    it('should validate PESEL format (11 digits)', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'individual',
          firstName: 'Jan',
          lastName: 'Kowalski',
          pesel: '12345',
        })
      ).rejects.toThrow();
    });

    it('should validate country code (2 letters)', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          country: 'POL',
        })
      ).rejects.toThrow();
    });

    it('should enforce max tags limit', async () => {
      const userCaller = appRouter.createCaller(createUserContext());
      const tooManyTags = Array.from({ length: 25 }, (_, i) => `tag${i}`);

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          tags: tooManyTags,
        })
      ).rejects.toThrow();
    });

    it('should enforce max notes length', async () => {
      const userCaller = appRouter.createCaller(createUserContext());
      const longNotes = 'x'.repeat(5001);

      await expect(
        userCaller.crm.client.createClient({
          type: 'company',
          companyName: 'Test',
          notes: longNotes,
        })
      ).rejects.toThrow();
    });
  });
});
