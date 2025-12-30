# Story: AAM-004 - Agent Execution Engine

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | AAM-004 |
| Epic | AI Agent Module (AAM) |
| Priority | P0 |
| Story Points | 8 |
| Sprint | Sprint 2 (Week 33) |
| Dependencies | AAM-001, AAM-002, AAM-003 |

## User Story

**As a** portal user or system integration
**I want to** interact with AI agents through chat interface
**So that** I can get intelligent assistance with accounting tasks, tax queries, and document analysis

## Acceptance Criteria

### AC1: Chat Interface
```gherkin
Given I have access to an active AI agent
When I send a message to the agent
Then the agent should process my message with context
And return a relevant, accurate response
And track the conversation history
```

### AC2: Streaming Responses
```gherkin
Given I'm chatting with an AI agent
When I send a complex query
Then I should receive streaming response in real-time
And see tokens appearing progressively
And have option to stop generation mid-stream
```

### AC3: Context Injection
```gherkin
Given an agent has module integrations configured
When I send a query
Then the agent should automatically inject relevant context
And access data from integrated modules (CRM, ACC, TAX)
And provide contextually accurate responses
```

### AC4: Knowledge Base RAG
```gherkin
Given an agent has knowledge bases attached
When I ask a question
Then the agent should search relevant knowledge chunks
And include source references in the response
And rank results by semantic similarity
```

### AC5: Source Attribution
```gherkin
Given an agent responds using knowledge base
When the response is generated
Then it should include source citations
And I should be able to view referenced documents
And verify the accuracy of information
```

### AC6: Action Extraction
```gherkin
Given an agent can suggest actions
When the response contains actionable items
Then actions should be extracted and structured
And I should be able to execute suggested actions
And actions should be logged for audit
```

## Technical Specification

### Database Schema

```sql
-- Conversation messages
CREATE TABLE agent_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  token_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  model_used VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Context injections for debugging
CREATE TABLE agent_context_log (
  context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  message_id UUID NOT NULL REFERENCES agent_messages(message_id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL,
  context_data JSONB NOT NULL,
  token_count INTEGER,
  injected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted actions from responses
CREATE TABLE agent_actions (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  message_id UUID NOT NULL REFERENCES agent_messages(message_id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'SUGGESTED', -- SUGGESTED, EXECUTED, DISMISSED
  executed_at TIMESTAMPTZ,
  executed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX idx_messages_agent ON agent_messages(agent_id);
CREATE INDEX idx_messages_user ON agent_messages(user_id);
CREATE INDEX idx_messages_created ON agent_messages(created_at DESC);
CREATE INDEX idx_context_message ON agent_context_log(message_id);
CREATE INDEX idx_actions_message ON agent_actions(message_id);
CREATE INDEX idx_actions_status ON agent_actions(status);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Chat input
export const chatInputSchema = z.object({
  message: z.string()
    .min(1, 'Wiadomość jest wymagana')
    .max(10000, 'Maksymalna długość wiadomości to 10000 znaków'),
  conversationId: z.string().uuid().optional(),
  context: z.record(z.any()).optional(),
  attachments: z.array(z.object({
    fileId: z.string().uuid(),
    fileName: z.string(),
    mimeType: z.string(),
  })).optional(),
  stream: z.boolean().default(false),
});

// Chat response
export const chatResponseSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  agentId: z.string().uuid(),
  content: z.string(),
  sources: z.array(z.object({
    knowledgeBaseId: z.string().uuid(),
    fileName: z.string(),
    chunkText: z.string(),
    score: z.number(),
    pageNumber: z.number().optional(),
  })),
  actions: z.array(z.object({
    actionId: z.string().uuid(),
    type: z.enum([
      'CREATE_TASK',
      'SCHEDULE_MEETING',
      'GENERATE_REPORT',
      'SEND_EMAIL',
      'CREATE_REMINDER',
      'NAVIGATE_TO',
      'DOWNLOAD_DOCUMENT',
    ]),
    label: z.string(),
    data: z.record(z.any()),
  })),
  metadata: z.object({
    model: z.string(),
    temperature: z.number(),
    processingTimeMs: z.number(),
    tokenCount: z.object({
      prompt: z.number(),
      completion: z.number(),
      total: z.number(),
    }),
    confidence: z.number().optional(),
  }),
});

// Stream chunk
export const streamChunkSchema = z.object({
  type: z.enum(['content', 'source', 'action', 'done', 'error']),
  content: z.string().optional(),
  source: z.object({
    fileName: z.string(),
    chunkText: z.string(),
    score: z.number(),
  }).optional(),
  action: z.object({
    type: z.string(),
    label: z.string(),
    data: z.record(z.any()),
  }).optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Context injection config
export const contextConfigSchema = z.object({
  moduleId: z.string(),
  dataPath: z.string(),
  transform: z.string().optional(),
  maxTokens: z.number().optional(),
});

// Stop generation request
export const stopGenerationSchema = z.object({
  messageId: z.string().uuid(),
  reason: z.enum(['USER_CANCELLED', 'TIMEOUT', 'ERROR']).optional(),
});

export type ChatInput = z.infer<typeof chatInputSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type StreamChunk = z.infer<typeof streamChunkSchema>;
export type ContextConfig = z.infer<typeof contextConfigSchema>;
```

