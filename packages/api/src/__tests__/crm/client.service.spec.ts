import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { ClientService } from '../../services/crm/client.service';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';

// ===========================================
// MOCK DATA
// ===========================================

const mockCompanyClient = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  type: 'company' as const,
  status: 'active' as const,
  displayName: 'Test Company Sp. z o.o.',
  companyName: 'Test Company Sp. z o.o.',
  nip: '1234563218',
  regon: '123456785',
  krs: '0000123456',
  legalForm: 'Spółka z ograniczoną odpowiedzialnością',
  pkdCodes: ['62.01.Z', '62.02.Z'],
  firstName: null,
  lastName: null,
  pesel: null,
  email: 'kontakt@testcompany.pl',
  phone: '+48123456789',
  website: 'https://testcompany.pl',
  street: 'Marszałkowska',
  buildingNumber: '100',
  apartmentNumber: '10',
  postalCode: '00-001',
  city: 'Warszawa',
  voivodeship: 'mazowieckie',
  country: 'PL',
  gusEnrichedAt: null,
  gusData: null,
  ownerId: '123e4567-e89b-12d3-a456-426614174001',
  organizationId: '123e4567-e89b-12d3-a456-426614174002',
  tags: ['vip', 'priority'],
  customFields: { industry: 'IT' },
  notes: 'Important client',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  archivedAt: null,
};

const mockIndividualClient = {
  id: '123e4567-e89b-12d3-a456-426614174003',
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
  pesel: '12345678901',
  email: 'jan.kowalski@example.pl',
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
  ownerId: '123e4567-e89b-12d3-a456-426614174001',
  organizationId: '123e4567-e89b-12d3-a456-426614174002',
  tags: [],
  customFields: {},
  notes: null,
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
  archivedAt: null,
};

const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174002';

// ===========================================
// MOCKS
// ===========================================

const mockPrisma = {
  client: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
} as unknown as PrismaClient;

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
} as unknown as Redis;

const mockAuditLogger = {
  log: vi.fn(),
} as unknown as AuditLogger;

