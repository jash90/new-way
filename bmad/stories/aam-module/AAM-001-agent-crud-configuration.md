# Story: Agent CRUD & Configuration

## Story Information

| Field | Value |
|-------|-------|
| Story ID | AAM-001 |
| Epic | AI Agent Module (AAM) |
| Title | Agent CRUD & Configuration |
| Priority | P0 |
| Story Points | 8 |
| Status | Draft |
| Sprint | Sprint 1 - Foundation |

## User Story

**As a** Super Admin,
**I want to** create, configure, and manage AI agents with custom settings,
**So that** I can deploy specialized assistants tailored for specific business functions.

## Acceptance Criteria

### AC1: Agent Creation
```gherkin
Given I am authenticated as a Super Admin
When I navigate to the Agent Management section
And I click "Create New Agent"
And I provide:
  | Field | Value |
  | Name | "Polish Tax Advisor" |
  | Description | "Expert in Polish tax regulations" |
  | Model | "claude-3-opus" |
  | Temperature | 0.7 |
  | Max Tokens | 2000 |
Then the agent should be created in DRAFT status
And I should see the agent configuration panel
And an audit event should be logged
```

### AC2: Agent Configuration
```gherkin
Given I have created an agent
When I configure the agent settings:
  | Setting | Value |
  | Avatar | uploaded image |
  | Response Style | Professional |
  | Language | Polish |
  | Context Window | 128000 |
Then the configuration should be saved
And the agent preview should reflect the changes
```

### AC3: Agent Activation
```gherkin
Given I have a fully configured agent in DRAFT status
When I click "Activate Agent"
And the agent has:
  - Valid system prompt
  - At least one active permission
Then the agent status should change to ACTIVE
And the agent should appear in the available agents list
And users with permissions should be able to interact with it
```

### AC4: Agent Update
```gherkin
Given I have an ACTIVE agent
When I modify the agent configuration
And I click "Save Changes"
Then the agent version should increment
And the previous configuration should be preserved in history
And active conversations should continue with the new config
```

### AC5: Agent Deactivation & Deletion
```gherkin
Given I have an ACTIVE agent
When I click "Deactivate"
Then the agent status should change to INACTIVE
And no new conversations can be started
And existing conversations can be continued

Given I have an INACTIVE agent with no active conversations
When I click "Delete"
Then I should see a confirmation dialog warning about data loss
And upon confirmation, the agent and all related data should be deleted
```

### AC6: Agent Listing & Search
```gherkin
Given I am on the Agent Management page
Then I should see a list of all agents with:
  | Column | Description |
  | Status | Active/Draft/Inactive |
  | Name | Agent name with avatar |
  | Model | LLM provider and model |
  | Usage | Conversation count |
  | Cost | Monthly cost |
  | Last Active | Last interaction date |
And I should be able to filter by status, model, creator
And I should be able to search by name or description
```

### AC7: Agent Duplication
```gherkin
Given I have an existing agent
When I click "Duplicate Agent"
Then a new agent should be created with:
  - Name suffixed with "(Copy)"
  - Same configuration as original
  - Status set to DRAFT
  - Knowledge base NOT copied (optional prompt)
And I should be redirected to the new agent's configuration
```

## Technical Specification

### Database Schema

