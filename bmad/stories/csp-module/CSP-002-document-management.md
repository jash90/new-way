# CSP-002: Document Management

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | CSP-002 |
| Epic | Client Self-Service Portal |
| Priority | P0 |
| Story Points | 8 |
| Status | Draft |
| Dependencies | DOC (Document Intelligence), AIM (Authentication) |

## User Story

**As a** client,
**I want to** securely upload, browse, and download documents through the portal,
**So that** I can exchange financial documents with my accountant without using insecure email.

## Acceptance Criteria

### AC1: Document Upload
```gherkin
Feature: Document Upload

  Scenario: Upload single document via drag-and-drop
    Given I am logged into the client portal
    When I drag a file onto the upload zone
    Then the file should be uploaded with a progress indicator
    And I should see upload completion notification
    And the document should appear in my document list

  Scenario: Upload multiple documents
    Given I am on the documents page
    When I select multiple files for upload
    Then all files should be uploaded in parallel
    And I should see individual progress for each file
    And I should see a summary when all uploads complete

  Scenario: Validate file constraints
    Given I attempt to upload a file
    When the file exceeds 50MB
    Then I should see an error message "Plik przekracza maksymalny rozmiar 50MB"
    And the upload should be rejected

  Scenario: Validate file types
    Given I attempt to upload a file
    When the file type is not allowed
    Then I should see an error message listing allowed types
    And only these types should be accepted:
      | Type | Extensions |
      | PDF | .pdf |
      | Images | .jpg, .jpeg, .png |
      | Excel | .xls, .xlsx |
      | CSV | .csv |
      | Word | .doc, .docx |
```

### AC2: Document Categorization
```gherkin
Feature: Document Categorization

  Scenario: Select document category during upload
    Given I am uploading a document
    When I select a category from the dropdown
    Then the document should be tagged with that category
    And available categories should include:
      | Category | Polish Label |
      | INVOICE | Faktura |
      | RECEIPT | Paragon |
      | BANK_STATEMENT | Wyciąg bankowy |
      | CONTRACT | Umowa |
      | TAX_RETURN | Deklaracja podatkowa |
      | PAYROLL | Dokumenty kadrowe |
      | OTHER | Inne |

  Scenario: AI-assisted categorization
    Given I upload a document without selecting category
    When the system analyzes the document
    Then it should suggest the most likely category
    And I can accept or change the suggestion
```

### AC3: Document Browsing
```gherkin
Feature: Document Browsing

  Scenario: View document list
    Given I am on the documents page
    Then I should see a paginated list of my documents
    And each document should show:
      | Field | Description |
      | Name | File name |
      | Category | Document category |
      | Size | File size |
      | Date | Upload date |
      | Status | Processing status |

  Scenario: Filter documents
    Given I am viewing my documents
    When I apply filters
    Then I can filter by:
      | Filter | Options |
      | Category | All categories |
      | Tax Year | 2020-2025 |
      | Upload Date | Date range |
      | Status | All, Processing, Ready |

  Scenario: Search documents
    Given I am viewing my documents
    When I enter a search term
    Then documents should be filtered by name and description
    And search should support partial matches
```

### AC4: Document Preview
```gherkin
Feature: Document Preview

  Scenario: Preview PDF document
    Given I am viewing the document list
    When I click the preview button on a PDF
    Then a preview modal should open
    And I should see the document content
    And I can navigate between pages

  Scenario: Preview image document
    Given I click preview on an image file
    Then the image should display in a lightbox
    And I can zoom in/out
```

### AC5: Document Download
```gherkin
Feature: Document Download

  Scenario: Download single document
    Given I am viewing the document list
    When I click download on a document
    Then the file should download to my device
    And the download should be logged in activity

  Scenario: Download multiple documents
    Given I have selected multiple documents
    When I click "Download Selected"
    Then all documents should be downloaded as a ZIP file
```

### AC6: Document Version History
```gherkin
Feature: Document Versioning

  Scenario: Upload new version
    Given I have an existing document
    When I upload a file with the same name
    Then I should be asked to create a new version or replace
    And version history should be maintained

  Scenario: View version history
    Given a document has multiple versions
    When I view the document details
    Then I should see all version history
    And I can download any previous version
```

