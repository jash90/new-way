# Core CRM Module - Complete Technical Specification

## Module Information
- **Module Name**: Core Customer Relationship Management
- **Acronym**: CRM
- **Primary Purpose**: Centralized management of client relationships and company data for accounting offices
- **Key Features**: Client profiles, GUS/REGON integration, VAT validation, AI risk assessment, timeline tracking, custom fields, document linking

---

## A. Module Overview

### Purpose
The Core CRM Module serves as the central hub for managing all client-related data and interactions within the accounting platform. It provides a unified view of client information, automates data enrichment from government sources, and enables intelligent client management through AI-powered insights.

### Scope
- **Client Profile Management**: Complete CRUD operations for client records with versioning
- **Company Data Enrichment**: Automatic data fetching from Polish government systems (GUS, REGON, VIES)
- **Contact Management**: Multiple contacts per client with roles and preferences
- **Interaction Timeline**: Chronological history of all client interactions and events
- **Document Repository Linking**: Association with documents stored in the Document Management module
- **Custom Fields System**: Flexible schema for industry-specific data
- **Tagging and Categorization**: Multi-dimensional client classification
- **VAT Validation**: EU VAT number verification through VIES
- **AI Risk Assessment**: Intelligent business risk scoring
- **Status Management**: Active/inactive/suspended client lifecycle
- **Audit Trail**: Complete history of all changes with versioning
- **Search and Filtering**: Advanced search capabilities with Elasticsearch
- **Data Export**: Multiple format exports (CSV, Excel, JSON)

### Dependencies
- **Authentication Module**: User context, permissions, session management
- **Document Module**: Document storage and retrieval
- **Integration Module**: GUS/REGON/VIES API connections
- **AI Module**: Risk assessment and data enrichment services
- **Notification Module**: Email/SMS alerts for client updates
- **Audit Module**: Comprehensive logging and compliance tracking

### Consumers
- **Accounting Module**: Client financial data and settings
- **HR Module**: Client employee management
- **Task Module**: Client-related task assignments
- **Reporting Module**: Client analytics and reports
- **Portal Module**: Client self-service access
- **Invoice Module**: Billing information
- **Calendar Module**: Client meetings and deadlines

---

## B. Technical Specification

### Technology Stack

```yaml
Primary Framework:
  Backend: Node.js with TypeScript
  API Layer: tRPC for type-safe APIs
  Validation: Zod for schema validation
  
Database:
  Primary: PostgreSQL 15 (via Supabase)
  - Row Level Security for multi-tenancy
  - JSONB for flexible custom fields
  - Full-text search capabilities
  
Cache:
  Redis 7:
  - Client data caching (TTL: 1 hour)
  - Search results caching
  - API response caching
  - Session storage
  
Search:
  Elasticsearch 8:
  - Full-text client search
  - Advanced filtering
  - Fuzzy matching
  - Polish language support
  
Security:
  - JWT-based authentication
  - Role-based access control (RBAC)
  - Field-level encryption for sensitive data
  - API rate limiting
  - Input sanitization
  
External Services:
  - GUS API for Polish company data
  - VIES for EU VAT validation
  - Google Maps API for address validation
  - OpenAI API for AI features
```

### Key Interfaces

