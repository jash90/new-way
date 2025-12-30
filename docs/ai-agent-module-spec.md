# AI Agent Module (AAM) - Complete Technical Specification

## Module Information
- **Module Name**: AI Agent Module
- **Acronym**: AAM
- **Primary Purpose**: Provide customizable AI agents with specialized knowledge bases, system prompts, and contextual data access for intelligent automation and assistance across the platform
- **Key Features**: Custom agent creation, knowledge base management, prompt engineering, file-based context, multi-model support, agent marketplace, conversation management, and super admin controls

---

## A. Module Overview

### Purpose
The AI Agent Module serves as the intelligent automation hub for the accounting platform, enabling super admins to create, configure, and deploy specialized AI agents that can assist with various business processes. Each agent can be tailored with custom system prompts, specific knowledge bases, and access to relevant data sources to provide domain-specific expertise.

### Scope
- **Agent Management**: Create, configure, and deploy custom AI agents
- **System Prompt Engineering**: Define agent behavior and expertise
- **Knowledge Base Integration**: Upload and manage agent-specific data sources
- **Multi-Model Support**: Integrate with OpenAI, Anthropic Claude, and other LLMs
- **Conversation Management**: Track and manage agent-user interactions
- **Agent Permissions**: Fine-grained access control for agents
- **Agent Marketplace**: Share and deploy pre-built agent templates
- **Performance Analytics**: Monitor agent usage and effectiveness
- **Context Management**: Dynamic context injection from platform modules
- **Workflow Integration**: Trigger agents from automated workflows
- **API Access**: RESTful API for agent interactions
- **Audit Trail**: Complete logging of agent activities
- **Cost Management**: Track and optimize AI token usage
- **Agent Versioning**: Version control for prompts and configurations

### Dependencies
- **AIM Module**: Authentication and authorization for agent access
- **Document Intelligence Module**: Access to processed documents
- **Client Module**: Client context and data access
- **Workflow Module**: Integration with automation workflows
- **Storage Module**: Knowledge base file storage
- **Notification Module**: Agent activity alerts
- **Audit Module**: Agent interaction logging
- **Analytics Module**: Usage metrics and insights

### Consumers
- **Super Admin Dashboard**: Agent configuration and management
- **User Interface**: Agent chat interface
- **API Gateway**: External agent access
- **Workflow Module**: Automated agent triggers
- **Client Portal**: Client-specific agent access
- **Task Module**: Agent-assisted task creation
- **Reporting Module**: Agent-generated insights
- **All Other Modules**: Context-aware assistance

---

## B. Technical Specification

### 1. Technology Stack

**Primary Framework**: Node.js with TypeScript
- Express.js for API layer
- NestJS for dependency injection and modularity

**AI Integration Layer**:
- LangChain for LLM orchestration
- OpenAI SDK for GPT models
- Anthropic SDK for Claude models
- Hugging Face Transformers for open-source models

**Vector Database**: Pinecone/Qdrant
- Embedding storage for knowledge bases
- Semantic search capabilities
- Scalable vector similarity search

**Database**: PostgreSQL 14+
- Main entities: agents, prompts, conversations, knowledge_bases, agent_permissions
- JSONB for flexible agent configurations

**Caching**: Redis 7+
- Conversation context caching
- Agent configuration cache
- Token usage tracking

**Message Queue**: RabbitMQ
- Async agent processing
- Batch knowledge base indexing

**File Storage**: S3-compatible storage
- Knowledge base documents
- Agent avatars and assets
- Conversation exports

### 2. Core Interfaces

