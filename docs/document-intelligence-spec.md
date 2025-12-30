
# Document Intelligence Hub Module - Complete Technical Specification

## Module Information

-   **Module Name**: Document Intelligence Hub
-   **Acronym**: DIH
-   **Primary Purpose**: Provide intelligent document processing with OCR, automated data extraction, smart categorization, and full-text search capabilities
-   **Key Features**: Multi-format document upload, OCR with Polish language support, AI-powered data extraction, automatic categorization, version control, full-text search, document workflow automation

----------

## A. Module Overview

### Purpose

The Document Intelligence Hub serves as the central document processing engine for the accounting platform, transforming unstructured documents into structured, actionable data. It combines advanced OCR capabilities with machine learning models specifically trained for Polish accounting documents, enabling automatic extraction of critical information from invoices, receipts, contracts, and other financial documents.

### Scope

-   **Document Upload & Storage**: Multi-format support (PDF, images, Office documents)
-   **OCR Processing**: Multi-language OCR with Polish optimization
-   **Data Extraction**: AI-powered extraction of entities and structured data
-   **Document Classification**: Automatic categorization based on content
-   **Version Control**: Complete document versioning and history
-   **Full-Text Search**: Elasticsearch-powered content search
-   **Metadata Management**: Custom metadata and tagging
-   **Document Templates**: Recognition and mapping to templates
-   **Workflow Integration**: Trigger workflows based on document types
-   **Batch Processing**: Bulk document import and processing
-   **Quality Assurance**: Confidence scoring and validation
-   **Document Linking**: Relationships between documents
-   **Export & Sharing**: Multiple export formats and secure sharing
-   **Compliance**: GDPR-compliant storage and retention policies

### Dependencies

-   **Storage Module**: Physical file storage (S3/Supabase Storage)
-   **AI Module**: ML models and NLP services
-   **Client Module**: Client association and context
-   **Authentication Module**: Access control and permissions
-   **Notification Module**: Processing status alerts
-   **Workflow Module**: Document-triggered automations
-   **Audit Module**: Document access and change tracking
-   **Queue Module**: Async processing jobs

### Consumers

-   **Accounting Module**: Invoice and expense document processing
-   **Task Module**: Document-based task creation
-   **Portal Module**: Client document access
-   **Tax Module**: Tax document processing
-   **Invoice Module**: Invoice data extraction
-   **Expense Module**: Receipt processing
-   **Reporting Module**: Document analytics
-   **Workflow Module**: Document-triggered workflows

----------

## B. Technical Specification

### Technology Stack

```yaml
Core Technologies:
  Language: TypeScript 5.0+
  Runtime: Node.js 20 LTS
  Framework: NestJS with dependency injection
  
OCR & AI Stack:
  OCR Services:
    - Google Vision API (primary)
    - AWS Textract (backup/specific features)
    - Tesseract.js (offline fallback)
  
  ML/NLP:
    - TensorFlow.js for custom models
    - spaCy for NLP (Polish language)
    - Custom BERT models for classification
  
  Document Processing:
    - Sharp for image processing
    - pdf-lib for PDF manipulation
    - Mammoth for Word documents
    - xlsx for Excel files
  
Storage:
  Primary: S3-compatible storage (AWS S3/MinIO)
  - Versioning enabled
  - Lifecycle policies
  - CDN integration
  
  Metadata: PostgreSQL 15
  - Document records
  - Extracted data
  - Search indexes
  
Search:
  Elasticsearch 8:
  - Full-text search
  - Polish language analyzer
  - Fuzzy matching
  - Faceted search
  
Cache:
  Redis:
  - OCR results (TTL: 24 hours)
  - Extracted data (TTL: 1 hour)
  - Search results (TTL: 15 minutes)
  
Queue:
  BullMQ:
  - OCR processing jobs
  - Data extraction jobs
  - Indexing jobs
  - Batch processing
  
Security:
  - End-to-end encryption
  - Virus scanning (ClamAV)
  - DLP (Data Loss Prevention)
  - Access logging

```

### Key Interfaces