```typescript
// =====================================
// Data Transfer Objects
// =====================================

import { z } from 'zod';

// Polish NIP validation
const nipSchema = z.string().regex(/^\d{10}$/, 'NIP must be 10 digits');
const regonSchema = z.string().regex(/^\d{9}(\d{5})?$/, 'REGON must be 9 or 14 digits');

export const CreateClientDto = z.object({
  companyName: z.string().min(1).max(255),
  nip: nipSchema,
  regon: regonSchema.optional(),
  vatNumber: z.string().optional(),
  taxForm: z.enum(['CIT', 'PIT', 'VAT', 'FLAT_TAX', 'LUMP_SUM']),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[0-9\s\-()]+$/).optional(),
  address: z.object({
    street: z.string(),
    buildingNumber: z.string(),
    apartmentNumber: z.string().optional(),
    postalCode: z.string().regex(/^\d{2}-\d{3}$/),
    city: z.string(),
    country: z.string().default('PL'),
    province: z.string().optional()
  }),
  contacts: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    role: z.enum(['OWNER', 'ACCOUNTANT', 'MANAGER', 'EMPLOYEE', 'OTHER']),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    isPrimary: z.boolean().default(false)
  })).optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional()
});

export const UpdateClientDto = CreateClientDto.partial().extend({
  version: z.number() // For optimistic locking
});

export type CreateClientDto = z.infer<typeof CreateClientDto>;
export type UpdateClientDto = z.infer<typeof UpdateClientDto>;

// =====================================
// Domain Models
// =====================================

export interface Client {
  id: string;
  organizationId: string;
  companyName: string;
  legalName?: string;
  nip: string;
  regon?: string;
  krs?: string;
  vatNumber?: string;
  vatStatus: VATStatus;
  
  // Tax configuration
  taxSettings: TaxConfiguration;
  
  // Address information
  registeredAddress: Address;
  correspondenceAddress?: Address;
  
  // Contact information
  contacts: Contact[];
  primaryContactId?: string;
  
  // Business information
  industryCode?: string; // PKD code
  industryName?: string;
  companySize?: CompanySize;
  establishedDate?: Date;
  
  // Financial information
  bankAccounts: BankAccount[];
  defaultBankAccountId?: string;
  
  // Relationship management
  status: ClientStatus;
  onboardingStatus: OnboardingStatus;
  serviceLevel: ServiceLevel;
  contractStartDate?: Date;
  contractEndDate?: Date;
  
  // AI-enhanced fields
  riskProfile?: RiskProfile;
  creditScore?: number;
  paymentHistory?: PaymentHistory;
  
  // Metadata
  customFields: Record<string, any>;
  tags: string[];
  notes?: string;
  
  // System fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number; // Optimistic locking
  deletedAt?: Date; // Soft delete
}

export interface TaxConfiguration {
  taxForm: TaxForm;
  vatPayer: boolean;
  vatRate?: number;
  vatPaymentPeriod?: 'MONTHLY' | 'QUARTERLY';
  citRate?: number;
  pitRate?: number;
  zusConfiguration?: ZUSConfiguration;
  taxDeadlines: TaxDeadline[];
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  role: ContactRole;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary: boolean;
  hasPortalAccess: boolean;
  portalUserId?: string;
  preferences: ContactPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimelineEvent {
  id: string;
  clientId: string;
  eventType: EventType;
  title: string;
  description?: string;
  metadata: Record<string, any>;
  userId: string;
  userName: string;
  createdAt: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface RiskProfile {
  score: number; // 0-100
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  lastAssessmentDate: Date;
  nextAssessmentDate: Date;
}

// =====================================
// Service Interfaces
// =====================================

export interface ClientService {
  // CRUD operations
  create(data: CreateClientDto, userId: string): Promise<Client>;
  update(id: string, data: UpdateClientDto, userId: string): Promise<Client>;
  delete(id: string, userId: string): Promise<void>;
  restore(id: string, userId: string): Promise<Client>;
  findById(id: string): Promise<Client | null>;
  findByNIP(nip: string): Promise<Client | null>;
  
  // Search and filtering
  search(query: ClientSearchQuery): Promise<ClientSearchResult>;
  list(filters: ClientFilters, pagination: PaginationParams): Promise<PaginatedResult<Client>>;
  
  // Data enrichment
  enrichFromGUS(nip: string): Promise<EnrichedCompanyData>;
  validateVATEU(vatNumber: string): Promise<VATValidationResult>;
  verifyWhiteList(nip: string, accountNumber: string): Promise<WhiteListStatus>;
  
  // Timeline and history
  getTimeline(clientId: string, filters?: TimelineFilters): Promise<TimelineEvent[]>;
  addTimelineEvent(clientId: string, event: CreateTimelineEventDto): Promise<TimelineEvent>;
  
  // Contact management
  addContact(clientId: string, contact: CreateContactDto): Promise<Contact>;
  updateContact(clientId: string, contactId: string, data: UpdateContactDto): Promise<Contact>;
  removeContact(clientId: string, contactId: string): Promise<void>;
  
  // AI features
  assessRisk(clientId: string): Promise<RiskProfile>;
  predictChurn(clientId: string): Promise<ChurnPrediction>;
  suggestServices(clientId: string): Promise<ServiceRecommendation[]>;
  
  // Bulk operations
  bulkImport(data: ClientImportData): Promise<BulkImportResult>;
  bulkUpdate(ids: string[], updates: Partial<UpdateClientDto>): Promise<BulkUpdateResult>;
  bulkExport(ids: string[], format: ExportFormat): Promise<Buffer>;
  
  // Statistics
  getStatistics(clientId: string): Promise<ClientStatistics>;
  getEngagementScore(clientId: string): Promise<number>;
}

// =====================================
// Event Interfaces
// =====================================

export interface ClientCreatedEvent {
  type: 'CLIENT_CREATED';
  clientId: string;
  organizationId: string;
  companyName: string;
  nip: string;
  createdBy: string;
  timestamp: Date;
}

export interface ClientUpdatedEvent {
  type: 'CLIENT_UPDATED';
  clientId: string;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  updatedBy: string;
  timestamp: Date;
}

export interface ClientStatusChangedEvent {
  type: 'CLIENT_STATUS_CHANGED';
  clientId: string;
  oldStatus: ClientStatus;
  newStatus: ClientStatus;
  reason?: string;
  changedBy: string;
  timestamp: Date;
}

// =====================================
// Enums
// =====================================

export enum ClientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  ARCHIVED = 'ARCHIVED'
}

export enum OnboardingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED'
}

export enum TaxForm {
  CIT = 'CIT',
  PIT = 'PIT',
  VAT = 'VAT',
  FLAT_TAX = 'FLAT_TAX',
  LUMP_SUM = 'LUMP_SUM'
}
```

