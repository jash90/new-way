# DOC-010: Batch Operations

> **Story ID**: DOC-010
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P2 (Important)
> **Story Points**: 5
> **Phase**: Week 16
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want** to perform bulk document operations,
**So that** I can efficiently manage large document sets without repetitive manual work.

---

## Business Context

### Problem Statement
Accountants frequently need to perform the same operation on multiple documents - uploading invoice batches from clients, downloading documents for audit preparation, applying tags to entire fiscal period sets, or exporting documents for external review. Without batch operations, these tasks require tedious one-by-one processing that wastes significant time.

### Business Value
- **Time Savings**: 90% reduction in time for multi-document operations
- **Consistency**: Uniform processing prevents partial updates
- **Error Reduction**: Atomic operations with rollback prevent inconsistent states
- **Audit Preparation**: Bulk export for tax audits and compliance reviews
- **Client Onboarding**: Mass upload for new client document migration
- **Fiscal Year Archiving**: Bulk operations for year-end document management

### Success Metrics
- Batch upload: 50+ documents in <30 seconds
- Bulk download: 100 documents ZIP in <60 seconds
- Bulk tag/untag: 500 documents in <10 seconds
- Progress tracking: Real-time updates every 500ms
- Error rate: <1% for batch operations
- Partial success handling: Continue on errors with detailed reporting

---

## Acceptance Criteria

### Scenario 1: Bulk Upload with Drag-and-Drop
```gherkin
Given I am an authenticated accountant
  And I am on the document upload page
When I drag and drop 25 PDF files (total 150MB) onto the upload zone
  And I select target folder "Faktury/2024/Grudzień"
  And I click "Upload All"
Then the system should show a progress bar with file count (0/25)
  And each file should be virus scanned before acceptance
  And the progress should update as each file completes
  And duplicate files should be detected via SHA-256 checksum
  And upon completion I should see a summary:
    | Successful | 23  |
    | Duplicates | 1   |
    | Failed     | 1   |
  And failed files should show specific error messages
  And I should be able to retry failed uploads individually
```

### Scenario 2: Bulk Download as ZIP Archive
```gherkin
Given I am an authenticated accountant
  And I have selected 50 documents using checkbox selection
  And the total size is 200MB
When I click "Download Selected" button
  And I choose "ZIP Archive" format
Then the system should show "Preparing download..." with progress
  And files should be organized in folders matching their document paths
  And the ZIP should include a manifest.csv with document metadata:
    | Column         | Description                    |
    | filename       | Original document name         |
    | document_id    | System UUID                    |
    | document_type  | INVOICE, RECEIPT, etc.         |
    | upload_date    | ISO 8601 timestamp             |
    | client_name    | Associated client              |
    | tags           | Comma-separated tag list       |
  And for large archives (>100MB) the system should email download link
  And download links should expire after 24 hours
```

### Scenario 3: Bulk Tag/Untag Operations
```gherkin
Given I am an authenticated accountant
  And I have searched for documents with filter "type:INVOICE AND date:2024-Q4"
  And the search returned 150 matching documents
When I click "Select All (150)"
  And I click "Bulk Actions" → "Add Tags"
  And I select tags ["Rozliczony", "Koszty 2024", "Odliczony VAT"]
  And I click "Apply to 150 documents"
Then the system should show progress indicator
  And tags should be added atomically (all or nothing per document)
  And existing tags should be preserved
  And the operation should complete within 10 seconds
  And I should receive confirmation: "Added 3 tags to 150 documents"
  And the operation should be logged in audit trail
```

### Scenario 4: Bulk Move to Different Folder
```gherkin
Given I am an authenticated accountant
  And I have 30 documents selected from "Inbox"
When I click "Move to..." and select "Faktury/2024/Styczeń"
Then the system should validate that all documents can be moved
  And should check for naming conflicts in destination
  And should show confirmation: "Move 30 documents to Faktury/2024/Styczeń?"
  And upon confirmation should move all documents
  And should update all document paths atomically
  And should preserve document versions and metadata
  And original folder references should be updated in related records
```

### Scenario 5: Bulk Delete with Soft Delete
```gherkin
Given I am an authenticated accountant
  And I have selected 20 documents for deletion
When I click "Delete Selected"
Then the system should show warning dialog with document list
  And should check for linked records (accounting entries, workflows)
  And should warn about documents with active share links (3 found)
  And should require confirmation by typing "USUŃ" for >10 documents
  And upon confirmation should soft-delete all documents
  And should set retention_until based on document type:
    | Type           | Retention      |
    | INVOICE        | 5 years        |
    | PAYROLL        | 10 years       |
    | CONTRACT       | 10 years       |
    | OTHER          | 5 years        |
  And deleted documents should be recoverable for 30 days
  And share links should be automatically revoked
```

### Scenario 6: Bulk Export with Format Selection
```gherkin
Given I am an authenticated accountant
  And I have selected 75 documents for export
When I click "Export" and choose export format:
  | Format           | Description                          |
  | Original         | Keep original file formats           |
  | PDF Conversion   | Convert all to PDF                   |
  | Searchable PDF   | Convert with OCR text layer          |
And I select additional options:
  | Include metadata JSON | Yes |
  | Include thumbnails    | Yes |
  | Add watermark         | No  |
  | Flatten folder structure | No |
Then the system should create export job
  And should process documents in background
  And should notify via email when complete
  And should provide download link valid for 7 days
  And should log export for audit compliance
```

### Scenario 7: Progress Tracking and Cancellation
```gherkin
Given I am an authenticated accountant
  And I have started a bulk operation on 200 documents
When the operation is 45% complete (90/200 documents)
Then I should see real-time progress:
  | Metric              | Value           |
  | Total               | 200             |
  | Completed           | 90              |
  | In Progress         | 5               |
  | Failed              | 2               |
  | Remaining           | 103             |
  | Estimated Time      | 2m 15s          |
  | Current Speed       | 15 docs/min     |
And I should be able to click "Cancel Operation"
  And upon cancellation already-completed operations should remain
  And pending operations should be cancelled
  And I should receive summary of what was completed vs cancelled
```

### Scenario 8: Error Handling and Partial Success
```gherkin
Given I am an authenticated accountant
  And I have started bulk upload of 100 documents
When 5 documents fail due to various errors:
  | File                | Error                              |
  | corrupted.pdf       | Invalid PDF structure              |
  | too_large.pdf       | Exceeds 50MB limit                 |
  | virus.exe           | Malware detected                   |
  | unsupported.psd     | Unsupported file format            |
  | network_timeout.pdf | Upload timeout after 60s           |
Then the operation should continue processing remaining files
  And successful uploads (95) should be saved
  And failed files should be listed with specific errors
  And I should be able to:
    | Action                  | Description                       |
    | Retry failed            | Retry only failed uploads         |
    | Download error report   | CSV with failure details          |
    | Skip and complete       | Accept partial success            |
  And audit log should record both successes and failures
```

---

## Technical Specification

### Database Schema