```typescript
// =====================================
// Core Types and Enums
// =====================================

import { z } from 'zod';
import { Readable } from 'stream';

export enum DocumentType {
  INVOICE = 'INVOICE',
  RECEIPT = 'RECEIPT',
  CONTRACT = 'CONTRACT',
  BANK_STATEMENT = 'BANK_STATEMENT',
  TAX_DECLARATION = 'TAX_DECLARATION',
  PAYROLL = 'PAYROLL',
  CORRESPONDENCE = 'CORRESPONDENCE',
  REPORT = 'REPORT',
  OTHER = 'OTHER'
}

export enum DocumentStatus {
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED'
}

export enum ProcessingStage {
  OCR = 'OCR',
  DATA_EXTRACTION = 'DATA_EXTRACTION',
  CLASSIFICATION = 'CLASSIFICATION',
  VALIDATION = 'VALIDATION',
  INDEXING = 'INDEXING'
}

export enum DocumentSource {
  MANUAL_UPLOAD = 'MANUAL_UPLOAD',
  EMAIL_ATTACHMENT = 'EMAIL_ATTACHMENT',
  API = 'API',
  SCANNER = 'SCANNER',
  BANK_IMPORT = 'BANK_IMPORT',
  INTEGRATION = 'INTEGRATION'
}

// =====================================
// Domain Models
// =====================================

export interface Document {
  id: string;
  organizationId: string;
  
  // Basic information
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  checksum: string;
  
  // Storage
  storageUrl: string;
  thumbnailUrl?: string;
  cdnUrl?: string;
  
  // Classification
  type: DocumentType;
  subType?: string;
  category?: string;
  confidenceScore?: number;
  
  // Status
  status: DocumentStatus;
  processingStage?: ProcessingStage;
  processingErrors?: ProcessingError[];
  
  // Associations
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
  expenseId?: string;
  
  // Extracted data
  extractedData?: ExtractedData;
  ocrText?: string;
  language?: string;
  
  // Metadata
  metadata: DocumentMetadata;
  customFields?: Record<string, any>;
  tags: string[];
  
  // Versioning
  version: number;
  previousVersionId?: string;
  isLatestVersion: boolean;
  
  // Security
  encryptionKey?: string;
  isEncrypted: boolean;
  accessLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  
  // Workflow
  workflowState?: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: Date;
  
  // Source
  source: DocumentSource;
  sourceDetails?: Record<string, any>;
  
  // Timestamps
  uploadedAt: Date;
  processedAt?: Date;
  lastAccessedAt?: Date;
  expiresAt?: Date;
  
  // Audit
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedData {
  // Common fields
  documentDate?: Date;
  documentNumber?: string;
  issuer?: Party;
  recipient?: Party;
  
  // Financial data
  totalAmount?: number;
  netAmount?: number;
  vatAmount?: number;
  currency?: string;
  paymentTerms?: string;
  dueDate?: Date;
  
  // Line items
  lineItems?: LineItem[];
  
  // Bank information
  bankAccount?: string;
  bankName?: string;
  swift?: string;
  
  // Additional extracted fields
  additionalFields?: Record<string, any>;
  
  // Confidence scores
  confidence: {
    overall: number;
    fields: Record<string, number>;
  };
}

export interface Party {
  name: string;
  nip?: string;
  regon?: string;
  address?: Address;
  email?: string;
  phone?: string;
  vatId?: string;
}

export interface LineItem {
  position: number;
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  netAmount?: number;
  vatRate?: number;
  vatAmount?: number;
  grossAmount?: number;
  category?: string;
}

export interface DocumentMetadata {
  title?: string;
  description?: string;
  author?: string;
  keywords?: string[];
  pageCount?: number;
  wordCount?: number;
  creationDate?: Date;
  modificationDate?: Date;
  producer?: string;
  subject?: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  pages: OCRPage[];
  tables?: ExtractedTable[];
  forms?: ExtractedForm[];
  processingTime: number;
  engine: 'GOOGLE_VISION' | 'AWS_TEXTRACT' | 'TESSERACT';
}

export interface OCRPage {
  pageNumber: number;
  text: string;
  width: number;
  height: number;
  blocks: TextBlock[];
  confidence: number;
}

export interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
  words?: Word[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// =====================================
// Service Interfaces
// =====================================

export interface DocumentService {
  // Upload & Storage
  upload(file: UploadFileDto, metadata?: Partial<DocumentMetadata>): Promise<Document>;
  uploadBatch(files: UploadFileDto[]): Promise<BatchUploadResult>;
  downloadDocument(documentId: string): Promise<Buffer>;
  getDocumentStream(documentId: string): Promise<Readable>;
  
  // CRUD Operations
  findById(documentId: string): Promise<Document>;
  findByClient(clientId: string, filters?: DocumentFilters): Promise<Document[]>;
  update(documentId: string, updates: UpdateDocumentDto): Promise<Document>;
  delete(documentId: string): Promise<void>;
  restore(documentId: string): Promise<Document>;
  
  // Processing
  processDocument(documentId: string): Promise<ProcessingResult>;
  reprocessDocument(documentId: string): Promise<ProcessingResult>;
  extractData(documentId: string): Promise<ExtractedData>;
  performOCR(documentId: string): Promise<OCRResult>;
  
  // Classification
  classifyDocument(documentId: string): Promise<DocumentClassification>;
  suggestCategory(documentId: string): Promise<CategorySuggestion[]>;
  trainClassifier(trainingData: TrainingData[]): Promise<TrainingResult>;
  
  // Search
  searchDocuments(query: SearchQuery): Promise<SearchResult>;
  searchByContent(text: string, options?: SearchOptions): Promise<Document[]>;
  findSimilar(documentId: string): Promise<Document[]>;
  
  // Versioning
  createVersion(documentId: string, file: UploadFileDto): Promise<Document>;
  getVersionHistory(documentId: string): Promise<DocumentVersion[]>;
  revertToVersion(documentId: string, versionId: string): Promise<Document>;
  
  // Workflow
  submitForApproval(documentId: string): Promise<ApprovalRequest>;
  approveDocument(documentId: string, comments?: string): Promise<Document>;
  rejectDocument(documentId: string, reason: string): Promise<Document>;
  
  // Export
  exportDocument(documentId: string, format: ExportFormat): Promise<Buffer>;
  generateShareLink(documentId: string, options: ShareOptions): Promise<ShareLink>;
  
  // Bulk Operations
  bulkDelete(documentIds: string[]): Promise<BulkOperationResult>;
  bulkTag(documentIds: string[], tags: string[]): Promise<BulkOperationResult>;
  bulkMove(documentIds: string[], targetFolder: string): Promise<BulkOperationResult>;
}

export interface DocumentProcessor {
  // OCR Processing
  performOCR(file: Buffer, options?: OCROptions): Promise<OCRResult>;
  detectLanguage(text: string): Promise<string>;
  enhanceImage(image: Buffer): Promise<Buffer>;
  
  // Data Extraction
  extractEntities(text: string, documentType: DocumentType): Promise<ExtractedEntities>;
  extractTables(document: Buffer): Promise<ExtractedTable[]>;
  extractForms(document: Buffer): Promise<ExtractedForm[]>;
  extractInvoiceData(document: Buffer): Promise<InvoiceData>;
  
  // Validation
  validateExtractedData(data: ExtractedData, rules: ValidationRules): Promise<ValidationResult>;
  crossCheckWithDatabase(data: ExtractedData): Promise<CrossCheckResult>;
  detectAnomalies(data: ExtractedData): Promise<Anomaly[]>;
  
  // Classification
  classifyDocument(content: string, metadata?: DocumentMetadata): Promise<DocumentClassification>;
  detectDocumentType(file: Buffer): Promise<DocumentType>;
  suggestTags(content: string): Promise<string[]>;
  
  // Quality
  assessQuality(document: Buffer): Promise<QualityAssessment>;
  detectBlurredPages(document: Buffer): Promise<number[]>;
  checkReadability(text: string): Promise<ReadabilityScore>;
}

// =====================================
// Data Transfer Objects
// =====================================

export const UploadFileDto = z.object({
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  buffer: z.instanceof(Buffer),
  clientId: z.string().uuid().optional(),
  type: z.nativeEnum(DocumentType).optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  autoProcess: z.boolean().default(true)
});

export const UpdateDocumentDto = z.object({
  filename: z.string().optional(),
  type: z.nativeEnum(DocumentType).optional(),
  category: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional()
});

export const SearchQueryDto = z.object({
  text: z.string().optional(),
  type: z.nativeEnum(DocumentType).optional(),
  clientId: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  tags: z.array(z.string()).optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  hasExtractedData: z.boolean().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  page: z.number().default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['relevance', 'date', 'name', 'size']).default('relevance')
});

export const OCROptionsDto = z.object({
  language: z.array(z.string()).default(['pl', 'en']),
  detectTables: z.boolean().default(true),
  detectForms: z.boolean().default(false),
  enhanceImage: z.boolean().default(true),
  pageNumbers: z.array(z.number()).optional(),
  engine: z.enum(['GOOGLE_VISION', 'AWS_TEXTRACT', 'TESSERACT']).optional()
});

export type UploadFileDto = z.infer<typeof UploadFileDto>;
export type UpdateDocumentDto = z.infer<typeof UpdateDocumentDto>;
export type SearchQueryDto = z.infer<typeof SearchQueryDto>;
export type OCROptionsDto = z.infer<typeof OCROptionsDto>;

```