### Service Implementation

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { LLMService } from './llm.service';
import { KnowledgeSearchService } from './knowledge-search.service';
import { ContextBuilderService } from './context-builder.service';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AgentExecutionService {
  constructor(
    @Inject('LLM_SERVICE')
    private readonly llmService: LLMService,
    private readonly knowledgeSearch: KnowledgeSearchService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly auditService: AuditService,
  ) {}

  async executeChat(
    tenantId: string,
    userId: string,
    agentId: string,
    input: ChatInput,
  ): Promise<ChatResponse> {
    // Get or create conversation
    const conversation = input.conversationId
      ? await this.conversationRepo.findById(tenantId, input.conversationId)
      : await this.conversationRepo.create({
          tenantId,
          agentId,
          userId,
          title: input.message.substring(0, 100),
        });

    // Load agent with configuration
    const agent = await this.loadAgentWithConfig(tenantId, agentId);

    // Build execution context
    const executionContext = await this.buildExecutionContext(
      tenantId,
      agent,
      input,
      conversation.id,
    );

    // Execute LLM call
    const startTime = Date.now();
    const llmResponse = await this.llmService.complete({
      model: agent.model,
      messages: executionContext.messages,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      stream: false,
    });
    const processingTime = Date.now() - startTime;

    // Post-process response
    const processedResponse = await this.postProcessResponse(
      llmResponse,
      executionContext,
    );

    // Save message
    const savedMessage = await this.messageRepo.create({
      tenantId,
      conversationId: conversation.id,
      agentId,
      userId,
      role: 'assistant',
      content: processedResponse.content,
      sources: processedResponse.sources,
      actions: processedResponse.actions,
      metadata: {
        model: agent.model,
        temperature: agent.temperature,
        contextTokens: executionContext.tokenCount,
      },
      tokenCount: llmResponse.usage.total,
      processingTimeMs: processingTime,
      modelUsed: agent.model,
    });

    // Log audit event
    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_CHAT',
      entityType: 'agent_message',
      entityId: savedMessage.messageId,
      metadata: {
        agentId,
        conversationId: conversation.id,
        tokenCount: llmResponse.usage.total,
        processingTimeMs: processingTime,
      },
    });

    return {
      messageId: savedMessage.messageId,
      conversationId: conversation.id,
      agentId,
      content: processedResponse.content,
      sources: processedResponse.sources,
      actions: processedResponse.actions,
      metadata: {
        model: agent.model,
        temperature: agent.temperature,
        processingTimeMs: processingTime,
        tokenCount: llmResponse.usage,
      },
    };
  }

  async *executeStreamingChat(
    tenantId: string,
    userId: string,
    agentId: string,
    input: ChatInput,
  ): AsyncGenerator<StreamChunk> {
    const conversation = input.conversationId
      ? await this.conversationRepo.findById(tenantId, input.conversationId)
      : await this.conversationRepo.create({
          tenantId,
          agentId,
          userId,
          title: input.message.substring(0, 100),
        });

    const agent = await this.loadAgentWithConfig(tenantId, agentId);
    const executionContext = await this.buildExecutionContext(
      tenantId,
      agent,
      input,
      conversation.id,
    );

    // Yield sources first
    for (const source of executionContext.sources) {
      yield {
        type: 'source',
        source: {
          fileName: source.fileName,
          chunkText: source.text.substring(0, 200),
          score: source.score,
        },
      };
    }

    // Stream LLM response
    let fullContent = '';
    const startTime = Date.now();

    try {
      for await (const chunk of this.llmService.streamComplete({
        model: agent.model,
        messages: executionContext.messages,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      })) {
        fullContent += chunk.content;
        yield {
          type: 'content',
          content: chunk.content,
        };
      }

      // Extract and yield actions
      const actions = this.extractActions(fullContent);
      for (const action of actions) {
        yield {
          type: 'action',
          action,
        };
      }

      // Save complete message
      const processingTime = Date.now() - startTime;
      await this.saveStreamedMessage(
        tenantId,
        userId,
        agentId,
        conversation.id,
        fullContent,
        executionContext.sources,
        actions,
        processingTime,
        agent.model,
      );

      yield {
        type: 'done',
        metadata: {
          conversationId: conversation.id,
          processingTimeMs: processingTime,
        },
      };
    } catch (error) {
      yield {
        type: 'error',
        error: error.message,
      };
    }
  }

  async stopGeneration(
    tenantId: string,
    userId: string,
    messageId: string,
    reason: string,
  ): Promise<void> {
    await this.llmService.cancelRequest(messageId);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_GENERATION_STOPPED',
      entityType: 'agent_message',
      entityId: messageId,
      metadata: { reason },
    });
  }

  private async buildExecutionContext(
    tenantId: string,
    agent: Agent,
    input: ChatInput,
    conversationId: string,
  ): Promise<ExecutionContext> {
    // Get conversation history
    const history = await this.messageRepo.getConversationHistory(
      tenantId,
      conversationId,
      10, // Last 10 messages
    );

    // Search knowledge bases
    const knowledgeResults = await this.knowledgeSearch.search(
      tenantId,
      agent.id,
      input.message,
      { topK: 5, threshold: 0.7 },
    );

    // Build module context
    const moduleContext = await this.contextBuilder.buildModuleContext(
      tenantId,
      agent.integrations,
      input.context,
    );

    // Expand system prompt with variables
    const expandedPrompt = this.expandSystemPrompt(
      agent.systemPrompt,
      {
        ...input.context,
        ...moduleContext,
      },
    );

    // Construct messages array
    const messages: LLMMessage[] = [
      { role: 'system', content: expandedPrompt },
    ];

    // Add knowledge context
    if (knowledgeResults.length > 0) {
      const knowledgeContext = knowledgeResults
        .map(r => `[Źródło: ${r.fileName}]\n${r.text}`)
        .join('\n\n');

      messages.push({
        role: 'system',
        content: `Kontekst z bazy wiedzy:\n${knowledgeContext}`,
      });
    }

    // Add conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: input.message,
    });

    // Calculate token count
    const tokenCount = await this.llmService.countTokens(
      messages.map(m => m.content).join('\n'),
      agent.model,
    );

    return {
      messages,
      sources: knowledgeResults,
      moduleContext,
      tokenCount,
    };
  }

  private expandSystemPrompt(
    prompt: SystemPrompt,
    context: Record<string, any>,
  ): string {
    let expanded = prompt.content;

    // Replace variables
    for (const variable of prompt.variables) {
      const value = this.getNestedValue(context, variable.source);
      const placeholder = `{{${variable.name}}}`;
      expanded = expanded.replace(
        new RegExp(placeholder, 'g'),
        value?.toString() || variable.defaultValue || '',
      );
    }

    // Add examples if present
    if (prompt.examples && prompt.examples.length > 0) {
      const examplesText = prompt.examples
        .map(ex => `Użytkownik: ${ex.user}\nAsystent: ${ex.assistant}`)
        .join('\n\n');
      expanded += `\n\nPrzykłady:\n${examplesText}`;
    }

    // Add constraints if present
    if (prompt.constraints && prompt.constraints.length > 0) {
      const constraintsText = prompt.constraints
        .map((c, i) => `${i + 1}. ${c}`)
        .join('\n');
      expanded += `\n\nOgraniczenia:\n${constraintsText}`;
    }

    return expanded;
  }

  private async postProcessResponse(
    llmResponse: LLMResponse,
    context: ExecutionContext,
  ): Promise<ProcessedResponse> {
    const content = llmResponse.content;

    // Extract actions from response
    const actions = this.extractActions(content);

    // Map sources used in response
    const usedSources = this.identifyUsedSources(content, context.sources);

    return {
      content,
      sources: usedSources,
      actions,
    };
  }

  private extractActions(content: string): ExtractedAction[] {
    const actions: ExtractedAction[] = [];

    // Pattern matching for action suggestions
    const actionPatterns = [
      {
        pattern: /(?:utwórz|stwórz)\s+(?:zadanie|task)\s*[:\-]?\s*(.+)/gi,
        type: 'CREATE_TASK',
      },
      {
        pattern: /(?:zaplanuj|umów)\s+(?:spotkanie|meeting)\s*[:\-]?\s*(.+)/gi,
        type: 'SCHEDULE_MEETING',
      },
      {
        pattern: /(?:wygeneruj|przygotuj)\s+(?:raport|zestawienie)\s*[:\-]?\s*(.+)/gi,
        type: 'GENERATE_REPORT',
      },
      {
        pattern: /(?:wyślij|napisz)\s+(?:email|wiadomość)\s*[:\-]?\s*(.+)/gi,
        type: 'SEND_EMAIL',
      },
      {
        pattern: /(?:przypomnij|ustaw przypomnienie)\s*[:\-]?\s*(.+)/gi,
        type: 'CREATE_REMINDER',
      },
    ];

    for (const { pattern, type } of actionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        actions.push({
          actionId: crypto.randomUUID(),
          type: type as any,
          label: match[1].trim().substring(0, 100),
          data: { rawMatch: match[0] },
        });
      }
    }

    return actions;
  }

  private identifyUsedSources(
    content: string,
    sources: KnowledgeResult[],
  ): SourceReference[] {
    // Simple heuristic: check if key terms from sources appear in response
    return sources
      .filter(source => {
        const keyTerms = this.extractKeyTerms(source.text);
        return keyTerms.some(term =>
          content.toLowerCase().includes(term.toLowerCase())
        );
      })
      .map(source => ({
        knowledgeBaseId: source.knowledgeBaseId,
        fileName: source.fileName,
        chunkText: source.text.substring(0, 200),
        score: source.score,
        pageNumber: source.pageNumber,
      }));
  }

  private extractKeyTerms(text: string): string[] {
    // Extract significant terms (simplified)
    const words = text
      .split(/\s+/)
      .filter(w => w.length > 5)
      .slice(0, 10);
    return [...new Set(words)];
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure, agentAccessMiddleware } from '../trpc';
import { chatInputSchema, stopGenerationSchema } from './schemas';