```sql
-- Batch operation jobs
CREATE TABLE batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),

    -- Job identification
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN (
        'bulk_upload', 'bulk_download', 'bulk_tag', 'bulk_untag',
        'bulk_move', 'bulk_delete', 'bulk_export', 'bulk_restore'
    )),
    job_name VARCHAR(255),

    -- Job status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled', 'partial'
    )),

    -- Progress tracking
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    successful_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    skipped_items INTEGER NOT NULL DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion TIMESTAMPTZ,

    -- Configuration
    configuration JSONB NOT NULL DEFAULT '{}',
    -- Example configuration for bulk_tag:
    -- {
    --   "tag_ids": ["uuid1", "uuid2"],
    --   "operation": "add" | "remove" | "replace",
    --   "document_ids": ["doc1", "doc2", ...]
    -- }

    -- Results
    result_summary JSONB,
    -- {
    --   "success_count": 95,
    --   "failure_count": 5,
    --   "failures": [{"document_id": "...", "error": "..."}],
    --   "download_url": "...",
    --   "download_expires_at": "..."
    -- }

    -- Error handling
    error_message TEXT,
    error_details JSONB,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for batch_jobs
CREATE INDEX idx_batch_jobs_organization ON batch_jobs(organization_id);
CREATE INDEX idx_batch_jobs_user ON batch_jobs(user_id);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_batch_jobs_created ON batch_jobs(created_at DESC);
CREATE INDEX idx_batch_jobs_type_status ON batch_jobs(job_type, status);

-- Individual items within batch jobs
CREATE TABLE batch_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_job_id UUID NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,

    -- Item identification
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_path VARCHAR(1024), -- For uploads: original filename
    target_path VARCHAR(1024), -- For moves: destination path

    -- Item status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'skipped', 'cancelled'
    )),

    -- Processing details
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,

    -- Results
    result_data JSONB,
    -- {
    --   "new_document_id": "...",
    --   "bytes_processed": 1234567,
    --   "checksum": "sha256:..."
    -- }

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Ordering
    sequence_number INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for batch_job_items
CREATE INDEX idx_batch_job_items_job ON batch_job_items(batch_job_id);
CREATE INDEX idx_batch_job_items_document ON batch_job_items(document_id);
CREATE INDEX idx_batch_job_items_status ON batch_job_items(status);
CREATE INDEX idx_batch_job_items_sequence ON batch_job_items(batch_job_id, sequence_number);

-- Batch download files (for ZIP archives)
CREATE TABLE batch_download_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_job_id UUID NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,

    -- File storage
    storage_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,

    -- Access control
    download_token VARCHAR(128) UNIQUE NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    max_downloads INTEGER DEFAULT 10,
    expires_at TIMESTAMPTZ NOT NULL,

    -- Tracking
    last_downloaded_at TIMESTAMPTZ,
    last_downloaded_by UUID REFERENCES users(id),
    last_downloaded_ip INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for batch_download_files
CREATE INDEX idx_batch_download_files_job ON batch_download_files(batch_job_id);
CREATE INDEX idx_batch_download_files_token ON batch_download_files(download_token);
CREATE INDEX idx_batch_download_files_expires ON batch_download_files(expires_at);

-- Batch operation templates (for repeated operations)
CREATE TABLE batch_operation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),

    -- Template details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    job_type VARCHAR(50) NOT NULL,

    -- Saved configuration
    configuration_template JSONB NOT NULL,
    -- {
    --   "tag_ids": ["uuid1", "uuid2"],
    --   "operation": "add",
    --   "filters": {...}
    -- }

    -- Usage tracking
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Metadata
    is_shared BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_download_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_operation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY batch_jobs_org_isolation ON batch_jobs
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY batch_job_items_via_job ON batch_job_items
    FOR ALL USING (
        batch_job_id IN (
            SELECT id FROM batch_jobs
            WHERE organization_id = current_setting('app.current_organization_id')::UUID
        )
    );

CREATE POLICY batch_downloads_via_job ON batch_download_files
    FOR ALL USING (
        batch_job_id IN (
            SELECT id FROM batch_jobs
            WHERE organization_id = current_setting('app.current_organization_id')::UUID
        )
    );

CREATE POLICY batch_templates_org_isolation ON batch_operation_templates
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// ============================================
// Batch Job Types
// ============================================

export const batchJobTypeSchema = z.enum([
  'bulk_upload',
  'bulk_download',
  'bulk_tag',
  'bulk_untag',
  'bulk_move',
  'bulk_delete',
  'bulk_export',
  'bulk_restore'
]);

export const batchJobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'partial'
]);

export const batchItemStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'skipped',
  'cancelled'
]);

// ============================================
// Bulk Upload
// ============================================

export const bulkUploadConfigSchema = z.object({
  targetFolderId: z.string().uuid().optional(),
  targetPath: z.string().max(1024).optional(),
  skipDuplicates: z.boolean().default(true),
  autoClassify: z.boolean().default(true),
  autoExtract: z.boolean().default(true),
  tagIds: z.array(z.string().uuid()).max(10).optional(),
  clientId: z.string().uuid().optional(),
  fiscalPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() // YYYY-MM
});

export const bulkUploadItemSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(52_428_800), // 50MB
  mimeType: z.string().max(100),
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/)
});

export const createBulkUploadJobSchema = z.object({
  config: bulkUploadConfigSchema,
  files: z.array(bulkUploadItemSchema).min(1).max(500)
});

// ============================================
// Bulk Download
// ============================================

export const bulkDownloadConfigSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(1000),
  format: z.enum(['zip', 'tar_gz']).default('zip'),
  includeMetadata: z.boolean().default(true),
  includeThumbnails: z.boolean().default(false),
  flattenStructure: z.boolean().default(false),
  filenamePattern: z.string().max(100).optional(), // e.g., "{date}_{type}_{name}"
  notifyEmail: z.string().email().optional()
});

export const createBulkDownloadJobSchema = z.object({
  config: bulkDownloadConfigSchema,
  jobName: z.string().max(255).optional()
});

// ============================================
// Bulk Tag Operations
// ============================================

export const tagOperationSchema = z.enum(['add', 'remove', 'replace']);

export const bulkTagConfigSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(10000),
  operation: tagOperationSchema,
  tagIds: z.array(z.string().uuid()).min(1).max(20)
});

export const createBulkTagJobSchema = z.object({
  config: bulkTagConfigSchema
});

// ============================================
// Bulk Move
// ============================================

export const bulkMoveConfigSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(1000),
  targetFolderId: z.string().uuid().optional(),
  targetPath: z.string().max(1024),
  conflictResolution: z.enum(['skip', 'rename', 'overwrite']).default('rename')
});

export const createBulkMoveJobSchema = z.object({
  config: bulkMoveConfigSchema
});

// ============================================
// Bulk Delete
// ============================================

export const bulkDeleteConfigSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(1000),
  hardDelete: z.boolean().default(false), // Soft delete by default
  revokeShareLinks: z.boolean().default(true),
  confirmationCode: z.string().optional() // Required for >10 docs
});

export const createBulkDeleteJobSchema = z.object({
  config: bulkDeleteConfigSchema
}).refine(
  (data) => {
    if (data.config.documentIds.length > 10) {
      return data.config.confirmationCode === 'USUŃ';
    }
    return true;
  },
  { message: 'Confirmation code "USUŃ" required for deleting >10 documents' }
);

// ============================================
// Bulk Export
// ============================================

export const exportFormatSchema = z.enum([
  'original',
  'pdf',
  'searchable_pdf'
]);

export const bulkExportConfigSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(1000),
  format: exportFormatSchema.default('original'),
  includeMetadataJson: z.boolean().default(true),
  includeThumbnails: z.boolean().default(false),
  addWatermark: z.boolean().default(false),
  watermarkText: z.string().max(100).optional(),
  flattenStructure: z.boolean().default(false),
  encryptZip: z.boolean().default(false),
  zipPassword: z.string().min(8).max(128).optional(),
  notifyEmail: z.string().email().optional()
});

export const createBulkExportJobSchema = z.object({
  config: bulkExportConfigSchema,
  jobName: z.string().max(255).optional()
}).refine(
  (data) => {
    if (data.config.encryptZip) {
      return !!data.config.zipPassword;
    }
    return true;
  },
  { message: 'ZIP password required when encryption is enabled' }
);

// ============================================
// Bulk Restore (from soft delete)
// ============================================

export const bulkRestoreConfigSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(1000),
  restoreShareLinks: z.boolean().default(false)
});

export const createBulkRestoreJobSchema = z.object({
  config: bulkRestoreConfigSchema
});

// ============================================
// Job Progress and Status
// ============================================

export const batchJobProgressSchema = z.object({
  jobId: z.string().uuid(),
  status: batchJobStatusSchema,
  totalItems: z.number().int().nonnegative(),
  processedItems: z.number().int().nonnegative(),
  successfulItems: z.number().int().nonnegative(),
  failedItems: z.number().int().nonnegative(),
  skippedItems: z.number().int().nonnegative(),
  percentComplete: z.number().min(0).max(100),
  estimatedTimeRemaining: z.number().int().nonnegative().optional(), // seconds
  currentSpeed: z.number().nonnegative().optional(), // items per second
  startedAt: z.string().datetime().optional(),
  estimatedCompletion: z.string().datetime().optional()
});

export const batchJobResultSchema = z.object({
  jobId: z.string().uuid(),
  jobType: batchJobTypeSchema,
  status: batchJobStatusSchema,
  summary: z.object({
    totalItems: z.number().int().nonnegative(),
    successfulItems: z.number().int().nonnegative(),
    failedItems: z.number().int().nonnegative(),
    skippedItems: z.number().int().nonnegative(),
    processingTimeMs: z.number().int().nonnegative()
  }),
  failures: z.array(z.object({
    documentId: z.string().uuid().optional(),
    fileName: z.string().optional(),
    errorCode: z.string(),
    errorMessage: z.string()
  })).optional(),
  downloadUrl: z.string().url().optional(),
  downloadExpiresAt: z.string().datetime().optional()
});

// ============================================
// Operation Templates
// ============================================

export const createBatchTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  jobType: batchJobTypeSchema,
  configurationTemplate: z.record(z.unknown()),
  isShared: z.boolean().default(false)
});

export const updateBatchTemplateSchema = createBatchTemplateSchema.partial();

// ============================================
// Query Schemas
// ============================================

export const listBatchJobsQuerySchema = z.object({
  status: batchJobStatusSchema.optional(),
  jobType: batchJobTypeSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

export const getJobItemsQuerySchema = z.object({
  jobId: z.string().uuid(),
  status: batchItemStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0)
});
```