```typescript
// Agent Management Interface
export interface AgentService {
  // Agent CRUD Operations
  createAgent(config: CreateAgentDto): Promise<Agent>;
  updateAgent(agentId: string, updates: UpdateAgentDto): Promise<Agent>;
  deleteAgent(agentId: string): Promise<void>;
  getAgent(agentId: string): Promise<Agent>;
  listAgents(filters: AgentFilters): Promise<PaginatedAgents>;
  
  // Agent Configuration
  setSystemPrompt(agentId: string, prompt: SystemPromptDto): Promise<void>;
  addKnowledgeBase(agentId: string, files: UploadedFile[]): Promise<KnowledgeBase>;
  updatePermissions(agentId: string, permissions: AgentPermissions): Promise<void>;
  
  // Agent Execution
  executeAgent(agentId: string, input: AgentInput): Promise<AgentResponse>;
  streamResponse(agentId: string, input: AgentInput): AsyncGenerator<string>;
  
  // Agent Marketplace
  publishAgent(agentId: string, metadata: MarketplaceMetadata): Promise<void>;
  installTemplate(templateId: string, customization: AgentCustomization): Promise<Agent>;
}

// Data Models
export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  systemPrompt: SystemPrompt;
  knowledgeBases: KnowledgeBase[];
  model: AIModel;
  temperature: number;
  maxTokens: number;
  permissions: AgentPermissions;
  integrations: ModuleIntegration[];
  analytics: AgentAnalytics;
  version: string;
  status: AgentStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemPrompt {
  id: string;
  agentId: string;
  content: string;
  variables: PromptVariable[];
  examples?: ConversationExample[];
  constraints?: string[];
  version: number;
  isActive: boolean;
}

export interface KnowledgeBase {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  files: KnowledgeFile[];
  indexStatus: IndexStatus;
  vectorCount: number;
  lastIndexed: Date;
  searchSettings: SearchSettings;
}

export interface KnowledgeFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  processedAt?: Date;
  chunks: number;
  embeddings: number;
  metadata: Record<string, any>;
}

export interface AgentPermissions {
  accessLevel: 'private' | 'organization' | 'public';
  allowedRoles: string[];
  allowedUsers: string[];
  dataAccess: ModuleAccess[];
  rateLimit: RateLimit;
  costLimit?: CostLimit;
}

export interface ModuleIntegration {
  moduleId: string;
  moduleName: string;
  permissions: string[];
  dataMapping: DataMapping[];
  enabled: boolean;
}

export interface AgentInput {
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
  attachments?: Attachment[];
  stream?: boolean;
}

export interface AgentResponse {
  id: string;
  agentId: string;
  message: string;
  sources?: Source[];
  actions?: SuggestedAction[];
  metadata: ResponseMetadata;
  usage: TokenUsage;
}
```

### 3. Knowledge Base Processing

```typescript
// Knowledge Base Processing Pipeline
export class KnowledgeBaseProcessor {
  constructor(
    private vectorDB: VectorDatabase,
    private documentProcessor: DocumentProcessor,
    private embeddingService: EmbeddingService
  ) {}

  async processDocument(file: UploadedFile, agentId: string): Promise<void> {
    // Step 1: Extract text content
    const content = await this.documentProcessor.extractText(file);
    
    // Step 2: Split into chunks
    const chunks = await this.splitIntoChunks(content, {
      chunkSize: 1000,
      overlap: 200,
      preserveContext: true
    });
    
    // Step 3: Generate embeddings
    const embeddings = await this.embeddingService.generateEmbeddings(chunks);
    
    // Step 4: Store in vector database
    await this.vectorDB.upsert({
      agentId,
      fileId: file.id,
      chunks: chunks.map((chunk, i) => ({
        text: chunk,
        embedding: embeddings[i],
        metadata: {
          fileName: file.name,
          position: i,
          timestamp: new Date()
        }
      }))
    });
  }

  async searchKnowledge(
    agentId: string, 
    query: string, 
    limit: number = 5
  ): Promise<KnowledgeResult[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    return this.vectorDB.search({
      agentId,
      vector: queryEmbedding,
      limit,
      threshold: 0.7
    });
  }
}
```

### 4. Agent Execution Engine