### API Endpoints

```typescript
// RESTful API endpoints
export const documentEndpoints = {
  // Document CRUD
  'POST   /api/v1/documents': 'Upload document',
  'POST   /api/v1/documents/batch': 'Batch upload documents',
  'GET    /api/v1/documents': 'List documents',
  'GET    /api/v1/documents/:id': 'Get document details',
  'GET    /api/v1/documents/:id/download': 'Download document',
  'PUT    /api/v1/documents/:id': 'Update document metadata',
  'DELETE /api/v1/documents/:id': 'Delete document',
  'POST   /api/v1/documents/:id/restore': 'Restore deleted document',
  
  // Processing
  'POST   /api/v1/documents/:id/process': 'Process document',
  'POST   /api/v1/documents/:id/reprocess': 'Reprocess document',
  'GET    /api/v1/documents/:id/ocr': 'Get OCR results',
  'GET    /api/v1/documents/:id/extracted-data': 'Get extracted data',
  
  // Classification
  'POST   /api/v1/documents/:id/classify': 'Classify document',
  'GET    /api/v1/documents/:id/suggestions': 'Get category suggestions',
  
  // Search
  'POST   /api/v1/documents/search': 'Search documents',
  'GET    /api/v1/documents/:id/similar': 'Find similar documents',
  
  // Versioning
  'POST   /api/v1/documents/:id/versions': 'Create new version',
  'GET    /api/v1/documents/:id/versions': 'Get version history',
  'POST   /api/v1/documents/:id/versions/:versionId/revert': 'Revert to version',
  
  // Workflow
  'POST   /api/v1/documents/:id/submit-approval': 'Submit for approval',
  'POST   /api/v1/documents/:id/approve': 'Approve document',
  'POST   /api/v1/documents/:id/reject': 'Reject document',
  
  // Export & Sharing
  'GET    /api/v1/documents/:id/export': 'Export document',
  'POST   /api/v1/documents/:id/share': 'Generate share link',
  
  // Bulk Operations
  'POST   /api/v1/documents/bulk/delete': 'Bulk delete',
  'POST   /api/v1/documents/bulk/tag': 'Bulk tag',
  'POST   /api/v1/documents/bulk/move': 'Bulk move',
  
  // Templates
  'GET    /api/v1/documents/templates': 'List templates',
  'POST   /api/v1/documents/templates/:id/apply': 'Apply template'
};

```

----------

## C. Implementation Details

### Main Service Implementation

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { S3 } from 'aws-sdk';
import * as sharp from 'sharp';
import * as crypto from 'crypto';
import { Logger } from 'winston';

@Injectable()
export class DocumentServiceImpl implements DocumentService {
  private readonly PROCESSING_TIMEOUT = 300000; // 5 minutes
  private readonly MAX_FILE_SIZE = 52428800; // 50MB
  private readonly SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  constructor(
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    @Inject('DataSource') private dataSource: DataSource,
    @Inject('S3') private s3: S3,
    @Inject('ElasticsearchClient') private elasticsearch: ElasticsearchClient,
    @Inject('DocumentProcessor') private processor: DocumentProcessor,
    @Inject('ProcessingQueue') private processingQueue: Queue,
    @Inject('Redis') private cache: Redis,
    @Inject('EventEmitter') private eventEmitter: EventEmitter2,
    @Inject('Logger') private logger: Logger,
    @Inject('VirusScanner') private virusScanner: VirusScanner,
    @Inject('AuthContext') private authContext: AuthContext
  ) {}

  // =====================================
  // Document Upload & Storage
  // =====================================

  async upload(file: UploadFileDto, metadata?: Partial<DocumentMetadata>): Promise<Document> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate input
      const validated = UploadFileDto.parse(file);
      
      // Security checks
      await this.performSecurityChecks(validated);
      
      // Generate document ID and storage key
      const documentId = this.generateDocumentId();
      const storageKey = this.generateStorageKey(documentId, validated.filename);
      
      // Calculate checksum
      const checksum = crypto
        .createHash('sha256')
        .update(validated.buffer)
        .digest('hex');
      
      // Check for duplicates
      const duplicate = await this.checkForDuplicate(checksum);
      if (duplicate) {
        this.logger.warn(`Duplicate document detected: ${duplicate.id}`);
        // Could implement deduplication logic here
      }
      
      // Process image if needed (resize, optimize)
      let processedBuffer = validated.buffer;
      let thumbnailBuffer: Buffer | undefined;
      
      if (this.isImage(validated.mimeType)) {
        const processed = await this.processImage(validated.buffer);
        processedBuffer = processed.optimized;
        thumbnailBuffer = processed.thumbnail;
      }
      
      // Upload to S3
      const uploadResult = await this.uploadToS3(
        storageKey,
        processedBuffer,
        validated.mimeType,
        {
          originalFilename: validated.filename,
          documentId,
          checksum
        }
      );
      
      // Upload thumbnail if exists
      let thumbnailUrl: string | undefined;
      if (thumbnailBuffer) {
        const thumbnailKey = `${storageKey}_thumb`;
        const thumbnailResult = await this.uploadToS3(
          thumbnailKey,
          thumbnailBuffer,
          'image/jpeg'
        );
        thumbnailUrl = thumbnailResult.Location;
      }
      
      // Extract initial metadata
      const extractedMetadata = await this.extractMetadata(
        processedBuffer,
        validated.mimeType
      );
      