### Service Implementation

```typescript
// src/services/batch-operations.service.ts

import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { s3Client } from '@/lib/s3';
import { documentService } from './document.service';
import { eventEmitter } from '@/lib/events';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import type {
  BatchJobType,
  BatchJobStatus,
  BulkUploadConfig,
  BulkDownloadConfig,
  BulkTagConfig,
  BulkMoveConfig,
  BulkDeleteConfig,
  BulkExportConfig,
  BulkRestoreConfig,
  BatchJobProgress
} from '@/types/batch-operations';

// Constants
const MAX_CONCURRENT_ITEMS = 10;
const PROGRESS_UPDATE_INTERVAL = 500; // ms
const DOWNLOAD_EXPIRY_HOURS = 24;
const EXPORT_EXPIRY_DAYS = 7;
const MAX_ZIP_SIZE_BYTES = 5_368_709_120; // 5GB
const LARGE_DOWNLOAD_THRESHOLD = 104_857_600; // 100MB

export class BatchOperationsService {
  // ============================================
  // Job Creation
  // ============================================

  async createBulkUploadJob(
    organizationId: string,
    userId: string,
    config: BulkUploadConfig,
    files: Array<{ fileName: string; fileSize: number; mimeType: string; checksum: string }>
  ): Promise<{ jobId: string; uploadUrls: Array<{ fileName: string; uploadUrl: string }> }> {
    // Validate total size
    const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);
    if (totalSize > MAX_ZIP_SIZE_BYTES) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Total upload size ${(totalSize / 1e9).toFixed(2)}GB exceeds maximum 5GB`
      });
    }

    // Create job
    const job = await db.batchJob.create({
      data: {
        organizationId,
        userId,
        jobType: 'bulk_upload',
        status: 'pending',
        totalItems: files.length,
        configuration: config
      }
    });

    // Create job items and generate presigned upload URLs
    const uploadUrls: Array<{ fileName: string; uploadUrl: string; itemId: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const itemId = uuidv4();
      const storageKey = `uploads/${organizationId}/${job.id}/${itemId}/${file.fileName}`;

      // Create job item
      await db.batchJobItem.create({
        data: {
          id: itemId,
          batchJobId: job.id,
          sourcePath: file.fileName,
          status: 'pending',
          sequenceNumber: i,
          resultData: {
            expectedChecksum: file.checksum,
            expectedSize: file.fileSize,
            mimeType: file.mimeType,
            storageKey
          }
        }
      });

      // Generate presigned upload URL
      const uploadUrl = await s3Client.getSignedUploadUrl(storageKey, {
        contentType: file.mimeType,
        maxSize: file.fileSize,
        expiresIn: 3600 // 1 hour
      });

      uploadUrls.push({ fileName: file.fileName, uploadUrl, itemId });
    }

    // Start background processing after uploads complete
    await this.scheduleJobProcessing(job.id);

    return { jobId: job.id, uploadUrls };
  }

  async createBulkDownloadJob(
    organizationId: string,
    userId: string,
    config: BulkDownloadConfig,
    jobName?: string
  ): Promise<{ jobId: string }> {
    // Validate all documents exist and are accessible
    const documents = await db.document.findMany({
      where: {
        id: { in: config.documentIds },
        organizationId,
        deletedAt: null
      },
      select: { id: true, fileName: true, storagePath: true, fileSizeBytes: true }
    });

    if (documents.length !== config.documentIds.length) {
      const foundIds = new Set(documents.map(d => d.id));
      const missingIds = config.documentIds.filter(id => !foundIds.has(id));
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Documents not found: ${missingIds.slice(0, 5).join(', ')}${missingIds.length > 5 ? '...' : ''}`
      });
    }

    // Calculate total size
    const totalSize = documents.reduce((sum, d) => sum + (d.fileSizeBytes || 0), 0);
    if (totalSize > MAX_ZIP_SIZE_BYTES) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Total download size ${(totalSize / 1e9).toFixed(2)}GB exceeds maximum 5GB`
      });
    }

    // Create job
    const job = await db.batchJob.create({
      data: {
        organizationId,
        userId,
        jobType: 'bulk_download',
        jobName: jobName || `Download ${documents.length} documents`,
        status: 'pending',
        totalItems: documents.length,
        configuration: {
          ...config,
          totalSizeBytes: totalSize,
          requiresEmailNotification: totalSize > LARGE_DOWNLOAD_THRESHOLD
        }
      }
    });

    // Create job items
    await db.batchJobItem.createMany({
      data: documents.map((doc, i) => ({
        batchJobId: job.id,
        documentId: doc.id,
        sourcePath: doc.storagePath,
        status: 'pending',
        sequenceNumber: i
      }))
    });

    // Start processing
    await this.startJobProcessing(job.id);

    return { jobId: job.id };
  }

  async createBulkTagJob(
    organizationId: string,
    userId: string,
    config: BulkTagConfig
  ): Promise<{ jobId: string }> {
    // Validate tags exist
    const tags = await db.documentTag.findMany({
      where: {
        id: { in: config.tagIds },
        organizationId
      }
    });

    if (tags.length !== config.tagIds.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'One or more tags not found'
      });
    }

    // Validate documents exist
    const documentCount = await db.document.count({
      where: {
        id: { in: config.documentIds },
        organizationId,
        deletedAt: null
      }
    });

    if (documentCount !== config.documentIds.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Only ${documentCount} of ${config.documentIds.length} documents found`
      });
    }

    // Create job
    const job = await db.batchJob.create({
      data: {
        organizationId,
        userId,
        jobType: config.operation === 'remove' ? 'bulk_untag' : 'bulk_tag',
        status: 'pending',
        totalItems: config.documentIds.length,
        configuration: config
      }
    });

    // Create job items
    await db.batchJobItem.createMany({
      data: config.documentIds.map((docId, i) => ({
        batchJobId: job.id,
        documentId: docId,
        status: 'pending',
        sequenceNumber: i
      }))
    });

    // Start processing
    await this.startJobProcessing(job.id);

    return { jobId: job.id };
  }

  async createBulkMoveJob(
    organizationId: string,
    userId: string,
    config: BulkMoveConfig
  ): Promise<{ jobId: string }> {
    // Validate target folder exists
    if (config.targetFolderId) {
      const folder = await db.documentFolder.findFirst({
        where: { id: config.targetFolderId, organizationId }
      });
      if (!folder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Target folder not found'
        });
      }
    }

    // Create job
    const job = await db.batchJob.create({
      data: {
        organizationId,
        userId,
        jobType: 'bulk_move',
        status: 'pending',
        totalItems: config.documentIds.length,
        configuration: config
      }
    });

    // Create job items
    await db.batchJobItem.createMany({
      data: config.documentIds.map((docId, i) => ({
        batchJobId: job.id,
        documentId: docId,
        targetPath: config.targetPath,
        status: 'pending',
        sequenceNumber: i
      }))
    });

    // Start processing
    await this.startJobProcessing(job.id);

    return { jobId: job.id };
  }

  async createBulkDeleteJob(
    organizationId: string,
    userId: string,
    config: BulkDeleteConfig
  ): Promise<{ jobId: string; warnings: string[] }> {
    const warnings: string[] = [];

    // Check for linked records
    const linkedDocs = await db.document.findMany({
      where: {
        id: { in: config.documentIds },
        organizationId,
        OR: [
          { journalEntryLinks: { some: {} } },
          { workflowInstances: { some: { status: 'active' } } },
          { shareLinks: { some: { isActive: true } } }
        ]
      },
      select: {
        id: true,
        fileName: true,
        _count: {
          select: {
            journalEntryLinks: true,
            workflowInstances: true,
            shareLinks: true
          }
        }
      }
    });

    if (linkedDocs.length > 0) {
      const withAccounting = linkedDocs.filter(d => d._count.journalEntryLinks > 0);
      const withWorkflows = linkedDocs.filter(d => d._count.workflowInstances > 0);
      const withShareLinks = linkedDocs.filter(d => d._count.shareLinks > 0);

      if (withAccounting.length > 0) {
        warnings.push(`${withAccounting.length} documents linked to accounting entries`);
      }
      if (withWorkflows.length > 0) {
        warnings.push(`${withWorkflows.length} documents in active workflows`);
      }
      if (withShareLinks.length > 0) {
        warnings.push(`${withShareLinks.length} documents have active share links that will be revoked`);
      }
    }

    // Create job
    const job = await db.batchJob.create({
      data: {
        organizationId,
        userId,
        jobType: 'bulk_delete',
        status: 'pending',
        totalItems: config.documentIds.length,
        configuration: {
          ...config,
          hasLinkedRecords: linkedDocs.length > 0
        }
      }
    });

    // Create job items
    await db.batchJobItem.createMany({
      data: config.documentIds.map((docId, i) => ({
        batchJobId: job.id,
        documentId: docId,
        status: 'pending',
        sequenceNumber: i
      }))
    });

    // Start processing
    await this.startJobProcessing(job.id);

    return { jobId: job.id, warnings };
  }

  async createBulkExportJob(
    organizationId: string,
    userId: string,
    config: BulkExportConfig,
    jobName?: string
  ): Promise<{ jobId: string }> {
    // Similar to download but with format conversion
    const documents = await db.document.findMany({
      where: {
        id: { in: config.documentIds },
        organizationId,
        deletedAt: null
      }
    });

    if (documents.length !== config.documentIds.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Some documents not found'
      });
    }

    const job = await db.batchJob.create({
      data: {
        organizationId,
        userId,
        jobType: 'bulk_export',
        jobName: jobName || `Export ${documents.length} documents`,
        status: 'pending',
        totalItems: documents.length,
        configuration: config
      }
    });

    await db.batchJobItem.createMany({
      data: documents.map((doc, i) => ({
        batchJobId: job.id,
        documentId: doc.id,
        status: 'pending',
        sequenceNumber: i
      }))
    });

    await this.startJobProcessing(job.id);

    return { jobId: job.id };
  }

  async createBulkRestoreJob(
    organizationId: string,
    userId: string,
    config: BulkRestoreConfig
  ): Promise<{ jobId: string }> {
    // Find soft-deleted documents
    const deletedDocs = await db.document.findMany({
      where: {
        id: { in: config.documentIds },
        organizationId,
        deletedAt: { not: null }
      }
    });

    if (deletedDocs.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No deleted documents found to restore'
      });
    }

    const job = await db.batchJob.create({
      data: {
        organizationId,
        userId,
        jobType: 'bulk_restore',
        status: 'pending',
        totalItems: deletedDocs.length,
        configuration: config
      }
    });

    await db.batchJobItem.createMany({
      data: deletedDocs.map((doc, i) => ({
        batchJobId: job.id,
        documentId: doc.id,
        status: 'pending',
        sequenceNumber: i
      }))
    });

    await this.startJobProcessing(job.id);

    return { jobId: job.id };
  }

  // ============================================
  // Job Processing
  // ============================================

  private async scheduleJobProcessing(jobId: string): Promise<void> {
    // Add to processing queue (using BullMQ or similar)
    await redis.lpush('batch:jobs:queue', jobId);
    eventEmitter.emit('batch:job:scheduled', { jobId });
  }

  private async startJobProcessing(jobId: string): Promise<void> {
    const job = await db.batchJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        startedAt: new Date()
      }
    });

    // Process based on job type
    switch (job.jobType) {
      case 'bulk_upload':
        await this.processBulkUpload(jobId);
        break;
      case 'bulk_download':
        await this.processBulkDownload(jobId);
        break;
      case 'bulk_tag':
      case 'bulk_untag':
        await this.processBulkTag(jobId);
        break;
      case 'bulk_move':
        await this.processBulkMove(jobId);
        break;
      case 'bulk_delete':
        await this.processBulkDelete(jobId);
        break;
      case 'bulk_export':
        await this.processBulkExport(jobId);
        break;
      case 'bulk_restore':
        await this.processBulkRestore(jobId);
        break;
    }
  }

  private async processBulkDownload(jobId: string): Promise<void> {
    const job = await db.batchJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { status: 'pending' },
          orderBy: { sequenceNumber: 'asc' },
          include: {
            document: true
          }
        }
      }
    });

    if (!job) return;

    const config = job.configuration as BulkDownloadConfig;

    // Create ZIP archive in S3
    const archive = archiver('zip', { zlib: { level: 6 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    const storageKey = `exports/${job.organizationId}/${job.id}/download.zip`;
    const downloadToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');

    // Stream upload to S3
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
        Body: passthrough,
        ContentType: 'application/zip'
      }
    });

    // Create manifest data
    const manifest: Array<Record<string, string>> = [];

    // Process items
    for (const item of job.items) {
      try {
        await db.batchJobItem.update({
          where: { id: item.id },
          data: { status: 'processing', startedAt: new Date() }
        });

        const doc = item.document!;
        const fileStream = await s3Client.getObject(doc.storagePath);

        // Determine archive path
        const archivePath = config.flattenStructure
          ? doc.fileName
          : `${doc.folderPath || ''}/${doc.fileName}`.replace(/^\//, '');

        archive.append(fileStream, { name: archivePath });

        // Add to manifest
        manifest.push({
          filename: doc.fileName,
          document_id: doc.id,
          document_type: doc.documentType || '',
          upload_date: doc.createdAt.toISOString(),
          client_name: doc.clientName || '',
          tags: (doc.tags || []).join(', ')
        });

        await db.batchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            processingTimeMs: Date.now() - item.startedAt!.getTime()
          }
        });

        // Update job progress
        await this.updateJobProgress(jobId);
      } catch (error) {
        await db.batchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    // Add manifest if requested
    if (config.includeMetadata) {
      const csv = this.generateCSV(manifest);
      archive.append(csv, { name: 'manifest.csv' });
    }

    // Finalize archive
    await archive.finalize();
    await upload.done();

    // Get file size
    const headResult = await s3Client.headObject({ Key: storageKey });
    const fileSize = headResult.ContentLength || 0;

    // Create download record
    const expiresAt = new Date(Date.now() + DOWNLOAD_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.batchDownloadFile.create({
      data: {
        batchJobId: jobId,
        storageKey,
        fileName: `documents_${new Date().toISOString().split('T')[0]}.zip`,
        fileSizeBytes: fileSize,
        mimeType: 'application/zip',
        checksumSha256: '', // Calculate from S3
        downloadToken,
        expiresAt
      }
    });

    // Complete job
    const summary = await this.calculateJobSummary(jobId);
    await db.batchJob.update({
      where: { id: jobId },
      data: {
        status: summary.failedItems > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
        resultSummary: {
          ...summary,
          downloadUrl: `/api/batch/download/${downloadToken}`,
          downloadExpiresAt: expiresAt.toISOString()
        }
      }
    });

    // Send email notification if configured
    if (config.notifyEmail || (config as any).requiresEmailNotification) {
      await this.sendCompletionEmail(jobId, config.notifyEmail);
    }
  }

  private async processBulkTag(jobId: string): Promise<void> {
    const job = await db.batchJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { status: 'pending' },
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    });

    if (!job) return;

    const config = job.configuration as BulkTagConfig;
    const startTime = Date.now();

    // Use transaction for atomicity
    await db.$transaction(async (tx) => {
      for (const item of job.items) {
        try {
          const itemStart = Date.now();

          await tx.batchJobItem.update({
            where: { id: item.id },
            data: { status: 'processing', startedAt: new Date() }
          });

          if (config.operation === 'add') {
            // Add tags
            await tx.documentTagAssignment.createMany({
              data: config.tagIds.map(tagId => ({
                documentId: item.documentId!,
                tagId
              })),
              skipDuplicates: true
            });
          } else if (config.operation === 'remove') {
            // Remove tags
            await tx.documentTagAssignment.deleteMany({
              where: {
                documentId: item.documentId!,
                tagId: { in: config.tagIds }
              }
            });
          } else if (config.operation === 'replace') {
            // Replace all tags
            await tx.documentTagAssignment.deleteMany({
              where: { documentId: item.documentId! }
            });
            await tx.documentTagAssignment.createMany({
              data: config.tagIds.map(tagId => ({
                documentId: item.documentId!,
                tagId
              }))
            });
          }

          await tx.batchJobItem.update({
            where: { id: item.id },
            data: {
              status: 'completed',
              completedAt: new Date(),
              processingTimeMs: Date.now() - itemStart
            }
          });
        } catch (error) {
          await tx.batchJobItem.update({
            where: { id: item.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }
    });

    // Complete job
    const summary = await this.calculateJobSummary(jobId);
    await db.batchJob.update({
      where: { id: jobId },
      data: {
        status: summary.failedItems > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
        resultSummary: {
          ...summary,
          processingTimeMs: Date.now() - startTime
        }
      }
    });
  }

  private async processBulkDelete(jobId: string): Promise<void> {
    const job = await db.batchJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { status: 'pending' },
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    });

    if (!job) return;

    const config = job.configuration as BulkDeleteConfig;

    for (const item of job.items) {
      try {
        await db.batchJobItem.update({
          where: { id: item.id },
          data: { status: 'processing', startedAt: new Date() }
        });

        // Revoke share links if configured
        if (config.revokeShareLinks) {
          await db.documentShareLink.updateMany({
            where: { documentId: item.documentId!, isActive: true },
            data: { isActive: false, revokedAt: new Date() }
          });
        }

        if (config.hardDelete) {
          // Permanent deletion
          const doc = await db.document.findUnique({
            where: { id: item.documentId! }
          });

          if (doc) {
            // Delete from S3
            await s3Client.deleteObject({ Key: doc.storagePath });
            // Delete from database
            await db.document.delete({ where: { id: item.documentId! } });
          }
        } else {
          // Soft delete with retention period
          const doc = await db.document.findUnique({
            where: { id: item.documentId! }
          });

          const retentionYears = this.getRetentionPeriod(doc?.documentType);
          const retentionUntil = new Date();
          retentionUntil.setFullYear(retentionUntil.getFullYear() + retentionYears);

          await db.document.update({
            where: { id: item.documentId! },
            data: {
              deletedAt: new Date(),
              deletedBy: job.userId,
              retentionUntil
            }
          });
        }

        await db.batchJobItem.update({
          where: { id: item.id },
          data: { status: 'completed', completedAt: new Date() }
        });

        await this.updateJobProgress(jobId);
      } catch (error) {
        await db.batchJobItem.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    const summary = await this.calculateJobSummary(jobId);
    await db.batchJob.update({
      where: { id: jobId },
      data: {
        status: summary.failedItems > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
        resultSummary: summary
      }
    });
  }

  // Similar implementations for processBulkUpload, processBulkMove,
  // processBulkExport, processBulkRestore...

  // ============================================
  // Progress and Status
  // ============================================

  async getJobProgress(jobId: string): Promise<BatchJobProgress> {
    const job = await db.batchJob.findUnique({
      where: { id: jobId },
      include: {
        _count: {
          select: { items: true }
        }
      }
    });

    if (!job) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
    }

    const itemStats = await db.batchJobItem.groupBy({
      by: ['status'],
      where: { batchJobId: jobId },
      _count: true
    });

    const statusCounts = itemStats.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    const processedItems = (statusCounts.completed || 0) +
                          (statusCounts.failed || 0) +
                          (statusCounts.skipped || 0);

    const percentComplete = job.totalItems > 0
      ? Math.round((processedItems / job.totalItems) * 100)
      : 0;

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | undefined;
    let currentSpeed: number | undefined;

    if (job.startedAt && processedItems > 0) {
      const elapsedMs = Date.now() - job.startedAt.getTime();
      currentSpeed = processedItems / (elapsedMs / 1000);
      const remainingItems = job.totalItems - processedItems;
      estimatedTimeRemaining = Math.round(remainingItems / currentSpeed);
    }

    return {
      jobId: job.id,
      status: job.status as BatchJobStatus,
      totalItems: job.totalItems,
      processedItems,
      successfulItems: statusCounts.completed || 0,
      failedItems: statusCounts.failed || 0,
      skippedItems: statusCounts.skipped || 0,
      percentComplete,
      estimatedTimeRemaining,
      currentSpeed,
      startedAt: job.startedAt?.toISOString(),
      estimatedCompletion: estimatedTimeRemaining
        ? new Date(Date.now() + estimatedTimeRemaining * 1000).toISOString()
        : undefined
    };
  }

  async cancelJob(jobId: string, userId: string): Promise<void> {
    const job = await db.batchJob.findFirst({
      where: { id: jobId, userId }
    });

    if (!job) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
    }

    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot cancel job with status: ${job.status}`
      });
    }

    // Cancel pending items
    await db.batchJobItem.updateMany({
      where: { batchJobId: jobId, status: 'pending' },
      data: { status: 'cancelled' }
    });

    // Update job status
    const summary = await this.calculateJobSummary(jobId);
    await db.batchJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        resultSummary: summary
      }
    });

    eventEmitter.emit('batch:job:cancelled', { jobId, userId });
  }

  async retryFailedItems(jobId: string, userId: string): Promise<{ retriedCount: number }> {
    const job = await db.batchJob.findFirst({
      where: { id: jobId, userId }
    });

    if (!job) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
    }

    // Reset failed items to pending
    const result = await db.batchJobItem.updateMany({
      where: { batchJobId: jobId, status: 'failed' },
      data: {
        status: 'pending',
        errorCode: null,
        errorMessage: null,
        retryCount: { increment: 1 }
      }
    });

    if (result.count > 0) {
      // Restart job processing
      await db.batchJob.update({
        where: { id: jobId },
        data: { status: 'processing' }
      });

      await this.startJobProcessing(jobId);
    }

    return { retriedCount: result.count };
  }

  // ============================================
  // Download Handling
  // ============================================

  async getDownloadByToken(token: string): Promise<{
    storageKey: string;
    fileName: string;
    mimeType: string;
  }> {
    const download = await db.batchDownloadFile.findFirst({
      where: {
        downloadToken: token,
        expiresAt: { gt: new Date() }
      }
    });

    if (!download) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Download link expired or not found'
      });
    }

    if (download.maxDownloads && download.downloadCount >= download.maxDownloads) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Download limit exceeded'
      });
    }

    // Increment download count
    await db.batchDownloadFile.update({
      where: { id: download.id },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: new Date()
      }
    });

    return {
      storageKey: download.storageKey,
      fileName: download.fileName,
      mimeType: download.mimeType
    };
  }

  // ============================================
  // Templates
  // ============================================

  async createTemplate(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      jobType: BatchJobType;
      configurationTemplate: Record<string, unknown>;
      isShared?: boolean;
    }
  ): Promise<{ templateId: string }> {
    const template = await db.batchOperationTemplate.create({
      data: {
        organizationId,
        userId,
        ...data
      }
    });

    return { templateId: template.id };
  }

  async listTemplates(
    organizationId: string,
    userId: string,
    jobType?: BatchJobType
  ): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    jobType: string;
    usageCount: number;
    isShared: boolean;
    isOwner: boolean;
  }>> {
    const templates = await db.batchOperationTemplate.findMany({
      where: {
        organizationId,
        ...(jobType && { jobType }),
        OR: [
          { userId },
          { isShared: true }
        ]
      },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }]
    });

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description || undefined,
      jobType: t.jobType,
      usageCount: t.usageCount,
      isShared: t.isShared,
      isOwner: t.userId === userId
    }));
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async updateJobProgress(jobId: string): Promise<void> {
    const progress = await this.getJobProgress(jobId);

    // Store in Redis for real-time updates
    await redis.setex(
      `batch:progress:${jobId}`,
      300, // 5 minutes TTL
      JSON.stringify(progress)
    );

    // Emit event for WebSocket updates
    eventEmitter.emit('batch:job:progress', progress);
  }

  private async calculateJobSummary(jobId: string): Promise<{
    totalItems: number;
    successfulItems: number;
    failedItems: number;
    skippedItems: number;
    processingTimeMs: number;
  }> {
    const job = await db.batchJob.findUnique({
      where: { id: jobId }
    });

    const stats = await db.batchJobItem.groupBy({
      by: ['status'],
      where: { batchJobId: jobId },
      _count: true
    });

    const statusCounts = stats.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalItems: job?.totalItems || 0,
      successfulItems: statusCounts.completed || 0,
      failedItems: statusCounts.failed || 0,
      skippedItems: statusCounts.skipped || 0,
      processingTimeMs: job?.startedAt
        ? Date.now() - job.startedAt.getTime()
        : 0
    };
  }

  private getRetentionPeriod(documentType?: string): number {
    const retentionMap: Record<string, number> = {
      'INVOICE': 5,
      'RECEIPT': 5,
      'PAYROLL': 10,
      'CONTRACT': 10,
      'BANK_STATEMENT': 5,
      'TAX_DECLARATION': 5
    };
    return retentionMap[documentType || ''] || 5;
  }

  private generateCSV(rows: Array<Record<string, string>>): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  private async sendCompletionEmail(jobId: string, email?: string): Promise<void> {
    // Implementation for email notification
    // Would use a service like SendGrid, SES, etc.
  }
}