```typescript
// Agent Execution with Context Injection
export class AgentExecutor {
  constructor(
    private llmService: LLMService,
    private knowledgeBase: KnowledgeBaseProcessor,
    private contextBuilder: ContextBuilder,
    private promptTemplate: PromptTemplateEngine
  ) {}

  async execute(agent: Agent, input: AgentInput): Promise<AgentResponse> {
    // Step 1: Build context from integrated modules
    const moduleContext = await this.contextBuilder.buildContext(
      agent.integrations,
      input.context
    );
    
    // Step 2: Search relevant knowledge
    const knowledge = await this.knowledgeBase.searchKnowledge(
      agent.id,
      input.message
    );
    
    // Step 3: Construct prompt with system prompt and context
    const prompt = await this.promptTemplate.build({
      systemPrompt: agent.systemPrompt.content,
      userMessage: input.message,
      knowledge: knowledge.map(k => k.text),
      context: moduleContext,
      conversationHistory: await this.getConversationHistory(input.conversationId)
    });
    
    // Step 4: Execute LLM call
    const response = await this.llmService.complete({
      model: agent.model,
      prompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      stream: input.stream
    });
    
    // Step 5: Post-process response
    return this.postProcess(response, agent, input);
  }

  private async postProcess(
    llmResponse: LLMResponse,
    agent: Agent,
    input: AgentInput
  ): Promise<AgentResponse> {
    // Extract actions from response
    const actions = this.extractActions(llmResponse.content);
    
    // Identify sources used
    const sources = this.identifySources(llmResponse.content);
    
    // Track token usage
    const usage = this.calculateUsage(llmResponse);
    
    // Save to conversation history
    await this.saveConversation(agent.id, input, llmResponse);
    
    return {
      id: generateId(),
      agentId: agent.id,
      message: llmResponse.content,
      sources,
      actions,
      metadata: {
        model: agent.model.name,
        temperature: agent.temperature,
        processingTime: llmResponse.processingTime,
        confidence: this.calculateConfidence(llmResponse)
      },
      usage
    };
  }
}
```

### 5. API Endpoints

```yaml
# Agent Management
POST   /api/v1/agents                    # Create new agent
GET    /api/v1/agents                    # List all agents
GET    /api/v1/agents/:id                # Get agent details
PUT    /api/v1/agents/:id                # Update agent
DELETE /api/v1/agents/:id                # Delete agent

# Agent Configuration
POST   /api/v1/agents/:id/prompt         # Update system prompt
POST   /api/v1/agents/:id/knowledge      # Upload knowledge files
DELETE /api/v1/agents/:id/knowledge/:fileId  # Remove knowledge file
PUT    /api/v1/agents/:id/permissions    # Update permissions
POST   /api/v1/agents/:id/integrations   # Configure integrations

# Agent Execution
POST   /api/v1/agents/:id/chat           # Send message to agent
GET    /api/v1/agents/:id/chat/stream    # Stream agent response
GET    /api/v1/agents/:id/conversations  # Get conversation history
DELETE /api/v1/agents/:id/conversations/:convId  # Delete conversation

# Agent Marketplace
GET    /api/v1/marketplace/templates     # Browse agent templates
POST   /api/v1/marketplace/install       # Install template
POST   /api/v1/marketplace/publish       # Publish agent template

# Analytics
GET    /api/v1/agents/:id/analytics      # Get agent usage stats
GET    /api/v1/agents/:id/costs          # Get cost breakdown
GET    /api/v1/agents/:id/performance    # Get performance metrics
```

---

## C. Implementation Examples

### 1. Creating a Tax Compliance Agent

```typescript
// Super Admin creates a specialized tax agent
const taxAgent = await agentService.createAgent({
  name: "Polish Tax Assistant",
  description: "Expert in Polish tax regulations and compliance",
  model: AIModel.CLAUDE_3_OPUS,
  systemPrompt: {
    content: `You are an expert Polish tax assistant specializing in:
    - VAT regulations and JPK reporting
    - CIT/PIT calculations and optimization
    - ZUS contributions and compliance
    - E-declarations and KSeF integration
    
    Always provide accurate, up-to-date information based on Polish tax law.
    Reference specific regulations and provide practical examples.
    Alert users to upcoming deadlines and compliance requirements.
    
    Context available:
    - Client financial data from the Accounting module
    - Current tax rates and thresholds
    - Historical tax filings and payments
    - Regulatory updates from the knowledge base`,
    
    variables: [
      { name: "clientId", source: "context" },
      { name: "taxPeriod", source: "context" },
      { name: "businessType", source: "client.profile" }
    ]
  },
  integrations: [
    {
      moduleId: "tax-compliance",
      permissions: ["read:calculations", "read:declarations"],
      dataMapping: [
        { source: "tax.vat", target: "context.vatData" },
        { source: "tax.deadlines", target: "context.upcomingDeadlines" }
      ]
    },
    {
      moduleId: "accounting",
      permissions: ["read:transactions", "read:reports"],
      dataMapping: [
        { source: "accounting.pl", target: "context.profitLoss" },
        { source: "accounting.balance", target: "context.balanceSheet" }
      ]
    }
  ],
  permissions: {
    accessLevel: "organization",
    allowedRoles: ["accountant", "tax_specialist", "admin"],
    dataAccess: [
      { module: "clients", scope: "assigned" },
      { module: "tax", scope: "all" }
    ],
    rateLimit: {
      requests: 100,
      window: "1h"
    },
    costLimit: {
      daily: 10.00,
      monthly: 200.00,
      currency: "USD"
    }
  }
});

// Upload tax regulation knowledge base
await agentService.addKnowledgeBase(taxAgent.id, [
  { name: "ustawa_vat_2024.pdf", path: "/docs/tax/vat_law.pdf" },
  { name: "interpretacje_mf.csv", path: "/docs/tax/interpretations.csv" },
  { name: "jpk_specifications.json", path: "/docs/tax/jpk_specs.json" }
]);
```

