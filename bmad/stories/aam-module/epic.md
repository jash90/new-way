# Epic: AI Agent Module (AAM)

## Epic Overview

| Field | Value |
|-------|-------|
| Epic ID | AAM-EPIC |
| Module | AI Agent Module |
| Priority | P2 |
| Total Story Points | 60 |
| Estimated Duration | 3 weeks |
| Dependencies | AIM, DOC, CRM, WFA, MON |

## Business Context

### Problem Statement
Modern accounting platforms require intelligent automation to handle routine queries, provide domain-specific expertise, and assist users with complex tasks. Manual handling of repetitive questions wastes valuable staff time, while generic AI solutions lack the contextual understanding of accounting workflows, Polish tax regulations, and client-specific data.

### Solution
A comprehensive AI Agent Module that enables super admins to create, configure, and deploy specialized AI agents with custom system prompts, dedicated knowledge bases, and contextual access to platform data. Each agent can be tailored for specific roles: tax advisor, document processor, client support, or workflow automation assistant.

### Business Value
- **70% reduction** in routine query handling by human staff
- **24/7 availability** of intelligent assistance for portal users
- **Improved accuracy** through RAG-powered knowledge bases
- **Cost optimization** via intelligent model selection and caching
- **Scalable expertise** through agent templates and marketplace

## Technical Foundation

### Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| AI Orchestration | LangChain + TypeScript | Flexible LLM integration |
| LLM Providers | OpenAI + Anthropic Claude | Multi-model flexibility |
| Vector Database | Qdrant | Scalable semantic search |
| Backend | NestJS + TypeScript | Type-safe, modular |
| Database | PostgreSQL 15 | JSONB for agent configs |
| Caching | Redis 7 | Context & conversation cache |
| Queue | RabbitMQ | Async KB processing |
| Storage | AWS S3 | Knowledge base documents |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Agent Module                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │    Agent    │  │  Knowledge   │  │      Conversation       │ │
│  │   Manager   │  │    Base      │  │        Engine           │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
│         │                │                       │               │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────────┴─────────────┐ │
│  │   Prompt    │  │   Vector     │  │       LLM               │ │
│  │   Engine    │  │   Search     │  │    Orchestrator         │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
├─────────┴────────────────┴───────────────────────┴───────────────┤
│                         API Gateway                               │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  OpenAI  │ │ Anthropic│ │  Qdrant  │ │  Redis   │ │RabbitMQ│ │
│  │   SDK    │ │   SDK    │ │   VDB    │ │  Cache   │ │  Queue │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │    AWS S3     │    Platform Modules               │
└──────────────────────────────────────────────────────────────────┘
```

### Core Database Tables

```sql
-- AI Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url VARCHAR(500),
  model VARCHAR(50) NOT NULL,
  temperature DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  config JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'DRAFT',
  version INTEGER DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Prompts with versioning
CREATE TABLE system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  examples JSONB DEFAULT '[]',
  constraints JSONB DEFAULT '[]',
  version INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Bases
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vector_count INTEGER DEFAULT 0,
  index_status VARCHAR(20) DEFAULT 'PENDING',
  last_indexed_at TIMESTAMPTZ,
  search_settings JSONB DEFAULT '{"topK": 5, "threshold": 0.7}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Base Files
CREATE TABLE knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  s3_location TEXT NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  embedding_count INTEGER DEFAULT 0,
  process_status VARCHAR(20) DEFAULT 'PENDING',
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Conversations
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL, -- 'STAFF', 'CLIENT'
  title VARCHAR(255),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Conversation Messages
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'USER', 'ASSISTANT', 'SYSTEM'
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  token_usage JSONB DEFAULT '{}',
  cost DECIMAL(10,6) DEFAULT 0,
  processing_time INTEGER, -- ms
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Permissions
CREATE TABLE agent_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  access_level VARCHAR(20) DEFAULT 'PRIVATE',
  allowed_roles JSONB DEFAULT '[]',
  allowed_users JSONB DEFAULT '[]',
  module_access JSONB DEFAULT '[]',
  rate_limit JSONB DEFAULT '{"requests": 100, "window": "1h"}',
  cost_limit JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Marketplace Templates
