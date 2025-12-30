# Story: AAM-005 - Conversation Management

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | AAM-005 |
| Epic | AI Agent Module (AAM) |
| Priority | P1 |
| Story Points | 5 |
| Sprint | Sprint 2 (Week 33) |
| Dependencies | AAM-004 |

## User Story

**As a** portal user
**I want to** manage my conversations with AI agents
**So that** I can review past interactions, continue conversations, and maintain organized communication history

## Acceptance Criteria

### AC1: Conversation List
```gherkin
Given I have interacted with AI agents
When I access my conversation history
Then I should see a list of all my conversations
And each conversation should show agent name, title, last message date
And conversations should be sorted by most recent first
```

### AC2: Conversation Details
```gherkin
Given I have a conversation with messages
When I open the conversation
Then I should see all messages in chronological order
And see source references for each response
And see token usage statistics
```

### AC3: Continue Conversation
```gherkin
Given I have an existing conversation
When I open and send a new message
Then the agent should have context from previous messages
And continue the conversation seamlessly
```

### AC4: Export Conversation
```gherkin
Given I have a conversation
When I request to export it
Then I should be able to download as PDF, JSON, or Markdown
And export should include all messages, sources, and metadata
```

### AC5: Delete Conversation
```gherkin
Given I have a conversation
When I delete it
Then all messages in that conversation should be removed
And I should not be able to access it anymore
And deletion should be logged for audit
```

### AC6: Search Conversations
```gherkin
Given I have multiple conversations
When I search using keywords
Then I should find conversations containing those terms
And results should highlight matching content
```

## Technical Specification

### Database Schema

```sql
-- Conversations table (from AAM-004, extended)
CREATE TABLE agent_conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED, DELETED
  pinned BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Conversation exports
CREATE TABLE conversation_exports (
  export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(conversation_id),
  user_id UUID NOT NULL REFERENCES users(id),
  format VARCHAR(20) NOT NULL, -- PDF, JSON, MARKDOWN
  file_path TEXT,
  file_size INTEGER,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Full-text search
CREATE INDEX idx_conversations_search ON agent_conversations
  USING gin(to_tsvector('polish', title || ' ' || COALESCE(summary, '')));

CREATE INDEX idx_messages_search ON agent_messages
  USING gin(to_tsvector('polish', content));

-- Other indexes
CREATE INDEX idx_conversations_user ON agent_conversations(tenant_id, user_id);
CREATE INDEX idx_conversations_agent ON agent_conversations(agent_id);
CREATE INDEX idx_conversations_status ON agent_conversations(status);
CREATE INDEX idx_conversations_last_message ON agent_conversations(last_message_at DESC);
CREATE INDEX idx_exports_conversation ON conversation_exports(conversation_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Conversation list filters
export const conversationFiltersSchema = z.object({
  agentId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ACTIVE'),
  search: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['lastMessageAt', 'createdAt', 'title']).default('lastMessageAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Conversation response
export const conversationSchema = z.object({
  conversationId: z.string().uuid(),
  agentId: z.string().uuid(),
  agentName: z.string(),
  agentAvatar: z.string().optional(),
  title: z.string(),
  summary: z.string().optional(),
  messageCount: z.number(),
  totalTokens: z.number(),
  totalCost: z.number(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DELETED']),
  pinned: z.boolean(),
  tags: z.array(z.string()),
  lastMessageAt: z.string().datetime().nullable(),
  lastMessagePreview: z.string().optional(),
  createdAt: z.string().datetime(),
});

// Update conversation
export const updateConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  pinned: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

// Export request
export const exportConversationSchema = z.object({
  format: z.enum(['PDF', 'JSON', 'MARKDOWN']),
  includeMetadata: z.boolean().default(true),
  includeSources: z.boolean().default(true),
  includeActions: z.boolean().default(false),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
});

// Search result
export const searchResultSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string(),
  agentName: z.string(),
  matchedContent: z.string(),
  messageId: z.string().uuid().optional(),
  highlightedText: z.string(),
  score: z.number(),
  createdAt: z.string().datetime(),
});

export type ConversationFilters = z.infer<typeof conversationFiltersSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type ExportRequest = z.infer<typeof exportConversationSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
```