### 2. Document Processing Agent

```typescript
// Agent for intelligent document processing
const docAgent = await agentService.createAgent({
  name: "Document Intelligence Assistant",
  description: "Automated document analysis and data extraction",
  model: AIModel.GPT_4_VISION,
  systemPrompt: {
    content: `You are a document processing specialist capable of:
    - Extracting structured data from invoices, receipts, and contracts
    - Categorizing documents based on content
    - Validating extracted data against business rules
    - Identifying missing or inconsistent information
    
    Use OCR results and document metadata to provide accurate extraction.
    Highlight any anomalies or potential issues.
    Suggest appropriate workflow actions based on document type.`,
  },
  integrations: [
    {
      moduleId: "document-intelligence",
      permissions: ["read:documents", "write:metadata"],
      dataMapping: [
        { source: "document.ocr", target: "context.ocrText" },
        { source: "document.metadata", target: "context.metadata" }
      ]
    }
  ]
});
```

### 3. Client Support Agent

```typescript
// Client-facing support agent
const supportAgent = await agentService.createAgent({
  name: "Client Support Assistant",
  description: "24/7 client support for accounting queries",
  model: AIModel.GPT_4_TURBO,
  systemPrompt: {
    content: `You are a friendly and professional client support assistant.
    
    Your responsibilities:
    - Answer questions about invoices, payments, and account status
    - Guide clients through the portal features
    - Explain tax calculations and compliance status
    - Schedule appointments with accountants when needed
    
    Always maintain confidentiality and verify client identity.
    Escalate complex issues to human accountants.
    Be empathetic and solution-focused in your responses.`,
  },
  integrations: [
    {
      moduleId: "client-portal",
      permissions: ["read:client_data"],
      dataMapping: [
        { source: "client.profile", target: "context.clientInfo" },
        { source: "client.documents", target: "context.recentDocuments" }
      ]
    }
  ],
  permissions: {
    accessLevel: "public",
    allowedRoles: ["client"],
    dataAccess: [
      { module: "clients", scope: "own" },
      { module: "documents", scope: "own" }
    ]
  }
});
```

---

## D. Advanced Features

### 1. Agent Chaining and Orchestration

```typescript
export class AgentOrchestrator {
  async executeChain(
    agentIds: string[], 
    input: AgentInput
  ): Promise<ChainedResponse> {
    let context = input.context || {};
    const responses: AgentResponse[] = [];
    
    for (const agentId of agentIds) {
      const agent = await this.agentService.getAgent(agentId);
      const response = await this.agentExecutor.execute(agent, {
        ...input,
        context: {
          ...context,
          previousResponses: responses
        }
      });
      
      responses.push(response);
      context = { ...context, ...response.metadata.extractedData };
    }
    
    return {
      responses,
      finalContext: context,
      aggregatedSources: this.aggregateSources(responses),
      totalUsage: this.calculateTotalUsage(responses)
    };
  }
}
```

### 2. Agent Learning and Improvement

```typescript
export class AgentLearningService {
  async collectFeedback(
    responseId: string, 
    feedback: UserFeedback
  ): Promise<void> {
    await this.feedbackRepo.save({
      responseId,
      rating: feedback.rating,
      comments: feedback.comments,
      corrections: feedback.corrections
    });
    
    // Trigger fine-tuning if threshold reached
    const feedbackCount = await this.feedbackRepo.count(responseId);
    if (feedbackCount >= 100) {
      await this.triggerFineTuning(responseId);
    }
  }
  
  async generateTrainingData(agentId: string): Promise<TrainingDataset> {
    const conversations = await this.getHighRatedConversations(agentId);
    
    return {
      examples: conversations.map(conv => ({
        prompt: conv.input,
        completion: conv.response,
        metadata: conv.metadata
      })),
      format: 'jsonl',
      validationSplit: 0.2
    };
  }
}
```