CREATE TABLE agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  system_prompt TEXT NOT NULL,
  default_config JSONB DEFAULT '{}',
  required_modules JSONB DEFAULT '[]',
  author_tenant_id UUID REFERENCES tenants(id),
  is_official BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  rating DECIMAL(2,1) DEFAULT 0,
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Usage Analytics
CREATE TABLE agent_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0, -- ms
  error_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  satisfaction_sum DECIMAL(5,2) DEFAULT 0,
  satisfaction_count INTEGER DEFAULT 0,
  UNIQUE(tenant_id, agent_id, date)
);

-- Agent Audit Log
CREATE TABLE agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  token_usage JSONB,
  cost DECIMAL(10,6),
  ip_address INET,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Story Map

### Sprint 1: Foundation & Core (Week 1)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| AAM-001 | Agent CRUD & Configuration | 8 | P0 | AIM |
| AAM-002 | System Prompt Engineering | 5 | P0 | AAM-001 |
| AAM-003 | Knowledge Base Management | 8 | P0 | DOC |

### Sprint 2: Execution & Conversations (Week 2)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| AAM-004 | Agent Execution Engine | 8 | P0 | AAM-001, AAM-002, AAM-003 |
| AAM-005 | Conversation Management | 5 | P1 | AAM-004 |
| AAM-006 | Agent Marketplace | 5 | P1 | AAM-001 |

### Sprint 3: Security & Analytics (Week 3)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| AAM-007 | Agent Permissions & Access | 5 | P1 | AAM-001, AIM |
| AAM-008 | Token & Cost Management | 5 | P1 | AAM-004 |
| AAM-009 | Agent Analytics & Monitoring | 5 | P2 | AAM-004, MON |
| AAM-010 | Agent Orchestration & Chaining | 6 | P2 | AAM-004, WFA |

## Story Dependency Graph

```
                    ┌─────────────────┐
                    │    AIM Auth     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ AAM-001  │   │   DOC    │   │   AIM    │
       │Agent CRUD│   │  Module  │   │  Module  │
       └────┬─────┘   └────┬─────┘   └────┬─────┘
            │              │              │
    ┌───────┴──────┐       │              │
    ▼              ▼       ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ AAM-002  │ │ AAM-006  │ │ AAM-003  │ │ AAM-007  │
│  Prompt  │ │Marketplace│ │   KB     │ │  Perms   │
└────┬─────┘ └──────────┘ └────┬─────┘ └──────────┘
     │                         │
     └────────────┬────────────┘
                  ▼
           ┌──────────┐
           │ AAM-004  │
           │Execution │
           └────┬─────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ AAM-005  │ │ AAM-008  │ │ AAM-009  │
│ Convos   │ │   Cost   │ │Analytics │
└──────────┘ └────┬─────┘ └──────────┘
                  │
                  ▼
           ┌──────────┐
           │ AAM-010  │
           │Orchestr. │
           └──────────┘
```

## User Personas

### Primary: Super Admin / System Administrator
- **Needs**: Create specialized agents, manage knowledge bases, monitor costs
- **Pain Points**: Complex AI setup, model selection, prompt engineering
- **Goals**: Deploy effective agents with minimal technical overhead

### Secondary: Accountant / Staff Member
- **Needs**: Quick answers to tax questions, document analysis, client support
- **Pain Points**: Repetitive queries, manual research, context switching
- **Goals**: Focus on high-value tasks while AI handles routine work

### Tertiary: Client (Portal User)
- **Needs**: 24/7 support, invoice queries, tax explanations
- **Pain Points**: Waiting for accountant availability, language barriers
- **Goals**: Self-service for common questions

## Acceptance Criteria Summary

### Functional Requirements

1. **Agent Management**
   - Create agents with custom name, description, avatar
   - Configure model (GPT-4, Claude 3, etc.) and parameters
   - Version control for prompts and configurations
   - Agent status lifecycle (Draft → Active → Archived)

2. **System Prompt Engineering**
   - Rich text editor for prompt content
   - Variable placeholders with context injection
   - Example conversations for few-shot learning
   - Constraints and guardrails definition

3. **Knowledge Base**
   - Multi-file upload (PDF, DOCX, TXT, CSV, JSON)
   - Automatic text extraction and chunking
   - Vector embedding generation and storage
   - Semantic search with configurable thresholds

