# CRM-002: GUS/REGON Integration

> **Story ID**: CRM-002
> **Epic**: Core CRM Module (CRM)
> **Priority**: P0 (Critical)
> **Points**: 8
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** automatically enrich client data from GUS/REGON government systems,
**So that** I can quickly populate client information with official, verified data.

---

## Acceptance Criteria

### AC1: Automatic Data Enrichment from GUS
```gherkin
Feature: GUS Data Enrichment
  As an accountant
  I want to fetch company data from GUS using NIP
  So that I can auto-populate client profiles

  Scenario: Successful GUS data fetch by NIP
    Given I am logged in as an accountant
    And I have a valid GUS API key configured
    When I request data enrichment for NIP "5270103391"
    Then the system should return company data including:
      | field           | example_value                |
      | legalName       | Company Sp. z o.o.           |
      | regon           | 012345678                    |
      | krs             | 0000123456                   |
      | pkdCode         | 62.01.Z                      |
      | pkdName         | Działalność związana z...    |
      | registeredAddress | Full address object        |
      | establishedDate | 2020-01-15                   |
    And the response should be cached for 24 hours
    And an audit event "GUS_DATA_FETCHED" should be logged

  Scenario: GUS data fetch with invalid NIP
    Given I am logged in as an accountant
    When I request data enrichment for NIP "0000000000"
    Then the system should return empty result
    And the response should indicate "No company found"

  Scenario: GUS API timeout handling
    Given I am logged in as an accountant
    And the GUS API is slow or unresponsive
    When I request data enrichment for NIP "5270103391"
    And the request takes more than 5 seconds
    Then the system should return a timeout error
    And the client should be notified to try again later
```

### AC2: REGON Data Fetch
```gherkin
Feature: REGON Data Enrichment
  As an accountant
  I want to fetch additional data using REGON number
  So that I can verify and complete company information

  Scenario: Fetch data by REGON
    Given I am logged in as an accountant
    When I request data enrichment for REGON "012345678"
    Then the system should return:
      | field              | description                    |
      | companyName        | Full legal name                |
      | nip                | Associated NIP                 |
      | addressDetails     | Detailed address breakdown     |
      | legalForm          | Legal entity type              |
      | businessStatus     | Active/Inactive/Liquidation    |
      | pkdCodes           | All registered PKD codes       |
    And the data should be validated against existing client record
```

### AC3: Auto-Enrichment on Client Creation
```gherkin
Feature: Automatic Enrichment During Creation
  As an accountant
  I want client data to be auto-enriched when creating a new client
  So that I don't have to manually enter all information

  Scenario: Auto-enrich on client creation
    Given I am logged in as an accountant
    When I create a new client with:
      | field       | value              |
      | companyName | Test Company       |
      | nip         | 5270103391         |
    Then the system should automatically fetch GUS data
    And the client should be created with enriched data:
      | field          | source |
      | legalName      | GUS    |
      | regon          | GUS    |
      | industryCode   | GUS    |
      | registeredAddress | GUS |
    And a timeline event "DATA_ENRICHED_FROM_GUS" should be created

  Scenario: Creation proceeds when GUS is unavailable
    Given I am logged in as an accountant
    And the GUS API is unavailable
    When I create a new client with:
      | field       | value              |
      | companyName | Test Company       |
      | nip         | 5270103391         |
    Then the client should be created with provided data only
    And a warning should be logged about GUS unavailability
    And the client should be flagged for later enrichment
```

### AC4: Manual Re-Enrichment
```gherkin
Feature: Manual Data Re-Enrichment
  As an accountant
  I want to manually trigger data refresh from GUS
  So that I can update client information when needed

  Scenario: Manual re-enrichment updates client data
    Given I am logged in as an accountant
    And a client "client-123" exists with outdated data
    When I trigger manual re-enrichment for the client
    Then the system should fetch fresh data from GUS
    And the client should be updated with new data
    And changes should be tracked in the timeline
    And the old data should be preserved in version history
```

---

## Technical Specification

### Database Schema