      // Create document record
      const document = queryRunner.manager.create(Document, {
        id: documentId,
        organizationId: this.authContext.organizationId,
        filename: this.sanitizeFilename(validated.filename),
        originalFilename: validated.filename,
        mimeType: validated.mimeType,
        size: validated.size,
        checksum,
        storageUrl: uploadResult.Location,
        thumbnailUrl,
        cdnUrl: this.getCDNUrl(storageKey),
        type: validated.type || DocumentType.OTHER,
        status: DocumentStatus.UPLOADED,
        clientId: validated.clientId,
        metadata: {
          ...extractedMetadata,
          ...metadata
        },
        tags: validated.tags || [],
        source: DocumentSource.MANUAL_UPLOAD,
        isEncrypted: false,
        accessLevel: 'INTERNAL',
        version: 1,
        isLatestVersion: true,
        uploadedAt: new Date(),
        createdBy: this.authContext.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const savedDocument = await queryRunner.manager.save(document);
      
      // Queue for processing if auto-process is enabled
      if (validated.autoProcess) {
        await this.processingQueue.add('process-document', {
          documentId: savedDocument.id,
          priority: this.getPriorityForDocumentType(savedDocument.type)
        }, {
          priority: 1,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });
        
        savedDocument.status = DocumentStatus.PROCESSING;
        await queryRunner.manager.save(savedDocument);
      }
      
      // Index in Elasticsearch
      await this.indexDocument(savedDocument);
      
      // Emit event
      await this.eventEmitter.emit('document.uploaded', {
        documentId: savedDocument.id,
        filename: savedDocument.filename,
        type: savedDocument.type,
        clientId: savedDocument.clientId,
        uploadedBy: this.authContext.userId
      });
      
      // Audit log
      await this.auditLog('DOCUMENT_UPLOADED', savedDocument.id, {
        filename: savedDocument.filename,
        size: savedDocument.size,
        type: savedDocument.type
      });
      
      await queryRunner.commitTransaction();
      
      this.logger.info(`Document uploaded successfully: ${savedDocument.id}`, {
        documentId: savedDocument.id,
        filename: savedDocument.filename,
        size: savedDocument.size
      });
      
      return savedDocument;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to upload document', error);
      throw new DocumentUploadException('Failed to upload document', error);
    } finally {
      await queryRunner.release();
    }
  }

  // =====================================
  // Document Processing
  // =====================================

  async processDocument(documentId: string): Promise<ProcessingResult> {
    try {
      const document = await this.findById(documentId);
      if (!document) {
        throw new DocumentNotFoundException(`Document ${documentId} not found`);
      }

      // Update status
      await this.updateStatus(documentId, DocumentStatus.PROCESSING, ProcessingStage.OCR);
      
      // Download document from storage
      const buffer = await this.downloadFromS3(document.storageUrl);
      
      // Step 1: Perform OCR
      const ocrResult = await this.performOCR(documentId);
      await this.updateStatus(documentId, DocumentStatus.PROCESSING, ProcessingStage.DATA_EXTRACTION);
      
      // Step 2: Extract structured data
      const extractedData = await this.extractDataFromOCR(
        ocrResult,
        document.type
      );
      await this.updateStatus(documentId, DocumentStatus.PROCESSING, ProcessingStage.CLASSIFICATION);
      
      // Step 3: Classify document
      const classification = await this.classifyDocument(documentId);
      await this.updateStatus(documentId, DocumentStatus.PROCESSING, ProcessingStage.VALIDATION);
      
      // Step 4: Validate extracted data
      const validationResult = await this.validateExtractedData(
        extractedData,
        document.type
      );
      
      // Step 5: Enrich data
      const enrichedData = await this.enrichExtractedData(
        extractedData,
        document
      );
      
      // Update document with results
      const updatedDocument = await this.documentRepo.save({
        ...document,
        ocrText: ocrResult.text,
        extractedData: enrichedData,
        type: classification.type,
        category: classification.category,
        confidenceScore: classification.confidence,
        status: DocumentStatus.PROCESSED,
        processingStage: undefined,
        processedAt: new Date(),
        language: ocrResult.language
      });
      
      // Update search index
      await this.indexDocument(updatedDocument);
      
      // Cache results
      await this.cacheProcessingResults(documentId, {
        ocr: ocrResult,
        extractedData: enrichedData,
        classification
      });
      
      // Trigger workflows based on document type
      await this.triggerDocumentWorkflows(updatedDocument);
      
      // Emit processing complete event
      await this.eventEmitter.emit('document.processed', {
        documentId,
        type: classification.type,
        extractedData: enrichedData,
        confidence: classification.confidence
      });
      
      const result: ProcessingResult = {
        documentId,
        status: 'SUCCESS',
        ocr: ocrResult,
        extractedData: enrichedData,
        classification,
        validation: validationResult,
        processingTime: Date.now() - document.uploadedAt.getTime()
      };
      
      this.logger.info(`Document processed successfully: ${documentId}`, {
        documentId,
        processingTime: result.processingTime,
        confidence: classification.confidence
      });
      
      return result;

    } catch (error) {
      await this.handleProcessingError(documentId, error);
      throw error;
    }
  }