### 3. Cost Optimization

```typescript
export class CostOptimizer {
  async optimizeAgentConfig(agent: Agent): Promise<OptimizationSuggestions> {
    const usage = await this.getAgentUsage(agent.id, '30d');
    
    return {
      modelSuggestion: this.suggestOptimalModel(usage),
      cachingStrategy: this.analyzeCachingOpportunities(usage),
      promptOptimization: await this.analyzePromptEfficiency(agent.systemPrompt),
      knowledgeBaseOptimization: this.suggestKnowledgeBaseImprovements(agent)
    };
  }
  
  private suggestOptimalModel(usage: AgentUsage): ModelSuggestion {
    // Analyze query complexity vs model capability
    if (usage.avgTokensPerQuery < 500 && usage.complexityScore < 0.3) {
      return {
        current: AIModel.GPT_4,
        suggested: AIModel.GPT_3_5_TURBO,
        estimatedSavings: usage.totalCost * 0.7
      };
    }
    return { current: usage.model, suggested: usage.model, estimatedSavings: 0 };
  }
}
```

---

## E. Security and Compliance

### 1. Data Access Control

```typescript
export class AgentSecurityService {
  async validateDataAccess(
    agent: Agent, 
    requestedData: DataRequest
  ): Promise<boolean> {
    // Check agent permissions
    const hasModuleAccess = agent.permissions.dataAccess.some(
      access => access.module === requestedData.module
    );
    
    if (!hasModuleAccess) return false;
    
    // Check scope restrictions
    const scope = agent.permissions.dataAccess.find(
      a => a.module === requestedData.module
    )?.scope;
    
    if (scope === 'own') {
      return requestedData.ownerId === agent.createdBy;
    }
    
    if (scope === 'assigned') {
      return this.checkAssignment(agent.id, requestedData.resourceId);
    }
    
    return scope === 'all';
  }
  
  async sanitizeResponse(
    response: AgentResponse, 
    userContext: UserContext
  ): Promise<AgentResponse> {
    // Remove sensitive data based on user permissions
    const sanitized = { ...response };
    
    if (!userContext.hasPermission('view:financial_details')) {
      sanitized.message = this.redactFinancialData(sanitized.message);
    }
    
    if (!userContext.hasPermission('view:personal_data')) {
      sanitized.message = this.redactPersonalData(sanitized.message);
    }
    
    return sanitized;
  }
}
```

### 2. Audit and Compliance

```typescript
export class AgentAuditService {
  async logAgentActivity(activity: AgentActivity): Promise<void> {
    await this.auditLog.create({
      agentId: activity.agentId,
      userId: activity.userId,
      action: activity.action,
      input: this.sanitizeForAudit(activity.input),
      response: this.sanitizeForAudit(activity.response),
      timestamp: new Date(),
      ipAddress: activity.ipAddress,
      sessionId: activity.sessionId,
      tokenUsage: activity.tokenUsage,
      cost: activity.cost
    });
  }
  
  async generateComplianceReport(
    agentId: string, 
    period: DateRange
  ): Promise<ComplianceReport> {
    const activities = await this.auditLog.find({ agentId, period });
    
    return {
      totalInteractions: activities.length,
      uniqueUsers: new Set(activities.map(a => a.userId)).size,
      dataAccessPatterns: this.analyzeDataAccess(activities),
      sensitiveDataExposure: this.checkSensitiveDataExposure(activities),
      costAnalysis: this.analyzeCosts(activities),
      anomalies: await this.detectAnomalies(activities)
    };
  }
}
```

---

## F. Monitoring and Analytics

### 1. Performance Monitoring