### AC7: Virus Scanning
```gherkin
Feature: Security Scanning

  Scenario: Scan uploaded files
    Given I upload a document
    When the upload completes
    Then the file should be scanned for viruses
    And if infected, the file should be quarantined
    And I should be notified of the scan result
```

## Technical Specification

### Database Schema

```sql
-- Portal documents table (extending base schema)
CREATE TABLE portal_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),

  -- File metadata
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  extension VARCHAR(20) NOT NULL,

  -- Categorization
  category VARCHAR(50) NOT NULL,
  ai_suggested_category VARCHAR(50),
  ai_confidence DECIMAL(3,2),
  tax_year INTEGER,
  description TEXT,
  tags JSONB DEFAULT '[]',

  -- Storage
  s3_bucket VARCHAR(100) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  s3_version_id VARCHAR(100),
  thumbnail_s3_key VARCHAR(500),

  -- Security
  checksum_sha256 VARCHAR(64) NOT NULL,
  encrypted BOOLEAN DEFAULT true,
  encryption_key_id VARCHAR(100),

  -- Versioning
  version INTEGER DEFAULT 1,
  parent_document_id UUID REFERENCES portal_documents(document_id),
  is_latest_version BOOLEAN DEFAULT true,

  -- Status
  status VARCHAR(20) DEFAULT 'PROCESSING',
  scan_status VARCHAR(20) DEFAULT 'PENDING',
  scan_result JSONB,

  -- Audit
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID NOT NULL,
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  modified_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  CONSTRAINT chk_status CHECK (status IN ('PROCESSING', 'READY', 'QUARANTINED', 'DELETED')),
  CONSTRAINT chk_scan_status CHECK (scan_status IN ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR'))
);

-- Document access log for audit
CREATE TABLE portal_document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  document_id UUID NOT NULL REFERENCES portal_documents(document_id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  action VARCHAR(50) NOT NULL, -- 'VIEW', 'DOWNLOAD', 'PREVIEW'
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_portal_docs_client ON portal_documents(tenant_id, client_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_portal_docs_category ON portal_documents(tenant_id, client_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_portal_docs_tax_year ON portal_documents(tenant_id, client_id, tax_year) WHERE deleted_at IS NULL;
CREATE INDEX idx_portal_docs_search ON portal_documents USING gin(to_tsvector('simple', file_name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_portal_docs_parent ON portal_documents(parent_document_id) WHERE parent_document_id IS NOT NULL;
CREATE INDEX idx_portal_doc_access ON portal_document_access_log(tenant_id, document_id, accessed_at DESC);

-- Row Level Security
ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY portal_documents_client_isolation ON portal_documents
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id')::UUID
    AND client_id = current_setting('app.client_id')::UUID
  );
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Document categories
export const documentCategorySchema = z.enum([
  'INVOICE',
  'RECEIPT',
  'BANK_STATEMENT',
  'CONTRACT',
  'TAX_RETURN',
  'PAYROLL',
  'CORRESPONDENCE',
  'OTHER',
]);

// Allowed file types
export const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

// Upload document input
export const uploadDocumentInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(allowedMimeTypes),
  fileSize: z.number().max(50 * 1024 * 1024, 'File must be less than 50MB'),
  category: documentCategorySchema,
  taxYear: z.number().min(2000).max(2030).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  parentDocumentId: z.string().uuid().optional(), // For versioning
});

// Get presigned upload URL
export const getUploadUrlInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(allowedMimeTypes),
  fileSize: z.number().max(50 * 1024 * 1024),
});

export const getUploadUrlOutputSchema = z.object({
  uploadUrl: z.string().url(),
  documentId: z.string().uuid(),
  expiresAt: z.coerce.date(),
  fields: z.record(z.string()), // S3 presigned POST fields
});

// Complete upload (after S3 upload)
export const completeUploadInputSchema = z.object({
  documentId: z.string().uuid(),
  checksumSha256: z.string().length(64),
  category: documentCategorySchema,
  taxYear: z.number().min(2000).max(2030).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// List documents input
export const listDocumentsInputSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(100).default(20),
  category: documentCategorySchema.optional(),
  taxYear: z.number().optional(),
  status: z.enum(['PROCESSING', 'READY', 'QUARANTINED']).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['uploadedAt', 'fileName', 'fileSize', 'category']).default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Document response
export const documentSchema = z.object({
  documentId: z.string().uuid(),
  fileName: z.string(),
  originalName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  category: documentCategorySchema,
  categoryLabel: z.string(),
  taxYear: z.number().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  status: z.string(),
  scanStatus: z.string(),
  version: z.number(),
  hasVersionHistory: z.boolean(),
  uploadedAt: z.coerce.date(),
  thumbnailUrl: z.string().nullable(),
});

export const paginatedDocumentsSchema = z.object({
  documents: z.array(documentSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    totalItems: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});

// Download document
export const getDownloadUrlInputSchema = z.object({
  documentId: z.string().uuid(),
  version: z.number().optional(), // For specific version
});

export const getDownloadUrlOutputSchema = z.object({
  downloadUrl: z.string().url(),
  fileName: z.string(),
  expiresAt: z.coerce.date(),
});

// Bulk download
export const bulkDownloadInputSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(20),
});

// Version history
export const getVersionHistoryInputSchema = z.object({
  documentId: z.string().uuid(),
});

export const documentVersionSchema = z.object({
  documentId: z.string().uuid(),
  version: z.number(),
  fileSize: z.number(),
  uploadedAt: z.coerce.date(),
  uploadedBy: z.string(),
  isLatest: z.boolean(),
});

export type PortalDocument = z.infer<typeof documentSchema>;
export type DocumentCategory = z.infer<typeof documentCategorySchema>;
```