  async performOCR(documentId: string): Promise<OCRResult> {
    try {
      const document = await this.findById(documentId);
      const buffer = await this.downloadFromS3(document.storageUrl);
      
      // Check cache first
      const cacheKey = `ocr:${document.checksum}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Perform OCR using the processor
      const ocrResult = await this.processor.performOCR(buffer, {
        language: ['pl', 'en'],
        detectTables: true,
        detectForms: document.type === DocumentType.TAX_DECLARATION,
        enhanceImage: true
      });
      
      // Post-process OCR text
      const processedResult = await this.postProcessOCR(ocrResult);
      
      // Cache results
      await this.cache.setex(
        cacheKey,
        86400, // 24 hours
        JSON.stringify(processedResult)
      );
      
      return processedResult;

    } catch (error) {
      this.logger.error(`OCR failed for document ${documentId}`, error);
      throw new OCRException('OCR processing failed', error);
    }
  }

  async extractData(documentId: string): Promise<ExtractedData> {
    try {
      const document = await this.findById(documentId);
      
      // Get OCR text
      let ocrText = document.ocrText;
      if (!ocrText) {
        const ocrResult = await this.performOCR(documentId);
        ocrText = ocrResult.text;
      }
      
      // Extract entities based on document type
      let extractedData: ExtractedData;
      
      switch (document.type) {
        case DocumentType.INVOICE:
          extractedData = await this.extractInvoiceData(ocrText, document);
          break;
        case DocumentType.RECEIPT:
          extractedData = await this.extractReceiptData(ocrText, document);
          break;
        case DocumentType.CONTRACT:
          extractedData = await this.extractContractData(ocrText, document);
          break;
        case DocumentType.BANK_STATEMENT:
          extractedData = await this.extractBankStatementData(ocrText, document);
          break;
        default:
          extractedData = await this.extractGenericData(ocrText, document);
      }
      
      // Validate against business rules
      const validated = await this.validateBusinessRules(extractedData, document.type);
      
      // Cross-check with database
      const crossChecked = await this.crossCheckExtractedData(validated);
      
      return crossChecked;

    } catch (error) {
      this.logger.error(`Data extraction failed for document ${documentId}`, error);
      throw new DataExtractionException('Failed to extract data', error);
    }
  }

  private async extractInvoiceData(text: string, document: Document): Promise<ExtractedData> {
    // Use ML model for invoice extraction
    const entities = await this.processor.extractEntities(text, DocumentType.INVOICE);
    
    // Parse invoice-specific fields
    const invoiceNumber = this.extractPattern(text, /(?:faktura|invoice)[\s\S]{0,20}?(\S+\d+\S*)/i);
    const invoiceDate = this.extractDate(text, /(?:data wystawienia|issue date)[\s\S]{0,20}?(\d{2}[-/.]\d{2}[-/.]\d{4})/i);
    const dueDate = this.extractDate(text, /(?:termin płatności|due date)[\s\S]{0,20}?(\d{2}[-/.]\d{2}[-/.]\d{4})/i);
    
    // Extract parties
    const issuer = await this.extractParty(text, 'ISSUER');
    const recipient = await this.extractParty(text, 'RECIPIENT');
    
    // Extract amounts
    const amounts = await this.extractAmounts(text);
    
    // Extract line items
    const lineItems = await this.extractLineItems(text);
    
    // Calculate confidence
    const confidence = this.calculateExtractionConfidence({
      invoiceNumber: !!invoiceNumber,
      invoiceDate: !!invoiceDate,
      issuer: !!issuer?.name,
      totalAmount: !!amounts.total
    });
    
    return {
      documentNumber: invoiceNumber,
      documentDate: invoiceDate,
      dueDate,
      issuer,
      recipient,
      totalAmount: amounts.total,
      netAmount: amounts.net,
      vatAmount: amounts.vat,
      currency: amounts.currency || 'PLN',
      lineItems,
      bankAccount: this.extractBankAccount(text),
      confidence: {
        overall: confidence,
        fields: {
          documentNumber: invoiceNumber ? 0.9 : 0,
          totalAmount: amounts.total ? 0.95 : 0,
          issuer: issuer?.name ? 0.85 : 0
        }
      },
      additionalFields: entities.additionalFields
    };
  }

  // =====================================
  // Search Implementation
  // =====================================

  async searchDocuments(query: SearchQueryDto): Promise<SearchResult> {
    try {
      const searchBody: any = {
        from: (query.page - 1) * query.limit,
        size: query.limit,
        query: {
          bool: {
            must: [],
            filter: []
          }
        },
        highlight: {
          fields: {
            'content': {},
            'metadata.title': {},
            'extractedData.documentNumber': {}
          }
        },
        aggs: {
          types: {
            terms: { field: 'type.keyword' }
          },
          clients: {
            terms: { field: 'clientId.keyword' }
          },
          dateRange: {
            date_histogram: {
              field: 'uploadedAt',
              calendar_interval: 'month'
            }
          }
        }
      };
      
      // Add text search
      if (query.text) {
        searchBody.query.bool.must.push({
          multi_match: {
            query: query.text,
            fields: [
              'content^3',
              'metadata.title^2',
              'extractedData.documentNumber^2',
              'tags',
              'filename'
            ],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        });
      }
      
      // Add filters
      if (query.type) {
        searchBody.query.bool.filter.push({
          term: { 'type.keyword': query.type }
        });
      }
      
      if (query.clientId) {
        searchBody.query.bool.filter.push({
          term: { 'clientId.keyword': query.clientId }
        });
      }
      
      if (query.dateFrom || query.dateTo) {
        const dateFilter: any = { range: { uploadedAt: {} } };
        if (query.dateFrom) dateFilter.range.uploadedAt.gte = query.dateFrom;
        if (query.dateTo) dateFilter.range.uploadedAt.lte = query.dateTo;
        searchBody.query.bool.filter.push(dateFilter);
      }
      
      if (query.tags && query.tags.length > 0) {
        searchBody.query.bool.filter.push({
          terms: { 'tags.keyword': query.tags }
        });
      }
      
      // Add sorting
      const sortMap: Record<string, any> = {
        relevance: ['_score', { uploadedAt: 'desc' }],
        date: [{ uploadedAt: 'desc' }],
        name: [{ 'filename.keyword': 'asc' }],
        size: [{ size: 'desc' }]
      };
      searchBody.sort = sortMap[query.sortBy || 'relevance'];
      
      // Execute search
      const response = await this.elasticsearch.search({
        index: 'documents',
        body: searchBody
      });
      
      // Process results
      const documents = await Promise.all(
        response.body.hits.hits.map(async (hit: any) => {
          const doc = await this.findById(hit._id);
          return {
            ...doc,
            _score: hit._score,
            _highlight: hit.highlight
          };
        })
      );
      
      return {
        documents,
        total: response.body.hits.total.value,
        page: query.page,
        pageSize: query.limit,
        aggregations: response.body.aggregations
      };

    } catch (error) {
      this.logger.error('Document search failed', error);
      throw new SearchException('Failed to search documents', error);
    }
  }

  // =====================================
  // Helper Methods
  // =====================================

  private async performSecurityChecks(file: UploadFileDto): Promise<void> {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new FileSizeException(`File size exceeds maximum of ${this.MAX_FILE_SIZE} bytes`);
    }
    
    // Check mime type
    if (!this.SUPPORTED_MIME_TYPES.includes(file.mimeType)) {
      throw new UnsupportedFileTypeException(`Unsupported file type: ${file.mimeType}`);
    }
    
    // Scan for viruses
    const scanResult = await this.virusScanner.scan(file.buffer);
    if (scanResult.infected) {
      throw new VirusDetectedException(`Virus detected: ${scanResult.virus}`);
    }
    
    // Check for malicious content patterns
    if (this.containsMaliciousPatterns(file.buffer)) {
      throw new MaliciousContentException('Potentially malicious content detected');
    }
  }

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<any> {
    const params = {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: metadata || {},
      ServerSideEncryption: 'AES256',
      StorageClass: 'INTELLIGENT_TIERING'
    };
    
    return await this.s3.upload(params).promise();
  }

  private async indexDocument(document: Document): Promise<void> {
    try {
      await this.elasticsearch.index({
        index: 'documents',
        id: document.id,
        body: {
          id: document.id,
          filename: document.filename,
          type: document.type,
          status: document.status,
          clientId: document.clientId,
          content: document.ocrText || '',
          metadata: document.metadata,
          extractedData: document.extractedData,
          tags: document.tags,
          uploadedAt: document.uploadedAt,
          processedAt: document.processedAt,
          size: document.size,
          organizationId: document.organizationId
        }
      });
    } catch (error) {
      this.logger.error(`Failed to index document ${document.id}`, error);
      // Non-critical error, don't throw
    }
  }

  private async processImage(buffer: Buffer): Promise<{ optimized: Buffer; thumbnail: Buffer }> {
    const image = sharp(buffer);
    
    // Optimize original
    const optimized = await image
      .rotate() // Auto-rotate based on EXIF
      .resize(2048, 2048, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85,
        progressive: true 
      })
      .toBuffer();
    
    // Create thumbnail
    const thumbnail = await sharp(buffer)
      .resize(200, 200, { 
        fit: 'cover',
        position: 'center' 
      })
      .jpeg({ quality: 70 })
      .toBuffer();
    
    return { optimized, thumbnail };
  }

  private generateDocumentId(): string {
    return crypto.randomUUID();
  }

  private generateStorageKey(documentId: string, filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const extension = filename.split('.').pop();
    
    return `${this.authContext.organizationId}/${year}/${month}/${documentId}.${extension}`;
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }

  private getCDNUrl(storageKey: string): string {
    return `${process.env.CDN_URL}/${storageKey}`;
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private getPriorityForDocumentType(type: DocumentType): number {
    const priorityMap: Record<DocumentType, number> = {
      [DocumentType.INVOICE]: 1,
      [DocumentType.TAX_DECLARATION]: 1,
      [DocumentType.BANK_STATEMENT]: 2,
      [DocumentType.CONTRACT]: 2,
      [DocumentType.RECEIPT]: 3,
      [DocumentType.PAYROLL]: 3,
      [DocumentType.CORRESPONDENCE]: 4,
      [DocumentType.REPORT]: 4,
      [DocumentType.OTHER]: 5
    };
    return priorityMap[type] || 5;
  }

  private async auditLog(action: string, entityId: string, metadata?: any): Promise<void> {
    // Implementation would call audit service
    this.logger.info('Audit log', { action, entityId, metadata });
  }
}

// =====================================
// Document Processor Implementation
// =====================================

@Injectable()
export class DocumentProcessorImpl implements DocumentProcessor {
  constructor(
    @Inject('GoogleVisionClient') private googleVision: any,
    @Inject('AWSTextract') private textract: any,
    @Inject('TesseractWorker') private tesseract: any,
    @Inject('MLService') private mlService: MLService,
    @Inject('Logger') private logger: Logger
  ) {}

  async performOCR(file: Buffer, options?: OCROptionsDto): Promise<OCRResult> {
    const validated = options ? OCROptionsDto.parse(options) : OCROptionsDto.parse({});
    const engine = validated.engine || this.selectBestEngine(file);
    
    let result: OCRResult;
    const startTime = Date.now();
    
    try {
      switch (engine) {
        case 'GOOGLE_VISION':
          result = await this.performGoogleVisionOCR(file, validated);
          break;
        case 'AWS_TEXTRACT':
          result = await this.performTextractOCR(file, validated);
          break;
        case 'TESSERACT':
          result = await this.performTesseractOCR(file, validated);
          break;
        default:
          throw new Error(`Unsupported OCR engine: ${engine}`);
      }
      
      result.processingTime = Date.now() - startTime;
      result.engine = engine;
      
      // Post-process to improve quality
      result.text = this.cleanOCRText(result.text);
      
      return result;

    } catch (error) {
      this.logger.error(`OCR failed with engine ${engine}`, error);
      
      // Fallback to alternative engine
      if (engine !== 'TESSERACT') {
        this.logger.info('Falling back to Tesseract OCR');
        return this.performTesseractOCR(file, validated);
      }
      
      throw error;
    }
  }

  private async performGoogleVisionOCR(file: Buffer, options: OCROptionsDto): Promise<OCRResult> {
    const [result] = await this.googleVision.documentTextDetection({
      image: { content: file.toString('base64') },
      imageContext: {
        languageHints: options.language
      }
    });
    
    const fullText = result.fullTextAnnotation;
    
    return {
      text: fullText.text,
      confidence: this.calculateConfidence(fullText.pages),
      language: this.detectPrimaryLanguage(fullText.pages),
      pages: this.mapGoogleVisionPages(fullText.pages),
      tables: options.detectTables ? await this.extractTablesFromGoogleVision(result) : undefined,
      processingTime: 0,
      engine: 'GOOGLE_VISION'
    };
  }

  async extractInvoiceData(document: Buffer): Promise<InvoiceData> {
    // Perform specialized invoice extraction
    const ocrResult = await this.performOCR(document, {
      language: ['pl'],
      detectTables: true,
      detectForms: true
    });
    
    // Use custom ML model for Polish invoices
    const extractedData = await this.mlService.runInference('polish-invoice-model', {
      text: ocrResult.text,
      tables: ocrResult.tables
    });
    
    return this.mapToInvoiceData(extractedData);
  }

  async classifyDocument(content: string, metadata?: DocumentMetadata): Promise<DocumentClassification> {
    // Use BERT-based classifier
    const classification = await this.mlService.classify('document-classifier', {
      text: content,
      metadata
    });
    
    return {
      type: classification.primaryClass as DocumentType,
      category: classification.secondaryClass,
      confidence: classification.confidence,
      alternatives: classification.alternatives
    };
  }

  private cleanOCRText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\S\r\n]+/g, ' ') // Remove extra spaces but keep line breaks
      .trim();
  }

  private selectBestEngine(file: Buffer): 'GOOGLE_VISION' | 'AWS_TEXTRACT' | 'TESSERACT' {
    // Logic to select best OCR engine based on file characteristics
    // For now, default to Google Vision
    return 'GOOGLE_VISION';
  }

  private calculateConfidence(pages: any[]): number {
    // Calculate average confidence from pages
    const confidences = pages.flatMap(page => 
      page.blocks?.map((block: any) => block.confidence) || []
    );
    
    if (confidences.length === 0) return 0;
    
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  private detectPrimaryLanguage(pages: any[]): string {
    // Detect primary language from OCR results
    // Default to Polish for this implementation
    return 'pl';
  }
}

// =====================================
// Custom Exceptions
// =====================================

export class DocumentException extends Error {
  constructor(message: string, public cause?: any) {
    super(message);
    this.name = 'DocumentException';
  }
}

export class DocumentNotFoundException extends DocumentException {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentNotFoundException';
  }
}

export class DocumentUploadException extends DocumentException {
  constructor(message: string, cause?: any) {
    super(message, cause);
    this.name = 'DocumentUploadException';
  }
}

export class OCRException extends DocumentException {
  constructor(message: string, cause?: any) {
    super(message, cause);
    this.name = 'OCRException';
  }
}

export class DataExtractionException extends DocumentException {
  constructor(message: string, cause?: any) {
    super(message, cause);
    this.name = 'DataExtractionException';
  }
}

export class FileSizeException extends DocumentException {
  constructor(message: string) {
    super(message);
    this.name = 'FileSizeException';
  }
}

export class UnsupportedFileTypeException extends DocumentException {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileTypeException';
  }
}

export class VirusDetectedException extends DocumentException {
  constructor(message: string) {
    super(message);
    this.name = 'VirusDetectedException';
  }
}

export class MaliciousContentException extends DocumentException {
  constructor(message: string) {
    super(message);
    this.name = 'MaliciousContentException';
  }
}

export class SearchException extends DocumentException {
  constructor(message: string, cause?: any) {
    super(message, cause);
    this.name = 'SearchException';
  }
}

```

----------

## D. Database Schema

```sql
-- =====================================
-- Documents Table
-- =====================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- File information
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  
  -- Storage URLs
  storage_url TEXT NOT NULL,
  thumbnail_url TEXT,
  cdn_url TEXT,
  
  -- Classification
  type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  sub_type VARCHAR(50),
  category VARCHAR(100),
  confidence_score DECIMAL(3,2),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
  processing_stage VARCHAR(50),
  processing_errors JSONB DEFAULT '[]',
  
  -- Associations
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  invoice_id UUID REFERENCES invoices(id),
  expense_id UUID REFERENCES expenses(id),
  
  -- OCR Results
  ocr_text TEXT,
  language VARCHAR(10),
  
  -- Extracted data
  extracted_data JSONB,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID REFERENCES documents(id),
  is_latest_version BOOLEAN DEFAULT TRUE,
  
  -- Security
  encryption_key VARCHAR(255),
  is_encrypted BOOLEAN DEFAULT FALSE,
  access_level VARCHAR(20) DEFAULT 'INTERNAL',
  
  -- Workflow
  workflow_state VARCHAR(50),
  approval_status VARCHAR(20),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  -- Source tracking
  source VARCHAR(50) NOT NULL DEFAULT 'MANUAL_UPLOAD',
  source_details JSONB,
  
  -- Timestamps
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  last_accessed_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_documents_org (organization_id),
  INDEX idx_documents_client (client_id),
  INDEX idx_documents_type (type),
  INDEX idx_documents_status (status),
  INDEX idx_documents_checksum (checksum),
  INDEX idx_documents_uploaded (uploaded_at DESC),
  INDEX idx_documents_tags USING GIN (tags),
  
  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('polish', COALESCE(filename, '')), 'A') ||
    setweight(to_tsvector('polish', COALESCE(ocr_text, '')), 'B') ||
    setweight(to_tsvector('polish', COALESCE(metadata->>'title', '')), 'C')
  ) STORED,
  
  INDEX idx_documents_search USING GIN (search_vector)
);

-- =====================================
-- Document Processing Queue
-- =====================================
CREATE TABLE document_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  
  -- Queue management
  priority INTEGER NOT NULL DEFAULT 5,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Processing details
  processor VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_queue_status_priority (status, priority),
  INDEX idx_queue_document (document_id)
);

-- =====================================
-- Document Templates
-- =====================================
CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Template info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  
  -- Template structure
  field_mappings JSONB NOT NULL,
  extraction_rules JSONB,
  validation_rules JSONB,
  
  -- Sample document
  sample_document_id UUID REFERENCES documents(id),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Usage statistics
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2),
  
  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(organization_id, name),
  INDEX idx_templates_type (type)
);

-- =====================================
-- Document Relationships
-- =====================================
CREATE TABLE document_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship
  parent_document_id UUID NOT NULL REFERENCES documents(id),
  child_document_id UUID NOT NULL REFERENCES documents(id),
  relationship_type VARCHAR(50) NOT NULL, -- 'ATTACHMENT', 'VERSION', 'RELATED', 'CORRECTION'
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(parent_document_id, child_document_id, relationship_type),
  CHECK (parent_document_id != child_document_id)
);

-- =====================================
-- Document Share Links
-- =====================================
CREATE TABLE document_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  
  -- Share details
  share_token VARCHAR(255) NOT NULL UNIQUE,
  access_type VARCHAR(20) NOT NULL DEFAULT 'VIEW', -- 'VIEW', 'DOWNLOAD'
  password_hash VARCHAR(255),
  
  -- Restrictions
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  
  -- Access log
  last_accessed_at TIMESTAMP,
  last_accessed_by_ip VARCHAR(45),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),
  
  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_share_token (share_token),
  INDEX idx_share_document (document_id),
  INDEX idx_share_expires (expires_at)
);

-- =====================================
-- Document Access Log
-- =====================================
CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  
  -- Access details
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'VIEW', 'DOWNLOAD', 'EDIT', 'DELETE', 'SHARE'
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Context
  session_id VARCHAR(255),
  metadata JSONB,
  
  -- Timestamp
  accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_access_document (document_id),
  INDEX idx_access_user (user_id),
  INDEX idx_access_time (accessed_at DESC)
);

```

----------

## E. Testing Strategy

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentServiceImpl } from './document.service';
import { Repository } from 'typeorm';

describe('DocumentService', () => {
  let service: DocumentServiceImpl;
  let mockRepo: jest.Mocked<Repository<Document>>;
  let mockS3: jest.Mocked<S3>;
  let mockProcessor: jest.Mocked<DocumentProcessor>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentServiceImpl,
        {
          provide: 'DocumentRepository',
          useValue: createMockRepository()
        },
        {
          provide: 'S3',
          useValue: createMockS3()
        },
        {
          provide: 'DocumentProcessor',
          useValue: createMockProcessor()
        }
      ]
    }).compile();

