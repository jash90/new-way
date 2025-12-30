# DOC-001: Document Upload System

> **Story ID**: DOC-001
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P0 (Critical)
> **Story Points**: 8
> **Sprint**: Phase 4 - Week 13
> **Status**: 📋 Ready for Development

---

## 📋 User Story

**As an** accountant,
**I want to** upload documents in various formats through a secure, intuitive interface,
**So that** I can digitize paper documents and integrate them into the accounting workflow.

---

## 🎯 Acceptance Criteria

### Scenario 1: Single File Upload via Drag-and-Drop
```gherkin
Given an authenticated accountant on the document upload page
When the user drags a PDF file (10MB) into the drop zone
Then the file should be uploaded to cloud storage
And a progress indicator should show upload status
And the document should appear in the document list with "UPLOADED" status
And a success notification should be displayed
And the upload should complete within 3 seconds
```

### Scenario 2: Multi-Format Support Validation
```gherkin
Given an authenticated accountant
When the user uploads files in the following formats:
  | Format | MIME Type                                                                  |
  | PDF    | application/pdf                                                            |
  | JPEG   | image/jpeg                                                                 |
  | PNG    | image/png                                                                  |
  | TIFF   | image/tiff                                                                 |
  | DOCX   | application/vnd.openxmlformats-officedocument.wordprocessingml.document    |
  | XLSX   | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet          |
Then all files should be accepted and uploaded successfully
And each file type should be correctly identified in metadata
And appropriate thumbnail generation should be triggered
```

### Scenario 3: File Size Validation
```gherkin
Given an authenticated accountant
When the user attempts to upload a file larger than 50MB
Then the upload should be rejected immediately
And an error message should display: "Plik przekracza maksymalny rozmiar 50MB"
And the file should not be transmitted to the server
And no partial upload data should be stored
```

### Scenario 4: MIME Type Verification
```gherkin
Given an authenticated accountant
When the user uploads a file with a .pdf extension but incorrect MIME type (e.g., text/plain)
Then the upload should be rejected
And an error message should display: "Nieprawidłowy format pliku"
And a security event should be logged
And the incident should be reported to administrators
```

### Scenario 5: Virus Scanning Integration
```gherkin
Given an authenticated accountant uploads a file
When the file is received by the server
Then the file should be scanned by ClamAV before storage
And if the file is clean, it should proceed to storage
And if malware is detected:
  - The file should be quarantined
  - The upload should be rejected with message "Wykryto zagrożenie bezpieczeństwa"
  - A security alert should be created
  - The incident should be logged with scan details
```

### Scenario 6: Duplicate Detection via Checksum
```gherkin
Given an authenticated accountant
And a document "faktura-2024-001.pdf" already exists in the system
When the user uploads the same file again (identical content, any filename)
Then the system should detect the duplicate via SHA-256 checksum
And prompt the user: "Ten dokument już istnieje w systemie. Czy chcesz utworzyć nową wersję?"
And provide options: "Utwórz wersję" | "Anuluj"
And if "Utwórz wersję" is selected, create a new version linked to original
```

### Scenario 7: Batch Upload Processing
```gherkin
Given an authenticated accountant
When the user selects 20 documents for batch upload
Then all files should be validated concurrently (format, size, MIME)
And a batch progress indicator should show overall and per-file status
And files should be uploaded in parallel (max 5 concurrent uploads)
And if any file fails, others should continue processing
And a summary should display: "Przesłano: 18 | Błędy: 2"
And failed files should be listed with specific error reasons
```

### Scenario 8: Upload Metadata Assignment
```gherkin
Given an authenticated accountant
When the user uploads a document
Then the user should be able to assign metadata:
  - Document type (invoice, receipt, contract, etc.)
  - Client association (from CRM)
  - Tags (custom or from suggestions)
  - Date (auto-detected or manual)
  - Notes
And all metadata should be stored with the document
And the document should be searchable by all metadata fields
```

---

## 🗄️ Database Schema