### Service Implementation

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { v4 as uuidv4 } from 'uuid';
import * as archiver from 'archiver';
import { InjectDrizzle } from '@/database/drizzle.provider';
import { DrizzleDB } from '@/database/drizzle.types';
import { eq, and, desc, asc, ilike, sql, isNull } from 'drizzle-orm';
import { portalDocuments, portalDocumentAccessLog } from '@/database/schema';

@Injectable()
export class DocumentService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectDrizzle() private db: DrizzleDB,
    private configService: ConfigService,
    private auditService: AuditService,
    private virusScanService: VirusScanService,
    private aiCategorizationService: AICategorization,
    private redis: Redis,
  ) {
    this.s3Client = new S3Client({
      region: configService.get('AWS_REGION'),
    });
    this.bucket = configService.get('DOCUMENTS_S3_BUCKET');
  }

  async getUploadUrl(
    tenantId: string,
    clientId: string,
    input: { fileName: string; mimeType: string; fileSize: number }
  ): Promise<{
    uploadUrl: string;
    documentId: string;
    expiresAt: Date;
    fields: Record<string, string>;
  }> {
    const documentId = uuidv4();
    const extension = input.fileName.split('.').pop()?.toLowerCase() || '';
    const s3Key = `${tenantId}/${clientId}/documents/${documentId}.${extension}`;

    // Create presigned POST for direct browser upload
    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucket,
      Key: s3Key,
      Conditions: [
        ['content-length-range', 0, 50 * 1024 * 1024], // 50MB max
        ['eq', '$Content-Type', input.mimeType],
      ],
      Fields: {
        'Content-Type': input.mimeType,
        'x-amz-server-side-encryption': 'AES256',
      },
      Expires: 3600, // 1 hour
    });

    // Create pending document record
    await this.db.insert(portalDocuments).values({
      documentId,
      tenantId,
      clientId,
      fileName: this.sanitizeFileName(input.fileName),
      originalName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      extension,
      category: 'OTHER', // Will be updated on complete
      s3Bucket: this.bucket,
      s3Key,
      status: 'PROCESSING',
      scanStatus: 'PENDING',
      uploadedBy: clientId,
      checksumSha256: '', // Will be updated on complete
    });

    return {
      uploadUrl: url,
      documentId,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      fields,
    };
  }

  async completeUpload(
    tenantId: string,
    clientId: string,
    input: {
      documentId: string;
      checksumSha256: string;
      category: string;
      taxYear?: number;
      description?: string;
      tags?: string[];
    }
  ): Promise<PortalDocument> {
    // Get document record
    const [document] = await this.db
      .select()
      .from(portalDocuments)
      .where(
        and(
          eq(portalDocuments.documentId, input.documentId),
          eq(portalDocuments.tenantId, tenantId),
          eq(portalDocuments.clientId, clientId)
        )
      );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Update document with metadata
    const [updated] = await this.db
      .update(portalDocuments)
      .set({
        checksumSha256: input.checksumSha256,
        category: input.category,
        taxYear: input.taxYear,
        description: input.description,
        tags: input.tags || [],
        modifiedAt: new Date(),
      })
      .where(eq(portalDocuments.documentId, input.documentId))
      .returning();

    // Queue virus scan
    await this.virusScanService.queueScan({
      documentId: input.documentId,
      s3Bucket: this.bucket,
      s3Key: document.s3Key,
    });

    // Queue AI categorization suggestion
    if (input.category === 'OTHER') {
      await this.aiCategorizationService.queueCategorization({
        documentId: input.documentId,
        mimeType: document.mimeType,
        s3Key: document.s3Key,
      });
    }

    // Generate thumbnail for images/PDFs
    if (this.canGenerateThumbnail(document.mimeType)) {
      await this.thumbnailService.queueThumbnailGeneration({
        documentId: input.documentId,
        s3Key: document.s3Key,
        mimeType: document.mimeType,
      });
    }

    // Audit log
    await this.auditService.log({
      tenantId,
      clientId,
      action: 'DOCUMENT_UPLOADED',
      entityId: input.documentId,
      metadata: {
        fileName: document.fileName,
        category: input.category,
        fileSize: document.fileSize,
      },
    });

    return this.mapToDTO(updated);
  }

  async listDocuments(
    tenantId: string,
    clientId: string,
    input: {
      page: number;
      pageSize: number;
      category?: string;
      taxYear?: number;
      status?: string;
      search?: string;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<{
    documents: PortalDocument[];
    pagination: Pagination;
  }> {
    const offset = (input.page - 1) * input.pageSize;

    // Build conditions
    const conditions = [
      eq(portalDocuments.tenantId, tenantId),
      eq(portalDocuments.clientId, clientId),
      isNull(portalDocuments.deletedAt),
      eq(portalDocuments.isLatestVersion, true),
    ];

    if (input.category) {
      conditions.push(eq(portalDocuments.category, input.category));
    }
    if (input.taxYear) {
      conditions.push(eq(portalDocuments.taxYear, input.taxYear));
    }
    if (input.status) {
      conditions.push(eq(portalDocuments.status, input.status));
    }
    if (input.search) {
      conditions.push(
        sql`to_tsvector('simple', ${portalDocuments.fileName} || ' ' || COALESCE(${portalDocuments.description}, ''))
            @@ plainto_tsquery('simple', ${input.search})`
      );
    }

    // Sort order
    const sortColumn = {
      uploadedAt: portalDocuments.uploadedAt,
      fileName: portalDocuments.fileName,
      fileSize: portalDocuments.fileSize,
      category: portalDocuments.category,
    }[input.sortBy] || portalDocuments.uploadedAt;

    const orderFn = input.sortOrder === 'asc' ? asc : desc;

    // Execute query
    const [documents, countResult] = await Promise.all([
      this.db
        .select()
        .from(portalDocuments)
        .where(and(...conditions))
        .orderBy(orderFn(sortColumn))
        .limit(input.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(portalDocuments)
        .where(and(...conditions)),
    ]);

    const totalItems = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / input.pageSize);

    return {
      documents: documents.map((d) => this.mapToDTO(d)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalPages,
        totalItems,
        hasNext: input.page < totalPages,
        hasPrevious: input.page > 1,
      },
    };
  }

  async getDownloadUrl(
    tenantId: string,
    clientId: string,
    documentId: string,
    version?: number
  ): Promise<{
    downloadUrl: string;
    fileName: string;
    expiresAt: Date;
  }> {
    // Get document
    const conditions = [
      eq(portalDocuments.tenantId, tenantId),
      eq(portalDocuments.clientId, clientId),
      isNull(portalDocuments.deletedAt),
    ];

    if (version) {
      conditions.push(
        eq(portalDocuments.version, version),
        sql`${portalDocuments.parentDocumentId} = ${documentId} OR ${portalDocuments.documentId} = ${documentId}`
      );
    } else {
      conditions.push(eq(portalDocuments.documentId, documentId));
    }

    const [document] = await this.db
      .select()
      .from(portalDocuments)
      .where(and(...conditions));

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status === 'QUARANTINED') {
      throw new BadRequestException('Document is quarantined due to security concerns');
    }

    // Generate presigned GET URL
    const command = new GetObjectCommand({
      Bucket: document.s3Bucket,
      Key: document.s3Key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(document.originalName)}"`,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    // Log access
    await this.db.insert(portalDocumentAccessLog).values({
      tenantId,
      documentId: document.documentId,
      clientId,
      action: 'DOWNLOAD',
    });

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'DOCUMENT_DOWNLOAD',
      entityId: document.documentId,
      metadata: { fileName: document.fileName },
    });

    return {
      downloadUrl,
      fileName: document.originalName,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  async bulkDownload(
    tenantId: string,
    clientId: string,
    documentIds: string[]
  ): Promise<{
    downloadUrl: string;
    fileName: string;
    expiresAt: Date;
  }> {
    // Validate all documents belong to client
    const documents = await this.db
      .select()
      .from(portalDocuments)
      .where(
        and(
          eq(portalDocuments.tenantId, tenantId),
          eq(portalDocuments.clientId, clientId),
          sql`${portalDocuments.documentId} = ANY(${documentIds})`,
          isNull(portalDocuments.deletedAt),
          eq(portalDocuments.status, 'READY')
        )
      );

    if (documents.length !== documentIds.length) {
      throw new BadRequestException('Some documents are not accessible');
    }

    // Create ZIP archive
    const zipKey = `${tenantId}/${clientId}/downloads/${uuidv4()}.zip`;
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Stream documents into archive
    for (const doc of documents) {
      const stream = await this.getDocumentStream(doc.s3Bucket, doc.s3Key);
      archive.append(stream, { name: doc.originalName });
    }

    await archive.finalize();

    // Upload ZIP to S3
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: zipKey,
      Body: archive,
      ContentType: 'application/zip',
    }));

    // Generate download URL
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: zipKey,
      ResponseContentDisposition: `attachment; filename="documents_${new Date().toISOString().split('T')[0]}.zip"`,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    // Schedule cleanup of ZIP file
    await this.scheduleCleanup(zipKey, 24 * 60 * 60); // 24 hours

    return {
      downloadUrl,
      fileName: `documents_${new Date().toISOString().split('T')[0]}.zip`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  async getVersionHistory(
    tenantId: string,
    clientId: string,
    documentId: string
  ): Promise<DocumentVersion[]> {
    const versions = await this.db
      .select({
        documentId: portalDocuments.documentId,
        version: portalDocuments.version,
        fileSize: portalDocuments.fileSize,
        uploadedAt: portalDocuments.uploadedAt,
        isLatest: portalDocuments.isLatestVersion,
      })
      .from(portalDocuments)
      .where(
        and(
          eq(portalDocuments.tenantId, tenantId),
          eq(portalDocuments.clientId, clientId),
          sql`${portalDocuments.documentId} = ${documentId} OR ${portalDocuments.parentDocumentId} = ${documentId}`,
          isNull(portalDocuments.deletedAt)
        )
      )
      .orderBy(desc(portalDocuments.version));

    return versions;
  }

  async softDeleteDocument(
    tenantId: string,
    clientId: string,
    documentId: string
  ): Promise<void> {
    const [document] = await this.db
      .update(portalDocuments)
      .set({
        deletedAt: new Date(),
        deletedBy: clientId,
      })
      .where(
        and(
          eq(portalDocuments.documentId, documentId),
          eq(portalDocuments.tenantId, tenantId),
          eq(portalDocuments.clientId, clientId),
          isNull(portalDocuments.deletedAt)
        )
      )
      .returning();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Invalidate cache
    await this.redis.del(`portal:${tenantId}:${clientId}:documents:*`);

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'DOCUMENT_DELETED',
      entityId: documentId,
      metadata: { fileName: document.fileName },
    });
  }

  async handleVirusScanResult(
    documentId: string,
    result: { clean: boolean; details?: string }
  ): Promise<void> {
    await this.db
      .update(portalDocuments)
      .set({
        scanStatus: result.clean ? 'CLEAN' : 'INFECTED',
        scanResult: result,
        status: result.clean ? 'READY' : 'QUARANTINED',
        modifiedAt: new Date(),
      })
      .where(eq(portalDocuments.documentId, documentId));

    if (!result.clean) {
      // Notify client about quarantined file
      const [document] = await this.db
        .select()
        .from(portalDocuments)
        .where(eq(portalDocuments.documentId, documentId));

      await this.notificationService.send({
        tenantId: document.tenantId,
        clientId: document.clientId,
        type: 'DOCUMENT_QUARANTINED',
        title: 'Plik został odrzucony',
        body: `Plik "${document.fileName}" został odrzucony z powodów bezpieczeństwa.`,
        priority: 'HIGH',
      });
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }

  private canGenerateThumbnail(mimeType: string): boolean {
    return ['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType);
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      INVOICE: 'Faktura',
      RECEIPT: 'Paragon',
      BANK_STATEMENT: 'Wyciąg bankowy',
      CONTRACT: 'Umowa',
      TAX_RETURN: 'Deklaracja podatkowa',
      PAYROLL: 'Dokumenty kadrowe',
      CORRESPONDENCE: 'Korespondencja',
      OTHER: 'Inne',
    };
    return labels[category] || category;
  }

  private mapToDTO(document: any): PortalDocument {
    return {
      documentId: document.documentId,
      fileName: document.fileName,
      originalName: document.originalName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      category: document.category,
      categoryLabel: this.getCategoryLabel(document.category),
      taxYear: document.taxYear,
      description: document.description,
      tags: document.tags || [],
      status: document.status,
      scanStatus: document.scanStatus,
      version: document.version,
      hasVersionHistory: document.parentDocumentId !== null || document.version > 1,
      uploadedAt: document.uploadedAt,
      thumbnailUrl: document.thumbnailS3Key
        ? this.getThumbnailUrl(document.thumbnailS3Key)
        : null,
    };
  }
}
```

### tRPC Router

```typescript
import { router, clientProcedure } from '../trpc';
import {
  getUploadUrlInputSchema,
  completeUploadInputSchema,
  listDocumentsInputSchema,
  getDownloadUrlInputSchema,
  bulkDownloadInputSchema,
  getVersionHistoryInputSchema,
} from './document.schemas';