export const agentExecutionRouter = router({
  // Send message to agent
  chat: protectedProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      ...chatInputSchema.shape,
    }))
    .use(agentAccessMiddleware)
    .mutation(async ({ ctx, input }) => {
      const { agentId, ...chatInput } = input;

      return ctx.agentExecutionService.executeChat(
        ctx.tenantId,
        ctx.userId,
        agentId,
        chatInput,
      );
    }),

  // Stream chat response (via WebSocket/SSE)
  streamChat: protectedProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      ...chatInputSchema.shape,
    }))
    .use(agentAccessMiddleware)
    .subscription(async function* ({ ctx, input }) {
      const { agentId, ...chatInput } = input;

      yield* ctx.agentExecutionService.executeStreamingChat(
        ctx.tenantId,
        ctx.userId,
        agentId,
        { ...chatInput, stream: true },
      );
    }),

  // Stop generation
  stopGeneration: protectedProcedure
    .input(stopGenerationSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.agentExecutionService.stopGeneration(
        ctx.tenantId,
        ctx.userId,
        input.messageId,
        input.reason || 'USER_CANCELLED',
      );

      return { success: true };
    }),

  // Execute suggested action
  executeAction: protectedProcedure
    .input(z.object({
      actionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.agentActionService.executeAction(
        ctx.tenantId,
        ctx.userId,
        input.actionId,
      );
    }),

  // Get message with sources
  getMessage: protectedProcedure
    .input(z.object({
      messageId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.messageRepo.findById(ctx.tenantId, input.messageId);
    }),

  // Provide feedback on response
  provideFeedback: protectedProcedure
    .input(z.object({
      messageId: z.string().uuid(),
      rating: z.number().min(1).max(5),
      feedback: z.string().max(1000).optional(),
      corrections: z.string().max(5000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.feedbackService.saveFeedback(
        ctx.tenantId,
        ctx.userId,
        input,
      );
    }),
});
```

## Test Specification

### Unit Tests

```typescript
describe('AgentExecutionService', () => {
  let service: AgentExecutionService;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockKnowledgeSearch: jest.Mocked<KnowledgeSearchService>;

  beforeEach(() => {
    mockLLMService = {
      complete: jest.fn(),
      streamComplete: jest.fn(),
      countTokens: jest.fn(),
      cancelRequest: jest.fn(),
    };
    mockKnowledgeSearch = {
      search: jest.fn(),
    };
    // ... setup service
  });

  describe('executeChat', () => {
    it('should execute chat with knowledge base context', async () => {
      mockKnowledgeSearch.search.mockResolvedValue([
        {
          knowledgeBaseId: 'kb-1',
          fileName: 'tax-law.pdf',
          text: 'Stawka VAT wynosi 23%',
          score: 0.95,
        },
      ]);

      mockLLMService.complete.mockResolvedValue({
        content: 'Standardowa stawka VAT w Polsce wynosi 23%.',
        usage: { prompt: 500, completion: 50, total: 550 },
      });

      const result = await service.executeChat(
        'tenant-1',
        'user-1',
        'agent-1',
        { message: 'Jaka jest stawka VAT?' },
      );

      expect(result.content).toContain('23%');
      expect(result.sources).toHaveLength(1);
      expect(mockKnowledgeSearch.search).toHaveBeenCalledWith(
        'tenant-1',
        'agent-1',
        'Jaka jest stawka VAT?',
        expect.any(Object),
      );
    });

    it('should inject module context', async () => {
      const result = await service.executeChat(
        'tenant-1',
        'user-1',
        'agent-with-integrations',
        {
          message: 'Pokaż moje przychody',
          context: { clientId: 'client-1' },
        },
      );

      expect(mockLLMService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('clientId'),
            }),
          ]),
        }),
      );
    });
  });

  describe('extractActions', () => {
    it('should extract task creation action', () => {
      const content = 'Sugeruję utworzenie zadania: przegląd dokumentów podatkowych';

      const actions = service['extractActions'](content);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('CREATE_TASK');
      expect(actions[0].label).toContain('przegląd dokumentów');
    });

    it('should extract multiple actions', () => {
      const content = `
        1. Utwórz zadanie: weryfikacja VAT
        2. Zaplanuj spotkanie: konsultacja podatkowa
        3. Wygeneruj raport: podsumowanie kwartalne
      `;

      const actions = service['extractActions'](content);

      expect(actions).toHaveLength(3);
    });
  });
});
```

### Integration Tests

```typescript
describe('Agent Execution API', () => {
  it('should handle complete chat flow', async () => {
    // Create agent
    const agent = await createTestAgent({
      model: 'gpt-4',
      systemPrompt: 'Jesteś pomocnym asystentem.',
    });

    // Upload knowledge
    await uploadTestKnowledge(agent.id, 'test-doc.pdf');

    // Send chat message
    const response = await request(app)
      .post(`/api/v1/agents/${agent.id}/chat`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Pomóż mi z podatkami' })
      .expect(200);

    expect(response.body).toMatchObject({
      messageId: expect.any(String),
      conversationId: expect.any(String),
      content: expect.any(String),
      metadata: expect.objectContaining({
        processingTimeMs: expect.any(Number),
        tokenCount: expect.any(Object),
      }),
    });
  });

  it('should stream response', async () => {
    const chunks: string[] = [];

    const eventSource = new EventSource(
      `/api/v1/agents/${agent.id}/chat/stream?message=test`,
    );

    await new Promise<void>((resolve) => {
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'content') {
          chunks.push(data.content);
        }
        if (data.type === 'done') {
          eventSource.close();
          resolve();
        }
      };
    });

    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### E2E Tests

```typescript
describe('Agent Chat E2E', () => {
  it('should complete chat workflow', async () => {
    await page.goto('/agents/tax-assistant');

    // Send message
    await page.fill('[data-testid="chat-input"]', 'Jaka jest stawka VAT?');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await page.waitForSelector('[data-testid="assistant-message"]');

    // Verify response contains sources
    const sources = await page.locator('[data-testid="source-reference"]');
    expect(await sources.count()).toBeGreaterThan(0);
  });

  it('should stop streaming generation', async () => {
    await page.fill('[data-testid="chat-input"]', 'Napisz długą analizę');
    await page.click('[data-testid="send-button"]');

    // Wait for streaming to start
    await page.waitForSelector('[data-testid="stop-button"]');

    // Stop generation
    await page.click('[data-testid="stop-button"]');

    // Verify generation stopped
    await expect(page.locator('[data-testid="stop-button"]')).not.toBeVisible();
  });
});
```

## Security Checklist

- [x] Validate user has access to agent before execution
- [x] Rate limit chat requests per user/agent
- [x] Sanitize user input before sending to LLM
- [x] Filter sensitive data from module context
- [x] Validate context data access permissions
- [x] Log all agent interactions for audit
- [x] Implement request cancellation capability
- [x] Protect against prompt injection attacks
- [x] Limit token usage per request

## Audit Events

| Event | Description | Data |
|-------|-------------|------|
| AGENT_CHAT | Chat message sent | agentId, conversationId, tokenCount |
| AGENT_STREAM_START | Streaming started | agentId, conversationId |
| AGENT_STREAM_END | Streaming completed | agentId, duration, tokens |
| AGENT_GENERATION_STOPPED | Generation cancelled | agentId, messageId, reason |
| AGENT_ACTION_EXECUTED | Suggested action executed | actionId, actionType |
| AGENT_FEEDBACK_PROVIDED | User provided feedback | messageId, rating |

## Performance Requirements

| Metric | Target |
|--------|--------|
| First token latency | < 500ms |
| Streaming throughput | > 30 tokens/sec |
| Knowledge search | < 200ms |
| Context building | < 300ms |
| Total response (non-streaming) | < 3s (P95) |
| Concurrent chats per agent | 100+ |

## Definition of Done

- [x] Chat interface implemented with streaming support
- [x] Knowledge base RAG integration working
- [x] Module context injection implemented
- [x] Action extraction and execution working
- [x] Source attribution in responses
- [x] Unit test coverage ≥ 80%
- [x] Integration tests passing
- [x] E2E tests for chat flow
- [x] Performance benchmarks met
- [x] Security review completed
- [x] Documentation updated
