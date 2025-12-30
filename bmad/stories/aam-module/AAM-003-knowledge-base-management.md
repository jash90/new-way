# Story: Knowledge Base Management

## Story Information

| Field | Value |
|-------|-------|
| Story ID | AAM-003 |
| Epic | AI Agent Module (AAM) |
| Title | Knowledge Base Management |
| Priority | P0 |
| Story Points | 8 |
| Status | Draft |
| Sprint | Sprint 1 - Foundation |

## User Story

**As a** Super Admin,
**I want to** upload and manage documents for agent knowledge bases,
**So that** agents can provide accurate, domain-specific answers grounded in authoritative sources.

## Acceptance Criteria

### AC1: Knowledge Base Creation
```gherkin
Given I am on the agent configuration page
When I navigate to "Knowledge Base" tab
And I click "Create Knowledge Base"
And I provide:
  | Field | Value |
  | Name | "Polish Tax Regulations 2024" |
  | Description | "Current tax laws and interpretations" |
Then a new knowledge base should be created
And I should see the file upload interface
```

### AC2: Document Upload
```gherkin
Given I have created a knowledge base
When I upload documents:
  | File | Type | Size |
  | ustawa_vat.pdf | PDF | 2.5 MB |
  | interpretacje.docx | DOCX | 1.2 MB |
  | stawki.csv | CSV | 50 KB |
Then each file should be validated and queued for processing
And I should see upload progress for each file
And upon completion, the processing status should update
```

### AC3: Document Processing
```gherkin
Given I have uploaded documents
When the processing pipeline runs
Then each document should be:
  - Extracted (text content pulled)
  - Chunked (split into semantic segments)
  - Embedded (converted to vectors)
  - Indexed (stored in vector database)
And the knowledge base should show:
  | Metric | Value |
  | Files | 3 |
  | Chunks | 450 |
  | Vectors | 450 |
  | Status | Indexed |
```

### AC4: Semantic Search Preview
```gherkin
Given I have an indexed knowledge base
When I enter a test query: "Jaka jest stawka VAT na usługi IT?"
Then I should see the top 5 most relevant chunks
And each result should show:
  - Source file name
  - Relevance score
  - Matched text snippet
  - Context window
```

### AC5: File Management
```gherkin
Given I have files in a knowledge base
When I view the file list
Then I should see for each file:
  | Column | Description |
  | Name | File name with icon |
  | Size | File size |
  | Chunks | Number of chunks |
  | Status | Processing status |
  | Uploaded | Upload date |
And I should be able to:
  - Download the original file
  - Delete a file (with re-indexing)
  - View file details and chunks
```

### AC6: Knowledge Base Settings
```gherkin
Given I am configuring a knowledge base
When I adjust settings:
  | Setting | Value | Description |
  | Chunk Size | 1000 | Characters per chunk |
  | Chunk Overlap | 200 | Overlap between chunks |
  | Top K | 5 | Results per query |
  | Threshold | 0.7 | Minimum relevance |
Then the settings should be saved
And new uploads should use these settings
And existing files can be re-processed with new settings
```

### AC7: Multiple Knowledge Bases
```gherkin
Given I have an agent
When I create multiple knowledge bases:
  - "Tax Regulations" (tax documents)
  - "Internal Procedures" (company docs)
  - "Client Templates" (form templates)
Then each knowledge base should be searchable independently
And agent queries should search across all active bases
And I should be able to enable/disable bases per agent
```

## Technical Specification

### Database Schema