```sql
-- Agents table (from epic, detailed fields)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url VARCHAR(500),

  -- LLM Configuration
  model VARCHAR(50) NOT NULL,
  model_provider VARCHAR(20) NOT NULL, -- 'openai', 'anthropic', 'azure'
  temperature DECIMAL(2,1) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER DEFAULT 2000 CHECK (max_tokens > 0 AND max_tokens <= 128000),
  top_p DECIMAL(2,1) DEFAULT 1.0,
  frequency_penalty DECIMAL(2,1) DEFAULT 0,
  presence_penalty DECIMAL(2,1) DEFAULT 0,

  -- Extended Configuration
  config JSONB DEFAULT '{
    "responseStyle": "professional",
    "language": "pl",
    "contextWindow": 128000,
    "streamingEnabled": true,
    "citationsEnabled": true,
    "actionsEnabled": true
  }',

  -- Lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')),
  version INTEGER DEFAULT 1,

  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(tenant_id, name)
);

-- Agent version history
CREATE TABLE agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config_snapshot JSONB NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  change_reason VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, version)
);

-- Indexes
CREATE INDEX idx_agents_tenant_status ON agents(tenant_id, status);
CREATE INDEX idx_agents_created_by ON agents(created_by);
CREATE INDEX idx_agent_versions_agent ON agent_versions(agent_id, version DESC);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Supported models
export const AIModelSchema = z.enum([
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
]);

export const ModelProviderSchema = z.enum(['openai', 'anthropic', 'azure']);

export const AgentStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);

export const AgentConfigSchema = z.object({
  responseStyle: z.enum(['professional', 'friendly', 'concise', 'detailed']).default('professional'),
  language: z.enum(['pl', 'en']).default('pl'),
  contextWindow: z.number().min(4096).max(128000).default(128000),
  streamingEnabled: z.boolean().default(true),
  citationsEnabled: z.boolean().default(true),
  actionsEnabled: z.boolean().default(true),
  customInstructions: z.string().max(2000).optional(),
});

export const CreateAgentSchema = z.object({
  name: z.string().min(3).max(100).regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9\s\-_]+$/),
  description: z.string().max(1000).optional(),
  model: AIModelSchema,
  modelProvider: ModelProviderSchema,
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(100).max(128000).default(2000),
  topP: z.number().min(0).max(1).default(1),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  config: AgentConfigSchema.optional(),
});

export const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  changeReason: z.string().max(500).optional(),
});

export const AgentFiltersSchema = z.object({
  status: AgentStatusSchema.optional(),
  model: AIModelSchema.optional(),
  createdBy: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
export type AgentFilters = z.infer<typeof AgentFiltersSchema>;
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { Agent, AgentVersion } from '../entities';
import { IAgentRepository } from '../repositories';
import { IAuditService, IStorageService, ICacheService } from '../../shared';
import { CreateAgentInput, UpdateAgentInput, AgentFilters } from '../schemas';
import { BadRequestException, NotFoundException, ForbiddenException } from '../../exceptions';

@injectable()
export class AgentService implements IAgentService {
  constructor(
    @inject('AgentRepository') private agentRepo: IAgentRepository,
    @inject('AgentVersionRepository') private versionRepo: IAgentVersionRepository,
    @inject('AuditService') private auditService: IAuditService,
    @inject('StorageService') private storageService: IStorageService,
    @inject('CacheService') private cacheService: ICacheService,
  ) {}

  async createAgent(tenantId: string, userId: string, input: CreateAgentInput): Promise<Agent> {
    // Validate unique name within tenant
    const existing = await this.agentRepo.findByName(tenantId, input.name);
    if (existing) {
      throw new BadRequestException('Agent o tej nazwie już istnieje');
    }

    // Create agent
    const agent = await this.agentRepo.create({
      tenantId,
      createdBy: userId,
      ...input,
      status: 'DRAFT',
      version: 1,
    });

    // Create initial version snapshot
    await this.createVersionSnapshot(agent, userId, 'Initial creation');

    // Audit log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_CREATED',
      entityType: 'agent',
      entityId: agent.id,
      metadata: { name: agent.name, model: agent.model },
    });

    return agent;
  }

  async updateAgent(
    tenantId: string,
    agentId: string,
    userId: string,
    input: UpdateAgentInput
  ): Promise<Agent> {
    const agent = await this.getAgentOrThrow(tenantId, agentId);

    // Check if name is being changed and is unique
    if (input.name && input.name !== agent.name) {
      const existing = await this.agentRepo.findByName(tenantId, input.name);
      if (existing) {
        throw new BadRequestException('Agent o tej nazwie już istnieje');
      }
    }

    // Increment version
    const newVersion = agent.version + 1;

    // Update agent
    const updated = await this.agentRepo.update(agentId, {
      ...input,
      version: newVersion,
      updatedAt: new Date(),
    });

    // Create version snapshot
    await this.createVersionSnapshot(updated, userId, input.changeReason || 'Configuration update');

    // Invalidate cache
    await this.cacheService.delete(`agent:${tenantId}:${agentId}`);

    // Audit log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_UPDATED',
      entityType: 'agent',
      entityId: agentId,
      metadata: {
        version: newVersion,
        changes: Object.keys(input).filter(k => k !== 'changeReason'),
      },
    });

    return updated;
  }

  async activateAgent(tenantId: string, agentId: string, userId: string): Promise<Agent> {
    const agent = await this.getAgentOrThrow(tenantId, agentId);

    if (agent.status === 'ACTIVE') {
      throw new BadRequestException('Agent jest już aktywny');
    }

    // Validate agent is ready for activation
    await this.validateAgentReadiness(agent);

    // Update status
    const updated = await this.agentRepo.update(agentId, {
      status: 'ACTIVE',
      activatedAt: new Date(),
      updatedAt: new Date(),
    });

    // Invalidate cache
    await this.cacheService.delete(`agent:${tenantId}:${agentId}`);

    // Audit log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_ACTIVATED',
      entityType: 'agent',
      entityId: agentId,
    });

    return updated;
  }

  async deactivateAgent(tenantId: string, agentId: string, userId: string): Promise<Agent> {
    const agent = await this.getAgentOrThrow(tenantId, agentId);

    if (agent.status !== 'ACTIVE') {
      throw new BadRequestException('Tylko aktywni agenci mogą być dezaktywowani');
    }

    const updated = await this.agentRepo.update(agentId, {
      status: 'INACTIVE',
      deactivatedAt: new Date(),
      updatedAt: new Date(),
    });

    await this.cacheService.delete(`agent:${tenantId}:${agentId}`);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_DEACTIVATED',
      entityType: 'agent',
      entityId: agentId,
    });

    return updated;
  }

  async deleteAgent(tenantId: string, agentId: string, userId: string): Promise<void> {
    const agent = await this.getAgentOrThrow(tenantId, agentId);

    if (agent.status === 'ACTIVE') {
      throw new BadRequestException('Dezaktywuj agenta przed usunięciem');
    }

    // Check for active conversations
    const activeConversations = await this.agentRepo.countActiveConversations(agentId);
    if (activeConversations > 0) {
      throw new BadRequestException(
        `Agent ma ${activeConversations} aktywnych konwersacji. Zakończ je przed usunięciem.`
      );
    }

    // Delete avatar if exists
    if (agent.avatarUrl) {
      await this.storageService.delete(agent.avatarUrl);
    }

    // Delete agent (cascades to versions, prompts, knowledge bases)
    await this.agentRepo.delete(agentId);

    await this.cacheService.delete(`agent:${tenantId}:${agentId}`);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_DELETED',
      entityType: 'agent',
      entityId: agentId,
      metadata: { name: agent.name },
    });
  }

  async duplicateAgent(
    tenantId: string,
    agentId: string,
    userId: string,
    includeKnowledgeBase: boolean = false
  ): Promise<Agent> {
    const source = await this.getAgentOrThrow(tenantId, agentId);

    // Create copy with modified name
    const copyName = await this.generateUniqueCopyName(tenantId, source.name);

    const duplicate = await this.agentRepo.create({
      tenantId,
      createdBy: userId,
      name: copyName,
      description: source.description,
      model: source.model,
      modelProvider: source.modelProvider,
      temperature: source.temperature,
      maxTokens: source.maxTokens,
      topP: source.topP,
      frequencyPenalty: source.frequencyPenalty,
      presencePenalty: source.presencePenalty,
      config: source.config,
      status: 'DRAFT',
      version: 1,
    });

    // Copy system prompts
    await this.copySystemPrompts(source.id, duplicate.id, tenantId);

    // Optionally copy knowledge base
    if (includeKnowledgeBase) {
      await this.copyKnowledgeBases(source.id, duplicate.id, tenantId);
    }

    await this.createVersionSnapshot(duplicate, userId, `Duplicated from "${source.name}"`);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_DUPLICATED',
      entityType: 'agent',
      entityId: duplicate.id,
      metadata: { sourceAgentId: agentId, includeKnowledgeBase },
    });

    return duplicate;
  }

  async listAgents(tenantId: string, filters: AgentFilters): Promise<PaginatedResult<Agent>> {
    return this.agentRepo.findAll(tenantId, filters);
  }

  async getAgent(tenantId: string, agentId: string): Promise<Agent | null> {
    // Check cache first
    const cached = await this.cacheService.get<Agent>(`agent:${tenantId}:${agentId}`);
    if (cached) {
      return cached;
    }

    const agent = await this.agentRepo.findById(tenantId, agentId);
    if (agent) {
      await this.cacheService.set(`agent:${tenantId}:${agentId}`, agent, 3600);
    }

    return agent;
  }

  async uploadAvatar(
    tenantId: string,
    agentId: string,
    userId: string,
    file: UploadedFile
  ): Promise<string> {
    const agent = await this.getAgentOrThrow(tenantId, agentId);

    // Validate file
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Dozwolone formaty: PNG, JPEG, WebP');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Maksymalny rozmiar avatara: 2MB');
    }

    // Delete old avatar
    if (agent.avatarUrl) {
      await this.storageService.delete(agent.avatarUrl);
    }

    // Upload new avatar
    const key = `agents/${tenantId}/${agentId}/avatar-${Date.now()}.${file.mimetype.split('/')[1]}`;
    const url = await this.storageService.upload(key, file.buffer, file.mimetype);

    // Update agent
    await this.agentRepo.update(agentId, { avatarUrl: url, updatedAt: new Date() });
    await this.cacheService.delete(`agent:${tenantId}:${agentId}`);

    return url;
  }

  async getAgentVersionHistory(
    tenantId: string,
    agentId: string
  ): Promise<AgentVersion[]> {
    await this.getAgentOrThrow(tenantId, agentId);
    return this.versionRepo.findByAgent(agentId);
  }

  async restoreAgentVersion(
    tenantId: string,
    agentId: string,
    version: number,
    userId: string
  ): Promise<Agent> {
    const agent = await this.getAgentOrThrow(tenantId, agentId);
    const targetVersion = await this.versionRepo.findByVersion(agentId, version);

    if (!targetVersion) {
      throw new NotFoundException(`Wersja ${version} nie istnieje`);
    }

    // Restore configuration from snapshot
    const newVersion = agent.version + 1;
    const updated = await this.agentRepo.update(agentId, {
      ...targetVersion.configSnapshot,
      version: newVersion,
      updatedAt: new Date(),
    });

    await this.createVersionSnapshot(
      updated,
      userId,
      `Restored from version ${version}`
    );

    await this.cacheService.delete(`agent:${tenantId}:${agentId}`);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_VERSION_RESTORED',
      entityType: 'agent',
      entityId: agentId,
      metadata: { restoredVersion: version, newVersion },
    });

    return updated;
  }

  // Private helpers

  private async getAgentOrThrow(tenantId: string, agentId: string): Promise<Agent> {
    const agent = await this.agentRepo.findById(tenantId, agentId);
    if (!agent) {
      throw new NotFoundException('Agent nie został znaleziony');
    }
    return agent;
  }

  private async validateAgentReadiness(agent: Agent): Promise<void> {
    const errors: string[] = [];

    // Check for system prompt
    const hasActivePrompt = await this.agentRepo.hasActiveSystemPrompt(agent.id);
    if (!hasActivePrompt) {
      errors.push('Agent musi mieć aktywny system prompt');
    }

    // Check for permissions
    const hasPermissions = await this.agentRepo.hasActivePermissions(agent.id);
    if (!hasPermissions) {
      errors.push('Agent musi mieć skonfigurowane uprawnienia');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('. '));
    }
  }

  private async createVersionSnapshot(
    agent: Agent,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.versionRepo.create({
      tenantId: agent.tenantId,
      agentId: agent.id,
      version: agent.version,
      configSnapshot: {
        name: agent.name,
        description: agent.description,
        model: agent.model,
        modelProvider: agent.modelProvider,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        topP: agent.topP,
        frequencyPenalty: agent.frequencyPenalty,
        presencePenalty: agent.presencePenalty,
        config: agent.config,
      },
      changedBy: userId,
      changeReason: reason,
    });
  }

  private async generateUniqueCopyName(tenantId: string, baseName: string): Promise<string> {
    let copyName = `${baseName} (Kopia)`;
    let counter = 1;

    while (await this.agentRepo.findByName(tenantId, copyName)) {
      counter++;
      copyName = `${baseName} (Kopia ${counter})`;
    }

    return copyName;
  }
}
```