### API Endpoints

```typescript
// RESTful API endpoints
export const clientEndpoints = {
  // Client CRUD
  'POST   /api/v1/clients': 'Create new client',
  'GET    /api/v1/clients': 'List clients with filters',
  'GET    /api/v1/clients/search': 'Search clients',
  'GET    /api/v1/clients/:id': 'Get client by ID',
  'PUT    /api/v1/clients/:id': 'Update client',
  'PATCH  /api/v1/clients/:id': 'Partial update',
  'DELETE /api/v1/clients/:id': 'Soft delete client',
  'POST   /api/v1/clients/:id/restore': 'Restore deleted client',
  
  // Data enrichment
  'POST   /api/v1/clients/enrich-gus': 'Fetch data from GUS',
  'POST   /api/v1/clients/validate-vat': 'Validate EU VAT',
  'POST   /api/v1/clients/verify-whitelist': 'Check tax whitelist',
  
  // Contacts
  'GET    /api/v1/clients/:id/contacts': 'List client contacts',
  'POST   /api/v1/clients/:id/contacts': 'Add contact',
  'PUT    /api/v1/clients/:id/contacts/:contactId': 'Update contact',
  'DELETE /api/v1/clients/:id/contacts/:contactId': 'Remove contact',
  
  // Timeline
  'GET    /api/v1/clients/:id/timeline': 'Get client timeline',
  'POST   /api/v1/clients/:id/timeline': 'Add timeline event',
  
  // AI features
  'POST   /api/v1/clients/:id/assess-risk': 'Run risk assessment',
  'GET    /api/v1/clients/:id/risk-profile': 'Get risk profile',
  
  // Bulk operations
  'POST   /api/v1/clients/bulk/import': 'Bulk import clients',
  'POST   /api/v1/clients/bulk/update': 'Bulk update clients',
  'POST   /api/v1/clients/bulk/export': 'Bulk export clients',
  
  // Statistics
  'GET    /api/v1/clients/:id/statistics': 'Get client statistics',
  'GET    /api/v1/clients/:id/engagement': 'Get engagement score'
};
```