    service = module.get<DocumentServiceImpl>(DocumentServiceImpl);
    mockRepo = module.get('DocumentRepository');
    mockS3 = module.get('S3');
    mockProcessor = module.get('DocumentProcessor');
  });

  describe('upload', () => {
    it('should successfully upload and process a document', async () => {
      // Arrange
      const file: UploadFileDto = {
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
        clientId: 'test-client-id',
        type: DocumentType.INVOICE,
        tags: ['urgent'],
        autoProcess: true
      };

      mockS3.upload.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://s3.example.com/invoice.pdf'
        })
      } as any);

      mockRepo.save.mockResolvedValue({
        id: 'doc-id',
        filename: 'invoice.pdf',
        status: DocumentStatus.UPLOADED
      } as any);

      // Act
      const result = await service.upload(file);

      // Assert
      expect(result).toBeDefined();
      expect(result.filename).toBe('invoice.pdf');
      expect(result.type).toBe(DocumentType.INVOICE);
      expect(mockS3.upload).toHaveBeenCalled();
    });

    it('should reject oversized files', async () => {
      // Arrange
      const file: UploadFileDto = {
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        size: 100000000, // 100MB
        buffer: Buffer.from('test'),
        autoProcess: false
      };

      // Act & Assert
      await expect(service.upload(file)).rejects.toThrow(FileSizeException);
    });
  });

  describe('processDocument', () => {
    it('should process document through OCR and extraction pipeline', async () => {
      // Arrange
      const documentId = 'test-doc-id';
      const mockDocument = {
        id: documentId,
        type: DocumentType.INVOICE,
        storageUrl: 'https://s3.example.com/doc.pdf',
        uploadedAt: new Date()
      };

      mockRepo.findOne.mockResolvedValue(mockDocument as any);

      mockProcessor.performOCR.mockResolvedValue({
        text: 'Invoice #123',
        confidence: 0.95,
        language: 'pl'
      } as any);

      mockProcessor.extractEntities.mockResolvedValue({
        documentNumber: 'INV-123',
        totalAmount: 1000
      } as any);

      mockProcessor.classifyDocument.mockResolvedValue({
        type: DocumentType.INVOICE,
        confidence: 0.9
      } as any);

      // Act
      const result = await service.processDocument(documentId);

      // Assert
      expect(result.status).toBe('SUCCESS');
      expect(result.extractedData).toBeDefined();
      expect(mockProcessor.performOCR).toHaveBeenCalled();
    });
  });

  describe('searchDocuments', () => {
    it('should search documents with filters', async () => {
      // Arrange
      const query: SearchQueryDto = {
        text: 'invoice',
        type: DocumentType.INVOICE,
        clientId: 'client-123',
        page: 1,
        limit: 20
      };

      const mockSearchResult = {
        body: {
          hits: {
            total: { value: 1 },
            hits: [{
              _id: 'doc-1',
              _score: 0.9,
              highlight: { content: ['<em>invoice</em>'] }
            }]
          },
          aggregations: {}
        }
      };

      // Mock Elasticsearch
      const mockElasticsearch = {
        search: jest.fn().mockResolvedValue(mockSearchResult)
      };
      (service as any).elasticsearch = mockElasticsearch;

      mockRepo.findOne.mockResolvedValue({
        id: 'doc-1',
        filename: 'invoice.pdf'
      } as any);

      // Act
      const result = await service.searchDocuments(query);

      // Assert
      expect(result.total).toBe(1);
      expect(result.documents).toHaveLength(1);
      expect(mockElasticsearch.search).toHaveBeenCalled();
    });
  });
});