### API Routes

```typescript
import { Router } from 'express';
import { validateRequest } from '../../middleware';
import { CreateAgentSchema, UpdateAgentSchema, AgentFiltersSchema } from '../schemas';

export const agentRoutes = Router();

// List agents
agentRoutes.get(
  '/',
  validateRequest({ query: AgentFiltersSchema }),
  async (req, res) => {
    const { tenantId } = req.context;
    const filters = req.query;

    const result = await agentService.listAgents(tenantId, filters);
    res.json(result);
  }
);

// Create agent
agentRoutes.post(
  '/',
  validateRequest({ body: CreateAgentSchema }),
  async (req, res) => {
    const { tenantId, userId } = req.context;

    const agent = await agentService.createAgent(tenantId, userId, req.body);
    res.status(201).json(agent);
  }
);

// Get agent
agentRoutes.get('/:id', async (req, res) => {
  const { tenantId } = req.context;
  const { id } = req.params;

  const agent = await agentService.getAgent(tenantId, id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent nie został znaleziony' });
  }
  res.json(agent);
});

// Update agent
agentRoutes.put(
  '/:id',
  validateRequest({ body: UpdateAgentSchema }),
  async (req, res) => {
    const { tenantId, userId } = req.context;
    const { id } = req.params;

    const agent = await agentService.updateAgent(tenantId, id, userId, req.body);
    res.json(agent);
  }
);

// Delete agent
agentRoutes.delete('/:id', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id } = req.params;

  await agentService.deleteAgent(tenantId, id, userId);
  res.status(204).send();
});

// Activate agent
agentRoutes.post('/:id/activate', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id } = req.params;

  const agent = await agentService.activateAgent(tenantId, id, userId);
  res.json(agent);
});

// Deactivate agent
agentRoutes.post('/:id/deactivate', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id } = req.params;

  const agent = await agentService.deactivateAgent(tenantId, id, userId);
  res.json(agent);
});

// Duplicate agent
agentRoutes.post('/:id/duplicate', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id } = req.params;
  const { includeKnowledgeBase } = req.body;

  const agent = await agentService.duplicateAgent(tenantId, id, userId, includeKnowledgeBase);
  res.status(201).json(agent);
});

// Upload avatar
agentRoutes.post('/:id/avatar', upload.single('avatar'), async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id } = req.params;

  const url = await agentService.uploadAvatar(tenantId, id, userId, req.file);
  res.json({ avatarUrl: url });
});

// Get version history
agentRoutes.get('/:id/versions', async (req, res) => {
  const { tenantId } = req.context;
  const { id } = req.params;

  const versions = await agentService.getAgentVersionHistory(tenantId, id);
  res.json(versions);
});

// Restore version
agentRoutes.post('/:id/versions/:version/restore', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id, version } = req.params;

  const agent = await agentService.restoreAgentVersion(tenantId, id, parseInt(version), userId);
  res.json(agent);
});
```