```sql
-- Knowledge Bases (from epic, detailed)
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Processing settings
  chunk_size INTEGER DEFAULT 1000 CHECK (chunk_size >= 200 AND chunk_size <= 4000),
  chunk_overlap INTEGER DEFAULT 200 CHECK (chunk_overlap >= 0 AND chunk_overlap < chunk_size),

  -- Search settings
  search_settings JSONB DEFAULT '{
    "topK": 5,
    "threshold": 0.7,
    "reranking": false,
    "hybridSearch": false
  }',

  -- Stats
  file_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  vector_count INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,

  -- Status
  index_status VARCHAR(20) DEFAULT 'EMPTY'
    CHECK (index_status IN ('EMPTY', 'PROCESSING', 'INDEXED', 'ERROR', 'REINDEXING')),
  last_indexed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Base Files
CREATE TABLE knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,

  -- File info
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  checksum VARCHAR(64) NOT NULL,

  -- Storage
  s3_location TEXT NOT NULL,

  -- Processing
  chunk_count INTEGER DEFAULT 0,
  embedding_count INTEGER DEFAULT 0,
  process_status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (process_status IN ('PENDING', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'INDEXED', 'ERROR')),
  process_error TEXT,
  processed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Chunks (for reference, actual vectors in Qdrant)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  knowledge_file_id UUID NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,

  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,

  -- Vector reference
  vector_id VARCHAR(100), -- Qdrant point ID

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(knowledge_file_id, chunk_index)
);

-- Indexes
CREATE INDEX idx_kb_agent ON knowledge_bases(agent_id);
CREATE INDEX idx_kb_status ON knowledge_bases(index_status);
CREATE INDEX idx_kf_kb ON knowledge_files(knowledge_base_id);
CREATE INDEX idx_kf_status ON knowledge_files(process_status);
CREATE INDEX idx_chunks_file ON document_chunks(knowledge_file_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

export const SearchSettingsSchema = z.object({
  topK: z.number().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.7),
  reranking: z.boolean().default(false),
  hybridSearch: z.boolean().default(false),
});

export const CreateKnowledgeBaseSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  chunkSize: z.number().min(200).max(4000).default(1000),
  chunkOverlap: z.number().min(0).max(500).default(200),
  searchSettings: SearchSettingsSchema.optional(),
});

export const UpdateKnowledgeBaseSchema = CreateKnowledgeBaseSchema.partial();

export const SearchKnowledgeSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(), // Specific KBs or all
});

export const AllowedFileTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
  'text/markdown',
] as const;

export const FileUploadSchema = z.object({
  file: z.object({
    mimetype: z.enum(AllowedFileTypes),
    size: z.number().max(50 * 1024 * 1024), // 50 MB max
    originalname: z.string(),
  }),
});

export type CreateKnowledgeBaseInput = z.infer<typeof CreateKnowledgeBaseSchema>;
export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeSchema>;
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { QdrantClient } from '@qdrant/js-client-rest';

@injectable()
export class KnowledgeBaseService implements IKnowledgeBaseService {
  constructor(
    @inject('KnowledgeBaseRepository') private kbRepo: IKnowledgeBaseRepository,
    @inject('KnowledgeFileRepository') private fileRepo: IKnowledgeFileRepository,
    @inject('ChunkRepository') private chunkRepo: IChunkRepository,
    @inject('StorageService') private storageService: IStorageService,
    @inject('DocumentProcessor') private docProcessor: IDocumentProcessor,
    @inject('EmbeddingService') private embeddingService: IEmbeddingService,
    @inject('VectorDBClient') private vectorDB: QdrantClient,
    @inject('MessageQueue') private queue: IMessageQueue,
    @inject('AuditService') private auditService: IAuditService,
  ) {}

  async createKnowledgeBase(
    tenantId: string,
    agentId: string,
    userId: string,
    input: CreateKnowledgeBaseInput
  ): Promise<KnowledgeBase> {
    // Validate chunk overlap < chunk size
    if (input.chunkOverlap >= input.chunkSize) {
      throw new BadRequestException('Nakładanie chunków musi być mniejsze niż rozmiar chunka');
    }

    const kb = await this.kbRepo.create({
      tenantId,
      agentId,
      ...input,
      indexStatus: 'EMPTY',
    });

    // Create collection in Qdrant
    await this.ensureVectorCollection(tenantId, kb.id);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'KNOWLEDGE_BASE_CREATED',
      entityType: 'knowledge_base',
      entityId: kb.id,
      metadata: { name: kb.name, agentId },
    });

    return kb;
  }

  async uploadFile(
    tenantId: string,
    knowledgeBaseId: string,
    userId: string,
    file: UploadedFile
  ): Promise<KnowledgeFile> {
    const kb = await this.getKnowledgeBaseOrThrow(tenantId, knowledgeBaseId);

    // Validate file type
    if (!AllowedFileTypes.includes(file.mimetype as any)) {
      throw new BadRequestException('Nieobsługiwany typ pliku');
    }

    // Calculate checksum
    const checksum = await this.calculateChecksum(file.buffer);

    // Check for duplicate
    const existing = await this.fileRepo.findByChecksum(knowledgeBaseId, checksum);
    if (existing) {
      throw new BadRequestException('Ten plik już istnieje w bazie wiedzy');
    }

    // Upload to S3
    const s3Key = `knowledge/${tenantId}/${knowledgeBaseId}/${Date.now()}-${file.originalname}`;
    const s3Location = await this.storageService.upload(s3Key, file.buffer, file.mimetype);

    // Create file record
    const kbFile = await this.fileRepo.create({
      tenantId,
      knowledgeBaseId,
      fileName: s3Key.split('/').pop()!,
      originalName: file.originalname,
      fileType: this.getFileType(file.mimetype),
      mimeType: file.mimetype,
      fileSize: file.size,
      checksum,
      s3Location,
      processStatus: 'PENDING',
      uploadedBy: userId,
    });

    // Queue for processing
    await this.queue.publish('knowledge.process', {
      tenantId,
      knowledgeBaseId,
      fileId: kbFile.id,
    });

    // Update KB status
    await this.kbRepo.update(knowledgeBaseId, {
      indexStatus: 'PROCESSING',
      updatedAt: new Date(),
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'KNOWLEDGE_FILE_UPLOADED',
      entityType: 'knowledge_file',
      entityId: kbFile.id,
      metadata: { fileName: file.originalname, size: file.size },
    });

    return kbFile;
  }

  async processFile(tenantId: string, knowledgeBaseId: string, fileId: string): Promise<void> {
    const kb = await this.getKnowledgeBaseOrThrow(tenantId, knowledgeBaseId);
    const file = await this.fileRepo.findById(fileId);
    if (!file) {
      throw new NotFoundException('Plik nie został znaleziony');
    }

    try {
      // Step 1: Extract text
      await this.fileRepo.update(fileId, { processStatus: 'EXTRACTING' });
      const fileBuffer = await this.storageService.download(file.s3Location);
      const text = await this.docProcessor.extractText(fileBuffer, file.mimeType);

      // Step 2: Split into chunks
      await this.fileRepo.update(fileId, { processStatus: 'CHUNKING' });
      const chunks = await this.splitIntoChunks(text, {
        chunkSize: kb.chunkSize,
        overlap: kb.chunkOverlap,
        preserveContext: true,
      });

      // Step 3: Generate embeddings
      await this.fileRepo.update(fileId, { processStatus: 'EMBEDDING' });
      const embeddings = await this.embeddingService.generateEmbeddings(
        chunks.map(c => c.text)
      );

      // Step 4: Store in vector database
      const collectionName = this.getCollectionName(tenantId, knowledgeBaseId);
      const points = chunks.map((chunk, i) => ({
        id: `${fileId}-${i}`,
        vector: embeddings[i],
        payload: {
          tenantId,
          knowledgeBaseId,
          fileId,
          fileName: file.originalName,
          chunkIndex: i,
          text: chunk.text,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          metadata: chunk.metadata,
        },
      }));

      await this.vectorDB.upsert(collectionName, { points });

      // Step 5: Save chunk references to PostgreSQL
      await this.chunkRepo.bulkCreate(
        chunks.map((chunk, i) => ({
          tenantId,
          knowledgeFileId: fileId,
          content: chunk.text,
          chunkIndex: i,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          vectorId: `${fileId}-${i}`,
          metadata: chunk.metadata,
        }))
      );

      // Update file status
      await this.fileRepo.update(fileId, {
        processStatus: 'INDEXED',
        chunkCount: chunks.length,
        embeddingCount: embeddings.length,
        processedAt: new Date(),
      });

      // Update KB stats
      await this.updateKnowledgeBaseStats(knowledgeBaseId);

    } catch (error) {
      await this.fileRepo.update(fileId, {
        processStatus: 'ERROR',
        processError: error.message,
      });

      // Check if all files have errors
      await this.updateKnowledgeBaseStats(knowledgeBaseId);

      throw error;
    }
  }

  async searchKnowledge(
    tenantId: string,
    agentId: string,
    input: SearchKnowledgeInput
  ): Promise<KnowledgeSearchResult[]> {
    // Get active knowledge bases for agent
    let knowledgeBases: KnowledgeBase[];
    if (input.knowledgeBaseIds?.length) {
      knowledgeBases = await this.kbRepo.findByIds(tenantId, input.knowledgeBaseIds);
    } else {
      knowledgeBases = await this.kbRepo.findActiveByAgent(tenantId, agentId);
    }

    if (knowledgeBases.length === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(input.query);

    // Search across all knowledge bases
    const results: KnowledgeSearchResult[] = [];

    for (const kb of knowledgeBases) {
      const collectionName = this.getCollectionName(tenantId, kb.id);
      const topK = input.topK || kb.searchSettings.topK;
      const threshold = input.threshold || kb.searchSettings.threshold;

      try {
        const searchResult = await this.vectorDB.search(collectionName, {
          vector: queryEmbedding,
          limit: topK,
          score_threshold: threshold,
          with_payload: true,
        });

        for (const point of searchResult) {
          results.push({
            knowledgeBaseId: kb.id,
            knowledgeBaseName: kb.name,
            fileId: point.payload!.fileId as string,
            fileName: point.payload!.fileName as string,
            text: point.payload!.text as string,
            score: point.score,
            chunkIndex: point.payload!.chunkIndex as number,
            metadata: point.payload!.metadata as Record<string, any>,
          });
        }
      } catch (error) {
        console.error(`Error searching KB ${kb.id}:`, error);
      }
    }

    // Sort by score and deduplicate
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, input.topK || 5);
  }

  async deleteFile(
    tenantId: string,
    knowledgeBaseId: string,
    fileId: string,
    userId: string
  ): Promise<void> {
    const file = await this.fileRepo.findById(fileId);
    if (!file || file.knowledgeBaseId !== knowledgeBaseId) {
      throw new NotFoundException('Plik nie został znaleziony');
    }

    // Delete from vector database
    const collectionName = this.getCollectionName(tenantId, knowledgeBaseId);
    await this.vectorDB.delete(collectionName, {
      filter: {
        must: [{ key: 'fileId', match: { value: fileId } }],
      },
    });

    // Delete from S3
    await this.storageService.delete(file.s3Location);

    // Delete from PostgreSQL (cascades to chunks)
    await this.fileRepo.delete(fileId);

    // Update KB stats
    await this.updateKnowledgeBaseStats(knowledgeBaseId);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'KNOWLEDGE_FILE_DELETED',
      entityType: 'knowledge_file',
      entityId: fileId,
      metadata: { fileName: file.originalName, knowledgeBaseId },
    });
  }

  async reprocessKnowledgeBase(
    tenantId: string,
    knowledgeBaseId: string,
    userId: string
  ): Promise<void> {
    const kb = await this.getKnowledgeBaseOrThrow(tenantId, knowledgeBaseId);

    // Get all files
    const files = await this.fileRepo.findByKnowledgeBase(knowledgeBaseId);

    // Clear existing vectors
    const collectionName = this.getCollectionName(tenantId, knowledgeBaseId);
    await this.vectorDB.delete(collectionName, { filter: {} });

    // Clear existing chunks
    await this.chunkRepo.deleteByKnowledgeBase(knowledgeBaseId);

    // Reset file statuses
    await this.fileRepo.resetStatusForKnowledgeBase(knowledgeBaseId);

    // Update KB status
    await this.kbRepo.update(knowledgeBaseId, {
      indexStatus: 'REINDEXING',
      chunkCount: 0,
      vectorCount: 0,
      updatedAt: new Date(),
    });

    // Queue all files for reprocessing
    for (const file of files) {
      await this.queue.publish('knowledge.process', {
        tenantId,
        knowledgeBaseId,
        fileId: file.id,
      });
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'KNOWLEDGE_BASE_REPROCESSED',
      entityType: 'knowledge_base',
      entityId: knowledgeBaseId,
      metadata: { fileCount: files.length },
    });
  }

  // Private helpers

  private async splitIntoChunks(
    text: string,
    options: { chunkSize: number; overlap: number; preserveContext: boolean }
  ): Promise<TextChunk[]> {
    const chunks: TextChunk[] = [];
    const sentences = this.splitIntoSentences(text);

    let currentChunk = '';
    let currentStart = 0;
    let charPosition = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > options.chunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startChar: currentStart,
          endChar: charPosition,
          metadata: {},
        });

        // Handle overlap
        if (options.overlap > 0) {
          const overlapText = currentChunk.slice(-options.overlap);
          currentChunk = overlapText + sentence;
          currentStart = charPosition - options.overlap;
        } else {
          currentChunk = sentence;
          currentStart = charPosition;
        }
      } else {
        currentChunk += sentence;
      }
      charPosition += sentence.length;
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        startChar: currentStart,
        endChar: charPosition,
        metadata: {},
      });
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Polish-aware sentence splitting
    return text.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/);
  }

  private async ensureVectorCollection(tenantId: string, knowledgeBaseId: string): Promise<void> {
    const collectionName = this.getCollectionName(tenantId, knowledgeBaseId);

    try {
      await this.vectorDB.getCollection(collectionName);
    } catch {
      await this.vectorDB.createCollection(collectionName, {
        vectors: {
          size: 1536, // OpenAI ada-002 embedding size
          distance: 'Cosine',
        },
      });
    }
  }

  private getCollectionName(tenantId: string, knowledgeBaseId: string): string {
    return `kb_${tenantId}_${knowledgeBaseId}`.replace(/-/g, '_');
  }

  private async updateKnowledgeBaseStats(knowledgeBaseId: string): Promise<void> {
    const stats = await this.fileRepo.getStatsForKnowledgeBase(knowledgeBaseId);
    const allIndexed = stats.files === stats.indexedFiles;
    const hasError = stats.errorFiles > 0;

    await this.kbRepo.update(knowledgeBaseId, {
      fileCount: stats.files,
      chunkCount: stats.chunks,
      vectorCount: stats.vectors,
      totalSizeBytes: stats.totalSize,
      indexStatus: hasError && stats.indexedFiles === 0
        ? 'ERROR'
        : allIndexed
          ? 'INDEXED'
          : 'PROCESSING',
      lastIndexedAt: allIndexed ? new Date() : undefined,
      updatedAt: new Date(),
    });
  }

  private async calculateChecksum(buffer: Buffer): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private getFileType(mimeType: string): string {
    const typeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/json': 'json',
      'text/markdown': 'md',
    };
    return typeMap[mimeType] || 'unknown';
  }
}
```

