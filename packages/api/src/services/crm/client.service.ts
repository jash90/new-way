import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  type CreateClientInput,
  type UpdateClientInput,
  type ListClientsQueryInput,
  type DeleteClientInput,
  type RestoreClientInput,
  type SearchByNipInput,
  type SearchByRegonInput,
  type EnrichFromGusInput,
  type ClientOutput,
  type PaginatedClients,
  type ClientCreateResult,
  type ClientUpdateResult,
  type ClientDeleteResult,
  type ClientRestoreResult,
  type GusEnrichResult,
  type ClientSearchResult,
} from '@ksiegowacrm/shared';
import { AuditLogger } from '../../utils/audit-logger';

// Cache TTL in seconds
const CLIENT_CACHE_TTL = 300; // 5 minutes
const GUS_CACHE_TTL = 86400; // 24 hours

// GUS API configuration (placeholder - would need real API credentials)
// TODO: Implement GUS API integration when credentials are available
const _GUS_API_URL = process.env.GUS_API_URL || 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
void _GUS_API_URL; // Suppress unused warning - reserved for future GUS integration

export class ClientService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string | null
  ) {}

  // ===========================================================================
  // CREATE CLIENT
  // ===========================================================================

  async createClient(input: CreateClientInput): Promise<ClientCreateResult> {
    // Check for duplicate NIP if provided (for company clients)
    if (input.type === 'company' && input.nip) {
      const existingByNip = await this.prisma.client.findFirst({
        where: {
          nip: input.nip,
          ownerId: this.userId,
          archivedAt: null,
        },
      });

      if (existingByNip) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Klient z tym NIP już istnieje',
        });
      }
    }

    // Check for duplicate REGON if provided
    if (input.type === 'company' && input.regon) {
      const existingByRegon = await this.prisma.client.findFirst({
        where: {
          regon: input.regon,
          ownerId: this.userId,
          archivedAt: null,
        },
      });

      if (existingByRegon) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Klient z tym REGON już istnieje',
        });
      }
    }

    // Build display name
    const displayName = input.type === 'company'
      ? input.companyName
      : `${input.firstName} ${input.lastName}`;

    // Create the client
    const client = await this.prisma.client.create({
      data: {
        type: input.type,
        status: 'active',
        displayName,
        companyName: input.type === 'company' ? input.companyName : null,
        nip: input.type === 'company' ? input.nip : null,
        regon: input.type === 'company' ? input.regon : null,
        krs: input.type === 'company' ? input.krs : null,
        legalForm: input.type === 'company' ? input.legalForm : null,
        pkdCodes: input.type === 'company' && input.pkdCodes ? input.pkdCodes : [],
        firstName: input.type === 'individual' ? input.firstName : null,
        lastName: input.type === 'individual' ? input.lastName : null,
        pesel: input.type === 'individual' ? input.pesel : null,
        email: input.email,
        phone: input.phone,
        website: input.type === 'company' ? input.website : null,
        street: input.street,
        buildingNumber: input.buildingNumber,
        apartmentNumber: input.apartmentNumber,
        postalCode: input.postalCode,
        city: input.city,
        voivodeship: input.voivodeship,
        country: input.country || 'PL',
        tags: input.tags || [],
        customFields: input.customFields ? JSON.parse(JSON.stringify(input.customFields)) : undefined,
        notes: input.notes,
        ownerId: this.userId,
        organizationId: this.organizationId,
      },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'CLIENT_CREATED',
      userId: this.userId,
      metadata: {
        clientId: client.id,
        clientType: input.type,
        displayName,
      },
    });

    return {
      success: true,
      client: this.formatClientOutput(client),
      message: 'Klient został utworzony',
    };
  }

  // ===========================================================================
  // GET CLIENT
  // ===========================================================================

  async getClient(clientId: string): Promise<ClientOutput> {
    // Try to get from cache first
    const cacheKey = `client:${clientId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss or error, continue to database
    }

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Klient nie został znaleziony',
      });
    }

    // Verify ownership
    if (client.ownerId !== this.userId && client.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Brak dostępu do tego klienta',
      });
    }

    const output = this.formatClientOutput(client);

    // Cache the client
    try {
      await this.redis.setex(cacheKey, CLIENT_CACHE_TTL, JSON.stringify(output));
    } catch {
      // Ignore cache errors
    }

    return output;
  }

  // ===========================================================================
  // UPDATE CLIENT
  // ===========================================================================

  async updateClient(
    clientId: string,
    input: UpdateClientInput
  ): Promise<ClientUpdateResult> {
    const existingClient = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!existingClient) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Klient nie został znaleziony',
      });
    }

    // Verify ownership
    if (existingClient.ownerId !== this.userId && existingClient.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Brak dostępu do tego klienta',
      });
    }

    // Check for duplicate NIP if updating it
    if (input.nip && input.nip !== existingClient.nip) {
      const existingByNip = await this.prisma.client.findFirst({
        where: {
          nip: input.nip,
          ownerId: this.userId,
          archivedAt: null,
          id: { not: clientId },
        },
      });

      if (existingByNip) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Klient z tym NIP już istnieje',
        });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (input.companyName !== undefined) updateData.companyName = input.companyName;
    if (input.firstName !== undefined) updateData.firstName = input.firstName;
    if (input.lastName !== undefined) updateData.lastName = input.lastName;
    if (input.nip !== undefined) updateData.nip = input.nip;
    if (input.regon !== undefined) updateData.regon = input.regon;
    if (input.krs !== undefined) updateData.krs = input.krs;
    if (input.pesel !== undefined) updateData.pesel = input.pesel;
    if (input.legalForm !== undefined) updateData.legalForm = input.legalForm;
    if (input.pkdCodes !== undefined) updateData.pkdCodes = input.pkdCodes;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.street !== undefined) updateData.street = input.street;
    if (input.buildingNumber !== undefined) updateData.buildingNumber = input.buildingNumber;
    if (input.apartmentNumber !== undefined) updateData.apartmentNumber = input.apartmentNumber;
    if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.voivodeship !== undefined) updateData.voivodeship = input.voivodeship;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.customFields !== undefined) updateData.customFields = input.customFields;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.status !== undefined) updateData.status = input.status;

    // Update display name if name fields changed
    if (input.companyName || input.firstName || input.lastName) {
      if (existingClient.type === 'company' && input.companyName) {
        updateData.displayName = input.companyName;
      } else if (existingClient.type === 'individual' && (input.firstName || input.lastName)) {
        const firstName = input.firstName || existingClient.firstName;
        const lastName = input.lastName || existingClient.lastName;
        updateData.displayName = `${firstName} ${lastName}`;
      }
    }

    const updatedClient = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.redis.del(`client:${clientId}`);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'CLIENT_UPDATED',
      userId: this.userId,
      metadata: {
        clientId,
        updatedFields: Object.keys(updateData),
      },
    });

    return {
      success: true,
      client: this.formatClientOutput(updatedClient),
    };
  }

  // ===========================================================================
  // LIST CLIENTS
  // ===========================================================================

  async listClients(query: ListClientsQueryInput): Promise<PaginatedClients> {
    const { page, limit, type, status, search, tags, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      ownerId: this.userId,
    };

    // Only show non-archived clients by default
    if (status !== 'archived') {
      where.archivedAt = null;
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search } },
        { regon: { contains: search } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = { hasEvery: tags };
    }

    // Build order by
    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;

    // Execute queries
    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where: where as any,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where: where as any }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      clients: clients.map((client) => this.formatClientOutput(client)),
      total,
      page,
      limit,
      totalPages,
      hasMore,
    };
  }

  // ===========================================================================
  // DELETE CLIENT
  // ===========================================================================

  async deleteClient(input: DeleteClientInput): Promise<ClientDeleteResult> {
    const { clientId, permanent } = input;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Klient nie został znaleziony',
      });
    }

    // Verify ownership
    if (client.ownerId !== this.userId && client.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Brak dostępu do tego klienta',
      });
    }

    if (permanent) {
      // Permanently delete the client
      await this.prisma.client.delete({
        where: { id: clientId },
      });

      // Log audit event
      await this.auditLogger.log({
        eventType: 'CLIENT_DELETED',
        userId: this.userId,
        metadata: {
          clientId,
          permanent: true,
          displayName: client.displayName,
        },
      });

      // Invalidate cache
      await this.redis.del(`client:${clientId}`);

      return {
        success: true,
        archived: false,
        message: 'Klient został trwale usunięty',
      };
    } else {
      // Soft delete (archive) the client
      await this.prisma.client.update({
        where: { id: clientId },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Log audit event
      await this.auditLogger.log({
        eventType: 'CLIENT_ARCHIVED',
        userId: this.userId,
        metadata: {
          clientId,
          displayName: client.displayName,
        },
      });

      // Invalidate cache
      await this.redis.del(`client:${clientId}`);

      return {
        success: true,
        archived: true,
        message: 'Klient został zarchiwizowany',
      };
    }
  }

  // ===========================================================================
  // RESTORE CLIENT
  // ===========================================================================

  async restoreClient(input: RestoreClientInput): Promise<ClientRestoreResult> {
    const { clientId } = input;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Klient nie został znaleziony',
      });
    }

    // Verify ownership
    if (client.ownerId !== this.userId && client.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Brak dostępu do tego klienta',
      });
    }

    // Check if client is archived
    if (!client.archivedAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Klient nie jest zarchiwizowany',
      });
    }

    const restoredClient = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        status: 'active',
        archivedAt: null,
        updatedAt: new Date(),
      },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'CLIENT_RESTORED',
      userId: this.userId,
      metadata: {
        clientId,
        displayName: client.displayName,
      },
    });

    // Invalidate cache
    await this.redis.del(`client:${clientId}`);

    return {
      success: true,
      client: this.formatClientOutput(restoredClient),
      message: 'Klient został przywrócony',
    };
  }

  // ===========================================================================
  // SEARCH BY NIP
  // ===========================================================================

  async searchByNip(input: SearchByNipInput): Promise<ClientSearchResult> {
    const client = await this.prisma.client.findFirst({
      where: {
        nip: input.nip,
        ownerId: this.userId,
        archivedAt: null,
      },
    });

    if (!client) {
      return {
        found: false,
        client: null,
        message: 'Nie znaleziono klienta',
      };
    }

    return {
      found: true,
      client: this.formatClientOutput(client),
    };
  }

  // ===========================================================================
  // SEARCH BY REGON
  // ===========================================================================

  async searchByRegon(input: SearchByRegonInput): Promise<ClientSearchResult> {
    const client = await this.prisma.client.findFirst({
      where: {
        regon: input.regon,
        ownerId: this.userId,
        archivedAt: null,
      },
    });

    if (!client) {
      return {
        found: false,
        client: null,
      };
    }

    return {
      found: true,
      client: this.formatClientOutput(client),
    };
  }

  // ===========================================================================
  // ENRICH FROM GUS
  // ===========================================================================

  async enrichFromGus(input: EnrichFromGusInput): Promise<GusEnrichResult> {
    const { clientId, nip, regon } = input;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Klient nie został znaleziony',
      });
    }

    // Verify ownership
    if (client.ownerId !== this.userId && client.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Brak dostępu do tego klienta',
      });
    }

    // GUS enrichment is only available for company clients
    if (client.type === 'individual') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wzbogacanie danych z GUS dostępne tylko dla firm',
      });
    }

    // Use the identifier (NIP takes priority)
    const identifier = nip || regon;
    const identifierType = nip ? 'nip' : 'regon';

    // Try to get from cache first
    const cacheKey = `gus:${identifierType}:${identifier}`;
    let gusData: Record<string, unknown> | null = null;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        gusData = JSON.parse(cached);
      }
    } catch {
      // Cache miss, continue to API
    }

    // If not cached, call GUS API (placeholder implementation)
    if (!gusData) {
      try {
        gusData = await this.fetchGusData(identifierType, identifier!);

        // Cache the result
        if (gusData) {
          await this.redis.setex(cacheKey, GUS_CACHE_TTL, JSON.stringify(gusData));
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'GUS API niedostępne',
        });
      }
    }

    if (!gusData) {
      return {
        success: false,
        client: this.formatClientOutput(client),
        enrichedFields: [],
        message: 'Nie znaleziono danych w GUS',
      };
    }

    // Build update data from GUS response
    const updateData: Record<string, unknown> = {};
    const enrichedFields: string[] = [];

    // GUS API may return 'name' or 'companyName'
    const gusCompanyName = gusData.companyName || gusData.name;
    if (gusCompanyName && !client.companyName) {
      updateData.companyName = gusCompanyName;
      updateData.displayName = gusCompanyName;
      enrichedFields.push('companyName');
    }

    if (gusData.street && !client.street) {
      updateData.street = gusData.street;
      enrichedFields.push('street');
    }

    if (gusData.buildingNumber && !client.buildingNumber) {
      updateData.buildingNumber = gusData.buildingNumber;
      enrichedFields.push('buildingNumber');
    }

    if (gusData.apartmentNumber && !client.apartmentNumber) {
      updateData.apartmentNumber = gusData.apartmentNumber;
      enrichedFields.push('apartmentNumber');
    }

    if (gusData.city && !client.city) {
      updateData.city = gusData.city;
      enrichedFields.push('city');
    }

    if (gusData.postalCode && !client.postalCode) {
      updateData.postalCode = gusData.postalCode;
      enrichedFields.push('postalCode');
    }

    if (gusData.voivodeship && !client.voivodeship) {
      updateData.voivodeship = gusData.voivodeship;
      enrichedFields.push('voivodeship');
    }

    if (gusData.legalForm && !client.legalForm) {
      updateData.legalForm = gusData.legalForm;
      enrichedFields.push('legalForm');
    }

    if (gusData.pkdCodes && (!client.pkdCodes || client.pkdCodes.length === 0)) {
      updateData.pkdCodes = gusData.pkdCodes;
      enrichedFields.push('pkdCodes');
    }

    // Update client with GUS data
    const updatedClient = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...updateData,
        gusData: gusData ? JSON.parse(JSON.stringify(gusData)) : undefined,
        gusEnrichedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'CLIENT_GUS_ENRICHED',
      userId: this.userId,
      metadata: {
        clientId,
        identifierType,
        identifier,
        enrichedFields,
      },
    });

    // Invalidate cache
    await this.redis.del(`client:${clientId}`);

    return {
      success: true,
      client: this.formatClientOutput(updatedClient),
      enrichedFields,
      message: 'Dane zostały wzbogacone z GUS',
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private formatClientOutput(client: any): ClientOutput {
    return {
      id: client.id,
      type: client.type,
      status: client.status,
      displayName: client.displayName,
      companyName: client.companyName,
      nip: client.nip,
      regon: client.regon,
      krs: client.krs,
      legalForm: client.legalForm,
      pkdCodes: client.pkdCodes || [],
      firstName: client.firstName,
      lastName: client.lastName,
      pesel: client.pesel,
      email: client.email,
      phone: client.phone,
      website: client.website,
      street: client.street,
      buildingNumber: client.buildingNumber,
      apartmentNumber: client.apartmentNumber,
      postalCode: client.postalCode,
      city: client.city,
      voivodeship: client.voivodeship,
      country: client.country,
      gusEnrichedAt: client.gusEnrichedAt,
      gusData: client.gusData,
      ownerId: client.ownerId,
      organizationId: client.organizationId,
      tags: client.tags || [],
      customFields: client.customFields || {},
      notes: client.notes,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      archivedAt: client.archivedAt,
    };
  }

  private async fetchGusData(
    _identifierType: 'nip' | 'regon',
    _identifier: string
  ): Promise<Record<string, unknown> | null> {
    // This is a placeholder implementation
    // In production, this would call the actual GUS REGON API
    // The API requires authentication and SOAP requests

    // For now, return mock data for testing purposes
    // In production, implement actual GUS API integration
    if (process.env.NODE_ENV === 'test' || process.env.GUS_MOCK === 'true') {
      return {
        companyName: 'Testowa Firma Sp. z o.o.',
        street: 'Marszałkowska',
        buildingNumber: '100',
        apartmentNumber: '5A',
        city: 'Warszawa',
        postalCode: '00-001',
        voivodeship: 'mazowieckie',
        legalForm: 'Spółka z ograniczoną odpowiedzialnością',
        pkdCodes: ['62.01.Z', '62.02.Z'],
        source: 'GUS REGON API',
      };
    }

    // Production GUS API call would go here
    // throw new TRPCError({
    //   code: 'NOT_IMPLEMENTED',
    //   message: 'GUS API integration not yet implemented',
    // });

    return null;
  }
}