---

## C. Implementation Details

### Main Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { EventEmitter } from 'events';

@injectable()
export class ClientServiceImpl implements ClientService {
  constructor(
    @inject('ClientRepository') private clientRepo: ClientRepository,
    @inject('GUSIntegration') private gusIntegration: GUSIntegrationService,
    @inject('VIESIntegration') private viesIntegration: VIESIntegrationService,
    @inject('AIService') private aiService: AIEnrichmentService,
    @inject('EventBus') private eventBus: EventBus,
    @inject('AuditLogger') private auditLogger: AuditLogger,
    @inject('Cache') private cache: Redis,
    @inject('Logger') private logger: Logger,
    @inject('ElasticSearch') private searchClient: ElasticsearchClient,
    @inject('NotificationService') private notificationService: NotificationService
  ) {}

  // =====================================
  // CRUD Operations
  // =====================================

  async create(data: CreateClientDto, userId: string): Promise<Client> {
    try {
      // Start transaction
      return await this.clientRepo.transaction(async (trx) => {
        // Validate input
        const validatedData = CreateClientDto.parse(data);
        
        // Check for duplicate NIP
        const existingClient = await this.findByNIP(validatedData.nip);
        if (existingClient && !existingClient.deletedAt) {
          throw new DuplicateClientException(`Client with NIP ${validatedData.nip} already exists`);
        }

        // Enrich data from GUS
        let enrichedData: Partial<Client> = {};
        try {
          const gusData = await this.gusIntegration.fetchCompanyData(validatedData.nip);
          enrichedData = {
            legalName: gusData.legalName,
            regon: gusData.regon || validatedData.regon,
            krs: gusData.krs,
            industryCode: gusData.pkdCodes?.[0],
            industryName: gusData.industryName,
            establishedDate: gusData.registrationDate,
            registeredAddress: {
              ...validatedData.address,
              ...gusData.address
            }
          };
        } catch (error) {
          this.logger.warn(`Failed to fetch GUS data for NIP ${validatedData.nip}`, error);
          // Continue without GUS data
        }

        // Validate VAT if provided
        let vatStatus: VATStatus = VATStatus.NOT_REGISTERED;
        if (validatedData.vatNumber) {
          const vatValidation = await this.validateVATEU(validatedData.vatNumber);
          vatStatus = vatValidation.valid ? VATStatus.ACTIVE : VATStatus.INVALID;
        }

        // AI-powered risk assessment
        let riskProfile: RiskProfile | undefined;
        try {
          riskProfile = await this.aiService.assessBusinessRisk({
            nip: validatedData.nip,
            industry: enrichedData.industryCode,
            registrationDate: enrichedData.establishedDate,
            companySize: this.estimateCompanySize(enrichedData)
          });
        } catch (error) {
          this.logger.warn('Failed to assess risk', error);
        }

        // Create client entity
        const client: Partial<Client> = {
          organizationId: await this.getCurrentOrganizationId(userId),
          companyName: validatedData.companyName,
          legalName: enrichedData.legalName,
          nip: validatedData.nip,
          regon: enrichedData.regon || validatedData.regon,
          krs: enrichedData.krs,
          vatNumber: validatedData.vatNumber,
          vatStatus,
          taxSettings: {
            taxForm: validatedData.taxForm,
            vatPayer: !!validatedData.vatNumber,
            vatRate: validatedData.taxForm === 'VAT' ? 23 : undefined,
            vatPaymentPeriod: this.determineVATPaymentPeriod(enrichedData),
            taxDeadlines: this.generateTaxDeadlines(validatedData.taxForm)
          },
          registeredAddress: enrichedData.registeredAddress || validatedData.address,
          correspondenceAddress: validatedData.address,
          contacts: validatedData.contacts || [],
          industryCode: enrichedData.industryCode,
          industryName: enrichedData.industryName,
          establishedDate: enrichedData.establishedDate,
          status: ClientStatus.PENDING,
          onboardingStatus: OnboardingStatus.NOT_STARTED,
          serviceLevel: ServiceLevel.STANDARD,
          riskProfile,
          customFields: validatedData.customFields || {},
          tags: validatedData.tags || [],
          notes: validatedData.notes,
          createdBy: userId,
          updatedBy: userId,
          version: 1
        };

        // Save to database
        const savedClient = await trx.clients.create(client);

        // Index in Elasticsearch
        await this.indexClient(savedClient);

        // Create initial timeline event
        await this.addTimelineEvent(savedClient.id, {
          eventType: EventType.CLIENT_CREATED,
          title: 'Client created',
          description: `Client ${savedClient.companyName} was created`,
          metadata: { source: 'manual', userId }
        });

        // Publish event
        await this.eventBus.publish({
          type: 'CLIENT_CREATED',
          clientId: savedClient.id,
          organizationId: savedClient.organizationId,
          companyName: savedClient.companyName,
          nip: savedClient.nip,
          createdBy: userId,
          timestamp: new Date()
        } as ClientCreatedEvent);

        // Audit log
        await this.auditLogger.log({
          action: 'CLIENT_CREATED',
          entityType: 'Client',
          entityId: savedClient.id,
          userId,
          metadata: {
            companyName: savedClient.companyName,
            nip: savedClient.nip
          }
        });

        // Clear cache
        await this.clearClientCache();

        // Send welcome notification
        if (validatedData.email) {
          await this.notificationService.sendClientWelcome({
            email: validatedData.email,
            companyName: savedClient.companyName
          });
        }

        return savedClient as Client;
      });
    } catch (error) {
      this.logger.error('Failed to create client', error);
      throw error;
    }
  }