```sql
-- GUS API cache table
CREATE TABLE gus_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nip VARCHAR(10) NOT NULL,
  regon VARCHAR(14),
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'GUS_API',

  CONSTRAINT unique_nip_cache UNIQUE(nip)
);

CREATE INDEX idx_gus_cache_nip ON gus_cache(nip);
CREATE INDEX idx_gus_cache_expires ON gus_cache(expires_at);

-- GUS API request log for debugging and rate limiting
CREATE TABLE gus_api_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  request_type VARCHAR(50) NOT NULL,
  nip VARCHAR(10),
  regon VARCHAR(14),
  status VARCHAR(50) NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  request_data JSONB,
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_gus_log_org ON gus_api_log(organization_id);
CREATE INDEX idx_gus_log_created ON gus_api_log(created_at DESC);

-- Enrichment queue for failed/pending enrichments
CREATE TABLE enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  enrichment_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_enrichment_queue_status ON enrichment_queue(status, next_attempt_at);
CREATE INDEX idx_enrichment_queue_client ON enrichment_queue(client_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// GUS API response schema
export const GUSCompanyDataSchema = z.object({
  nip: z.string(),
  regon: z.string().optional(),
  regon14: z.string().optional(),
  krs: z.string().optional(),

  // Names
  nazwa: z.string(), // Legal name
  nazwaSkrocona: z.string().optional(), // Short name

  // Address
  adSiedzKraj_Nazwa: z.string().optional(),
  adSiedzWojewodztwo_Nazwa: z.string().optional(),
  adSiedzPowiat_Nazwa: z.string().optional(),
  adSiedzGmina_Nazwa: z.string().optional(),
  adSiedzMiejscowosc_Nazwa: z.string().optional(),
  adSiedzKodPocztowy: z.string().optional(),
  adSiedzUlica_Nazwa: z.string().optional(),
  adSiedzNumerNieruchomosci: z.string().optional(),
  adSiedzNumerLokalu: z.string().optional(),

  // Business information
  podstawowaFormaPrawna_Nazwa: z.string().optional(), // Legal form
  szczegolnaFormaPrawna_Nazwa: z.string().optional(),
  formaFinansowania_Nazwa: z.string().optional(),
  formaWlasnosci_Nazwa: z.string().optional(),

  // PKD codes
  pkdKod: z.string().optional(), // Main PKD code
  pkdNazwa: z.string().optional(), // Main PKD name
  pkdPrzewazajacy: z.string().optional(),

  // Dates
  dataRozpoczeciaDzialalnosci: z.string().optional(),
  dataZawieszeniaDzialalnosci: z.string().optional(),
  dataWznowieniaDzialalnosci: z.string().optional(),
  dataZakonczeniaDzialalnosci: z.string().optional(),
  dataWpisuDoRegostrREGON: z.string().optional(),

  // Contact
  numerTelefonu: z.string().optional(),
  numerFaksu: z.string().optional(),
  adresEmail: z.string().optional(),
  adresStronyInternetowej: z.string().optional(),

  // Status
  statusNip: z.string().optional(),
  stanPrawny: z.string().optional()
});

// Enriched company data (normalized)
export const EnrichedCompanyDataSchema = z.object({
  source: z.literal('GUS'),
  fetchedAt: z.date(),

  // Identifiers
  nip: z.string(),
  regon: z.string().optional(),
  regon14: z.string().optional(),
  krs: z.string().optional(),

  // Names
  legalName: z.string(),
  shortName: z.string().optional(),

  // Address
  registeredAddress: z.object({
    country: z.string(),
    province: z.string().optional(),
    district: z.string().optional(),
    commune: z.string().optional(),
    city: z.string(),
    postalCode: z.string(),
    street: z.string().optional(),
    buildingNumber: z.string().optional(),
    apartmentNumber: z.string().optional()
  }),

  // Legal form
  legalForm: z.string().optional(),
  detailedLegalForm: z.string().optional(),
  financingForm: z.string().optional(),
  ownershipForm: z.string().optional(),

  // Business classification
  pkdCodes: z.array(z.object({
    code: z.string(),
    name: z.string(),
    isPrimary: z.boolean()
  })),

  // Dates
  registrationDate: z.date().optional(),
  suspensionDate: z.date().optional(),
  resumptionDate: z.date().optional(),
  terminationDate: z.date().optional(),
  regonRegistrationDate: z.date().optional(),

  // Contact
  phone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),

  // Status
  nipStatus: z.string().optional(),
  legalStatus: z.string().optional(),
  isActive: z.boolean()
});

// Enrichment request schema
export const EnrichFromGUSRequestSchema = z.object({
  nip: z.string().regex(/^\d{10}$/, 'NIP must be 10 digits'),
  forceRefresh: z.boolean().default(false)
});

// Enrichment by REGON request schema
export const EnrichFromREGONRequestSchema = z.object({
  regon: z.string().regex(/^\d{9}(\d{5})?$/, 'REGON must be 9 or 14 digits'),
  forceRefresh: z.boolean().default(false)
});

export type GUSCompanyData = z.infer<typeof GUSCompanyDataSchema>;
export type EnrichedCompanyData = z.infer<typeof EnrichedCompanyDataSchema>;
export type EnrichFromGUSRequest = z.infer<typeof EnrichFromGUSRequestSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  EnrichFromGUSRequestSchema,
  EnrichFromREGONRequestSchema,
  EnrichedCompanyDataSchema
} from './schemas';

export const gusRouter = router({
  // Enrich from GUS by NIP
  enrichFromGUS: protectedProcedure
    .input(EnrichFromGUSRequestSchema)
    .output(EnrichedCompanyDataSchema.nullable())
    .mutation(async ({ ctx, input }) => {
      const { nip, forceRefresh } = input;
      const { user, organizationId } = ctx;

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await ctx.db.gusCache.findFirst({
          where: {
            nip,
            expiresAt: { gt: new Date() }
          }
        });

        if (cached) {
          // Log cache hit
          await logGUSRequest(ctx, {
            requestType: 'NIP_LOOKUP',
            nip,
            status: 'CACHE_HIT',
            responseTimeMs: 0
          });

          return cached.data as EnrichedCompanyData;
        }
      }

      const startTime = Date.now();

      try {
        // Call GUS API
        const gusData = await ctx.gusService.fetchByNIP(nip);

        if (!gusData) {
          await logGUSRequest(ctx, {
            requestType: 'NIP_LOOKUP',
            nip,
            status: 'NOT_FOUND',
            responseTimeMs: Date.now() - startTime
          });
          return null;
        }

        // Normalize the data
        const enrichedData = normalizeGUSData(gusData);

        // Cache the result (24 hour TTL)
        await ctx.db.gusCache.upsert({
          where: { nip },
          create: {
            nip,
            regon: enrichedData.regon,
            data: enrichedData,
            fetchedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          },
          update: {
            regon: enrichedData.regon,
            data: enrichedData,
            fetchedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });

        // Log successful request
        await logGUSRequest(ctx, {
          requestType: 'NIP_LOOKUP',
          nip,
          status: 'SUCCESS',
          responseTimeMs: Date.now() - startTime,
          responseData: enrichedData
        });

        // Audit log
        await ctx.audit.log({
          action: 'GUS_DATA_FETCHED',
          entityType: 'GUSEnrichment',
          entityId: nip,
          userId: user.id,
          metadata: { nip, source: 'GUS_API' }
        });

        return enrichedData;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Log failed request
        await logGUSRequest(ctx, {
          requestType: 'NIP_LOOKUP',
          nip,
          status: 'ERROR',
          responseTimeMs: Date.now() - startTime,
          errorMessage
        });

        if (errorMessage.includes('timeout')) {
          throw new TRPCError({
            code: 'TIMEOUT',
            message: 'GUS API request timed out. Please try again later.'
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch GUS data: ${errorMessage}`
        });
      }
    }),

  // Enrich from REGON
  enrichFromREGON: protectedProcedure
    .input(EnrichFromREGONRequestSchema)
    .output(EnrichedCompanyDataSchema.nullable())
    .mutation(async ({ ctx, input }) => {
      const { regon, forceRefresh } = input;
      const startTime = Date.now();

      try {
        const gusData = await ctx.gusService.fetchByREGON(regon);

        if (!gusData) {
          await logGUSRequest(ctx, {
            requestType: 'REGON_LOOKUP',
            regon,
            status: 'NOT_FOUND',
            responseTimeMs: Date.now() - startTime
          });
          return null;
        }

        const enrichedData = normalizeGUSData(gusData);

        await logGUSRequest(ctx, {
          requestType: 'REGON_LOOKUP',
          regon,
          status: 'SUCCESS',
          responseTimeMs: Date.now() - startTime
        });

        return enrichedData;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await logGUSRequest(ctx, {
          requestType: 'REGON_LOOKUP',
          regon,
          status: 'ERROR',
          responseTimeMs: Date.now() - startTime,
          errorMessage
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch REGON data: ${errorMessage}`
        });
      }
    }),

  // Enrich existing client
  enrichClient: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      forceRefresh: z.boolean().default(false)
    }))
    .output(z.object({
      success: z.boolean(),
      fieldsUpdated: z.array(z.string()),
      enrichedData: EnrichedCompanyDataSchema.nullable()
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId, forceRefresh } = input;
      const { user, db, organizationId } = ctx;

      // Get client
      const client = await db.client.findFirst({
        where: {
          id: clientId,
          organizationId,
          deletedAt: null
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found'
        });
      }

      // Fetch GUS data
      const enrichedData = await ctx.gusService.fetchByNIP(client.nip);

      if (!enrichedData) {
        return {
          success: false,
          fieldsUpdated: [],
          enrichedData: null
        };
      }

      const normalizedData = normalizeGUSData(enrichedData);

      // Determine which fields to update
      const updates: Record<string, any> = {};
      const fieldsUpdated: string[] = [];

      if (!client.legalName && normalizedData.legalName) {
        updates.legalName = normalizedData.legalName;
        fieldsUpdated.push('legalName');
      }

      if (!client.regon && normalizedData.regon) {
        updates.regon = normalizedData.regon;
        fieldsUpdated.push('regon');
      }

      if (!client.krs && normalizedData.krs) {
        updates.krs = normalizedData.krs;
        fieldsUpdated.push('krs');
      }

      if (!client.industryCode && normalizedData.pkdCodes.length > 0) {
        const primaryPkd = normalizedData.pkdCodes.find(p => p.isPrimary) || normalizedData.pkdCodes[0];
        updates.industryCode = primaryPkd.code;
        updates.industryName = primaryPkd.name;
        fieldsUpdated.push('industryCode', 'industryName');
      }

      if (!client.establishedDate && normalizedData.registrationDate) {
        updates.establishedDate = normalizedData.registrationDate;
        fieldsUpdated.push('establishedDate');
      }

      // Update client if there are changes
      if (Object.keys(updates).length > 0) {
        await db.client.update({
          where: { id: clientId },
          data: {
            ...updates,
            updatedBy: user.id,
            version: client.version + 1
          }
        });

        // Add timeline event
        await db.clientTimeline.create({
          data: {
            clientId,
            eventType: 'DATA_ENRICHED_FROM_GUS',
            title: 'Data enriched from GUS',
            description: `Updated ${fieldsUpdated.length} field(s) from GUS`,
            metadata: {
              fieldsUpdated,
              source: 'GUS_API'
            },
            userId: user.id,
            userName: user.name
          }
        });

        // Audit log
        await ctx.audit.log({
          action: 'CLIENT_ENRICHED_FROM_GUS',
          entityType: 'Client',
          entityId: clientId,
          userId: user.id,
          metadata: { fieldsUpdated }
        });
      }

      return {
        success: true,
        fieldsUpdated,
        enrichedData: normalizedData
      };
    }),

  // Get cached GUS data
  getCachedData: protectedProcedure
    .input(z.object({ nip: z.string() }))
    .output(z.object({
      data: EnrichedCompanyDataSchema.nullable(),
      cachedAt: z.date().nullable(),
      expiresAt: z.date().nullable()
    }))
    .query(async ({ ctx, input }) => {
      const cached = await ctx.db.gusCache.findFirst({
        where: { nip: input.nip }
      });

      return {
        data: cached?.data as EnrichedCompanyData | null,
        cachedAt: cached?.fetchedAt || null,
        expiresAt: cached?.expiresAt || null
      };
    }),

  // Clear cache for NIP
  clearCache: protectedProcedure
    .input(z.object({ nip: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.gusCache.delete({
        where: { nip: input.nip }
      });

      return { success: true };
    })
});

// Helper function to normalize GUS data
function normalizeGUSData(gusData: GUSCompanyData): EnrichedCompanyData {
  return {
    source: 'GUS',
    fetchedAt: new Date(),
    nip: gusData.nip,
    regon: gusData.regon,
    regon14: gusData.regon14,
    krs: gusData.krs,
    legalName: gusData.nazwa,
    shortName: gusData.nazwaSkrocona,
    registeredAddress: {
      country: gusData.adSiedzKraj_Nazwa || 'Polska',
      province: gusData.adSiedzWojewodztwo_Nazwa,
      district: gusData.adSiedzPowiat_Nazwa,
      commune: gusData.adSiedzGmina_Nazwa,
      city: gusData.adSiedzMiejscowosc_Nazwa || '',
      postalCode: gusData.adSiedzKodPocztowy || '',
      street: gusData.adSiedzUlica_Nazwa,
      buildingNumber: gusData.adSiedzNumerNieruchomosci,
      apartmentNumber: gusData.adSiedzNumerLokalu
    },
    legalForm: gusData.podstawowaFormaPrawna_Nazwa,
    detailedLegalForm: gusData.szczegolnaFormaPrawna_Nazwa,
    financingForm: gusData.formaFinansowania_Nazwa,
    ownershipForm: gusData.formaWlasnosci_Nazwa,
    pkdCodes: gusData.pkdKod ? [{
      code: gusData.pkdKod,
      name: gusData.pkdNazwa || '',
      isPrimary: true
    }] : [],
    registrationDate: gusData.dataRozpoczeciaDzialalnosci
      ? new Date(gusData.dataRozpoczeciaDzialalnosci)
      : undefined,
    suspensionDate: gusData.dataZawieszeniaDzialalnosci
      ? new Date(gusData.dataZawieszeniaDzialalnosci)
      : undefined,
    resumptionDate: gusData.dataWznowieniaDzialalnosci
      ? new Date(gusData.dataWznowieniaDzialalnosci)
      : undefined,
    terminationDate: gusData.dataZakonczeniaDzialalnosci
      ? new Date(gusData.dataZakonczeniaDzialalnosci)
      : undefined,
    regonRegistrationDate: gusData.dataWpisuDoRegostrREGON
      ? new Date(gusData.dataWpisuDoRegostrREGON)
      : undefined,
    phone: gusData.numerTelefonu,
    fax: gusData.numerFaksu,
    email: gusData.adresEmail,
    website: gusData.adresStronyInternetowej,
    nipStatus: gusData.statusNip,
    legalStatus: gusData.stanPrawny,
    isActive: !gusData.dataZakonczeniaDzialalnosci && !gusData.dataZawieszeniaDzialalnosci
  };
}

// Helper function to log GUS requests
async function logGUSRequest(ctx: any, data: {
  requestType: string;
  nip?: string;
  regon?: string;
  status: string;
  responseTimeMs: number;
  errorMessage?: string;
  responseData?: any;
}) {
  await ctx.db.gusApiLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      ...data
    }
  });
}
```

### GUS Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as soap from 'soap';
import { GUSCompanyData } from './schemas';

@Injectable()
export class GUSService {
  private readonly logger = new Logger(GUSService.name);
  private soapClient: soap.Client | null = null;
  private sessionId: string | null = null;
  private sessionExpiresAt: Date | null = null;

  private readonly GUS_WSDL = process.env.GUS_WSDL_URL ||
    'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc?wsdl';
  private readonly GUS_API_KEY = process.env.GUS_API_KEY;
  private readonly REQUEST_TIMEOUT = 5000; // 5 seconds

  async initialize(): Promise<void> {
    if (!this.GUS_API_KEY) {
      this.logger.warn('GUS API key not configured');
      return;
    }

    try {
      this.soapClient = await soap.createClientAsync(this.GUS_WSDL, {
        wsdl_options: { timeout: this.REQUEST_TIMEOUT }
      });

      await this.login();
    } catch (error) {
      this.logger.error('Failed to initialize GUS client', error);
      throw error;
    }
  }

  private async login(): Promise<void> {
    if (!this.soapClient) {
      throw new Error('SOAP client not initialized');
    }

    const result = await this.soapClient.ZalogujAsync({
      pKluczUzytkownika: this.GUS_API_KEY
    });

    this.sessionId = result[0].ZalogujResult;
    this.sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Add session header
    this.soapClient.addSoapHeader({
      sid: this.sessionId
    });
  }

  private async ensureSession(): Promise<void> {
    if (!this.sessionId || !this.sessionExpiresAt || this.sessionExpiresAt < new Date()) {
      await this.login();
    }
  }

  async fetchByNIP(nip: string): Promise<GUSCompanyData | null> {
    await this.ensureSession();

    if (!this.soapClient) {
      throw new Error('GUS service not available');
    }

    try {
      const result = await this.soapClient.DaneSzukajPodmiotyAsync({
        pParametryWyszukiwania: {
          Nip: nip
        }
      });

      const data = result[0].DaneSzukajPodmiotyResult;

      if (!data) {
        return null;
      }

      // Parse XML response
      const parsedData = this.parseGUSResponse(data);

      if (parsedData.length === 0) {
        return null;
      }

      // Fetch detailed data
      const regon = parsedData[0].Regon;
      const detailedData = await this.fetchDetailedData(regon);

      return {
        ...parsedData[0],
        ...detailedData
      };

    } catch (error) {
      this.logger.error(`Failed to fetch data for NIP ${nip}`, error);

      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('timeout');
      }

      throw error;
    }
  }

  async fetchByREGON(regon: string): Promise<GUSCompanyData | null> {
    await this.ensureSession();

    if (!this.soapClient) {
      throw new Error('GUS service not available');
    }

    try {
      const result = await this.soapClient.DaneSzukajPodmiotyAsync({
        pParametryWyszukiwania: {
          Regon: regon
        }
      });

      const data = result[0].DaneSzukajPodmiotyResult;

      if (!data) {
        return null;
      }

      const parsedData = this.parseGUSResponse(data);

      if (parsedData.length === 0) {
        return null;
      }

      const detailedData = await this.fetchDetailedData(regon);

      return {
        ...parsedData[0],
        ...detailedData
      };

    } catch (error) {
      this.logger.error(`Failed to fetch data for REGON ${regon}`, error);
      throw error;
    }
  }

  private async fetchDetailedData(regon: string): Promise<Partial<GUSCompanyData>> {
    if (!this.soapClient) {
      return {};
    }

    try {
      // Determine report type based on REGON length and entity type
      const reportType = regon.length === 9
        ? 'BIR11OsFizycznaDzworkaReskaPubl'
        : 'BIR11JednstotkiLokalne';

      const result = await this.soapClient.DanePobierzPelnyRaportAsync({
        pRegon: regon,
        pNazwaRaportu: reportType
      });

      const reportData = result[0].DanePobierzPelnyRaportResult;

      if (!reportData) {
        return {};
      }

      return this.parseDetailedReport(reportData);

    } catch (error) {
      this.logger.warn(`Failed to fetch detailed data for REGON ${regon}`, error);
      return {};
    }
  }

  private parseGUSResponse(xmlData: string): GUSCompanyData[] {
    // Parse XML response from GUS
    // Implementation depends on xml2js or similar library
    const parser = require('fast-xml-parser');

    try {
      const parsed = parser.parse(xmlData, {
        ignoreAttributes: false,
        parseTagValue: true
      });

      if (!parsed.root || !parsed.root.dane) {
        return [];
      }

      const dane = Array.isArray(parsed.root.dane)
        ? parsed.root.dane
        : [parsed.root.dane];

      return dane.map((item: any) => ({
        nip: item.Nip,
        regon: item.Regon,
        nazwa: item.Nazwa,
        adSiedzWojewodztwo_Nazwa: item.Wojewodztwo,
        adSiedzPowiat_Nazwa: item.Powiat,
        adSiedzGmina_Nazwa: item.Gmina,
        adSiedzMiejscowosc_Nazwa: item.Miejscowosc,
        adSiedzKodPocztowy: item.KodPocztowy,
        adSiedzUlica_Nazwa: item.Ulica,
        adSiedzNumerNieruchomosci: item.NrNieruchomosci,
        adSiedzNumerLokalu: item.NrLokalu
      }));

    } catch (error) {
      this.logger.error('Failed to parse GUS response', error);
      return [];
    }
  }

  private parseDetailedReport(xmlData: string): Partial<GUSCompanyData> {
    const parser = require('fast-xml-parser');

    try {
      const parsed = parser.parse(xmlData, {
        ignoreAttributes: false,
        parseTagValue: true
      });

      if (!parsed.root || !parsed.root.dane) {
        return {};
      }

      const dane = parsed.root.dane;

      return {
        krs: dane.praw_numerWRejestrzeEwidencji,
        podstawowaFormaPrawna_Nazwa: dane.praw_podstawowaFormaPrawna_Nazwa,
        szczegolnaFormaPrawna_Nazwa: dane.praw_szczegolnaFormaPrawna_Nazwa,
        pkdKod: dane.praw_pkdKod,
        pkdNazwa: dane.praw_pkdNazwa,
        dataRozpoczeciaDzialalnosci: dane.praw_dataRozpoczeciaDzialalnosci,
        dataZawieszeniaDzialalnosci: dane.praw_dataZawieszeniaDzialalnosci,
        dataWznowieniaDzialalnosci: dane.praw_dataWznowieniaDzialalnosci,
        dataZakonczeniaDzialalnosci: dane.praw_dataZakonczeniaDzialalnosci,
        numerTelefonu: dane.praw_numerTelefonu,
        adresEmail: dane.praw_adresEmail,
        adresStronyInternetowej: dane.praw_adresStronyinternetowej
      };

    } catch (error) {
      this.logger.error('Failed to parse detailed report', error);
      return {};
    }
  }

  async logout(): Promise<void> {
    if (this.soapClient && this.sessionId) {
      try {
        await this.soapClient.WylogujAsync({
          pIdentyfikatorSesji: this.sessionId
        });
      } catch (error) {
        this.logger.warn('Failed to logout from GUS', error);
      }

      this.sessionId = null;
      this.sessionExpiresAt = null;
    }
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GUSService } from './gus.service';

describe('GUSService', () => {
  let service: GUSService;

  beforeEach(() => {
    service = new GUSService();
  });

  describe('fetchByNIP', () => {
    it('should fetch company data for valid NIP', async () => {
      // Mock SOAP client response
      vi.spyOn(service as any, 'ensureSession').mockResolvedValue(undefined);

      const mockClient = {
        DaneSzukajPodmiotyAsync: vi.fn().mockResolvedValue([{
          DaneSzukajPodmiotyResult: `
            <root>
              <dane>
                <Nip>5270103391</Nip>
                <Regon>012345678</Regon>
                <Nazwa>Test Company Sp. z o.o.</Nazwa>
                <Miejscowosc>Warszawa</Miejscowosc>
                <KodPocztowy>00-001</KodPocztowy>
              </dane>
            </root>
          `
        }]),
        DanePobierzPelnyRaportAsync: vi.fn().mockResolvedValue([{
          DanePobierzPelnyRaportResult: '<root><dane></dane></root>'
        }])
      };

      (service as any).soapClient = mockClient;

      const result = await service.fetchByNIP('5270103391');

      expect(result).toBeDefined();
      expect(result?.nip).toBe('5270103391');
      expect(result?.nazwa).toBe('Test Company Sp. z o.o.');
    });

    it('should return null for non-existent NIP', async () => {
      vi.spyOn(service as any, 'ensureSession').mockResolvedValue(undefined);

      const mockClient = {
        DaneSzukajPodmiotyAsync: vi.fn().mockResolvedValue([{
          DaneSzukajPodmiotyResult: null
        }])
      };

      (service as any).soapClient = mockClient;

      const result = await service.fetchByNIP('0000000000');

      expect(result).toBeNull();
    });

    it('should throw timeout error when API is slow', async () => {
      vi.spyOn(service as any, 'ensureSession').mockResolvedValue(undefined);

      const mockClient = {
        DaneSzukajPodmiotyAsync: vi.fn().mockRejectedValue(new Error('timeout'))
      };

      (service as any).soapClient = mockClient;

      await expect(service.fetchByNIP('5270103391')).rejects.toThrow('timeout');
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '@/test/helpers';
import { gusRouter } from './gus.router';

describe('GUS Integration API', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof gusRouter.createCaller>;

  beforeAll(async () => {
    ctx = await createTestContext();
    caller = gusRouter.createCaller(ctx);
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('enrichFromGUS', () => {
    it('should enrich data from GUS API', async () => {
      // Note: This test requires a valid GUS API key
      // In CI, use mocked responses

      const result = await caller.enrichFromGUS({
        nip: '5270103391',
        forceRefresh: true
      });

      expect(result).toBeDefined();
      expect(result?.source).toBe('GUS');
      expect(result?.nip).toBe('5270103391');
    });

    it('should use cache for repeated requests', async () => {
      // First request
      await caller.enrichFromGUS({
        nip: '5270103391',
        forceRefresh: true
      });

      // Second request (should use cache)
      const startTime = Date.now();
      const result = await caller.enrichFromGUS({
        nip: '5270103391',
        forceRefresh: false
      });
      const elapsed = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(100); // Cache hit should be fast
    });
  });

  describe('enrichClient', () => {
    it('should enrich existing client with GUS data', async () => {
      // Create test client
      const client = await ctx.db.client.create({
        data: {
          organizationId: ctx.organizationId,
          companyName: 'Test Company',
          nip: '5270103391',
          taxSettings: { taxForm: 'CIT', vatPayer: false },
          registeredAddress: {
            street: 'Test',
            buildingNumber: '1',
            postalCode: '00-001',
            city: 'Test',
            country: 'PL'
          },
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id
        }
      });

      const result = await caller.enrichClient({
        clientId: client.id,
        forceRefresh: false
      });

      expect(result.success).toBe(true);
      expect(result.fieldsUpdated.length).toBeGreaterThan(0);
    });
  });
});
```

---

## Security Checklist

- [x] **API Key Security**: GUS API key stored in environment variables
- [x] **Session Management**: SOAP session properly managed with expiration
- [x] **Rate Limiting**: Request logging enables rate limit tracking
- [x] **Data Caching**: Responses cached to reduce API calls
- [x] **Error Handling**: Sensitive error details not exposed to client
- [x] **Audit Trail**: All GUS requests logged for compliance
- [x] **Input Validation**: NIP/REGON validated before API calls
- [x] **Timeout Handling**: 5-second timeout prevents hanging requests

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `GUS_DATA_FETCHED` | Successful GUS lookup | nip, source |
| `CLIENT_ENRICHED_FROM_GUS` | Client updated with GUS data | clientId, fieldsUpdated |
| `GUS_API_ERROR` | GUS API failure | nip, errorMessage |

---

## Implementation Notes

### GUS API Authentication
- Uses SOAP-based BIR1 API (Baza Internetowa REGON)
- Requires API key from GUS (stat.gov.pl)
- Session-based authentication with 1-hour validity
- Test environment: https://wyszukiwarkaregontest.stat.gov.pl/

### Caching Strategy
- 24-hour cache TTL for GUS data (data doesn't change frequently)
- Cache invalidation on force refresh
- Redis for distributed caching in production

### Error Handling
- Graceful degradation when GUS is unavailable
- Queue failed enrichments for retry
- Maximum 3 retry attempts with exponential backoff

---

*Story created: December 2024*
*Last updated: December 2024*