```sql
-- Document core table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    client_id UUID REFERENCES clients(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),

    -- File information
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_extension VARCHAR(20) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,

    -- Storage paths
    storage_bucket VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    cdn_url VARCHAR(500),

    -- Status
    status document_status NOT NULL DEFAULT 'UPLOADING',
    processing_status processing_status DEFAULT 'PENDING',
    virus_scan_status scan_status DEFAULT 'PENDING',
    virus_scan_result JSONB,

    -- Metadata
    document_type document_type,
    title VARCHAR(500),
    description TEXT,
    tags VARCHAR(100)[] DEFAULT '{}',
    custom_metadata JSONB DEFAULT '{}',

    -- Document date
    document_date DATE,
    document_date_source VARCHAR(50), -- 'manual', 'extracted', 'filename'

    -- Versioning
    is_current_version BOOLEAN DEFAULT TRUE,
    version_number INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 52428800),
    CONSTRAINT valid_checksum CHECK (LENGTH(checksum_sha256) = 64)
);

-- Document status enum
CREATE TYPE document_status AS ENUM (
    'UPLOADING',
    'UPLOADED',
    'PROCESSING',
    'PROCESSED',
    'FAILED',
    'QUARANTINED',
    'ARCHIVED',
    'DELETED'
);

-- Processing status enum
CREATE TYPE processing_status AS ENUM (
    'PENDING',
    'OCR_PROCESSING',
    'EXTRACTING',
    'CLASSIFYING',
    'INDEXING',
    'COMPLETED',
    'FAILED'
);

-- Scan status enum
CREATE TYPE scan_status AS ENUM (
    'PENDING',
    'SCANNING',
    'CLEAN',
    'INFECTED',
    'ERROR'
);

-- Document type enum
CREATE TYPE document_type AS ENUM (
    'INVOICE',
    'RECEIPT',
    'CONTRACT',
    'BANK_STATEMENT',
    'TAX_DECLARATION',
    'PAYROLL',
    'CORRESPONDENCE',
    'REPORT',
    'OTHER'
);

-- Upload sessions for batch uploads
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),

    -- Batch information
    total_files INTEGER NOT NULL,
    uploaded_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Upload session files
CREATE TABLE upload_session_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),

    -- File info
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,

    -- Progress tracking
    progress_percent INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Duplicate tracking
CREATE TABLE document_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    checksum_sha256 VARCHAR(64) NOT NULL,
    original_document_id UUID NOT NULL REFERENCES documents(id),
    duplicate_document_id UUID REFERENCES documents(id),

    -- Detection info
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    detected_by UUID NOT NULL REFERENCES users(id),
    resolution VARCHAR(50), -- 'NEW_VERSION', 'IGNORED', 'REPLACED'
    resolved_at TIMESTAMPTZ,

    -- Unique constraint on checksum per organization
    CONSTRAINT unique_duplicate_detection UNIQUE (organization_id, checksum_sha256, duplicate_document_id)
);

-- Quarantine table for infected files
CREATE TABLE document_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- File information (stored separately from main table)
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,

    -- Quarantine storage
    quarantine_path VARCHAR(500) NOT NULL,

    -- Scan results
    scan_result JSONB NOT NULL,
    threat_name VARCHAR(255),
    threat_type VARCHAR(100),

    -- Metadata
    uploaded_by UUID NOT NULL REFERENCES users(id),
    quarantined_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),

    -- Resolution
    resolution VARCHAR(50), -- 'DELETED', 'RELEASED', 'PENDING'
    resolution_notes TEXT
);

-- Document upload audit log
CREATE TABLE document_upload_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    document_id UUID REFERENCES documents(id),
    session_id UUID REFERENCES upload_sessions(id),

    -- Event info
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,

    -- Actor
    user_id UUID NOT NULL REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_documents_organization ON documents(organization_id);
CREATE INDEX idx_documents_client ON documents(client_id);
CREATE INDEX idx_documents_checksum ON documents(checksum_sha256);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_created ON documents(created_at DESC);
CREATE INDEX idx_documents_document_date ON documents(document_date);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

CREATE INDEX idx_upload_sessions_org ON upload_sessions(organization_id);
CREATE INDEX idx_upload_session_files_session ON upload_session_files(session_id);
CREATE INDEX idx_document_duplicates_checksum ON document_duplicates(organization_id, checksum_sha256);
CREATE INDEX idx_quarantine_org ON document_quarantine(organization_id);
CREATE INDEX idx_upload_audit_document ON document_upload_audit(document_id);

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_session_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_upload_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY documents_org_isolation ON documents
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY upload_sessions_org_isolation ON upload_sessions
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY duplicates_org_isolation ON document_duplicates
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY quarantine_org_isolation ON document_quarantine
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY upload_audit_org_isolation ON document_upload_audit
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);
```

---

## 🔧 Technical Implementation

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Supported MIME types
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

// File extension mapping
export const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Maximum file size (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Maximum batch size
export const MAX_BATCH_SIZE = 100;

// Document type schema
export const DocumentTypeSchema = z.enum([
  'INVOICE',
  'RECEIPT',
  'CONTRACT',
  'BANK_STATEMENT',
  'TAX_DECLARATION',
  'PAYROLL',
  'CORRESPONDENCE',
  'REPORT',
  'OTHER',
]);

// File upload validation schema
export const FileUploadSchema = z.object({
  filename: z.string()
    .min(1, 'Nazwa pliku jest wymagana')
    .max(255, 'Nazwa pliku zbyt długa'),
  mimeType: z.enum(SUPPORTED_MIME_TYPES, {
    errorMap: () => ({ message: 'Nieobsługiwany format pliku' }),
  }),
  size: z.number()
    .positive('Nieprawidłowy rozmiar pliku')
    .max(MAX_FILE_SIZE, `Plik przekracza maksymalny rozmiar ${MAX_FILE_SIZE / 1024 / 1024}MB`),
  checksum: z.string()
    .length(64, 'Nieprawidłowa suma kontrolna'),
});

// Document metadata schema
export const DocumentMetadataSchema = z.object({
  documentType: DocumentTypeSchema.optional(),
  clientId: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  documentDate: z.string().datetime().optional(),
  customMetadata: z.record(z.string(), z.unknown()).optional(),
});

// Single upload request schema
export const SingleUploadRequestSchema = z.object({
  file: FileUploadSchema,
  metadata: DocumentMetadataSchema.optional(),
});

// Batch upload request schema
export const BatchUploadRequestSchema = z.object({
  files: z.array(FileUploadSchema)
    .min(1, 'Wybierz co najmniej jeden plik')
    .max(MAX_BATCH_SIZE, `Maksymalnie ${MAX_BATCH_SIZE} plików na raz`),
  sharedMetadata: DocumentMetadataSchema.optional(),
});

// Upload presigned URL request schema
export const PresignedUrlRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(SUPPORTED_MIME_TYPES),
  size: z.number().positive().max(MAX_FILE_SIZE),
});

// Duplicate resolution schema
export const DuplicateResolutionSchema = z.object({
  documentId: z.string().uuid(),
  duplicateChecksum: z.string().length(64),
  resolution: z.enum(['NEW_VERSION', 'IGNORE', 'REPLACE']),
});

// Upload completion schema
export const UploadCompletionSchema = z.object({
  uploadId: z.string().uuid(),
  storagePath: z.string(),
  metadata: DocumentMetadataSchema.optional(),
});