  async update(id: string, data: UpdateClientDto, userId: string): Promise<Client> {
    try {
      return await this.clientRepo.transaction(async (trx) => {
        // Get existing client with lock
        const existingClient = await trx.clients.findById(id, { lock: true });
        if (!existingClient) {
          throw new ClientNotFoundException(`Client ${id} not found`);
        }

        // Check version for optimistic locking
        if (data.version && data.version !== existingClient.version) {
          throw new OptimisticLockException('Client has been modified by another user');
        }

        // Validate permissions
        await this.validatePermissions(userId, 'clients.update', existingClient);

        // Track changes for audit
        const changes = this.trackChanges(existingClient, data);

        // Update fields
        const updatedClient = {
          ...existingClient,
          ...data,
          updatedBy: userId,
          updatedAt: new Date(),
          version: existingClient.version + 1
        };

        // Save to database
        const savedClient = await trx.clients.update(id, updatedClient);

        // Update search index
        await this.indexClient(savedClient);

        // Add timeline event
        if (changes.length > 0) {
          await this.addTimelineEvent(id, {
            eventType: EventType.CLIENT_UPDATED,
            title: 'Client updated',
            description: `Updated ${changes.length} field(s)`,
            metadata: { changes, userId }
          });
        }

        // Publish event
        await this.eventBus.publish({
          type: 'CLIENT_UPDATED',
          clientId: id,
          changes,
          updatedBy: userId,
          timestamp: new Date()
        } as ClientUpdatedEvent);

        // Audit log
        await this.auditLogger.log({
          action: 'CLIENT_UPDATED',
          entityType: 'Client',
          entityId: id,
          userId,
          oldValue: existingClient,
          newValue: savedClient,
          metadata: { changes }
        });

        // Clear cache
        await this.clearClientCache(id);

        return savedClient;
      });
    } catch (error) {
      this.logger.error(`Failed to update client ${id}`, error);
      throw error;
    }
  }