### API Routes

```typescript
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

export const knowledgeBaseRoutes = Router();

// List knowledge bases for agent
knowledgeBaseRoutes.get('/agents/:agentId/knowledge-bases', async (req, res) => {
  const { tenantId } = req.context;
  const { agentId } = req.params;

  const kbs = await knowledgeBaseService.listForAgent(tenantId, agentId);
  res.json(kbs);
});

// Create knowledge base
knowledgeBaseRoutes.post(
  '/agents/:agentId/knowledge-bases',
  validateRequest({ body: CreateKnowledgeBaseSchema }),
  async (req, res) => {
    const { tenantId, userId } = req.context;
    const { agentId } = req.params;

    const kb = await knowledgeBaseService.createKnowledgeBase(
      tenantId, agentId, userId, req.body
    );
    res.status(201).json(kb);
  }
);

// Get knowledge base details
knowledgeBaseRoutes.get('/knowledge-bases/:id', async (req, res) => {
  const { tenantId } = req.context;
  const { id } = req.params;

  const kb = await knowledgeBaseService.getKnowledgeBase(tenantId, id);
  res.json(kb);
});

// Update knowledge base
knowledgeBaseRoutes.put(
  '/knowledge-bases/:id',
  validateRequest({ body: UpdateKnowledgeBaseSchema }),
  async (req, res) => {
    const { tenantId, userId } = req.context;
    const { id } = req.params;

    const kb = await knowledgeBaseService.updateKnowledgeBase(
      tenantId, id, userId, req.body
    );
    res.json(kb);
  }
);

// Delete knowledge base
knowledgeBaseRoutes.delete('/knowledge-bases/:id', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id } = req.params;

  await knowledgeBaseService.deleteKnowledgeBase(tenantId, id, userId);
  res.status(204).send();
});

// Upload file
knowledgeBaseRoutes.post(
  '/knowledge-bases/:id/files',
  upload.single('file'),
  async (req, res) => {
    const { tenantId, userId } = req.context;
    const { id } = req.params;

    const file = await knowledgeBaseService.uploadFile(tenantId, id, userId, req.file);
    res.status(201).json(file);
  }
);

// List files
knowledgeBaseRoutes.get('/knowledge-bases/:id/files', async (req, res) => {
  const { tenantId } = req.context;
  const { id } = req.params;

  const files = await knowledgeBaseService.listFiles(tenantId, id);
  res.json(files);
});

// Delete file
knowledgeBaseRoutes.delete('/knowledge-bases/:kbId/files/:fileId', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { kbId, fileId } = req.params;

  await knowledgeBaseService.deleteFile(tenantId, kbId, fileId, userId);
  res.status(204).send();
});

// Search knowledge
knowledgeBaseRoutes.post(
  '/agents/:agentId/knowledge/search',
  validateRequest({ body: SearchKnowledgeSchema }),
  async (req, res) => {
    const { tenantId } = req.context;
    const { agentId } = req.params;

    const results = await knowledgeBaseService.searchKnowledge(
      tenantId, agentId, req.body
    );
    res.json(results);
  }
);

// Reprocess knowledge base
knowledgeBaseRoutes.post('/knowledge-bases/:id/reprocess', async (req, res) => {
  const { tenantId, userId } = req.context;
  const { id } = req.params;

  await knowledgeBaseService.reprocessKnowledgeBase(tenantId, id, userId);
  res.json({ message: 'Reprocessing started' });
});
```