## Test Specification

### Unit Tests

```typescript
describe('AgentService', () => {
  let service: AgentService;
  let mockAgentRepo: jest.Mocked<IAgentRepository>;
  let mockAuditService: jest.Mocked<IAuditService>;

  beforeEach(() => {
    mockAgentRepo = createMock<IAgentRepository>();
    mockAuditService = createMock<IAuditService>();
    service = new AgentService(mockAgentRepo, mockAuditService, ...);
  });

  describe('createAgent', () => {
    it('should create agent with DRAFT status', async () => {
      mockAgentRepo.findByName.mockResolvedValue(null);
      mockAgentRepo.create.mockResolvedValue(createTestAgent());

      const result = await service.createAgent('tenant-1', 'user-1', {
        name: 'Test Agent',
        model: 'gpt-4',
        modelProvider: 'openai',
      });

      expect(result.status).toBe('DRAFT');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AGENT_CREATED' })
      );
    });

    it('should reject duplicate names', async () => {
      mockAgentRepo.findByName.mockResolvedValue(createTestAgent());

      await expect(
        service.createAgent('tenant-1', 'user-1', { name: 'Existing Agent', ... })
      ).rejects.toThrow('Agent o tej nazwie już istnieje');
    });
  });

  describe('activateAgent', () => {
    it('should activate agent with valid prompt and permissions', async () => {
      const agent = createTestAgent({ status: 'DRAFT' });
      mockAgentRepo.findById.mockResolvedValue(agent);
      mockAgentRepo.hasActiveSystemPrompt.mockResolvedValue(true);
      mockAgentRepo.hasActivePermissions.mockResolvedValue(true);
      mockAgentRepo.update.mockResolvedValue({ ...agent, status: 'ACTIVE' });

      const result = await service.activateAgent('tenant-1', agent.id, 'user-1');

      expect(result.status).toBe('ACTIVE');
    });

    it('should reject activation without system prompt', async () => {
      const agent = createTestAgent({ status: 'DRAFT' });
      mockAgentRepo.findById.mockResolvedValue(agent);
      mockAgentRepo.hasActiveSystemPrompt.mockResolvedValue(false);

      await expect(
        service.activateAgent('tenant-1', agent.id, 'user-1')
      ).rejects.toThrow('Agent musi mieć aktywny system prompt');
    });
  });

  describe('deleteAgent', () => {
    it('should prevent deletion of active agent', async () => {
      const agent = createTestAgent({ status: 'ACTIVE' });
      mockAgentRepo.findById.mockResolvedValue(agent);

      await expect(
        service.deleteAgent('tenant-1', agent.id, 'user-1')
      ).rejects.toThrow('Dezaktywuj agenta przed usunięciem');
    });

    it('should prevent deletion with active conversations', async () => {
      const agent = createTestAgent({ status: 'INACTIVE' });
      mockAgentRepo.findById.mockResolvedValue(agent);
      mockAgentRepo.countActiveConversations.mockResolvedValue(5);

      await expect(
        service.deleteAgent('tenant-1', agent.id, 'user-1')
      ).rejects.toThrow(/5 aktywnych konwersacji/);
    });
  });
});
```