```typescript
export class AgentMonitoringService {
  async collectMetrics(agent: Agent): Promise<AgentMetrics> {
    return {
      responseTime: await this.measureResponseTime(agent.id),
      accuracy: await this.measureAccuracy(agent.id),
      userSatisfaction: await this.getUserSatisfaction(agent.id),
      tokenEfficiency: await this.calculateTokenEfficiency(agent.id),
      errorRate: await this.calculateErrorRate(agent.id),
      availability: await this.calculateAvailability(agent.id)
    };
  }
  
  async createDashboard(agentId: string): Promise<DashboardConfig> {
    return {
      widgets: [
        {
          type: 'line-chart',
          title: 'Response Time Trend',
          metric: 'response_time',
          period: '7d'
        },
        {
          type: 'gauge',
          title: 'User Satisfaction',
          metric: 'satisfaction_score',
          target: 4.5
        },
        {
          type: 'bar-chart',
          title: 'Token Usage by Model',
          metric: 'token_usage',
          groupBy: 'model'
        },
        {
          type: 'heatmap',
          title: 'Usage Pattern',
          metric: 'requests',
          dimensions: ['hour', 'day']
        }
      ],
      refreshInterval: 60,
      alerts: [
        {
          metric: 'error_rate',
          threshold: 0.05,
          action: 'notify_admin'
        },
        {
          metric: 'response_time',
          threshold: 5000,
          action: 'scale_up'
        }
      ]
    };
  }
}
```

### 2. Usage Analytics

```typescript
export class AgentAnalyticsService {
  async generateInsights(agentId: string): Promise<AgentInsights> {
    const usage = await this.getUsageData(agentId, '30d');
    
    return {
      topQueries: this.identifyTopQueries(usage),
      userSegments: this.segmentUsers(usage),
      peakUsageTimes: this.identifyPeakTimes(usage),
      commonIssues: this.identifyCommonIssues(usage),
      improvementOpportunities: await this.identifyImprovements(usage),
      costBreakdown: this.analyzeCosts(usage),
      recommendations: await this.generateRecommendations(usage)
    };
  }
}
```

---

## G. Deployment and Scaling

### 1. Deployment Configuration

```yaml
# Docker Compose Configuration
services:
  agent-service:
    image: accounting-crm/agent-service:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - PINECONE_API_KEY=${PINECONE_API_KEY}
    ports:
      - "3005:3000"
    depends_on:
      - postgres
      - redis
      - rabbitmq
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  vector-db:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
```

### 2. Scaling Strategy

```typescript
export class AgentScalingStrategy {
  async autoScale(metrics: SystemMetrics): Promise<ScalingAction> {
    // Horizontal scaling based on request queue
    if (metrics.queueLength > 100) {
      return {
        action: 'scale_out',
        instances: Math.ceil(metrics.queueLength / 50),
        reason: 'high_queue_length'
      };
    }
    
    // Scale based on response time
    if (metrics.avgResponseTime > 3000) {
      return {
        action: 'scale_out',
        instances: 2,
        reason: 'slow_response_time'
      };
    }
    
    // Scale down during low usage
    if (metrics.cpuUsage < 20 && metrics.instances > 1) {
      return {
        action: 'scale_in',
        instances: 1,
        reason: 'low_usage'
      };
    }
    
    return { action: 'no_change' };
  }
}
```

---

## H. Testing Strategy

### 1. Unit Testing

```typescript
describe('AgentService', () => {
  let agentService: AgentService;
  let mockLLM: jest.Mocked<LLMService>;
  let mockKnowledgeBase: jest.Mocked<KnowledgeBaseProcessor>;
  
  beforeEach(() => {
    mockLLM = createMock<LLMService>();
    mockKnowledgeBase = createMock<KnowledgeBaseProcessor>();
    agentService = new AgentService(mockLLM, mockKnowledgeBase);
  });
  
  describe('executeAgent', () => {
    it('should execute agent with context injection', async () => {
      const agent = createTestAgent();
      const input = { message: 'What is the VAT rate?' };
      
      mockKnowledgeBase.searchKnowledge.mockResolvedValue([
        { text: 'Standard VAT rate in Poland is 23%', score: 0.95 }
      ]);
      
      mockLLM.complete.mockResolvedValue({
        content: 'The standard VAT rate in Poland is 23%.',
        usage: { prompt: 100, completion: 20 }
      });
      
      const response = await agentService.executeAgent(agent.id, input);
      
      expect(response.message).toContain('23%');
      expect(response.sources).toHaveLength(1);
      expect(mockKnowledgeBase.searchKnowledge).toHaveBeenCalledWith(
        agent.id,
        input.message
      );
    });
  });
});
```

### 2. Integration Testing