```

### Integration Tests

```typescript
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

describe('Document API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/api/v1/documents', () => {
    it('should upload a document', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .attach('file', 'test/fixtures/invoice.pdf')
        .field('type', 'INVOICE')
        .field('clientId', 'test-client')
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('INVOICE');
      expect(response.body.status).toBe('PROCESSING');
    });

    it('should search documents', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/documents/search')
        .send({
          text: 'invoice',
          type: 'INVOICE',
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.documents)).toBe(true);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});

```

----------

## F. Deployment Considerations

### Resource Requirements

```yaml
Development:
  CPU: 2 cores
  Memory: 4GB
  Storage: 50GB (local)
  Elasticsearch: 1 node (2GB)
  Redis: 1GB
  
Production:
  CPU: 4-8 cores
  Memory: 8-16GB
  Storage: S3 (unlimited)
  Elasticsearch: 3 nodes (4GB each)
  Redis: 4GB cluster
  Queue Workers: 2-4 instances
  
OCR Services:
  Google Vision API: 1000 requests/month free tier
  AWS Textract: Pay per page
  Rate limits: 10 requests/second

```

### Performance Optimization

-   **Image Optimization**: Resize and compress images before storage
-   **Async Processing**: Queue all heavy operations
-   **Caching Strategy**: Cache OCR results, extracted data, search results
-   **CDN Integration**: Serve documents through CDN
-   **Database Indexes**: Optimize for common queries
-   **Elasticsearch Tuning**: Configure analyzers for Polish language

### Security Considerations

-   **Encryption**: AES-256 for documents at rest
-   **Virus Scanning**: ClamAV integration for all uploads
-   **Access Control**: Fine-grained permissions per document
-   **Audit Trail**: Complete logging of all document access
-   **DLP**: Prevent sensitive data leakage
-   **Secure Sharing**: Time-limited, password-protected links

### External Service SLAs

-   **S3**: 99.99% availability
-   **Google Vision API**: 99.9% availability
-   **AWS Textract**: 99.9% availability
-   **Elasticsearch**: 99.95% availability (self-hosted)

----------

This comprehensive Document Intelligence Hub specification provides a production-ready document processing system with advanced OCR, AI-powered extraction, and intelligent search capabilities, specifically optimized for Polish accounting documents.