describe('ClientService', () => {
  let clientService: ClientService;

  beforeEach(() => {
    vi.clearAllMocks();
    clientService = new ClientService(
      mockPrisma,
      mockRedis,
      mockAuditLogger,
      mockUserId,
      mockOrganizationId
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // CREATE CLIENT
  // ===========================================

  describe('createClient', () => {
    describe('company client', () => {
      it('should create a company client successfully', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'New Company Sp. z o.o.',
          nip: '1234563218',
          regon: '123456785',
          email: 'kontakt@newcompany.pl',
          phone: '+48123456789',
          city: 'Warszawa',
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockCompanyClient,
          ...input,
          displayName: input.companyName,
        });

        const result = await clientService.createClient(input);

        expect(result.success).toBe(true);
        expect(result.client.companyName).toBe(input.companyName);
        expect(result.client.type).toBe('company');
        expect(mockAuditLogger.log).toHaveBeenCalled();
      });

      it('should reject duplicate NIP within organization', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'Duplicate Company',
          nip: '1234563218',
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(mockCompanyClient);

        await expect(
          clientService.createClient(input)
        ).rejects.toThrow(TRPCError);

        await expect(
          clientService.createClient(input)
        ).rejects.toMatchObject({
          code: 'CONFLICT',
        });
      });

      it('should reject duplicate REGON within organization', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'Duplicate Company',
          regon: '123456785',
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(mockCompanyClient);

        await expect(
          clientService.createClient(input)
        ).rejects.toThrow(TRPCError);
      });

      it('should set displayName from companyName for company clients', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'Display Name Test Sp. z o.o.',
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockCompanyClient,
          companyName: input.companyName,
          displayName: input.companyName,
        });

        const result = await clientService.createClient(input);

        expect(result.client.displayName).toBe(input.companyName);
      });

      it('should handle optional fields correctly', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'Minimal Company',
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockCompanyClient,
          companyName: input.companyName,
          displayName: input.companyName,
          nip: null,
          regon: null,
          email: null,
        });

        const result = await clientService.createClient(input);

        expect(result.success).toBe(true);
        expect(result.client.nip).toBeNull();
      });

      it('should store tags correctly', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'Tagged Company',
          tags: ['important', 'vip', 'premium'],
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockCompanyClient,
          ...input,
          displayName: input.companyName,
        });

        const result = await clientService.createClient(input);

        expect(result.client.tags).toEqual(['important', 'vip', 'premium']);
      });

      it('should store custom fields correctly', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'Custom Fields Company',
          customFields: { industry: 'IT', size: 'medium', established: 2020 },
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockCompanyClient,
          ...input,
          displayName: input.companyName,
        });

        const result = await clientService.createClient(input);

        expect(result.client.customFields).toEqual(input.customFields);
      });
    });

    describe('individual client', () => {
      it('should create an individual client successfully', async () => {
        const input = {
          type: 'individual' as const,
          firstName: 'Anna',
          lastName: 'Nowak',
          email: 'anna.nowak@example.pl',
          phone: '+48111222333',
        };

        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockIndividualClient,
          ...input,
          displayName: `${input.firstName} ${input.lastName}`,
        });

        const result = await clientService.createClient(input);

        expect(result.success).toBe(true);
        expect(result.client.firstName).toBe(input.firstName);
        expect(result.client.lastName).toBe(input.lastName);
        expect(result.client.type).toBe('individual');
      });

      it('should set displayName from firstName and lastName for individuals', async () => {
        const input = {
          type: 'individual' as const,
          firstName: 'Piotr',
          lastName: 'Wiśniewski',
        };

        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockIndividualClient,
          ...input,
          displayName: `${input.firstName} ${input.lastName}`,
        });

        const result = await clientService.createClient(input);

        expect(result.client.displayName).toBe('Piotr Wiśniewski');
      });

      it('should handle PESEL correctly', async () => {
        const input = {
          type: 'individual' as const,
          firstName: 'Maria',
          lastName: 'Zielińska',
          pesel: '90010112345',
        };

        vi.mocked(mockPrisma.client.create).mockResolvedValue({
          ...mockIndividualClient,
          ...input,
          displayName: `${input.firstName} ${input.lastName}`,
        });

        const result = await clientService.createClient(input);

        expect(result.client.pesel).toBe(input.pesel);
      });
    });

    describe('error handling', () => {
      it('should handle database errors gracefully', async () => {
        const input = {
          type: 'company' as const,
          companyName: 'Error Test Company',
        };

        vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
        vi.mocked(mockPrisma.client.create).mockRejectedValue(new Error('Database error'));

        await expect(
          clientService.createClient(input)
        ).rejects.toThrow();
      });
    });
  });

  // ===========================================
  // GET CLIENT
  // ===========================================

  describe('getClient', () => {
    it('should return client from cache if available', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockCompanyClient));

      const result = await clientService.getClient(mockCompanyClient.id);

      expect(result).toMatchObject({
        id: mockCompanyClient.id,
        displayName: mockCompanyClient.displayName,
      });
      expect(mockPrisma.client.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache on cache miss', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);

      const result = await clientService.getClient(mockCompanyClient.id);

      expect(result.id).toBe(mockCompanyClient.id);
      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: mockCompanyClient.id },
      });
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        clientService.getClient('non-existent-id')
      ).rejects.toThrow(TRPCError);

      await expect(
        clientService.getClient('non-existent-id')
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should handle cache errors gracefully', async () => {
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis error'));
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);

      const result = await clientService.getClient(mockCompanyClient.id);

      expect(result.id).toBe(mockCompanyClient.id);
    });
  });

  // ===========================================
  // UPDATE CLIENT
  // ===========================================

  describe('updateClient', () => {
    it('should update client successfully', async () => {
      const updateInput = {
        companyName: 'Updated Company Name',
        email: 'updated@company.pl',
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        ...updateInput,
        displayName: updateInput.companyName,
        updatedAt: new Date(),
      });

      const result = await clientService.updateClient(
        mockCompanyClient.id,
        updateInput
      );

      expect(result.success).toBe(true);
      expect(result.client.companyName).toBe(updateInput.companyName);
      expect(result.client.email).toBe(updateInput.email);
    });

    it('should update displayName when companyName changes for company', async () => {
      const updateInput = {
        companyName: 'New Display Name Sp. z o.o.',
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        companyName: updateInput.companyName,
        displayName: updateInput.companyName,
      });

      const result = await clientService.updateClient(
        mockCompanyClient.id,
        updateInput
      );

      expect(result.client.displayName).toBe(updateInput.companyName);
    });

    it('should update displayName when name changes for individual', async () => {
      const updateInput = {
        firstName: 'Piotr',
        lastName: 'Nowicki',
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockIndividualClient);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockIndividualClient,
        ...updateInput,
        displayName: `${updateInput.firstName} ${updateInput.lastName}`,
      });

      const result = await clientService.updateClient(
        mockIndividualClient.id,
        updateInput
      );

      expect(result.client.displayName).toBe('Piotr Nowicki');
    });

    it('should invalidate cache on update', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        email: 'new@email.pl',
      });

      await clientService.updateClient(mockCompanyClient.id, { email: 'new@email.pl' });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        clientService.updateClient('non-existent-id', { email: 'test@test.pl' })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject duplicate NIP on update', async () => {
      const updateInput = { nip: '9876543210' };
      const existingClientWithNip = { ...mockCompanyClient, id: 'other-id', nip: '9876543210' };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(existingClientWithNip);

      await expect(
        clientService.updateClient(mockCompanyClient.id, updateInput)
      ).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('should update status correctly', async () => {
      const updateInput = { status: 'suspended' as const };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        status: 'suspended',
      });

      const result = await clientService.updateClient(
        mockCompanyClient.id,
        updateInput
      );

      expect(result.client.status).toBe('suspended');
    });

    it('should update tags correctly', async () => {
      const updateInput = { tags: ['updated', 'tags'] };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        tags: updateInput.tags,
      });

      const result = await clientService.updateClient(
        mockCompanyClient.id,
        updateInput
      );

      expect(result.client.tags).toEqual(updateInput.tags);
    });

    it('should log audit event on update', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        email: 'audit@test.pl',
      });

      await clientService.updateClient(mockCompanyClient.id, { email: 'audit@test.pl' });

      expect(mockAuditLogger.log).toHaveBeenCalled();
    });
  });

  // ===========================================
  // LIST CLIENTS
  // ===========================================

  describe('listClients', () => {
    it('should return paginated clients', async () => {
      const mockClients = [mockCompanyClient, mockIndividualClient];
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(2);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.clients).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by type', async () => {
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue([mockCompanyClient]);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(1);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        type: 'company',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].type).toBe('company');
    });

    it('should filter by status', async () => {
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue([mockCompanyClient]);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(1);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        status: 'active',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.clients[0].status).toBe('active');
    });

    it('should search by displayName', async () => {
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue([mockCompanyClient]);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(1);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        search: 'Test Company',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.clients[0].displayName).toContain('Test Company');
    });

    it('should filter by tags', async () => {
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue([mockCompanyClient]);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(1);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        tags: ['vip'],
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.clients[0].tags).toContain('vip');
    });

    it('should sort correctly', async () => {
      const sortedClients = [mockIndividualClient, mockCompanyClient];
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(sortedClients);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(2);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      expect(result.clients).toHaveLength(2);
    });

    it('should handle empty results', async () => {
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(0);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.clients).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should calculate hasMore correctly', async () => {
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue([mockCompanyClient]);
      vi.mocked(mockPrisma.client.count).mockResolvedValue(25);

      const result = await clientService.listClients({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.hasMore).toBe(true);
      expect(result.totalPages).toBe(2);
    });
  });

  // ===========================================
  // DELETE/ARCHIVE CLIENT
  // ===========================================

  describe('deleteClient', () => {
    it('should archive client by default (soft delete)', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        status: 'archived',
        archivedAt: new Date(),
      });

      const result = await clientService.deleteClient({
        clientId: mockCompanyClient.id,
        permanent: false,
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(true);
      expect(mockPrisma.client.update).toHaveBeenCalled();
      expect(mockPrisma.client.delete).not.toHaveBeenCalled();
    });

    it('should permanently delete when permanent=true', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.delete).mockResolvedValue(mockCompanyClient);

      const result = await clientService.deleteClient({
        clientId: mockCompanyClient.id,
        permanent: true,
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(false);
      expect(mockPrisma.client.delete).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        clientService.deleteClient({ clientId: 'non-existent-id', permanent: false })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should invalidate cache on delete', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        status: 'archived',
      });

      await clientService.deleteClient({ clientId: mockCompanyClient.id, permanent: false });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should log audit event on delete', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        status: 'archived',
      });

      await clientService.deleteClient({ clientId: mockCompanyClient.id, permanent: false });

      expect(mockAuditLogger.log).toHaveBeenCalled();
    });
  });

  // ===========================================
  // RESTORE CLIENT
  // ===========================================

  describe('restoreClient', () => {
    it('should restore archived client', async () => {
      const archivedClient = {
        ...mockCompanyClient,
        status: 'archived' as const,
        archivedAt: new Date(),
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(archivedClient);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        status: 'active',
        archivedAt: null,
      });

      const result = await clientService.restoreClient({ clientId: mockCompanyClient.id });

      expect(result.success).toBe(true);
      expect(result.client.status).toBe('active');
      expect(result.client.archivedAt).toBeNull();
    });

    it('should throw error for non-archived client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);

      await expect(
        clientService.restoreClient({ clientId: mockCompanyClient.id })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        clientService.restoreClient({ clientId: 'non-existent-id' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should invalidate cache on restore', async () => {
      const archivedClient = {
        ...mockCompanyClient,
        status: 'archived' as const,
        archivedAt: new Date(),
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(archivedClient);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        status: 'active',
        archivedAt: null,
      });

      await clientService.restoreClient({ clientId: mockCompanyClient.id });

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // ===========================================
  // SEARCH BY NIP/REGON
  // ===========================================

  describe('searchByNip', () => {
    it('should find client by NIP', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(mockCompanyClient);

      const result = await clientService.searchByNip({ nip: '1234563218' });

      expect(result.found).toBe(true);
      expect(result.client?.nip).toBe('1234563218');
    });

    it('should return not found for non-existent NIP', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);

      const result = await clientService.searchByNip({ nip: '9999999999' });

      expect(result.found).toBe(false);
      expect(result.client).toBeNull();
    });
  });

  describe('searchByRegon', () => {
    it('should find client by REGON', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(mockCompanyClient);

      const result = await clientService.searchByRegon({ regon: '123456785' });

      expect(result.found).toBe(true);
      expect(result.client?.regon).toBe('123456785');
    });

    it('should return not found for non-existent REGON', async () => {
      vi.mocked(mockPrisma.client.findFirst).mockResolvedValue(null);

      const result = await clientService.searchByRegon({ regon: '999999999' });

      expect(result.found).toBe(false);
      expect(result.client).toBeNull();
    });
  });

  // ===========================================
  // GUS ENRICHMENT
  // ===========================================

  describe('enrichFromGus', () => {
    const mockGusData = {
      name: 'GUS Company Name Sp. z o.o.',
      nip: '1234563218',
      regon: '123456785',
      street: 'GUS Street',
      buildingNumber: '123',
      city: 'Warsaw',
      postalCode: '00-001',
      voivodeship: 'MAZOWIECKIE',
      legalForm: 'Spółka z ograniczoną odpowiedzialnością',
      pkdCodes: ['62.01.Z', '62.02.Z'],
    };

    it('should enrich client with GUS data by NIP', async () => {
      // Create a client with empty fields that can be enriched
      const clientWithEmptyFields = {
        ...mockCompanyClient,
        companyName: null,
        street: null,
        city: null,
        postalCode: null,
        voivodeship: null,
      };
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(clientWithEmptyFields);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      // Mock GUS API call would be here in real implementation
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...clientWithEmptyFields,
        companyName: mockGusData.name,
        street: mockGusData.street,
        city: mockGusData.city,
        gusEnrichedAt: new Date(),
        gusData: mockGusData,
      });

      const result = await clientService.enrichFromGus({
        clientId: mockCompanyClient.id,
        nip: '1234563218',
      });

      expect(result.success).toBe(true);
      expect(result.enrichedFields.length).toBeGreaterThan(0);
    });

    it('should use cached GUS data if available', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockGusData));
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        gusEnrichedAt: new Date(),
        gusData: mockGusData,
      });

      const result = await clientService.enrichFromGus({
        clientId: mockCompanyClient.id,
        nip: '1234563218',
      });

      expect(result.success).toBe(true);
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        clientService.enrichFromGus({ clientId: 'non-existent-id', nip: '1234563218' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw error for individual clients', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockIndividualClient);

      await expect(
        clientService.enrichFromGus({ clientId: mockIndividualClient.id, nip: '1234563218' })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should invalidate cache after enrichment', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockGusData));
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        gusEnrichedAt: new Date(),
        gusData: mockGusData,
      });

      await clientService.enrichFromGus({
        clientId: mockCompanyClient.id,
        nip: '1234563218',
      });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should log audit event on enrichment', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockGusData));
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        gusEnrichedAt: new Date(),
        gusData: mockGusData,
      });

      await clientService.enrichFromGus({
        clientId: mockCompanyClient.id,
        nip: '1234563218',
      });

      expect(mockAuditLogger.log).toHaveBeenCalled();
    });
  });
});