```typescript
describe('Agent API Integration', () => {
  let app: INestApplication;
  let authToken: string;
  
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
    
    authToken = await authenticateAsAdmin();
  });
  
  it('should create and execute an agent', async () => {
    // Create agent
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Agent',
        model: 'gpt-4',
        systemPrompt: {
          content: 'You are a helpful assistant.'
        }
      })
      .expect(201);
    
    const agentId = createResponse.body.id;
    
    // Upload knowledge base
    await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/knowledge`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('files', 'test/fixtures/knowledge.pdf')
      .expect(201);
    
    // Execute agent
    const executeResponse = await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/chat`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        message: 'Hello, can you help me?'
      })
      .expect(200);
    
    expect(executeResponse.body).toHaveProperty('message');
    expect(executeResponse.body.agentId).toBe(agentId);
  });
});
```

---

## I. Migration and Rollback Plan

### 1. Database Migrations

```sql
-- Migration: 001_create_agent_tables.sql
BEGIN;

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(500),
    model VARCHAR(50) NOT NULL,
    temperature DECIMAL(2,1) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2000,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    examples JSONB DEFAULT '[]',
    constraints TEXT[],
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    vector_count INTEGER DEFAULT 0,
    index_status VARCHAR(20) DEFAULT 'pending',
    last_indexed_at TIMESTAMP WITH TIME ZONE,
    search_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    user_id UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0
);

CREATE INDEX idx_agents_created_by ON agents(created_by);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_prompts_agent_active ON system_prompts(agent_id, is_active);
CREATE INDEX idx_knowledge_agent ON knowledge_bases(agent_id);
CREATE INDEX idx_conversations_agent_user ON agent_conversations(agent_id, user_id);

COMMIT;

-- Rollback: 001_rollback.sql
BEGIN;
DROP TABLE IF EXISTS agent_conversations CASCADE;
DROP TABLE IF EXISTS knowledge_bases CASCADE;
DROP TABLE IF EXISTS system_prompts CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
COMMIT;
```

---

## J. Success Metrics and KPIs

### 1. Performance KPIs

- **Response Time**: < 2 seconds for 95% of requests
- **Accuracy Rate**: > 90% correct responses (based on user feedback)
- **Availability**: 99.9% uptime
- **Token Efficiency**: < 1000 tokens per average query
- **Cost per Query**: < $0.05 average

### 2. Business KPIs

- **User Adoption**: 80% of users interact with agents monthly
- **Task Automation**: 60% reduction in manual tasks
- **User Satisfaction**: > 4.5/5 rating
- **ROI**: 3x return on AI investment within 12 months
- **Knowledge Base Growth**: 100+ documents per agent

### 3. Monitoring Dashboard

```typescript
export const AgentDashboardConfig = {
  metrics: [
    { id: 'total_agents', label: 'Total Agents', type: 'counter' },
    { id: 'active_conversations', label: 'Active Conversations', type: 'gauge' },
    { id: 'daily_queries', label: 'Daily Queries', type: 'line' },
    { id: 'avg_response_time', label: 'Avg Response Time', type: 'histogram' },
    { id: 'token_usage', label: 'Token Usage', type: 'area' },
    { id: 'cost_breakdown', label: 'Cost by Model', type: 'pie' },
    { id: 'user_satisfaction', label: 'Satisfaction Score', type: 'gauge' },
    { id: 'error_rate', label: 'Error Rate', type: 'percentage' }
  ],
  alerts: [
    { metric: 'error_rate', threshold: 5, severity: 'warning' },
    { metric: 'response_time', threshold: 5000, severity: 'critical' },
    { metric: 'daily_cost', threshold: 100, severity: 'info' }
  ],
  refreshInterval: 30 // seconds
};
```

---

This comprehensive AI Agent Module specification provides a complete blueprint for implementing intelligent, customizable AI agents within your accounting CRM platform. The module enables super admins to create specialized agents with custom prompts and knowledge bases, while maintaining security, scalability, and cost efficiency.

Key features include:
- Full agent lifecycle management
- Knowledge base processing with vector search
- Multi-model LLM support
- Context injection from platform modules
- Comprehensive security and access control
- Cost optimization and monitoring
- Agent marketplace for template sharing
- Complete audit trail and compliance reporting

The module integrates seamlessly with your existing architecture, particularly the AIM module for authentication and other platform modules for contextual data access.