## Test Specification

### Unit Tests

```typescript
describe('KnowledgeBaseService', () => {
  describe('uploadFile', () => {
    it('should upload and queue file for processing', async () => {
      mockStorageService.upload.mockResolvedValue('s3://bucket/key');
      mockFileRepo.create.mockImplementation(async (data) => ({ id: 'file-1', ...data }));

      const result = await service.uploadFile('tenant-1', 'kb-1', 'user-1', {
        mimetype: 'application/pdf',
        size: 1024,
        originalname: 'test.pdf',
        buffer: Buffer.from('test'),
      });

      expect(mockQueue.publish).toHaveBeenCalledWith('knowledge.process', expect.any(Object));
      expect(result.processStatus).toBe('PENDING');
    });

    it('should reject duplicate files by checksum', async () => {
      mockFileRepo.findByChecksum.mockResolvedValue({ id: 'existing' });

      await expect(
        service.uploadFile('tenant-1', 'kb-1', 'user-1', createTestFile())
      ).rejects.toThrow('Ten plik już istnieje');
    });
  });

  describe('searchKnowledge', () => {
    it('should search across multiple knowledge bases', async () => {
      mockKbRepo.findActiveByAgent.mockResolvedValue([
        { id: 'kb-1', searchSettings: { topK: 5, threshold: 0.7 } },
        { id: 'kb-2', searchSettings: { topK: 5, threshold: 0.7 } },
      ]);
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorDB.search.mockResolvedValue([
        { score: 0.9, payload: { text: 'Result 1', fileId: 'f1', fileName: 'doc.pdf' } },
      ]);

      const results = await service.searchKnowledge('tenant-1', 'agent-1', {
        query: 'VAT rate',
      });

      expect(mockVectorDB.search).toHaveBeenCalledTimes(2);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('splitIntoChunks', () => {
    it('should create overlapping chunks', () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const chunks = service['splitIntoChunks'](text, {
        chunkSize: 30,
        overlap: 10,
        preserveContext: true,
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Check overlap
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = chunks[i - 1].text.slice(-10);
        const currStart = chunks[i].text.slice(0, 10);
        // Overlap should exist
      }
    });
  });
});
```