### Integration Tests

```typescript
describe('Agent API Integration', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await authenticateAsSuperAdmin(app);
  });

  describe('POST /api/v1/agents', () => {
    it('should create agent and return 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Integration Test Agent',
          description: 'Test agent for integration tests',
          model: 'gpt-4',
          modelProvider: 'openai',
          temperature: 0.7,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Integration Test Agent',
        status: 'DRAFT',
        version: 1,
      });
      expect(response.body.id).toBeDefined();
    });
  });

  describe('Agent lifecycle', () => {
    it('should support full CRUD lifecycle', async () => {
      // Create
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/agents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Lifecycle Agent', model: 'gpt-4', modelProvider: 'openai' })
        .expect(201);

      const agentId = createRes.body.id;

      // Add prompt (required for activation)
      await request(app.getHttpServer())
        .post(`/api/v1/agents/${agentId}/prompt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'You are a helpful assistant.' })
        .expect(201);

      // Add permissions
      await request(app.getHttpServer())
        .put(`/api/v1/agents/${agentId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ accessLevel: 'ORGANIZATION', allowedRoles: ['admin'] })
        .expect(200);

      // Activate
      await request(app.getHttpServer())
        .post(`/api/v1/agents/${agentId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Deactivate
      await request(app.getHttpServer())
        .post(`/api/v1/agents/${agentId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Delete
      await request(app.getHttpServer())
        .delete(`/api/v1/agents/${agentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });
});
```

## Security Checklist

- [x] Super Admin authorization required for agent management
- [x] Tenant isolation enforced via tenant_id
- [x] Input validation on all agent configuration fields
- [x] File upload validation for avatar (type, size)
- [x] Audit logging for all agent lifecycle events
- [x] Cache invalidation on agent updates
- [x] Cascade delete for related data (prompts, KB, conversations)
- [x] Version history for configuration rollback

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| AGENT_CREATED | New agent created | name, model, creator |
| AGENT_UPDATED | Agent configuration changed | changes, version |
| AGENT_ACTIVATED | Agent status → ACTIVE | agentId |
| AGENT_DEACTIVATED | Agent status → INACTIVE | agentId |
| AGENT_DELETED | Agent removed | name |
| AGENT_DUPLICATED | Agent copied | sourceId, includeKB |
| AGENT_VERSION_RESTORED | Config restored | version |

## Implementation Notes

### Model Selection
- Default to GPT-4 for complex reasoning tasks
- Claude 3 Sonnet for document analysis
- GPT-3.5-turbo for cost-sensitive applications
- Model availability validated on agent activation

### Caching Strategy
- Agent configuration cached for 1 hour
- Invalidate on any update operation
- Cache key: `agent:{tenantId}:{agentId}`

### Avatar Storage
- S3 path: `agents/{tenantId}/{agentId}/avatar-{timestamp}.{ext}`
- Max size: 2MB
- Formats: PNG, JPEG, WebP
- Old avatar deleted on new upload