  // =====================================
  // AI Features
  // =====================================

  async assessRisk(clientId: string): Promise<RiskProfile> {
    try {
      const client = await this.findById(clientId);
      if (!client) {
        throw new ClientNotFoundException(`Client ${clientId} not found`);
      }

      // Gather risk factors
      const factors: RiskFactor[] = [];

      // Check company age
      if (client.establishedDate) {
        const ageInYears = (Date.now() - client.establishedDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
        if (ageInYears < 1) {
          factors.push({
            type: 'COMPANY_AGE',
            severity: 'HIGH',
            description: 'Company less than 1 year old',
            score: 25
          });
        } else if (ageInYears < 3) {
          factors.push({
            type: 'COMPANY_AGE',
            severity: 'MEDIUM',
            description: 'Company less than 3 years old',
            score: 15
          });
        }
      }

      // Check tax whitelist status
      if (client.bankAccounts.length > 0) {
        for (const account of client.bankAccounts) {
          const whiteListStatus = await this.verifyWhiteList(client.nip, account.accountNumber);
          if (!whiteListStatus.isOnWhiteList) {
            factors.push({
              type: 'TAX_WHITELIST',
              severity: 'HIGH',
              description: 'Bank account not on tax whitelist',
              score: 30
            });
          }
        }
      }

      // Calculate total score
      const totalScore = factors.reduce((sum, factor) => sum + factor.score, 0);
      const riskScore = Math.min(100, totalScore);

      // Determine risk level
      let riskLevel: RiskProfile['level'];
      if (riskScore < 25) riskLevel = 'LOW';
      else if (riskScore < 50) riskLevel = 'MEDIUM';
      else if (riskScore < 75) riskLevel = 'HIGH';
      else riskLevel = 'CRITICAL';

      const riskProfile: RiskProfile = {
        score: riskScore,
        level: riskLevel,
        factors,
        lastAssessmentDate: new Date(),
        nextAssessmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };

      // Update client record
      await this.update(clientId, { riskProfile }, 'system');

      return riskProfile;
    } catch (error) {
      this.logger.error(`Failed to assess risk for client ${clientId}`, error);
      throw error;
    }
  }

  // Additional methods continue...
}
```

---

## D. Database Schema

```sql
-- =====================================
-- Main clients table
-- =====================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Basic information
  company_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  nip VARCHAR(10) NOT NULL,
  regon VARCHAR(14),
  krs VARCHAR(20),
  vat_number VARCHAR(20),
  vat_status VARCHAR(50) DEFAULT 'NOT_REGISTERED',
  
  -- Tax configuration (JSONB for flexibility)
  tax_settings JSONB NOT NULL DEFAULT '{}',
  
  -- Address information (JSONB)
  registered_address JSONB NOT NULL,
  correspondence_address JSONB,
  
  -- Business information
  industry_code VARCHAR(10),
  industry_name VARCHAR(255),
  company_size VARCHAR(50),
  established_date DATE,
  
  -- Status fields
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  onboarding_status VARCHAR(50) DEFAULT 'NOT_STARTED',
  service_level VARCHAR(50) DEFAULT 'STANDARD',
  contract_start_date DATE,
  contract_end_date DATE,
  
  -- Risk assessment
  risk_profile JSONB,
  credit_score INTEGER,
  payment_history JSONB,
  
  -- Flexible fields
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- System fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Constraints
  UNIQUE(organization_id, nip),
  CONSTRAINT valid_nip CHECK (nip ~ '^\d{10}$'),
  CONSTRAINT valid_regon CHECK (regon IS NULL OR regon ~ '^\d{9}(\d{5})?$')
);