// Quarantine review schema
export const QuarantineReviewSchema = z.object({
  quarantineId: z.string().uuid(),
  resolution: z.enum(['DELETE', 'RELEASE']),
  notes: z.string().max(1000).optional(),
});
```

### Document Upload Service

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import NodeClam from 'clamscan';
import sharp from 'sharp';
import { TRPCError } from '@trpc/server';
import Decimal from 'decimal.js';

// Configuration
const CONFIG = {
  S3_BUCKET: process.env.S3_BUCKET!,
  S3_REGION: process.env.S3_REGION!,
  CDN_URL: process.env.CDN_URL!,
  CLAMAV_HOST: process.env.CLAMAV_HOST || 'localhost',
  CLAMAV_PORT: parseInt(process.env.CLAMAV_PORT || '3310'),
  PRESIGNED_URL_EXPIRY: 300, // 5 minutes
  MAX_CONCURRENT_UPLOADS: 5,
  THUMBNAIL_SIZE: { width: 300, height: 400 },
};

// S3 Client
const s3Client = new S3Client({
  region: CONFIG.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ClamAV Scanner
let clamScanner: NodeClam;

async function initClamScanner() {
  if (!clamScanner) {
    clamScanner = await new NodeClam().init({
      clamdscan: {
        host: CONFIG.CLAMAV_HOST,
        port: CONFIG.CLAMAV_PORT,
        timeout: 60000,
      },
    });
  }
  return clamScanner;
}

// Types
interface UploadContext {
  organizationId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface FileInfo {
  filename: string;
  mimeType: string;
  size: number;
  buffer?: Buffer;
  checksum?: string;
}

interface UploadResult {
  documentId: string;
  filename: string;
  storagePath: string;
  cdnUrl: string;
  thumbnailPath?: string;
  status: string;
  virusScanStatus: string;
}

interface BatchUploadResult {
  sessionId: string;
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  results: Array<{
    filename: string;
    success: boolean;
    documentId?: string;
    error?: string;
  }>;
}

// Document Upload Service
export class DocumentUploadService {

  // Calculate SHA-256 checksum
  static calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Generate unique storage path
  static generateStoragePath(
    organizationId: string,
    filename: string,
    extension: string
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const uniqueId = uuidv4();

    return `${organizationId}/${year}/${month}/${uniqueId}${extension}`;
  }

  // Validate file before upload
  static async validateFile(file: FileInfo): Promise<void> {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Plik przekracza maksymalny rozmiar ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Validate MIME type
    if (!SUPPORTED_MIME_TYPES.includes(file.mimeType as any)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieobsługiwany format pliku',
      });
    }

    // Validate extension matches MIME type
    const extension = file.filename.substring(file.filename.lastIndexOf('.')).toLowerCase();
    const expectedMime = EXTENSION_MIME_MAP[extension];

    if (expectedMime && expectedMime !== file.mimeType) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy format pliku - niezgodność rozszerzenia i typu',
      });
    }
  }

  // Scan file for viruses
  static async scanFile(buffer: Buffer, filename: string): Promise<{
    isClean: boolean;
    scanResult: object;
  }> {
    const scanner = await initClamScanner();

    try {
      const result = await scanner.scanBuffer(buffer);

      return {
        isClean: result.isInfected === false,
        scanResult: {
          isInfected: result.isInfected,
          viruses: result.viruses || [],
          scannedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      // If scanner fails, treat as suspicious
      return {
        isClean: false,
        scanResult: {
          error: 'Scan failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          scannedAt: new Date().toISOString(),
        },
      };
    }
  }

  // Check for duplicates
  static async checkDuplicate(
    prisma: any,
    organizationId: string,
    checksum: string
  ): Promise<{ isDuplicate: boolean; existingDocument?: any }> {
    const existing = await prisma.document.findFirst({
      where: {
        organizationId,
        checksumSha256: checksum,
        isCurrentVersion: true,
        deletedAt: null,
      },
      select: {
        id: true,
        originalFilename: true,
        createdAt: true,
        documentType: true,
      },
    });

    return {
      isDuplicate: !!existing,
      existingDocument: existing,
    };
  }

  // Generate presigned URL for direct upload
  static async generatePresignedUrl(
    ctx: UploadContext,
    file: FileInfo
  ): Promise<{ uploadUrl: string; uploadId: string; storagePath: string }> {
    const extension = file.filename.substring(file.filename.lastIndexOf('.')).toLowerCase();
    const storagePath = this.generateStoragePath(ctx.organizationId, file.filename, extension);
    const uploadId = uuidv4();

    const command = new PutObjectCommand({
      Bucket: CONFIG.S3_BUCKET,
      Key: storagePath,
      ContentType: file.mimeType,
      ContentLength: file.size,
      Metadata: {
        'upload-id': uploadId,
        'organization-id': ctx.organizationId,
        'original-filename': Buffer.from(file.filename).toString('base64'),
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: CONFIG.PRESIGNED_URL_EXPIRY,
    });

    return { uploadUrl, uploadId, storagePath };
  }

  // Generate thumbnail for images and PDFs
  static async generateThumbnail(
    buffer: Buffer,
    mimeType: string,
    storagePath: string
  ): Promise<string | null> {
    let thumbnailBuffer: Buffer | null = null;

    if (mimeType.startsWith('image/')) {
      thumbnailBuffer = await sharp(buffer)
        .resize(CONFIG.THUMBNAIL_SIZE.width, CONFIG.THUMBNAIL_SIZE.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    }
    // For PDFs, thumbnail generation would require additional libraries
    // like pdf-poppler or similar

    if (thumbnailBuffer) {
      const thumbnailPath = storagePath.replace(/\.[^.]+$/, '_thumb.jpg');

      await s3Client.send(new PutObjectCommand({
        Bucket: CONFIG.S3_BUCKET,
        Key: thumbnailPath,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      }));

      return thumbnailPath;
    }

    return null;
  }

  // Upload single document
  static async uploadDocument(
    prisma: any,
    ctx: UploadContext,
    file: FileInfo,
    buffer: Buffer,
    metadata?: z.infer<typeof DocumentMetadataSchema>
  ): Promise<UploadResult> {
    // Validate file
    await this.validateFile(file);

    // Calculate checksum
    const checksum = this.calculateChecksum(buffer);

    // Check for duplicates
    const duplicate = await this.checkDuplicate(prisma, ctx.organizationId, checksum);

    if (duplicate.isDuplicate) {
      // Record duplicate detection
      await prisma.documentDuplicate.create({
        data: {
          organizationId: ctx.organizationId,
          checksumSha256: checksum,
          originalDocumentId: duplicate.existingDocument.id,
          detectedBy: ctx.userId,
        },
      });

      throw new TRPCError({
        code: 'CONFLICT',
        message: 'DUPLICATE_DETECTED',
        cause: {
          existingDocument: duplicate.existingDocument,
          checksum,
        },
      });
    }

    // Scan for viruses
    const scanResult = await this.scanFile(buffer, file.filename);

    if (!scanResult.isClean) {
      // Quarantine infected file
      const quarantinePath = `quarantine/${ctx.organizationId}/${uuidv4()}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: CONFIG.S3_BUCKET,
        Key: quarantinePath,
        Body: buffer,
        ContentType: file.mimeType,
      }));

      await prisma.documentQuarantine.create({
        data: {
          organizationId: ctx.organizationId,
          originalFilename: file.filename,
          fileSize: file.size,
          mimeType: file.mimeType,
          checksumSha256: checksum,
          quarantinePath,
          scanResult: scanResult.scanResult,
          threatName: (scanResult.scanResult as any).viruses?.[0],
          threatType: 'MALWARE',
          uploadedBy: ctx.userId,
        },
      });

      // Log security event
      await this.logUploadEvent(prisma, ctx, null, null, 'VIRUS_DETECTED', {
        filename: file.filename,
        scanResult: scanResult.scanResult,
      });

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wykryto zagrożenie bezpieczeństwa',
      });
    }

    // Generate storage path
    const extension = file.filename.substring(file.filename.lastIndexOf('.')).toLowerCase();
    const storagePath = this.generateStoragePath(ctx.organizationId, file.filename, extension);

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: CONFIG.S3_BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: file.mimeType,
      Metadata: {
        'organization-id': ctx.organizationId,
        'original-filename': Buffer.from(file.filename).toString('base64'),
        'checksum': checksum,
      },
    }));

    // Generate thumbnail
    const thumbnailPath = await this.generateThumbnail(buffer, file.mimeType, storagePath);

    // Create document record
    const document = await prisma.document.create({
      data: {
        organizationId: ctx.organizationId,
        uploadedBy: ctx.userId,
        clientId: metadata?.clientId,
        originalFilename: file.filename,
        storedFilename: storagePath.split('/').pop()!,
        mimeType: file.mimeType,
        fileSize: file.size,
        fileExtension: extension,
        checksumSha256: checksum,
        storageBucket: CONFIG.S3_BUCKET,
        storagePath,
        thumbnailPath,
        cdnUrl: `${CONFIG.CDN_URL}/${storagePath}`,
        status: 'UPLOADED',
        virusScanStatus: 'CLEAN',
        virusScanResult: scanResult.scanResult,
        documentType: metadata?.documentType,
        title: metadata?.title || file.filename,
        description: metadata?.description,
        tags: metadata?.tags || [],
        documentDate: metadata?.documentDate ? new Date(metadata.documentDate) : null,
        documentDateSource: metadata?.documentDate ? 'manual' : null,
        customMetadata: metadata?.customMetadata || {},
      },
    });

    // Log upload event
    await this.logUploadEvent(prisma, ctx, document.id, null, 'DOCUMENT_UPLOADED', {
      filename: file.filename,
      size: file.size,
      mimeType: file.mimeType,
    });

    return {
      documentId: document.id,
      filename: file.filename,
      storagePath: document.storagePath,
      cdnUrl: document.cdnUrl,
      thumbnailPath: document.thumbnailPath,
      status: document.status,
      virusScanStatus: document.virusScanStatus,
    };
  }

  // Upload batch of documents
  static async uploadBatch(
    prisma: any,
    ctx: UploadContext,
    files: Array<{ file: FileInfo; buffer: Buffer }>,
    sharedMetadata?: z.infer<typeof DocumentMetadataSchema>
  ): Promise<BatchUploadResult> {
    // Create upload session
    const session = await prisma.uploadSession.create({
      data: {
        organizationId: ctx.organizationId,
        uploadedBy: ctx.userId,
        totalFiles: files.length,
        status: 'IN_PROGRESS',
        metadata: sharedMetadata || {},
      },
    });

    // Create session file records
    await prisma.uploadSessionFile.createMany({
      data: files.map(f => ({
        sessionId: session.id,
        originalFilename: f.file.filename,
        fileSize: f.file.size,
        status: 'PENDING',
      })),
    });

    const results: Array<{
      filename: string;
      success: boolean;
      documentId?: string;
      error?: string;
    }> = [];

    let uploadedCount = 0;
    let failedCount = 0;

    // Process files with concurrency limit
    const chunks = [];
    for (let i = 0; i < files.length; i += CONFIG.MAX_CONCURRENT_UPLOADS) {
      chunks.push(files.slice(i, i + CONFIG.MAX_CONCURRENT_UPLOADS));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async ({ file, buffer }) => {
          try {
            // Update session file status
            await prisma.uploadSessionFile.updateMany({
              where: {
                sessionId: session.id,
                originalFilename: file.filename,
              },
              data: {
                status: 'UPLOADING',
                startedAt: new Date(),
              },
            });

            const result = await this.uploadDocument(prisma, ctx, file, buffer, sharedMetadata);

            // Update session file with success
            await prisma.uploadSessionFile.updateMany({
              where: {
                sessionId: session.id,
                originalFilename: file.filename,
              },
              data: {
                documentId: result.documentId,
                status: 'COMPLETED',
                progressPercent: 100,
                completedAt: new Date(),
              },
            });

            return { filename: file.filename, success: true, documentId: result.documentId };
          } catch (error) {
            const errorMessage = error instanceof TRPCError
              ? error.message
              : 'Błąd przesyłania';

            // Update session file with failure
            await prisma.uploadSessionFile.updateMany({
              where: {
                sessionId: session.id,
                originalFilename: file.filename,
              },
              data: {
                status: 'FAILED',
                errorMessage,
                completedAt: new Date(),
              },
            });

            return { filename: file.filename, success: false, error: errorMessage };
          }
        })
      );

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            uploadedCount++;
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
          results.push({
            filename: 'unknown',
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }

      // Update session progress
      await prisma.uploadSession.update({
        where: { id: session.id },
        data: {
          uploadedFiles: uploadedCount,
          failedFiles: failedCount,
        },
      });
    }

    // Complete session
    await prisma.uploadSession.update({
      where: { id: session.id },
      data: {
        status: failedCount === files.length ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        uploadedFiles: uploadedCount,
        failedFiles: failedCount,
      },
    });

    // Log batch upload event
    await this.logUploadEvent(prisma, ctx, null, session.id, 'BATCH_UPLOAD_COMPLETED', {
      totalFiles: files.length,
      uploadedFiles: uploadedCount,
      failedFiles: failedCount,
    });

    return {
      sessionId: session.id,
      totalFiles: files.length,
      uploadedFiles: uploadedCount,
      failedFiles: failedCount,
      results,
    };
  }

  // Resolve duplicate
  static async resolveDuplicate(
    prisma: any,
    ctx: UploadContext,
    documentId: string,
    checksum: string,
    resolution: 'NEW_VERSION' | 'IGNORE' | 'REPLACE'
  ): Promise<void> {
    const duplicate = await prisma.documentDuplicate.findFirst({
      where: {
        organizationId: ctx.organizationId,
        originalDocumentId: documentId,
        checksumSha256: checksum,
        resolution: null,
      },
    });

    if (!duplicate) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Duplicate record not found',
      });
    }

    await prisma.documentDuplicate.update({
      where: { id: duplicate.id },
      data: {
        resolution,
        resolvedAt: new Date(),
      },
    });

    // Log resolution
    await this.logUploadEvent(prisma, ctx, documentId, null, 'DUPLICATE_RESOLVED', {
      resolution,
      checksum,
    });
  }

  // Log upload event
  static async logUploadEvent(
    prisma: any,
    ctx: UploadContext,
    documentId: string | null,
    sessionId: string | null,
    eventType: string,
    eventData: object
  ): Promise<void> {
    await prisma.documentUploadAudit.create({
      data: {
        organizationId: ctx.organizationId,
        documentId,
        sessionId,
        eventType,
        eventData,
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });
  }
}
```

### tRPC API Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { DocumentUploadService } from '../services/documentUpload.service';
import {
  SingleUploadRequestSchema,
  BatchUploadRequestSchema,
  PresignedUrlRequestSchema,
  DuplicateResolutionSchema,
  UploadCompletionSchema,
  QuarantineReviewSchema,
  DocumentMetadataSchema,
} from '../schemas/documentUpload.schema';

export const documentUploadRouter = router({
  // Get presigned URL for direct upload
  getPresignedUrl: protectedProcedure
    .input(PresignedUrlRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return DocumentUploadService.generatePresignedUrl(
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
          ipAddress: ctx.req?.ip,
          userAgent: ctx.req?.headers['user-agent'],
        },
        {
          filename: input.filename,
          mimeType: input.mimeType,
          size: input.size,
        }
      );
    }),

  // Complete upload after presigned URL upload
  completeUpload: protectedProcedure
    .input(UploadCompletionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify upload completed to S3
      // Create document record
      // Trigger virus scanning queue
      // Return document info

      // Implementation would retrieve file from S3, scan, and create record
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Use direct upload endpoint',
      });
    }),

  // Upload single document (for smaller files)
  uploadSingle: protectedProcedure
    .input(z.object({
      file: z.object({
        filename: z.string(),
        mimeType: z.string(),
        size: z.number(),
        base64Data: z.string(),
      }),
      metadata: DocumentMetadataSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.file.base64Data, 'base64');

      return DocumentUploadService.uploadDocument(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
          ipAddress: ctx.req?.ip,
          userAgent: ctx.req?.headers['user-agent'],
        },
        {
          filename: input.file.filename,
          mimeType: input.file.mimeType,
          size: input.file.size,
        },
        buffer,
        input.metadata
      );
    }),

  // Upload batch of documents
  uploadBatch: protectedProcedure
    .input(z.object({
      files: z.array(z.object({
        filename: z.string(),
        mimeType: z.string(),
        size: z.number(),
        base64Data: z.string(),
      })).min(1).max(100),
      sharedMetadata: DocumentMetadataSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const filesWithBuffers = input.files.map(f => ({
        file: {
          filename: f.filename,
          mimeType: f.mimeType,
          size: f.size,
        },
        buffer: Buffer.from(f.base64Data, 'base64'),
      }));

      return DocumentUploadService.uploadBatch(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
          ipAddress: ctx.req?.ip,
          userAgent: ctx.req?.headers['user-agent'],
        },
        filesWithBuffers,
        input.sharedMetadata
      );
    }),

  // Resolve duplicate document
  resolveDuplicate: protectedProcedure
    .input(DuplicateResolutionSchema)
    .mutation(async ({ ctx, input }) => {
      await DocumentUploadService.resolveDuplicate(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
        },
        input.documentId,
        input.duplicateChecksum,
        input.resolution
      );

      return { success: true };
    }),

  // Get upload session status
  getSessionStatus: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.uploadSession.findFirst({
        where: {
          id: input.sessionId,
          organizationId: ctx.session.organizationId,
        },
        include: {
          files: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sesja nie znaleziona',
        });
      }

      return session;
    }),

  // Get quarantined files
  getQuarantined: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.prisma.documentQuarantine.findMany({
          where: {
            organizationId: ctx.session.organizationId,
            resolution: null,
          },
          orderBy: { quarantinedAt: 'desc' },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.documentQuarantine.count({
          where: {
            organizationId: ctx.session.organizationId,
            resolution: null,
          },
        }),
      ]);

      return {
        items,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Review quarantined file (admin only)
  reviewQuarantined: protectedProcedure
    .input(QuarantineReviewSchema)
    .mutation(async ({ ctx, input }) => {
      // Check admin permission
      if (!ctx.session.permissions.includes('ADMIN') &&
          !ctx.session.permissions.includes('SECURITY_ADMIN')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Brak uprawnień',
        });
      }

      const quarantined = await ctx.prisma.documentQuarantine.findFirst({
        where: {
          id: input.quarantineId,
          organizationId: ctx.session.organizationId,
          resolution: null,
        },
      });

      if (!quarantined) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plik nie znaleziony w kwarantannie',
        });
      }

      if (input.resolution === 'DELETE') {
        // Delete from quarantine storage
        await s3Client.send(new DeleteObjectCommand({
          Bucket: CONFIG.S3_BUCKET,
          Key: quarantined.quarantinePath,
        }));
      }
      // Note: 'RELEASE' would need careful handling - generally not recommended

      await ctx.prisma.documentQuarantine.update({
        where: { id: input.quarantineId },
        data: {
          resolution: input.resolution === 'DELETE' ? 'DELETED' : 'RELEASED',
          resolutionNotes: input.notes,
          reviewedAt: new Date(),
          reviewedBy: ctx.session.userId,
        },
      });

      // Log security event
      await DocumentUploadService.logUploadEvent(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
        },
        null,
        null,
        'QUARANTINE_REVIEWED',
        {
          quarantineId: input.quarantineId,
          resolution: input.resolution,
          filename: quarantined.originalFilename,
        }
      );

      return { success: true };
    }),

  // Get upload statistics
  getUploadStats: protectedProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month', 'year']).default('month'),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      let startDate: Date;

      switch (input.period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }

      const [totalDocuments, totalSize, byType, recentUploads] = await Promise.all([
        ctx.prisma.document.count({
          where: {
            organizationId: ctx.session.organizationId,
            createdAt: { gte: startDate },
            deletedAt: null,
          },
        }),
        ctx.prisma.document.aggregate({
          where: {
            organizationId: ctx.session.organizationId,
            createdAt: { gte: startDate },
            deletedAt: null,
          },
          _sum: { fileSize: true },
        }),
        ctx.prisma.document.groupBy({
          by: ['documentType'],
          where: {
            organizationId: ctx.session.organizationId,
            createdAt: { gte: startDate },
            deletedAt: null,
          },
          _count: true,
        }),
        ctx.prisma.document.findMany({
          where: {
            organizationId: ctx.session.organizationId,
            createdAt: { gte: startDate },
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            originalFilename: true,
            documentType: true,
            fileSize: true,
            createdAt: true,
          },
        }),
      ]);

      return {
        totalDocuments,
        totalSizeBytes: totalSize._sum.fileSize || 0,
        totalSizeMB: ((totalSize._sum.fileSize || 0) / 1024 / 1024).toFixed(2),
        byType,
        recentUploads,
      };
    }),
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentUploadService } from '../services/documentUpload.service';
import crypto from 'crypto';

describe('DocumentUploadService', () => {
  describe('calculateChecksum', () => {
    it('should calculate correct SHA-256 checksum', () => {
      const buffer = Buffer.from('test content');
      const checksum = DocumentUploadService.calculateChecksum(buffer);

      const expected = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(checksum).toBe(expected);
      expect(checksum).toHaveLength(64);
    });

    it('should return different checksums for different content', () => {
      const buffer1 = Buffer.from('content 1');
      const buffer2 = Buffer.from('content 2');

      const checksum1 = DocumentUploadService.calculateChecksum(buffer1);
      const checksum2 = DocumentUploadService.calculateChecksum(buffer2);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('generateStoragePath', () => {
    it('should generate valid storage path with organization prefix', () => {
      const orgId = 'org-123';
      const filename = 'document.pdf';
      const extension = '.pdf';

      const path = DocumentUploadService.generateStoragePath(orgId, filename, extension);

      expect(path).toMatch(/^org-123\/\d{4}\/\d{2}\/[a-f0-9-]+\.pdf$/);
    });

    it('should use current date in path', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      const path = DocumentUploadService.generateStoragePath('org', 'file', '.pdf');

      expect(path).toContain(`/${year}/${month}/`);
    });
  });

  describe('validateFile', () => {
    it('should accept valid PDF file', async () => {
      const file = {
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 1024, // 1MB
      };

      await expect(DocumentUploadService.validateFile(file)).resolves.not.toThrow();
    });

    it('should accept valid image files', async () => {
      const formats = [
        { filename: 'image.jpg', mimeType: 'image/jpeg' },
        { filename: 'image.png', mimeType: 'image/png' },
        { filename: 'image.tiff', mimeType: 'image/tiff' },
      ];

      for (const format of formats) {
        const file = { ...format, size: 1024 * 1024 };
        await expect(DocumentUploadService.validateFile(file)).resolves.not.toThrow();
      }
    });

    it('should accept valid Office files', async () => {
      const formats = [
        { filename: 'doc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { filename: 'sheet.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      ];

      for (const format of formats) {
        const file = { ...format, size: 1024 * 1024 };
        await expect(DocumentUploadService.validateFile(file)).resolves.not.toThrow();
      }
    });

    it('should reject file exceeding 50MB', async () => {
      const file = {
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        size: 51 * 1024 * 1024, // 51MB
      };

      await expect(DocumentUploadService.validateFile(file)).rejects.toThrow(
        /przekracza maksymalny rozmiar/
      );
    });

    it('should reject unsupported MIME type', async () => {
      const file = {
        filename: 'script.js',
        mimeType: 'application/javascript',
        size: 1024,
      };

      await expect(DocumentUploadService.validateFile(file)).rejects.toThrow(
        /Nieobsługiwany format/
      );
    });

    it('should reject mismatched extension and MIME type', async () => {
      const file = {
        filename: 'fake.pdf',
        mimeType: 'text/plain',
        size: 1024,
      };

      await expect(DocumentUploadService.validateFile(file)).rejects.toThrow(
        /niezgodność rozszerzenia/
      );
    });
  });
});

describe('FileUploadSchema', () => {
  it('should validate correct file upload', () => {
    const result = FileUploadSchema.safeParse({
      filename: 'document.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      checksum: 'a'.repeat(64),
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty filename', () => {
    const result = FileUploadSchema.safeParse({
      filename: '',
      mimeType: 'application/pdf',
      size: 1024,
      checksum: 'a'.repeat(64),
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid MIME type', () => {
    const result = FileUploadSchema.safeParse({
      filename: 'file.txt',
      mimeType: 'text/plain',
      size: 1024,
      checksum: 'a'.repeat(64),
    });

    expect(result.success).toBe(false);
  });

  it('should reject file size exceeding limit', () => {
    const result = FileUploadSchema.safeParse({
      filename: 'file.pdf',
      mimeType: 'application/pdf',
      size: 60 * 1024 * 1024, // 60MB
      checksum: 'a'.repeat(64),
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid checksum length', () => {
    const result = FileUploadSchema.safeParse({
      filename: 'file.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      checksum: 'short',
    });

    expect(result.success).toBe(false);
  });
});

describe('BatchUploadRequestSchema', () => {
  it('should validate correct batch upload', () => {
    const result = BatchUploadRequestSchema.safeParse({
      files: [
        { filename: 'doc1.pdf', mimeType: 'application/pdf', size: 1024, checksum: 'a'.repeat(64) },
        { filename: 'doc2.pdf', mimeType: 'application/pdf', size: 2048, checksum: 'b'.repeat(64) },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty file array', () => {
    const result = BatchUploadRequestSchema.safeParse({
      files: [],
    });

    expect(result.success).toBe(false);
  });

  it('should reject more than 100 files', () => {
    const files = Array(101).fill({
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      checksum: 'a'.repeat(64),
    });

    const result = BatchUploadRequestSchema.safeParse({ files });

    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '../test/helpers';
import { documentUploadRouter } from '../routers/documentUpload.router';

describe('Document Upload Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  beforeEach(async () => {
    await ctx.prisma.document.deleteMany({
      where: { organizationId: ctx.organizationId },
    });
  });

  describe('uploadSingle', () => {
    it('should upload PDF document successfully', async () => {
      const caller = documentUploadRouter.createCaller(ctx);
      const pdfContent = Buffer.from('%PDF-1.4 test content');

      const result = await caller.uploadSingle({
        file: {
          filename: 'test-invoice.pdf',
          mimeType: 'application/pdf',
          size: pdfContent.length,
          base64Data: pdfContent.toString('base64'),
        },
        metadata: {
          documentType: 'INVOICE',
          title: 'Test Invoice',
        },
      });

      expect(result.documentId).toBeDefined();
      expect(result.status).toBe('UPLOADED');
      expect(result.virusScanStatus).toBe('CLEAN');

      // Verify database record
      const document = await ctx.prisma.document.findUnique({
        where: { id: result.documentId },
      });
      expect(document).toBeDefined();
      expect(document?.documentType).toBe('INVOICE');
    });

    it('should detect and report duplicates', async () => {
      const caller = documentUploadRouter.createCaller(ctx);
      const content = Buffer.from('duplicate content');

      // First upload
      await caller.uploadSingle({
        file: {
          filename: 'original.pdf',
          mimeType: 'application/pdf',
          size: content.length,
          base64Data: content.toString('base64'),
        },
      });

      // Duplicate upload
      await expect(
        caller.uploadSingle({
          file: {
            filename: 'copy.pdf',
            mimeType: 'application/pdf',
            size: content.length,
            base64Data: content.toString('base64'),
          },
        })
      ).rejects.toThrow('DUPLICATE_DETECTED');
    });
  });

  describe('uploadBatch', () => {
    it('should upload multiple files successfully', async () => {
      const caller = documentUploadRouter.createCaller(ctx);

      const files = [
        { filename: 'doc1.pdf', content: 'content 1' },
        { filename: 'doc2.pdf', content: 'content 2' },
        { filename: 'doc3.pdf', content: 'content 3' },
      ].map(f => ({
        filename: f.filename,
        mimeType: 'application/pdf' as const,
        size: Buffer.from(f.content).length,
        base64Data: Buffer.from(f.content).toString('base64'),
      }));

      const result = await caller.uploadBatch({ files });

      expect(result.totalFiles).toBe(3);
      expect(result.uploadedFiles).toBe(3);
      expect(result.failedFiles).toBe(0);
      expect(result.results.every(r => r.success)).toBe(true);
    });

    it('should continue processing after individual failures', async () => {
      const caller = documentUploadRouter.createCaller(ctx);

      // First upload a file to create a duplicate situation
      const duplicateContent = Buffer.from('will be duplicated');
      await caller.uploadSingle({
        file: {
          filename: 'original.pdf',
          mimeType: 'application/pdf',
          size: duplicateContent.length,
          base64Data: duplicateContent.toString('base64'),
        },
      });

      // Batch with one duplicate
      const files = [
        { filename: 'new1.pdf', content: 'new content 1' },
        { filename: 'duplicate.pdf', content: 'will be duplicated' }, // Duplicate
        { filename: 'new2.pdf', content: 'new content 2' },
      ].map(f => ({
        filename: f.filename,
        mimeType: 'application/pdf' as const,
        size: Buffer.from(f.content).length,
        base64Data: Buffer.from(f.content).toString('base64'),
      }));

      const result = await caller.uploadBatch({ files });

      expect(result.totalFiles).toBe(3);
      expect(result.uploadedFiles).toBe(2);
      expect(result.failedFiles).toBe(1);
      expect(result.results.find(r => r.filename === 'duplicate.pdf')?.success).toBe(false);
    });
  });

  describe('RLS Policies', () => {
    it('should only return documents for current organization', async () => {
      // Create document in different organization context
      const otherOrgCtx = await createTestContext({ organizationId: 'other-org' });
      const otherCaller = documentUploadRouter.createCaller(otherOrgCtx);

      const content = Buffer.from('other org content');
      await otherCaller.uploadSingle({
        file: {
          filename: 'other-org.pdf',
          mimeType: 'application/pdf',
          size: content.length,
          base64Data: content.toString('base64'),
        },
      });

      // Query from original context
      const caller = documentUploadRouter.createCaller(ctx);
      const stats = await caller.getUploadStats({ period: 'day' });

      expect(stats.totalDocuments).toBe(0);
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Document Upload E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    await page.goto('/documents/upload');
  });

  test('should upload document via drag and drop', async ({ page }) => {
    // Create test file
    const buffer = Buffer.from('%PDF-1.4 test content');

    // Simulate drag and drop
    const dropZone = page.locator('[data-testid="drop-zone"]');

    // Create DataTransfer with file
    await page.evaluate(async (b64) => {
      const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([buffer], 'test-invoice.pdf', { type: 'application/pdf' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropZone = document.querySelector('[data-testid="drop-zone"]');
      dropZone?.dispatchEvent(new DragEvent('drop', {
        dataTransfer,
        bubbles: true
      }));
    }, buffer.toString('base64'));

    // Wait for upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Wait for completion
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });

    // Verify document appears in list
    await expect(page.locator('text=test-invoice.pdf')).toBeVisible();
  });

  test('should reject file larger than 50MB', async ({ page }) => {
    // Create oversized file input
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="file-input-button"]');
    const fileChooser = await fileChooserPromise;

    // This would fail because we can't actually create 51MB file in test
    // In real test, mock the validation response
    await page.route('**/api/trpc/doc.uploadSingle*', route => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          error: {
            message: 'Plik przekracza maksymalny rozmiar 50MB',
          },
        }),
      });
    });

    // Verify error message
    await expect(page.locator('text=Plik przekracza maksymalny rozmiar')).toBeVisible();
  });

  test('should handle batch upload with progress', async ({ page }) => {
    // Select multiple files
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="batch-upload-button"]');
    const fileChooser = await fileChooserPromise;

    // Create test files
    const files = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf'].map(name => ({
      name,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 ${name} content`),
    }));

    await fileChooser.setFiles(files);

    // Verify batch progress UI
    await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
    await expect(page.locator('text=/Przesyłanie: \\d+ z 3/')).toBeVisible();

    // Wait for completion
    await expect(page.locator('text=Przesłano: 3 | Błędy: 0')).toBeVisible({ timeout: 30000 });
  });

  test('should show duplicate detection dialog', async ({ page }) => {
    // First upload
    const buffer = Buffer.from('%PDF-1.4 duplicate test');

    // Upload first file
    await page.evaluate(async (b64) => {
      const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([buffer], 'original.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, buffer.toString('base64'));

    await expect(page.locator('text=original.pdf')).toBeVisible({ timeout: 10000 });

    // Upload same file again
    await page.evaluate(async (b64) => {
      const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([buffer], 'copy.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, buffer.toString('base64'));

    // Verify duplicate dialog
    await expect(page.locator('[data-testid="duplicate-dialog"]')).toBeVisible();
    await expect(page.locator('text=Ten dokument już istnieje')).toBeVisible();

    // Click "Create Version"
    await page.click('[data-testid="create-version-button"]');

    // Verify version created
    await expect(page.locator('text=Wersja 2')).toBeVisible();
  });

  test('should display metadata form after upload', async ({ page }) => {
    const buffer = Buffer.from('%PDF-1.4 metadata test');

    await page.evaluate(async (b64) => {
      const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([buffer], 'invoice.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, buffer.toString('base64'));

    await expect(page.locator('[data-testid="metadata-form"]')).toBeVisible();

    // Fill metadata
    await page.selectOption('[data-testid="document-type"]', 'INVOICE');
    await page.fill('[data-testid="document-title"]', 'Faktura VAT 2024/001');
    await page.click('[data-testid="client-selector"]');
    await page.click('text=ABC Company');
    await page.fill('[data-testid="tags-input"]', 'VAT, 2024');

    // Save
    await page.click('[data-testid="save-metadata-button"]');

    // Verify saved
    await expect(page.locator('text=Metadane zapisane')).toBeVisible();
  });
});
```

---

## 🔐 Security Checklist

### Authentication & Authorization
- [ ] All endpoints require valid session token
- [ ] Organization isolation via RLS policies
- [ ] Upload permissions validated before processing
- [ ] Admin-only access for quarantine management

### Input Validation
- [ ] File size validation on client and server
- [ ] MIME type verification against extension
- [ ] Magic bytes verification for file content
- [ ] Filename sanitization (no path traversal)
- [ ] Metadata sanitization (XSS prevention)

### File Security
- [ ] Virus scanning with ClamAV before storage
- [ ] Infected files quarantined immediately
- [ ] Files stored with random names (no original filenames in path)
- [ ] Presigned URLs with short expiry (5 minutes)
- [ ] No direct file access - all via CDN with authentication

### Data Protection
- [ ] Files encrypted at rest (S3 server-side encryption)
- [ ] Files encrypted in transit (HTTPS/TLS)
- [ ] Checksums verified for integrity
- [ ] Audit logging for all upload operations

### Rate Limiting
- [ ] Upload requests rate limited per user
- [ ] Batch upload limited to 100 files
- [ ] Concurrent uploads limited to 5
- [ ] Presigned URL generation rate limited

---

## 📊 Audit Events

All document upload operations generate immutable audit events:

| Event Type | Trigger | Data Captured |
|------------|---------|---------------|
| `DOCUMENT_UPLOADED` | Successful upload | filename, size, mimeType, documentId |
| `UPLOAD_FAILED` | Upload failure | filename, errorMessage, reason |
| `VIRUS_DETECTED` | Malware found | filename, threatName, scanResult |
| `DUPLICATE_DETECTED` | Duplicate found | filename, originalDocumentId, checksum |
| `DUPLICATE_RESOLVED` | Duplicate handled | resolution, documentId |
| `BATCH_UPLOAD_STARTED` | Batch initiated | sessionId, totalFiles |
| `BATCH_UPLOAD_COMPLETED` | Batch finished | sessionId, uploadedFiles, failedFiles |
| `QUARANTINE_REVIEWED` | Quarantine action | quarantineId, resolution, reviewedBy |
| `PRESIGNED_URL_GENERATED` | URL requested | filename, expiresAt |

---

## 📝 Implementation Notes

### Performance Considerations
- Use presigned URLs for large files to bypass server memory constraints
- Implement chunked upload for files >10MB
- Generate thumbnails asynchronously after upload confirmation
- Use Redis for caching duplicate checksums for fast lookup
- Implement upload progress via WebSocket or Server-Sent Events

### Polish Localization
- All user-facing messages in Polish
- Support for Polish characters in filenames (UTF-8)
- Date formatting according to Polish conventions
- File size display in Polish format (e.g., "50 MB")

### CDN Configuration
- CloudFront distribution for fast document delivery
- Origin Access Identity for S3 bucket protection
- Cache invalidation for updated documents
- Geographic restrictions if required for compliance

### Monitoring
- Track upload success/failure rates
- Monitor virus detection frequency
- Alert on high duplicate detection rates
- Track storage consumption per organization

---

## 🔗 Dependencies

### Internal
- **AIM**: User authentication and organization context
- **CRM**: Client association for document metadata

### External
- **AWS S3**: Document storage
- **CloudFront CDN**: Document delivery
- **ClamAV**: Virus scanning
- **Sharp**: Image processing for thumbnails

---

*Story created: December 2024*
*Last updated: December 2024*