export const documentRouter = router({
  // Get presigned upload URL
  getUploadUrl: clientProcedure
    .input(getUploadUrlInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.getUploadUrl(
        ctx.tenantId,
        ctx.clientId,
        input
      );
    }),

  // Complete upload after S3 upload
  completeUpload: clientProcedure
    .input(completeUploadInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.completeUpload(
        ctx.tenantId,
        ctx.clientId,
        input
      );
    }),

  // List documents
  list: clientProcedure
    .input(listDocumentsInputSchema)
    .query(async ({ ctx, input }) => {
      return ctx.documentService.listDocuments(
        ctx.tenantId,
        ctx.clientId,
        input
      );
    }),

  // Get single document
  get: clientProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.documentService.getDocument(
        ctx.tenantId,
        ctx.clientId,
        input.documentId
      );
    }),

  // Get download URL
  getDownloadUrl: clientProcedure
    .input(getDownloadUrlInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.getDownloadUrl(
        ctx.tenantId,
        ctx.clientId,
        input.documentId,
        input.version
      );
    }),

  // Bulk download as ZIP
  bulkDownload: clientProcedure
    .input(bulkDownloadInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.documentService.bulkDownload(
        ctx.tenantId,
        ctx.clientId,
        input.documentIds
      );
    }),

  // Get version history
  getVersionHistory: clientProcedure
    .input(getVersionHistoryInputSchema)
    .query(async ({ ctx, input }) => {
      return ctx.documentService.getVersionHistory(
        ctx.tenantId,
        ctx.clientId,
        input.documentId
      );
    }),

  // Delete document (soft delete)
  delete: clientProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.documentService.softDeleteDocument(
        ctx.tenantId,
        ctx.clientId,
        input.documentId
      );
      return { success: true };
    }),

  // Get categories with counts
  getCategoryCounts: clientProcedure
    .query(async ({ ctx }) => {
      return ctx.documentService.getCategoryCounts(ctx.tenantId, ctx.clientId);
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(() => {
    service = createMockDocumentService();
  });

  describe('getUploadUrl', () => {
    it('should generate presigned URL and create pending document', async () => {
      const result = await service.getUploadUrl('tenant-1', 'client-1', {
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      });

      expect(result.uploadUrl).toBeDefined();
      expect(result.documentId).toBeDefined();
      expect(result.fields).toHaveProperty('Content-Type', 'application/pdf');
    });

    it('should reject files over 50MB', async () => {
      await expect(
        service.getUploadUrl('tenant-1', 'client-1', {
          fileName: 'large.pdf',
          mimeType: 'application/pdf',
          fileSize: 60 * 1024 * 1024,
        })
      ).rejects.toThrow('File must be less than 50MB');
    });
  });

  describe('completeUpload', () => {
    it('should queue virus scan after completion', async () => {
      await service.completeUpload('tenant-1', 'client-1', {
        documentId: 'doc-123',
        checksumSha256: 'abc123',
        category: 'INVOICE',
      });

      expect(mockVirusScanService.queueScan).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: 'doc-123' })
      );
    });

    it('should queue AI categorization for OTHER category', async () => {
      await service.completeUpload('tenant-1', 'client-1', {
        documentId: 'doc-123',
        checksumSha256: 'abc123',
        category: 'OTHER',
      });

      expect(mockAICategorization.queueCategorization).toHaveBeenCalled();
    });
  });

  describe('listDocuments', () => {
    it('should filter by category', async () => {
      const result = await service.listDocuments('tenant-1', 'client-1', {
        page: 1,
        pageSize: 20,
        category: 'INVOICE',
        sortBy: 'uploadedAt',
        sortOrder: 'desc',
      });

      expect(result.documents.every((d) => d.category === 'INVOICE')).toBe(true);
    });

    it('should support full-text search', async () => {
      const result = await service.listDocuments('tenant-1', 'client-1', {
        page: 1,
        pageSize: 20,
        search: 'faktura',
        sortBy: 'uploadedAt',
        sortOrder: 'desc',
      });

      expect(result.documents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDownloadUrl', () => {
    it('should reject quarantined documents', async () => {
      mockDb.select.mockResolvedValue([{ status: 'QUARANTINED' }]);

      await expect(
        service.getDownloadUrl('tenant-1', 'client-1', 'doc-123')
      ).rejects.toThrow('Document is quarantined');
    });

    it('should log download access', async () => {
      mockDb.select.mockResolvedValue([{ status: 'READY', s3Key: 'key' }]);

      await service.getDownloadUrl('tenant-1', 'client-1', 'doc-123');

      expect(mockDb.insert).toHaveBeenCalledWith(portalDocumentAccessLog);
    });
  });
});
```

## Security Checklist

- [ ] Client can only access own documents (RLS enforced)
- [ ] File type validation on both client and server
- [ ] File size limits enforced (50MB max)
- [ ] Virus scanning for all uploads
- [ ] Checksums verified for integrity
- [ ] S3 server-side encryption enabled
- [ ] Presigned URLs expire within 1 hour
- [ ] Download access logged for audit
- [ ] Soft delete with audit trail
- [ ] No direct S3 access (all through signed URLs)

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| DOCUMENT_UPLOADED | Upload complete | fileName, category, fileSize |
| DOCUMENT_DOWNLOAD | File downloaded | documentId, fileName |
| DOCUMENT_PREVIEW | Preview opened | documentId |
| DOCUMENT_DELETED | Soft delete | documentId, fileName |
| DOCUMENT_QUARANTINED | Virus detected | documentId, scanResult |

## Implementation Notes

1. **Direct S3 Upload**: Use presigned POST for browser-direct upload to avoid server bandwidth
2. **Virus Scanning**: Integrate with ClamAV or AWS GuardDuty for malware detection
3. **Thumbnail Generation**: Use Lambda for async PDF/image thumbnail creation
4. **Search**: PostgreSQL full-text search for document names and descriptions
5. **Versioning**: S3 versioning + database tracking for complete history
6. **Cleanup Jobs**: Scheduled job to clean up expired ZIP downloads