-- =====================================
-- Contacts table
-- =====================================
CREATE TABLE client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Contact information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  
  -- Flags
  is_primary BOOLEAN DEFAULT FALSE,
  has_portal_access BOOLEAN DEFAULT FALSE,
  portal_user_id UUID REFERENCES users(id),
  
  -- Preferences (JSONB)
  preferences JSONB DEFAULT '{}',
  
  -- System fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================
-- Timeline events table
-- =====================================
CREATE TABLE client_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Event information
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- User information
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  
  -- Related entity
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  
  -- System fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================
-- Indexes
-- =====================================

-- Primary search indexes
CREATE INDEX idx_clients_organization ON clients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_nip ON clients(nip) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_status ON clients(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_tags ON clients USING GIN(tags) WHERE deleted_at IS NULL;

-- Full-text search
CREATE INDEX idx_clients_search ON clients USING GIN(
  to_tsvector('polish', company_name || ' ' || COALESCE(legal_name, ''))
) WHERE deleted_at IS NULL;

-- Timeline indexes
CREATE INDEX idx_timeline_client ON client_timeline(client_id);
CREATE INDEX idx_timeline_created ON client_timeline(created_at DESC);
```

---

## E. Testing Strategy

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClientServiceImpl } from './client.service';

describe('ClientService', () => {
  let service: ClientServiceImpl;
  let mockRepo: jest.Mocked<ClientRepository>;
  let mockGUS: jest.Mocked<GUSIntegrationService>;
  
  beforeEach(() => {
    // Setup mocks
    mockRepo = createMockRepository();
    mockGUS = createMockGUSService();
    
    service = new ClientServiceImpl(
      mockRepo,
      mockGUS,
      // ... other mocks
    );
  });

  describe('create', () => {
    it('should create a new client with GUS enrichment', async () => {
      // Arrange
      const createDto: CreateClientDto = {
        companyName: 'Test Company',
        nip: '1234567890',
        taxForm: TaxForm.CIT,
        address: {
          street: 'Test Street',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warsaw',
          country: 'PL'
        }
      };

      mockRepo.findByNIP.mockResolvedValue(null);
      mockGUS.fetchCompanyData.mockResolvedValue({
        legalName: 'Test Company Sp. z o.o.',
        regon: '123456789',
        krs: '0000123456'
      });

      // Act
      const result = await service.create(createDto, 'user123');

      // Assert
      expect(result).toBeDefined();
      expect(result.companyName).toBe('Test Company');
      expect(result.legalName).toBe('Test Company Sp. z o.o.');
      expect(mockGUS.fetchCompanyData).toHaveBeenCalledWith('1234567890');
    });
  });
});
```

---

## F. Deployment Considerations

### Resource Requirements

```yaml
Development:
  CPU: 1 core
  Memory: 2GB
  Storage: 10GB
  
Production:
  CPU: 2-4 cores
  Memory: 4-8GB
  Storage: 50GB
  Database: PostgreSQL (4 cores, 8GB RAM)
  Cache: Redis (2GB)
  Search: Elasticsearch (3 nodes, 4GB each)
```

### Scaling Strategy

- **Horizontal Scaling**: Add more pods for increased throughput
- **Database Read Replicas**: For read-heavy workloads
- **Cache Layer**: Redis cluster for distributed caching
- **Search Cluster**: Elasticsearch cluster for search scalability
- **CDN**: For static assets and API caching

### External Dependencies SLAs

- GUS API: 99% availability, 5s timeout
- VIES API: 98% availability, 10s timeout
- Database: 99.95% availability
- Redis: 99.9% availability
- Elasticsearch: 99.9% availability

---

This complete specification provides a production-ready implementation of the Core CRM Module with all necessary components, security measures, and deployment considerations. The module is designed to be scalable, maintainable, and fully integrated with Polish accounting requirements.