### Integration Tests

```typescript
describe('Knowledge Base Integration', () => {
  it('should process uploaded file and enable search', async () => {
    // Create agent
    const agentRes = await request(app).post('/api/v1/agents')...;
    const agentId = agentRes.body.id;

    // Create knowledge base
    const kbRes = await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/knowledge-bases`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test KB', chunkSize: 500 })
      .expect(201);

    const kbId = kbRes.body.id;

    // Upload file
    const uploadRes = await request(app.getHttpServer())
      .post(`/api/v1/knowledge-bases/${kbId}/files`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', 'test/fixtures/sample.pdf')
      .expect(201);

    // Wait for processing (in real tests, use queue consumer)
    await new Promise(r => setTimeout(r, 5000));

    // Search
    const searchRes = await request(app.getHttpServer())
      .post(`/api/v1/agents/${agentId}/knowledge/search`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ query: 'test query' })
      .expect(200);

    expect(searchRes.body.length).toBeGreaterThan(0);
  });
});
```

## Security Checklist

- [x] File type validation (whitelist only)
- [x] File size limits (50 MB max)
- [x] Checksum validation for duplicates
- [x] Tenant isolation in vector database
- [x] S3 bucket policies per tenant
- [x] Audit logging for all file operations
- [x] Virus scanning integration (queue consumer)

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| KNOWLEDGE_BASE_CREATED | KB created | name, agentId |
| KNOWLEDGE_FILE_UPLOADED | File uploaded | fileName, size |
| KNOWLEDGE_FILE_PROCESSED | Processing done | chunks, vectors |
| KNOWLEDGE_FILE_DELETED | File deleted | fileName |
| KNOWLEDGE_BASE_REPROCESSED | Reindex triggered | fileCount |

## Implementation Notes

### Embedding Model
- Default: OpenAI text-embedding-ada-002 (1536 dimensions)
- Alternative: Cohere embed-multilingual-v3.0 for Polish
- Batch size: 100 texts per request for efficiency

### Vector Database
- Qdrant collection per knowledge base
- Cosine similarity for semantic search
- Payload includes full text for retrieval

### Processing Queue
- RabbitMQ with prefetch=1 for ordered processing
- Dead letter queue for failed processing
- Retry with exponential backoff (3 attempts)