4. **Agent Execution**
   - Real-time chat interface with streaming
   - Context injection from platform modules
   - Source citation from knowledge base
   - Action suggestions for workflow integration

5. **Marketplace**
   - Browse pre-built agent templates
   - One-click installation with customization
   - Publish custom agents as templates
   - Rating and review system

### Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Response Time | < 3 seconds (P95) for streaming start |
| Throughput | 1000 concurrent conversations |
| Token Efficiency | < 2000 tokens/avg query |
| Cost Optimization | < $0.05/query average |
| Uptime | 99.9% |
| Knowledge Indexing | < 5 min for 100 pages |
| Vector Search | < 100ms (P95) |

### Security Requirements

- Role-based agent access control (RBAC)
- Data isolation per tenant and user
- PII redaction in responses (configurable)
- Audit logging for all agent interactions
- Rate limiting per user/agent
- Cost limits per agent/tenant
- Encrypted storage for prompts and knowledge

## API Design

### tRPC Router Structure

```typescript
// Main agent router
export const agentRouter = router({
  // Agent CRUD
  agents: agentCrudRouter,

  // Prompt management
  prompts: promptRouter,

  // Knowledge bases
  knowledgeBases: knowledgeBaseRouter,

  // Chat/execution
  chat: chatRouter,

  // Conversations
  conversations: conversationRouter,

  // Marketplace
  marketplace: marketplaceRouter,

  // Permissions
  permissions: permissionRouter,

  // Analytics
  analytics: analyticsRouter,
});

// Protected procedure for agents
const agentProcedure = publicProcedure
  .use(authMiddleware)
  .use(tenantMiddleware)
  .use(agentAccessMiddleware);
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/agents` | GET/POST | List/create agents |
| `/api/v1/agents/:id` | GET/PUT/DELETE | Agent CRUD |
| `/api/v1/agents/:id/prompt` | GET/POST | Manage prompts |
| `/api/v1/agents/:id/knowledge` | GET/POST | Knowledge base |
| `/api/v1/agents/:id/chat` | POST | Chat with agent |
| `/api/v1/agents/:id/chat/stream` | GET | Streaming chat |
| `/api/v1/agents/:id/conversations` | GET | List conversations |
| `/api/v1/marketplace/templates` | GET | Browse templates |
| `/api/v1/agents/:id/analytics` | GET | Usage analytics |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM API costs exceed budget | High | High | Cost limits, model selection optimization |
| Hallucination in responses | Medium | High | RAG grounding, citation requirements |
| Knowledge base sync issues | Medium | Medium | Incremental indexing, status monitoring |
| Response latency spikes | Medium | Medium | Caching, streaming, model fallback |
| Data privacy breach | Low | Critical | PII filtering, access controls, audit |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent Adoption | 50% of tenants | Tenants with active agents |
| Query Resolution | 70% self-service | Queries resolved without human escalation |
| User Satisfaction | > 4.0/5 rating | Conversation feedback scores |
| Cost per Query | < $0.05 | Total AI costs / total queries |
| Response Time | < 3s P95 | Time to first streaming token |
| Knowledge Accuracy | > 85% | Correct citations / total citations |

## Implementation Notes

### Multi-tenancy Strategy
- All tables include `tenant_id` column
- Vector database namespacing: `{tenant_id}:{agent_id}`
- Redis caching: `agent:{tenant_id}:{agent_id}:*`
- Separate API key quotas per tenant

### LLM Provider Strategy
- Primary: OpenAI GPT-4 for complex reasoning
- Secondary: Claude 3 for document analysis
- Fallback: GPT-3.5 for cost optimization
- Model routing based on query complexity

### Caching Strategy
- Agent config: 1-hour TTL, invalidate on update
- Conversation context: Session-scoped
- Knowledge search: 5-minute TTL for common queries
- Cost counters: Real-time with Redis INCR

### Internationalization
- System prompts in Polish (pl) and English (en)
- Agent UI fully localized
- Knowledge base supports multilingual documents
- Response language matches user preference

## Definition of Done

- [ ] All acceptance criteria met and verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests for all API endpoints
- [ ] E2E tests for agent creation and chat flow
- [ ] Security review completed (prompts, KB access)
- [ ] Performance benchmarks met
- [ ] Cost tracking validated
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Deployed to staging and verified