### Service Implementation

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { ExportService } from './export.service';
import { SearchService } from './search.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly exportService: ExportService,
    private readonly searchService: SearchService,
    private readonly auditService: AuditService,
  ) {}

  async listConversations(
    tenantId: string,
    userId: string,
    filters: ConversationFilters,
  ): Promise<PaginatedResult<Conversation>> {
    const result = await this.conversationRepo.findByUser(
      tenantId,
      userId,
      filters,
    );

    // Add last message preview
    const conversationsWithPreview = await Promise.all(
      result.items.map(async (conv) => {
        const lastMessage = await this.messageRepo.getLastMessage(
          tenantId,
          conv.conversationId,
        );
        return {
          ...conv,
          lastMessagePreview: lastMessage?.content.substring(0, 100),
        };
      }),
    );

    return {
      items: conversationsWithPreview,
      total: result.total,
      page: filters.page,
      limit: filters.limit,
      hasMore: result.total > filters.page * filters.limit,
    };
  }

  async getConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<ConversationWithMessages> {
    const conversation = await this.conversationRepo.findById(
      tenantId,
      conversationId,
    );

    if (!conversation) {
      throw new NotFoundException('Rozmowa nie została znaleziona');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Brak dostępu do tej rozmowy');
    }

    const messages = await this.messageRepo.getConversationMessages(
      tenantId,
      conversationId,
    );

    const agent = await this.agentRepo.findById(tenantId, conversation.agentId);

    return {
      ...conversation,
      agent: {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
      },
      messages,
    };
  }

  async updateConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
    input: UpdateConversation,
  ): Promise<Conversation> {
    const conversation = await this.validateOwnership(
      tenantId,
      userId,
      conversationId,
    );

    const updated = await this.conversationRepo.update(
      conversationId,
      {
        ...input,
        updatedAt: new Date(),
      },
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CONVERSATION_UPDATED',
      entityType: 'conversation',
      entityId: conversationId,
      metadata: { changes: Object.keys(input) },
    });

    return updated;
  }

  async deleteConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.validateOwnership(
      tenantId,
      userId,
      conversationId,
    );

    // Soft delete
    await this.conversationRepo.update(conversationId, {
      status: 'DELETED',
      deletedAt: new Date(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CONVERSATION_DELETED',
      entityType: 'conversation',
      entityId: conversationId,
      metadata: {
        agentId: conversation.agentId,
        messageCount: conversation.messageCount,
      },
    });
  }

  async exportConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
    input: ExportRequest,
  ): Promise<ExportResult> {
    const conversation = await this.validateOwnership(
      tenantId,
      userId,
      conversationId,
    );

    // Create export record
    const exportRecord = await this.exportService.createExport({
      tenantId,
      conversationId,
      userId,
      format: input.format,
    });

    // Queue export job
    await this.exportService.queueExportJob({
      exportId: exportRecord.exportId,
      conversationId,
      format: input.format,
      options: {
        includeMetadata: input.includeMetadata,
        includeSources: input.includeSources,
        includeActions: input.includeActions,
        dateRange: input.dateRange,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CONVERSATION_EXPORT_REQUESTED',
      entityType: 'conversation',
      entityId: conversationId,
      metadata: { format: input.format },
    });

    return {
      exportId: exportRecord.exportId,
      status: 'PENDING',
      estimatedTime: this.estimateExportTime(conversation.messageCount),
    };
  }

  async getExportStatus(
    tenantId: string,
    userId: string,
    exportId: string,
  ): Promise<ExportStatus> {
    const exportRecord = await this.exportService.getExport(tenantId, exportId);

    if (!exportRecord || exportRecord.userId !== userId) {
      throw new NotFoundException('Eksport nie został znaleziony');
    }

    return {
      exportId,
      status: exportRecord.status,
      downloadUrl: exportRecord.status === 'COMPLETED'
        ? await this.exportService.getDownloadUrl(exportRecord.filePath)
        : null,
      expiresAt: exportRecord.expiresAt,
      fileSize: exportRecord.fileSize,
    };
  }

  async searchConversations(
    tenantId: string,
    userId: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    // Full-text search across conversations and messages
    const results = await this.searchService.search({
      tenantId,
      userId,
      query,
      tables: ['agent_conversations', 'agent_messages'],
      options: {
        limit: options?.limit || 20,
        highlightLength: 150,
      },
    });

    return results.map(result => ({
      conversationId: result.conversationId,
      title: result.title || 'Bez tytułu',
      agentName: result.agentName,
      matchedContent: result.matchedContent,
      messageId: result.messageId,
      highlightedText: result.highlight,
      score: result.score,
      createdAt: result.createdAt,
    }));
  }

  async archiveConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<void> {
    await this.validateOwnership(tenantId, userId, conversationId);

    await this.conversationRepo.update(conversationId, {
      status: 'ARCHIVED',
      updatedAt: new Date(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CONVERSATION_ARCHIVED',
      entityType: 'conversation',
      entityId: conversationId,
    });
  }

  async restoreConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<void> {
    await this.validateOwnership(tenantId, userId, conversationId);

    await this.conversationRepo.update(conversationId, {
      status: 'ACTIVE',
      updatedAt: new Date(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CONVERSATION_RESTORED',
      entityType: 'conversation',
      entityId: conversationId,
    });
  }

  async getConversationStats(
    tenantId: string,
    userId: string,
  ): Promise<ConversationStats> {
    return this.conversationRepo.getStats(tenantId, userId);
  }

  private async validateOwnership(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.findById(
      tenantId,
      conversationId,
    );

    if (!conversation) {
      throw new NotFoundException('Rozmowa nie została znaleziona');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Brak dostępu do tej rozmowy');
    }

    if (conversation.status === 'DELETED') {
      throw new NotFoundException('Rozmowa została usunięta');
    }

    return conversation;
  }

  private estimateExportTime(messageCount: number): number {
    // Rough estimate in seconds
    return Math.ceil(messageCount / 100) * 5 + 10;
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import {
  conversationFiltersSchema,
  updateConversationSchema,
  exportConversationSchema,
} from './schemas';

export const conversationRouter = router({
  // List user's conversations
  list: protectedProcedure
    .input(conversationFiltersSchema)
    .query(async ({ ctx, input }) => {
      return ctx.conversationService.listConversations(
        ctx.tenantId,
        ctx.userId,
        input,
      );
    }),

  // Get conversation with messages
  get: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.conversationService.getConversation(
        ctx.tenantId,
        ctx.userId,
        input.conversationId,
      );
    }),

  // Update conversation
  update: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      ...updateConversationSchema.shape,
    }))
    .mutation(async ({ ctx, input }) => {
      const { conversationId, ...data } = input;
      return ctx.conversationService.updateConversation(
        ctx.tenantId,
        ctx.userId,
        conversationId,
        data,
      );
    }),

  // Delete conversation
  delete: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.conversationService.deleteConversation(
        ctx.tenantId,
        ctx.userId,
        input.conversationId,
      );
      return { success: true };
    }),

  // Export conversation
  export: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      ...exportConversationSchema.shape,
    }))
    .mutation(async ({ ctx, input }) => {
      const { conversationId, ...options } = input;
      return ctx.conversationService.exportConversation(
        ctx.tenantId,
        ctx.userId,
        conversationId,
        options,
      );
    }),

  // Get export status
  exportStatus: protectedProcedure
    .input(z.object({ exportId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.conversationService.getExportStatus(
        ctx.tenantId,
        ctx.userId,
        input.exportId,
      );
    }),

  // Search conversations
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(2).max(200),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.conversationService.searchConversations(
        ctx.tenantId,
        ctx.userId,
        input.query,
        { limit: input.limit },
      );
    }),

  // Archive conversation
  archive: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.conversationService.archiveConversation(
        ctx.tenantId,
        ctx.userId,
        input.conversationId,
      );
      return { success: true };
    }),

  // Restore conversation
  restore: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.conversationService.restoreConversation(
        ctx.tenantId,
        ctx.userId,
        input.conversationId,
      );
      return { success: true };
    }),

  // Get conversation statistics
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.conversationService.getConversationStats(
        ctx.tenantId,
        ctx.userId,
      );
    }),
});
```

## Test Specification

### Unit Tests

```typescript
describe('ConversationService', () => {
  describe('listConversations', () => {
    it('should return paginated conversations', async () => {
      const result = await service.listConversations(
        'tenant-1',
        'user-1',
        { page: 1, limit: 10 },
      );

      expect(result.items).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.hasMore).toBeDefined();
    });

    it('should filter by agent', async () => {
      const result = await service.listConversations(
        'tenant-1',
        'user-1',
        { agentId: 'agent-1', page: 1, limit: 10 },
      );

      result.items.forEach(conv => {
        expect(conv.agentId).toBe('agent-1');
      });
    });

    it('should search by query', async () => {
      const result = await service.listConversations(
        'tenant-1',
        'user-1',
        { search: 'VAT', page: 1, limit: 10 },
      );

      expect(result.items.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deleteConversation', () => {
    it('should soft delete conversation', async () => {
      await service.deleteConversation('tenant-1', 'user-1', 'conv-1');

      const deleted = await conversationRepo.findById('tenant-1', 'conv-1');
      expect(deleted.status).toBe('DELETED');
      expect(deleted.deletedAt).toBeDefined();
    });

    it('should deny access to other user conversation', async () => {
      await expect(
        service.deleteConversation('tenant-1', 'user-2', 'conv-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exportConversation', () => {
    it('should queue export job', async () => {
      const result = await service.exportConversation(
        'tenant-1',
        'user-1',
        'conv-1',
        { format: 'PDF' },
      );

      expect(result.exportId).toBeDefined();
      expect(result.status).toBe('PENDING');
    });
  });
});
```

### Integration Tests

```typescript
describe('Conversation API', () => {
  it('should list user conversations', async () => {
    const response = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.items).toBeInstanceOf(Array);
    expect(response.body.total).toBeDefined();
  });

  it('should export conversation to PDF', async () => {
    const exportResponse = await request(app)
      .post(`/api/v1/conversations/${convId}/export`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ format: 'PDF' })
      .expect(200);

    const exportId = exportResponse.body.exportId;

    // Wait for export to complete
    await waitForExport(exportId);

    const statusResponse = await request(app)
      .get(`/api/v1/conversations/exports/${exportId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(statusResponse.body.status).toBe('COMPLETED');
    expect(statusResponse.body.downloadUrl).toBeDefined();
  });
});
```

## Security Checklist

- [x] Users can only access their own conversations
- [x] Soft delete preserves data for audit
- [x] Export URLs are signed and time-limited
- [x] Search is scoped to user's conversations
- [x] Rate limiting on search and export
- [x] All operations logged for audit

## Audit Events

| Event | Description | Data |
|-------|-------------|------|
| CONVERSATION_UPDATED | Conversation metadata changed | conversationId, changes |
| CONVERSATION_DELETED | Conversation deleted | conversationId, agentId |
| CONVERSATION_ARCHIVED | Conversation archived | conversationId |
| CONVERSATION_RESTORED | Conversation restored | conversationId |
| CONVERSATION_EXPORT_REQUESTED | Export initiated | conversationId, format |
| CONVERSATION_EXPORT_DOWNLOADED | Export downloaded | exportId |

## Definition of Done

- [x] Conversation CRUD operations implemented
- [x] Full-text search working
- [x] Export to PDF, JSON, Markdown
- [x] Archive and restore functionality
- [x] Unit test coverage ≥ 80%
- [x] Integration tests passing
- [x] Security review completed
- [x] Documentation updated