export const batchOperationsService = new BatchOperationsService();
```

### tRPC Router

```typescript
// src/server/routers/batch-operations.router.ts

import { router, protectedProcedure } from '../trpc';
import { batchOperationsService } from '@/services/batch-operations.service';
import {
  createBulkUploadJobSchema,
  createBulkDownloadJobSchema,
  createBulkTagJobSchema,
  createBulkMoveJobSchema,
  createBulkDeleteJobSchema,
  createBulkExportJobSchema,
  createBulkRestoreJobSchema,
  listBatchJobsQuerySchema,
  getJobItemsQuerySchema,
  createBatchTemplateSchema,
  updateBatchTemplateSchema,
  batchJobTypeSchema
} from '@/schemas/batch-operations.schema';
import { z } from 'zod';

export const batchOperationsRouter = router({
  // ============================================
  // Job Creation
  // ============================================

  createBulkUploadJob: protectedProcedure
    .input(createBulkUploadJobSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createBulkUploadJob(
        ctx.organizationId,
        ctx.userId,
        input.config,
        input.files
      );
    }),

  createBulkDownloadJob: protectedProcedure
    .input(createBulkDownloadJobSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createBulkDownloadJob(
        ctx.organizationId,
        ctx.userId,
        input.config,
        input.jobName
      );
    }),

  createBulkTagJob: protectedProcedure
    .input(createBulkTagJobSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createBulkTagJob(
        ctx.organizationId,
        ctx.userId,
        input.config
      );
    }),

  createBulkMoveJob: protectedProcedure
    .input(createBulkMoveJobSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createBulkMoveJob(
        ctx.organizationId,
        ctx.userId,
        input.config
      );
    }),

  createBulkDeleteJob: protectedProcedure
    .input(createBulkDeleteJobSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createBulkDeleteJob(
        ctx.organizationId,
        ctx.userId,
        input.config
      );
    }),

  createBulkExportJob: protectedProcedure
    .input(createBulkExportJobSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createBulkExportJob(
        ctx.organizationId,
        ctx.userId,
        input.config,
        input.jobName
      );
    }),

  createBulkRestoreJob: protectedProcedure
    .input(createBulkRestoreJobSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createBulkRestoreJob(
        ctx.organizationId,
        ctx.userId,
        input.config
      );
    }),

  // ============================================
  // Job Status and Progress
  // ============================================

  getJobProgress: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input }) => {
      return batchOperationsService.getJobProgress(input.jobId);
    }),

  getJobResult: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await db.batchJob.findFirst({
        where: {
          id: input.jobId,
          organizationId: ctx.organizationId
        }
      });

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      return {
        jobId: job.id,
        jobType: job.jobType,
        status: job.status,
        summary: job.resultSummary,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      };
    }),

  listJobs: protectedProcedure
    .input(listBatchJobsQuerySchema)
    .query(async ({ ctx, input }) => {
      const jobs = await db.batchJob.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input.status && { status: input.status }),
          ...(input.jobType && { jobType: input.jobType }),
          ...(input.fromDate && { createdAt: { gte: new Date(input.fromDate) } }),
          ...(input.toDate && { createdAt: { lte: new Date(input.toDate) } })
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: input.offset
      });

      const total = await db.batchJob.count({
        where: {
          organizationId: ctx.organizationId,
          ...(input.status && { status: input.status }),
          ...(input.jobType && { jobType: input.jobType })
        }
      });

      return { jobs, total };
    }),

  getJobItems: protectedProcedure
    .input(getJobItemsQuerySchema)
    .query(async ({ ctx, input }) => {
      const items = await db.batchJobItem.findMany({
        where: {
          batchJobId: input.jobId,
          ...(input.status && { status: input.status })
        },
        include: {
          document: {
            select: { id: true, fileName: true, documentType: true }
          }
        },
        orderBy: { sequenceNumber: 'asc' },
        take: input.limit,
        skip: input.offset
      });

      return items;
    }),

  // ============================================
  // Job Control
  // ============================================

  cancelJob: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await batchOperationsService.cancelJob(input.jobId, ctx.userId);
      return { success: true };
    }),

  retryFailedItems: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.retryFailedItems(input.jobId, ctx.userId);
    }),

  // ============================================
  // Downloads
  // ============================================

  getDownloadUrl: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const download = await db.batchDownloadFile.findFirst({
        where: {
          batchJobId: input.jobId,
          expiresAt: { gt: new Date() }
        }
      });

      if (!download) {
        return { available: false };
      }

      return {
        available: true,
        url: `/api/batch/download/${download.downloadToken}`,
        fileName: download.fileName,
        fileSize: download.fileSizeBytes,
        expiresAt: download.expiresAt,
        downloadCount: download.downloadCount,
        maxDownloads: download.maxDownloads
      };
    }),

  // ============================================
  // Templates
  // ============================================

  createTemplate: protectedProcedure
    .input(createBatchTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return batchOperationsService.createTemplate(
        ctx.organizationId,
        ctx.userId,
        input
      );
    }),

  updateTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      updates: updateBatchTemplateSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.batchOperationTemplate.findFirst({
        where: { id: input.templateId, userId: ctx.userId }
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found or access denied'
        });
      }

      await db.batchOperationTemplate.update({
        where: { id: input.templateId },
        data: input.updates
      });

      return { success: true };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.batchOperationTemplate.findFirst({
        where: { id: input.templateId, userId: ctx.userId }
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found or access denied'
        });
      }

      await db.batchOperationTemplate.delete({
        where: { id: input.templateId }
      });

      return { success: true };
    }),

  listTemplates: protectedProcedure
    .input(z.object({
      jobType: batchJobTypeSchema.optional()
    }))
    .query(async ({ ctx, input }) => {
      return batchOperationsService.listTemplates(
        ctx.organizationId,
        ctx.userId,
        input.jobType
      );
    }),

  useTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      documentIds: z.array(z.string().uuid()).min(1).max(10000)
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.batchOperationTemplate.findFirst({
        where: {
          id: input.templateId,
          OR: [
            { userId: ctx.userId },
            { isShared: true, organizationId: ctx.organizationId }
          ]
        }
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found'
        });
      }

      // Update usage count
      await db.batchOperationTemplate.update({
        where: { id: input.templateId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      });

      // Create job from template
      const config = {
        ...template.configurationTemplate,
        documentIds: input.documentIds
      };

      switch (template.jobType) {
        case 'bulk_tag':
        case 'bulk_untag':
          return batchOperationsService.createBulkTagJob(
            ctx.organizationId,
            ctx.userId,
            config as any
          );
        case 'bulk_move':
          return batchOperationsService.createBulkMoveJob(
            ctx.organizationId,
            ctx.userId,
            config as any
          );
        case 'bulk_export':
          return batchOperationsService.createBulkExportJob(
            ctx.organizationId,
            ctx.userId,
            config as any
          );
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Template job type ${template.jobType} not supported`
          });
      }
    }),

  // ============================================
  // Real-time Progress Subscription
  // ============================================

  subscribeToProgress: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .subscription(async function* ({ ctx, input }) {
      // Verify access
      const job = await db.batchJob.findFirst({
        where: {
          id: input.jobId,
          organizationId: ctx.organizationId
        }
      });

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      // Yield progress updates
      while (true) {
        const progress = await batchOperationsService.getJobProgress(input.jobId);
        yield progress;

        if (['completed', 'failed', 'cancelled', 'partial'].includes(progress.status)) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
// src/services/__tests__/batch-operations.service.test.ts

describe('BatchOperationsService', () => {
  describe('createBulkUploadJob', () => {
    it('should create upload job with presigned URLs', async () => {
      const files = [
        { fileName: 'invoice1.pdf', fileSize: 1024000, mimeType: 'application/pdf', checksum: 'sha256:abc123...' },
        { fileName: 'invoice2.pdf', fileSize: 2048000, mimeType: 'application/pdf', checksum: 'sha256:def456...' }
      ];

      const result = await service.createBulkUploadJob(
        orgId,
        userId,
        { targetPath: '/Faktury/2024' },
        files
      );

      expect(result.jobId).toBeDefined();
      expect(result.uploadUrls).toHaveLength(2);
      expect(result.uploadUrls[0]).toHaveProperty('uploadUrl');
    });

    it('should reject when total size exceeds 5GB', async () => {
      const files = Array(100).fill({
        fileName: 'large.pdf',
        fileSize: 52_428_800, // 50MB each = 5GB total
        mimeType: 'application/pdf',
        checksum: 'sha256:...'
      });

      await expect(
        service.createBulkUploadJob(orgId, userId, {}, files)
      ).rejects.toThrow('exceeds maximum 5GB');
    });
  });

  describe('createBulkDownloadJob', () => {
    it('should create download job for valid documents', async () => {
      const docIds = await createTestDocuments(10);

      const result = await service.createBulkDownloadJob(
        orgId,
        userId,
        { documentIds: docIds, format: 'zip', includeMetadata: true }
      );

      expect(result.jobId).toBeDefined();
    });

    it('should reject when documents not found', async () => {
      await expect(
        service.createBulkDownloadJob(orgId, userId, {
          documentIds: ['non-existent-id'],
          format: 'zip'
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('createBulkTagJob', () => {
    it('should add tags to all documents atomically', async () => {
      const docIds = await createTestDocuments(5);
      const tagIds = await createTestTags(2);

      const result = await service.createBulkTagJob(orgId, userId, {
        documentIds: docIds,
        operation: 'add',
        tagIds
      });

      // Wait for job completion
      await waitForJobCompletion(result.jobId);

      // Verify all documents have tags
      for (const docId of docIds) {
        const tags = await db.documentTagAssignment.findMany({
          where: { documentId: docId }
        });
        expect(tags.length).toBe(2);
      }
    });

    it('should replace all tags when operation is replace', async () => {
      const docId = await createTestDocumentWithTags(3);
      const newTagIds = await createTestTags(2);

      await service.createBulkTagJob(orgId, userId, {
        documentIds: [docId],
        operation: 'replace',
        tagIds: newTagIds
      });

      const tags = await db.documentTagAssignment.findMany({
        where: { documentId: docId }
      });
      expect(tags.length).toBe(2);
    });
  });

  describe('createBulkDeleteJob', () => {
    it('should require confirmation for >10 documents', async () => {
      const docIds = await createTestDocuments(15);

      await expect(
        service.createBulkDeleteJob(orgId, userId, {
          documentIds: docIds
        })
      ).rejects.toThrow('Confirmation code "USUŃ" required');
    });

    it('should soft delete with correct retention periods', async () => {
      const invoiceId = await createTestDocument('INVOICE');
      const payrollId = await createTestDocument('PAYROLL');

      await service.createBulkDeleteJob(orgId, userId, {
        documentIds: [invoiceId, payrollId],
        hardDelete: false
      });

      const invoice = await db.document.findUnique({ where: { id: invoiceId } });
      const payroll = await db.document.findUnique({ where: { id: payrollId } });

      expect(invoice?.deletedAt).toBeDefined();
      expect(payroll?.deletedAt).toBeDefined();

      // Invoice: 5 years, Payroll: 10 years
      const invoiceRetention = invoice!.retentionUntil!.getFullYear() - new Date().getFullYear();
      const payrollRetention = payroll!.retentionUntil!.getFullYear() - new Date().getFullYear();

      expect(invoiceRetention).toBe(5);
      expect(payrollRetention).toBe(10);
    });

    it('should revoke share links when configured', async () => {
      const docId = await createTestDocumentWithShareLink();

      await service.createBulkDeleteJob(orgId, userId, {
        documentIds: [docId],
        revokeShareLinks: true
      });

      const shareLinks = await db.documentShareLink.findMany({
        where: { documentId: docId, isActive: true }
      });
      expect(shareLinks.length).toBe(0);
    });
  });

  describe('getJobProgress', () => {
    it('should calculate accurate progress metrics', async () => {
      const jobId = await createTestJobWithItems(100);

      // Simulate partial processing
      await db.batchJobItem.updateMany({
        where: { batchJobId: jobId },
        data: { status: 'completed' },
        take: 45
      });
      await db.batchJobItem.updateMany({
        where: { batchJobId: jobId, status: 'pending' },
        data: { status: 'failed' },
        take: 5
      });

      const progress = await service.getJobProgress(jobId);

      expect(progress.totalItems).toBe(100);
      expect(progress.processedItems).toBe(50);
      expect(progress.successfulItems).toBe(45);
      expect(progress.failedItems).toBe(5);
      expect(progress.percentComplete).toBe(50);
    });

    it('should estimate remaining time accurately', async () => {
      const jobId = await createTestJobWithTiming();

      const progress = await service.getJobProgress(jobId);

      expect(progress.estimatedTimeRemaining).toBeDefined();
      expect(progress.currentSpeed).toBeDefined();
      expect(progress.currentSpeed).toBeGreaterThan(0);
    });
  });

  describe('cancelJob', () => {
    it('should cancel pending items and preserve completed', async () => {
      const jobId = await createTestJobWithItems(10);

      // Process some items
      await db.batchJobItem.updateMany({
        where: { batchJobId: jobId },
        data: { status: 'completed' },
        take: 3
      });

      await service.cancelJob(jobId, userId);

      const job = await db.batchJob.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('cancelled');

      const items = await db.batchJobItem.groupBy({
        by: ['status'],
        where: { batchJobId: jobId },
        _count: true
      });

      const statusMap = items.reduce((acc, i) => ({ ...acc, [i.status]: i._count }), {});
      expect(statusMap.completed).toBe(3);
      expect(statusMap.cancelled).toBe(7);
    });
  });
});
```

### Integration Tests

```typescript
// src/services/__tests__/batch-operations.integration.test.ts

describe('Batch Operations Integration', () => {
  describe('Full Bulk Download Workflow', () => {
    it('should create ZIP with manifest and proper structure', async () => {
      // Create test documents with different paths
      const docs = await Promise.all([
        createTestDocument({ path: '/Faktury/2024/Styczeń' }),
        createTestDocument({ path: '/Faktury/2024/Luty' }),
        createTestDocument({ path: '/Umowy/2024' })
      ]);

      const { jobId } = await batchService.createBulkDownloadJob(
        orgId,
        userId,
        {
          documentIds: docs.map(d => d.id),
          format: 'zip',
          includeMetadata: true,
          flattenStructure: false
        }
      );

      await waitForJobCompletion(jobId);

      // Get download
      const download = await db.batchDownloadFile.findFirst({
        where: { batchJobId: jobId }
      });

      expect(download).toBeDefined();
      expect(download!.fileName).toContain('.zip');

      // Verify ZIP contents
      const zipBuffer = await s3Client.getObject({ Key: download!.storageKey });
      const zip = await JSZip.loadAsync(zipBuffer);

      expect(zip.file('manifest.csv')).toBeDefined();
      expect(zip.file('Faktury/2024/Styczeń/' + docs[0].fileName)).toBeDefined();
      expect(zip.file('Faktury/2024/Luty/' + docs[1].fileName)).toBeDefined();
      expect(zip.file('Umowy/2024/' + docs[2].fileName)).toBeDefined();
    });
  });

  describe('Bulk Export with PDF Conversion', () => {
    it('should convert documents to searchable PDF', async () => {
      const imageDoc = await createTestDocument({
        mimeType: 'image/jpeg',
        hasOcrText: false
      });

      const { jobId } = await batchService.createBulkExportJob(
        orgId,
        userId,
        {
          documentIds: [imageDoc.id],
          format: 'searchable_pdf',
          includeMetadataJson: true
        }
      );

      await waitForJobCompletion(jobId);

      const job = await db.batchJob.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('completed');

      // Verify PDF has text layer
      const download = await db.batchDownloadFile.findFirst({
        where: { batchJobId: jobId }
      });

      const zipBuffer = await s3Client.getObject({ Key: download!.storageKey });
      const zip = await JSZip.loadAsync(zipBuffer);

      // Check that original image is now PDF
      const pdfFile = Object.keys(zip.files).find(f => f.endsWith('.pdf'));
      expect(pdfFile).toBeDefined();
    });
  });

  describe('Progress Tracking via WebSocket', () => {
    it('should emit progress updates in real-time', async () => {
      const docIds = await createTestDocuments(20);
      const progressUpdates: any[] = [];

      const { jobId } = await batchService.createBulkTagJob(
        orgId,
        userId,
        { documentIds: docIds, operation: 'add', tagIds: [testTagId] }
      );

      // Subscribe to progress
      eventEmitter.on('batch:job:progress', (progress) => {
        if (progress.jobId === jobId) {
          progressUpdates.push(progress);
        }
      });

      await waitForJobCompletion(jobId);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].percentComplete).toBe(100);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/batch-operations.spec.ts

describe('Batch Operations E2E', () => {
  test('complete bulk upload workflow', async ({ page }) => {
    await page.goto('/documents');

    // Open bulk upload dialog
    await page.click('[data-testid="bulk-upload-button"]');

    // Select files via file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      'test-files/invoice1.pdf',
      'test-files/invoice2.pdf',
      'test-files/invoice3.pdf'
    ]);

    // Select target folder
    await page.click('[data-testid="folder-select"]');
    await page.click('text=Faktury/2024/Grudzień');

    // Start upload
    await page.click('text=Upload All');

    // Verify progress UI
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('text=0/3')).toBeVisible();

    // Wait for completion
    await expect(page.locator('text=3/3')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Upload Complete')).toBeVisible();

    // Verify documents appear in list
    await page.click('text=Close');
    await page.click('text=Faktury/2024/Grudzień');
    await expect(page.locator('text=invoice1.pdf')).toBeVisible();
  });

  test('bulk download with ZIP archive', async ({ page }) => {
    await page.goto('/documents');

    // Select multiple documents
    await page.click('[data-testid="doc-checkbox-1"]');
    await page.click('[data-testid="doc-checkbox-2"]');
    await page.click('[data-testid="doc-checkbox-3"]');

    // Open bulk actions
    await page.click('[data-testid="bulk-actions-menu"]');
    await page.click('text=Download Selected');

    // Configure download options
    await expect(page.locator('text=Download Options')).toBeVisible();
    await page.check('[data-testid="include-metadata"]');

    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download ZIP');

    // Verify download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.zip');
  });

  test('bulk tag operation with confirmation', async ({ page }) => {
    await page.goto('/documents?type=INVOICE&date=2024-Q4');

    // Select all
    await page.click('[data-testid="select-all-checkbox"]');
    await expect(page.locator('text=150 selected')).toBeVisible();

    // Open tag dialog
    await page.click('[data-testid="bulk-actions-menu"]');
    await page.click('text=Add Tags');

    // Select tags
    await page.click('[data-testid="tag-Rozliczony"]');
    await page.click('[data-testid="tag-Koszty 2024"]');

    // Apply
    await page.click('text=Apply to 150 documents');

    // Verify progress
    await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
    await expect(page.locator('text=Processing')).toBeVisible();

    // Wait for completion
    await expect(page.locator('text=Added 2 tags to 150 documents')).toBeVisible({ timeout: 15000 });
  });

  test('bulk delete with confirmation code', async ({ page }) => {
    await page.goto('/documents/archive');

    // Select 15 documents
    for (let i = 1; i <= 15; i++) {
      await page.click(`[data-testid="doc-checkbox-${i}"]`);
    }

    // Open delete dialog
    await page.click('[data-testid="bulk-actions-menu"]');
    await page.click('text=Delete Selected');

    // Verify warning
    await expect(page.locator('text=You are about to delete 15 documents')).toBeVisible();
    await expect(page.locator('text=Type "USUŃ" to confirm')).toBeVisible();

    // Enter confirmation
    await page.fill('[data-testid="confirmation-input"]', 'USUŃ');
    await page.click('text=Delete Permanently');

    // Verify completion
    await expect(page.locator('text=15 documents deleted')).toBeVisible({ timeout: 10000 });
  });

  test('cancel in-progress batch operation', async ({ page }) => {
    // Start a large operation
    await page.goto('/documents');
    await page.click('[data-testid="select-all-checkbox"]'); // 200+ docs
    await page.click('[data-testid="bulk-actions-menu"]');
    await page.click('text=Export All');
    await page.click('text=Start Export');

    // Wait for partial progress
    await expect(page.locator('text=45%')).toBeVisible({ timeout: 30000 });

    // Cancel
    await page.click('text=Cancel Operation');
    await expect(page.locator('text=Cancel export?')).toBeVisible();
    await page.click('text=Yes, Cancel');

    // Verify cancellation
    await expect(page.locator('text=Export cancelled')).toBeVisible();
    await expect(page.locator('text=90 documents exported, 110 cancelled')).toBeVisible();
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [ ] All batch endpoints require authentication
- [ ] RLS policies enforce organization isolation
- [ ] Job ownership verified for status/cancel operations
- [ ] Template sharing respects organization boundaries

### Input Validation
- [ ] Document counts limited (max 10,000 per operation)
- [ ] File sizes validated before upload
- [ ] Confirmation required for destructive operations (>10 docs)
- [ ] Path traversal prevented in folder operations

### Data Protection
- [ ] Download links use cryptographically secure tokens
- [ ] Download links expire after configurable time (default 24h)
- [ ] Download count limits prevent abuse
- [ ] Soft delete preserves data for retention compliance

### Rate Limiting
- [ ] Concurrent batch jobs limited per user (max 5)
- [ ] Download requests rate-limited (10/minute)
- [ ] Upload rate limiting per organization

### Audit Logging
- [ ] All batch operations logged with user context
- [ ] Failed items logged with error details
- [ ] Download access tracked with IP/user-agent
- [ ] Cancellation events recorded

---

## Audit Events

```typescript
const BATCH_AUDIT_EVENTS = {
  // Job lifecycle
  'batch.job.created': 'Batch job created',
  'batch.job.started': 'Batch job processing started',
  'batch.job.completed': 'Batch job completed successfully',
  'batch.job.failed': 'Batch job failed',
  'batch.job.cancelled': 'Batch job cancelled by user',
  'batch.job.partial': 'Batch job completed with partial success',

  // Operations
  'batch.upload.completed': 'Bulk upload completed',
  'batch.download.created': 'Bulk download archive created',
  'batch.download.accessed': 'Bulk download accessed',
  'batch.tag.applied': 'Bulk tag operation completed',
  'batch.move.completed': 'Bulk move operation completed',
  'batch.delete.completed': 'Bulk delete operation completed',
  'batch.export.completed': 'Bulk export operation completed',
  'batch.restore.completed': 'Bulk restore operation completed',

  // Templates
  'batch.template.created': 'Batch operation template created',
  'batch.template.used': 'Batch operation template executed',
  'batch.template.deleted': 'Batch operation template deleted'
};
```

---

## Implementation Notes

### Performance Considerations
- Use streaming for large ZIP creation (archiver library)
- Process items in batches of 10 to balance throughput and memory
- Cache job progress in Redis for sub-500ms polling response
- Use presigned URLs for direct S3 uploads to avoid proxy overhead

### Error Handling Strategy
- Continue processing on individual item failures
- Collect all errors for final summary
- Support retry of failed items without reprocessing successes
- Implement exponential backoff for transient failures

### Polish Compliance
- Retention periods follow Polish accounting law requirements
- Soft delete ensures document recovery within legal periods
- Export includes required metadata for tax audits
- Audit trail meets Polish accounting documentation requirements

### Integration Points
- Document upload triggers OCR processing (DOC-004)
- Tag operations update search index (DOC-008)
- Delete operations revoke share links (DOC-009)
- Export can trigger workflow notifications (DOC-007)

---

## Dependencies

- **DOC-001**: Document Upload System (upload processing)
- **DOC-006**: Document Classification & Tagging (tag management)

---

*Last Updated: December 2024*
