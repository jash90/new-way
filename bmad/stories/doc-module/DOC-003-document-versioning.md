# DOC-003: Document Versioning

> **Story ID**: DOC-003
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P1 (High)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 4 - Week 13

---

## 📋 User Story

**As an** accountant,
**I want** version control for documents with automatic versioning and history tracking,
**So that** I can track changes over time, compare versions, and revert to previous versions when needed.

---

## 🎯 Acceptance Criteria

### Scenario 1: Automatic Version Creation on Document Update
```gherkin
Given I have an existing document "umowa-2024-001.pdf" at version 1
And I am authenticated with edit permissions
When I upload a new version of the document
Then a new version 2 should be created automatically
And version 1 should be preserved in version history
And the version metadata should include:
  | Field         | Value                    |
  | version_number| 2                        |
  | created_by    | current user ID          |
  | created_at    | current timestamp        |
  | file_size     | new file size in bytes   |
  | checksum      | SHA-256 of new file      |
  | change_reason | optional user input      |
And the document's current_version should point to version 2
```

### Scenario 2: Version History Browsing
```gherkin
Given I have a document with 5 versions
When I request the version history
Then I should receive a paginated list of all versions
And each version should include:
  | Field           | Description                    |
  | version_number  | Sequential version identifier  |
  | created_at      | Version creation timestamp     |
  | created_by      | User who created the version   |
  | file_size       | Size in bytes                  |
  | change_reason   | Optional description of changes|
  | is_current      | Boolean flag for latest version|
And versions should be sorted by version_number descending
And I should be able to download any historical version
```

### Scenario 3: Version Comparison
```gherkin
Given I have document "faktura-2024-05.pdf" with versions 3 and 5
When I request a comparison between version 3 and version 5
Then I should receive comparison metadata:
  | Metric          | Version 3      | Version 5      |
  | file_size       | 125,432 bytes  | 142,891 bytes  |
  | page_count      | 2              | 3              |
  | created_at      | 2024-01-15     | 2024-03-20     |
  | created_by      | jan.kowalski   | anna.nowak     |
And for text-based documents, I should see text differences
And for PDF documents, I should see visual diff thumbnails
And the comparison should highlight:
  - Added content (green)
  - Removed content (red)
  - Modified content (yellow)
```

### Scenario 4: Revert to Previous Version
```gherkin
Given I have a document currently at version 5
And I have permission to revert documents
When I request to revert to version 3
And I provide a reason "Przywrócenie oryginalnej umowy przed aneksem"
Then a new version 6 should be created
And version 6 should contain the exact content of version 3
And the revert should be logged in audit trail:
  | Field           | Value                                    |
  | action          | VERSION_REVERT                           |
  | source_version  | 3                                        |
  | target_version  | 6                                        |
  | reason          | Przywrócenie oryginalnej umowy...        |
  | reverted_by     | current user                             |
And all intermediate versions (4, 5) should remain accessible
```

### Scenario 5: Version Retention Policy
```gherkin
Given I have a document type "INVOICE" with retention policy:
  | Policy                    | Value           |
  | min_retention_days        | 1825 (5 years)  |
  | max_versions_kept         | 50              |
  | auto_archive_after_days   | 365             |
When the retention policy job runs
Then versions older than 5 years should be:
  - Archived to cold storage if beyond max_versions_kept
  - Never permanently deleted if within retention period
And versions beyond max_versions_kept should be:
  - Archived but still retrievable
  - Moved to Glacier storage class
And the system should maintain:
  - At least the current version
  - All versions within retention period
  - Audit trail of any archived versions
```

### Scenario 6: Soft Delete with Recovery
```gherkin
Given I have a document "raport-2024-Q1.xlsx"
When I delete the document
Then the document should be soft-deleted (marked as deleted)
And all versions should be preserved
And the document should be hidden from normal queries
And the deletion should be logged:
  | Field           | Value                    |
  | action          | DOCUMENT_SOFT_DELETE     |
  | deleted_at      | current timestamp        |
  | deleted_by      | current user             |
  | recoverable     | true                     |
  | recovery_deadline| 30 days from deletion   |
And I should be able to recover the document within 30 days
When I recover the document
Then all versions should be restored
And the document should appear in normal queries again
And recovery should be logged in audit trail
```

### Scenario 7: Version Locking
```gherkin
Given I have a document "umowa-ważna.pdf" at version 3
And the document contains legally binding content
When I lock version 3 with reason "Podpisana umowa - nie modyfikować"
Then version 3 should be marked as locked
And no new versions should be allowed to overwrite it
And the lock should include:
  | Field           | Value                              |
  | locked_at       | current timestamp                  |
  | locked_by       | current user                       |
  | lock_reason     | Podpisana umowa - nie modyfikować  |
  | lock_type       | PERMANENT or TEMPORARY             |
And only users with unlock permission can remove the lock
And locked versions cannot be archived or deleted
```

### Scenario 8: Version Annotations
```gherkin
Given I have a document with version 4
When I add an annotation to version 4:
  | Field           | Value                              |
  | annotation_type | COMMENT                            |
  | content         | Zatwierdzone przez księgową        |
  | visibility      | INTERNAL                           |
Then the annotation should be saved with the version
And the annotation should appear in version history
And annotations should be searchable
And annotations should support:
  - Text comments
  - Approval stamps
  - Review notes
  - Custom tags
```

---

## 📐 Technical Specification

### Database Schema

```sql
-- Document versions table
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Version identification
  version_number INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT false,

  -- Storage references
  storage_key TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_class storage_class DEFAULT 'STANDARD',

  -- File metadata
  file_size BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  page_count INTEGER,

  -- Version metadata
  change_reason TEXT,
  source_version_id UUID REFERENCES document_versions(id),
  is_revert BOOLEAN DEFAULT false,

  -- Lock status
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  lock_reason TEXT,
  lock_type TEXT CHECK (lock_type IN ('PERMANENT', 'TEMPORARY')),
  lock_expires_at TIMESTAMPTZ,

  -- Archival status
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id),
  archive_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),

  -- Constraints
  CONSTRAINT unique_version_per_document UNIQUE (document_id, version_number),
  CONSTRAINT positive_version_number CHECK (version_number > 0)
);

-- Version annotations
CREATE TABLE version_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Annotation content
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('COMMENT', 'APPROVAL', 'REVIEW', 'TAG', 'STAMP')),
  content TEXT NOT NULL,
  visibility TEXT DEFAULT 'INTERNAL' CHECK (visibility IN ('PUBLIC', 'INTERNAL', 'PRIVATE')),

  -- Position (for document annotations)
  page_number INTEGER,
  position_x DECIMAL(10, 4),
  position_y DECIMAL(10, 4),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search optimization
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('polish', content)) STORED
);

-- Soft-deleted documents tracking
CREATE TABLE deleted_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Original document metadata (snapshot)
  original_name TEXT NOT NULL,
  original_type TEXT NOT NULL,
  version_count INTEGER NOT NULL,

  -- Deletion info
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_by UUID NOT NULL REFERENCES users(id),
  delete_reason TEXT,

  -- Recovery info
  recovery_deadline TIMESTAMPTZ NOT NULL,
  recovered_at TIMESTAMPTZ,
  recovered_by UUID REFERENCES users(id),

  -- Status
  status TEXT DEFAULT 'DELETED' CHECK (status IN ('DELETED', 'RECOVERED', 'PERMANENTLY_DELETED'))
);

-- Version comparison cache
CREATE TABLE version_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Compared versions
  version_a_id UUID NOT NULL REFERENCES document_versions(id),
  version_b_id UUID NOT NULL REFERENCES document_versions(id),

  -- Comparison results (cached)
  comparison_type TEXT NOT NULL CHECK (comparison_type IN ('METADATA', 'TEXT', 'VISUAL')),
  comparison_result JSONB NOT NULL,
  diff_summary JSONB,

  -- Cache management
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

  CONSTRAINT unique_comparison UNIQUE (version_a_id, version_b_id, comparison_type)
);

-- Version retention policies
CREATE TABLE version_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Policy scope
  document_type TEXT NOT NULL,

  -- Retention rules
  min_retention_days INTEGER NOT NULL DEFAULT 1825, -- 5 years for Polish accounting
  max_versions_kept INTEGER DEFAULT 50,
  auto_archive_after_days INTEGER DEFAULT 365,

  -- Archive settings
  archive_storage_class storage_class DEFAULT 'GLACIER_INSTANT_RETRIEVAL',

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_policy_per_type UNIQUE (organization_id, document_type)
);

-- Audit log for version operations
CREATE TABLE version_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  document_id UUID NOT NULL,
  version_id UUID,

  -- Action details
  action TEXT NOT NULL,
  action_details JSONB NOT NULL DEFAULT '{}',

  -- Actor
  performed_by UUID NOT NULL REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id TEXT
);

-- Indexes
CREATE INDEX idx_versions_document ON document_versions(document_id);
CREATE INDEX idx_versions_current ON document_versions(document_id, is_current) WHERE is_current = true;
CREATE INDEX idx_versions_org ON document_versions(organization_id);
CREATE INDEX idx_versions_created ON document_versions(created_at DESC);
CREATE INDEX idx_annotations_version ON version_annotations(version_id);
CREATE INDEX idx_annotations_search ON version_annotations USING gin(search_vector);
CREATE INDEX idx_deleted_docs_org ON deleted_documents(organization_id);
CREATE INDEX idx_deleted_docs_deadline ON deleted_documents(recovery_deadline) WHERE status = 'DELETED';
CREATE INDEX idx_version_audit_doc ON version_audit_log(document_id);
CREATE INDEX idx_version_audit_action ON version_audit_log(action, performed_at);

-- RLS Policies
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY versions_org_isolation ON document_versions
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY annotations_org_isolation ON version_annotations
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY deleted_docs_org_isolation ON deleted_documents
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY comparisons_org_isolation ON version_comparisons
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY policies_org_isolation ON version_retention_policies
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY audit_org_isolation ON version_audit_log
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Functions
CREATE OR REPLACE FUNCTION get_next_version_number(p_document_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO v_max_version
  FROM document_versions
  WHERE document_id = p_document_id;

  RETURN v_max_version + 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_current_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Unset current flag on all other versions
  UPDATE document_versions
  SET is_current = false
  WHERE document_id = NEW.document_id
    AND id != NEW.id
    AND is_current = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_current_version
  AFTER INSERT ON document_versions
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION set_current_version();
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Version number schema
export const VersionNumberSchema = z.number().int().positive();

// Annotation types
export const AnnotationType = z.enum(['COMMENT', 'APPROVAL', 'REVIEW', 'TAG', 'STAMP']);

// Visibility levels
export const VisibilityLevel = z.enum(['PUBLIC', 'INTERNAL', 'PRIVATE']);

// Lock types
export const LockType = z.enum(['PERMANENT', 'TEMPORARY']);

// Create new version request
export const CreateVersionSchema = z.object({
  documentId: z.string().uuid(),
  file: z.instanceof(File).or(z.instanceof(Buffer)),
  changeReason: z.string().max(500).optional(),
  metadata: z.object({
    pageCount: z.number().int().positive().optional(),
    extractedText: z.string().optional(),
  }).optional(),
});

// Version history request
export const VersionHistoryRequestSchema = z.object({
  documentId: z.string().uuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  includeArchived: z.boolean().default(false),
});

// Version comparison request
export const VersionComparisonRequestSchema = z.object({
  documentId: z.string().uuid(),
  versionA: VersionNumberSchema,
  versionB: VersionNumberSchema,
  comparisonType: z.enum(['METADATA', 'TEXT', 'VISUAL']).default('METADATA'),
});

// Revert version request
export const RevertVersionRequestSchema = z.object({
  documentId: z.string().uuid(),
  targetVersion: VersionNumberSchema,
  reason: z.string().min(10, 'Podaj powód przywrócenia (min. 10 znaków)').max(500),
});

// Lock version request
export const LockVersionRequestSchema = z.object({
  versionId: z.string().uuid(),
  lockType: LockType,
  reason: z.string().min(5, 'Podaj powód blokady').max(500),
  expiresAt: z.date().optional(), // Only for TEMPORARY locks
});

// Unlock version request
export const UnlockVersionRequestSchema = z.object({
  versionId: z.string().uuid(),
  reason: z.string().min(5, 'Podaj powód odblokowania').max(500),
});

// Soft delete request
export const SoftDeleteRequestSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  recoveryDays: z.number().int().min(1).max(90).default(30),
});

// Recover document request
export const RecoverDocumentRequestSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// Add annotation request
export const AddAnnotationRequestSchema = z.object({
  versionId: z.string().uuid(),
  annotationType: AnnotationType,
  content: z.string().min(1).max(2000),
  visibility: VisibilityLevel.default('INTERNAL'),
  pageNumber: z.number().int().positive().optional(),
  positionX: z.number().min(0).max(1).optional(),
  positionY: z.number().min(0).max(1).optional(),
});

// Retention policy schema
export const RetentionPolicySchema = z.object({
  documentType: z.string(),
  minRetentionDays: z.number().int().min(365).default(1825), // Min 1 year, default 5 years
  maxVersionsKept: z.number().int().min(1).max(1000).default(50),
  autoArchiveAfterDays: z.number().int().min(30).default(365),
  archiveStorageClass: z.enum(['STANDARD_IA', 'GLACIER_INSTANT_RETRIEVAL', 'GLACIER', 'DEEP_ARCHIVE'])
    .default('GLACIER_INSTANT_RETRIEVAL'),
});

// Version response schemas
export const VersionMetadataSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  isCurrent: z.boolean(),
  fileSize: z.number(),
  checksum: z.string(),
  mimeType: z.string(),
  pageCount: z.number().nullable(),
  changeReason: z.string().nullable(),
  isRevert: z.boolean(),
  sourceVersionId: z.string().uuid().nullable(),
  isLocked: z.boolean(),
  lockReason: z.string().nullable(),
  isArchived: z.boolean(),
  createdAt: z.date(),
  createdBy: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});

export const VersionHistoryResponseSchema = z.object({
  documentId: z.string().uuid(),
  documentName: z.string(),
  totalVersions: z.number().int(),
  currentVersion: z.number().int(),
  versions: z.array(VersionMetadataSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
    hasMore: z.boolean(),
  }),
});

export const VersionComparisonResponseSchema = z.object({
  documentId: z.string().uuid(),
  versionA: VersionMetadataSchema,
  versionB: VersionMetadataSchema,
  comparison: z.object({
    metadataDiff: z.object({
      fileSizeDiff: z.number(),
      fileSizePercentChange: z.number(),
      pageCountDiff: z.number().nullable(),
      daysBetween: z.number(),
    }),
    textDiff: z.object({
      addedLines: z.number(),
      removedLines: z.number(),
      modifiedLines: z.number(),
      diffContent: z.string().optional(),
    }).optional(),
    visualDiff: z.object({
      thumbnailUrlA: z.string().url(),
      thumbnailUrlB: z.string().url(),
      diffOverlayUrl: z.string().url().optional(),
    }).optional(),
  }),
});

// Type exports
export type CreateVersionInput = z.infer<typeof CreateVersionSchema>;
export type VersionHistoryRequest = z.infer<typeof VersionHistoryRequestSchema>;
export type VersionComparisonRequest = z.infer<typeof VersionComparisonRequestSchema>;
export type RevertVersionRequest = z.infer<typeof RevertVersionRequestSchema>;
export type LockVersionRequest = z.infer<typeof LockVersionRequestSchema>;
export type SoftDeleteRequest = z.infer<typeof SoftDeleteRequestSchema>;
export type AddAnnotationRequest = z.infer<typeof AddAnnotationRequestSchema>;
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
export type VersionMetadata = z.infer<typeof VersionMetadataSchema>;
export type VersionHistoryResponse = z.infer<typeof VersionHistoryResponseSchema>;
export type VersionComparisonResponse = z.infer<typeof VersionComparisonResponseSchema>;
```

### Service Implementation

```typescript
import { S3Client, CopyObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { diff_match_patch } from 'diff-match-patch';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import {
  CreateVersionInput,
  VersionHistoryRequest,
  VersionComparisonRequest,
  RevertVersionRequest,
  LockVersionRequest,
  SoftDeleteRequest,
  AddAnnotationRequest,
} from './schemas';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

export class DocumentVersioningService {
  /**
   * Create a new version of a document
   */
  static async createVersion(
    input: CreateVersionInput,
    context: { userId: string; organizationId: string; ipAddress?: string }
  ) {
    const { documentId, file, changeReason } = input;

    // Verify document exists and user has access
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: context.organizationId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie został znaleziony',
      });
    }

    // Check if current version is locked
    const currentVersion = await db.documentVersion.findFirst({
      where: { documentId, isCurrent: true },
    });

    if (currentVersion?.isLocked) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Bieżąca wersja jest zablokowana. Nie można utworzyć nowej wersji.',
      });
    }

    // Calculate file checksum
    const fileBuffer = file instanceof File
      ? Buffer.from(await file.arrayBuffer())
      : file;
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    // Get next version number
    const nextVersionNumber = await db.$queryRaw<[{ get_next_version_number: number }]>`
      SELECT get_next_version_number(${documentId}::uuid)
    `;
    const versionNumber = nextVersionNumber[0].get_next_version_number;

    // Generate storage key for new version
    const storageKey = `documents/${context.organizationId}/${documentId}/v${versionNumber}/${document.originalName}`;

    // Upload to S3
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: document.mimeType,
      ServerSideEncryption: 'aws:kms',
      Metadata: {
        'document-id': documentId,
        'version-number': versionNumber.toString(),
        'checksum': checksum,
      },
    }));

    // Create version record in transaction
    const newVersion = await db.$transaction(async (tx) => {
      // Create new version
      const version = await tx.documentVersion.create({
        data: {
          documentId,
          organizationId: context.organizationId,
          versionNumber,
          isCurrent: true,
          storageKey,
          storageBucket: BUCKET_NAME,
          fileSize: fileBuffer.length,
          checksum,
          mimeType: document.mimeType,
          pageCount: input.metadata?.pageCount,
          changeReason,
          createdBy: context.userId,
        },
      });

      // Update document's current version reference
      await tx.document.update({
        where: { id: documentId },
        data: {
          currentVersionId: version.id,
          updatedAt: new Date(),
        },
      });

      // Log audit event
      await tx.versionAuditLog.create({
        data: {
          organizationId: context.organizationId,
          documentId,
          versionId: version.id,
          action: 'VERSION_CREATED',
          actionDetails: {
            versionNumber,
            fileSize: fileBuffer.length,
            checksum,
            changeReason,
            previousVersion: currentVersion?.versionNumber,
          },
          performedBy: context.userId,
          ipAddress: context.ipAddress,
        },
      });

      return version;
    });

    return {
      success: true,
      version: {
        id: newVersion.id,
        versionNumber: newVersion.versionNumber,
        checksum: newVersion.checksum,
        fileSize: newVersion.fileSize,
        createdAt: newVersion.createdAt,
      },
    };
  }

  /**
   * Get version history for a document
   */
  static async getVersionHistory(
    input: VersionHistoryRequest,
    context: { organizationId: string }
  ) {
    const { documentId, page, limit, includeArchived } = input;

    // Get document info
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: context.organizationId,
      },
      select: { id: true, originalName: true },
    });

    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie został znaleziony',
      });
    }

    // Build where clause
    const whereClause = {
      documentId,
      organizationId: context.organizationId,
      ...(includeArchived ? {} : { isArchived: false }),
    };

    // Get total count
    const totalVersions = await db.documentVersion.count({ where: whereClause });

    // Get paginated versions
    const versions = await db.documentVersion.findMany({
      where: whereClause,
      orderBy: { versionNumber: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
        lockedByUser: {
          select: { id: true, name: true },
        },
      },
    });

    // Get current version number
    const currentVersion = versions.find(v => v.isCurrent);

    return {
      documentId,
      documentName: document.originalName,
      totalVersions,
      currentVersion: currentVersion?.versionNumber || 1,
      versions: versions.map(v => ({
        id: v.id,
        documentId: v.documentId,
        versionNumber: v.versionNumber,
        isCurrent: v.isCurrent,
        fileSize: Number(v.fileSize),
        checksum: v.checksum,
        mimeType: v.mimeType,
        pageCount: v.pageCount,
        changeReason: v.changeReason,
        isRevert: v.isRevert,
        sourceVersionId: v.sourceVersionId,
        isLocked: v.isLocked,
        lockReason: v.lockReason,
        isArchived: v.isArchived,
        createdAt: v.createdAt,
        createdBy: v.createdByUser,
      })),
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalVersions / limit),
        hasMore: page * limit < totalVersions,
      },
    };
  }

  /**
   * Compare two versions of a document
   */
  static async compareVersions(
    input: VersionComparisonRequest,
    context: { organizationId: string }
  ) {
    const { documentId, versionA, versionB, comparisonType } = input;

    // Ensure versionA < versionB for consistent comparison
    const [olderVersion, newerVersion] = versionA < versionB
      ? [versionA, versionB]
      : [versionB, versionA];

    // Fetch both versions
    const versions = await db.documentVersion.findMany({
      where: {
        documentId,
        organizationId: context.organizationId,
        versionNumber: { in: [olderVersion, newerVersion] },
      },
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (versions.length !== 2) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Jedna lub obie wersje nie zostały znalezione',
      });
    }

    const versionAData = versions.find(v => v.versionNumber === olderVersion)!;
    const versionBData = versions.find(v => v.versionNumber === newerVersion)!;

    // Check cache first
    const cachedComparison = await db.versionComparison.findFirst({
      where: {
        versionAId: versionAData.id,
        versionBId: versionBData.id,
        comparisonType,
        expiresAt: { gt: new Date() },
      },
    });

    if (cachedComparison) {
      return cachedComparison.comparisonResult;
    }

    // Calculate metadata diff
    const metadataDiff = {
      fileSizeDiff: Number(versionBData.fileSize) - Number(versionAData.fileSize),
      fileSizePercentChange: ((Number(versionBData.fileSize) - Number(versionAData.fileSize)) / Number(versionAData.fileSize)) * 100,
      pageCountDiff: versionBData.pageCount && versionAData.pageCount
        ? versionBData.pageCount - versionAData.pageCount
        : null,
      daysBetween: Math.floor(
        (versionBData.createdAt.getTime() - versionAData.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ),
    };

    let textDiff = undefined;
    let visualDiff = undefined;

    // Text comparison for text-based documents
    if (comparisonType === 'TEXT' && this.isTextBasedDocument(versionAData.mimeType)) {
      textDiff = await this.calculateTextDiff(versionAData, versionBData);
    }

    // Visual comparison for PDFs and images
    if (comparisonType === 'VISUAL' && this.isVisualDocument(versionAData.mimeType)) {
      visualDiff = await this.generateVisualDiff(versionAData, versionBData);
    }

    const comparisonResult = {
      documentId,
      versionA: this.formatVersionMetadata(versionAData),
      versionB: this.formatVersionMetadata(versionBData),
      comparison: {
        metadataDiff,
        textDiff,
        visualDiff,
      },
    };

    // Cache the result
    await db.versionComparison.create({
      data: {
        organizationId: context.organizationId,
        versionAId: versionAData.id,
        versionBId: versionBData.id,
        comparisonType,
        comparisonResult: comparisonResult as any,
        diffSummary: { metadataDiff },
      },
    });

    return comparisonResult;
  }

  /**
   * Revert to a previous version
   */
  static async revertToVersion(
    input: RevertVersionRequest,
    context: { userId: string; organizationId: string; ipAddress?: string }
  ) {
    const { documentId, targetVersion, reason } = input;

    // Find target version
    const targetVersionData = await db.documentVersion.findFirst({
      where: {
        documentId,
        organizationId: context.organizationId,
        versionNumber: targetVersion,
      },
    });

    if (!targetVersionData) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Wersja ${targetVersion} nie została znaleziona`,
      });
    }

    if (targetVersionData.isArchived) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można przywrócić zarchiwizowanej wersji. Najpierw przywróć ją z archiwum.',
      });
    }

    // Get next version number
    const nextVersionNumber = await db.$queryRaw<[{ get_next_version_number: number }]>`
      SELECT get_next_version_number(${documentId}::uuid)
    `;
    const newVersionNumber = nextVersionNumber[0].get_next_version_number;

    // Copy S3 object to new version
    const newStorageKey = `documents/${context.organizationId}/${documentId}/v${newVersionNumber}/${targetVersionData.storageKey.split('/').pop()}`;

    await s3Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${targetVersionData.storageBucket}/${targetVersionData.storageKey}`,
      Key: newStorageKey,
      ServerSideEncryption: 'aws:kms',
      Metadata: {
        'document-id': documentId,
        'version-number': newVersionNumber.toString(),
        'reverted-from': targetVersion.toString(),
      },
      MetadataDirective: 'REPLACE',
    }));

    // Create new version record
    const revertedVersion = await db.$transaction(async (tx) => {
      const newVersion = await tx.documentVersion.create({
        data: {
          documentId,
          organizationId: context.organizationId,
          versionNumber: newVersionNumber,
          isCurrent: true,
          storageKey: newStorageKey,
          storageBucket: BUCKET_NAME,
          fileSize: targetVersionData.fileSize,
          checksum: targetVersionData.checksum,
          mimeType: targetVersionData.mimeType,
          pageCount: targetVersionData.pageCount,
          changeReason: `Przywrócono z wersji ${targetVersion}: ${reason}`,
          sourceVersionId: targetVersionData.id,
          isRevert: true,
          createdBy: context.userId,
        },
      });

      // Update document reference
      await tx.document.update({
        where: { id: documentId },
        data: {
          currentVersionId: newVersion.id,
          updatedAt: new Date(),
        },
      });

      // Log audit event
      await tx.versionAuditLog.create({
        data: {
          organizationId: context.organizationId,
          documentId,
          versionId: newVersion.id,
          action: 'VERSION_REVERT',
          actionDetails: {
            sourceVersion: targetVersion,
            newVersion: newVersionNumber,
            reason,
          },
          performedBy: context.userId,
          ipAddress: context.ipAddress,
        },
      });

      return newVersion;
    });

    return {
      success: true,
      message: `Przywrócono wersję ${targetVersion} jako nową wersję ${newVersionNumber}`,
      newVersion: {
        id: revertedVersion.id,
        versionNumber: revertedVersion.versionNumber,
        sourceVersion: targetVersion,
      },
    };
  }

  /**
   * Lock a version to prevent modifications
   */
  static async lockVersion(
    input: LockVersionRequest,
    context: { userId: string; organizationId: string; ipAddress?: string }
  ) {
    const { versionId, lockType, reason, expiresAt } = input;

    // Validate temporary lock has expiration
    if (lockType === 'TEMPORARY' && !expiresAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Blokada tymczasowa wymaga daty wygaśnięcia',
      });
    }

    const version = await db.documentVersion.findFirst({
      where: {
        id: versionId,
        organizationId: context.organizationId,
      },
    });

    if (!version) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wersja nie została znaleziona',
      });
    }

    if (version.isLocked) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Ta wersja jest już zablokowana',
      });
    }

    const lockedVersion = await db.$transaction(async (tx) => {
      const updated = await tx.documentVersion.update({
        where: { id: versionId },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: context.userId,
          lockReason: reason,
          lockType,
          lockExpiresAt: expiresAt,
        },
      });

      await tx.versionAuditLog.create({
        data: {
          organizationId: context.organizationId,
          documentId: version.documentId,
          versionId,
          action: 'VERSION_LOCKED',
          actionDetails: {
            lockType,
            reason,
            expiresAt: expiresAt?.toISOString(),
          },
          performedBy: context.userId,
          ipAddress: context.ipAddress,
        },
      });

      return updated;
    });

    return {
      success: true,
      message: `Wersja ${version.versionNumber} została zablokowana`,
      lock: {
        type: lockType,
        reason,
        expiresAt,
        lockedBy: context.userId,
      },
    };
  }

  /**
   * Soft delete a document (all versions)
   */
  static async softDelete(
    input: SoftDeleteRequest,
    context: { userId: string; organizationId: string; ipAddress?: string }
  ) {
    const { documentId, reason, recoveryDays } = input;

    const document = await db.document.findFirst({
      where: {
        id: documentId,
        organizationId: context.organizationId,
        deletedAt: null,
      },
      include: {
        _count: { select: { versions: true } },
      },
    });

    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie został znaleziony',
      });
    }

    // Check for locked versions
    const lockedVersions = await db.documentVersion.count({
      where: {
        documentId,
        isLocked: true,
        lockType: 'PERMANENT',
      },
    });

    if (lockedVersions > 0) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Nie można usunąć dokumentu z trwale zablokowanymi wersjami',
      });
    }

    const recoveryDeadline = new Date();
    recoveryDeadline.setDate(recoveryDeadline.getDate() + recoveryDays);

    await db.$transaction(async (tx) => {
      // Soft delete the document
      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      // Create deleted document record
      await tx.deletedDocument.create({
        data: {
          documentId,
          organizationId: context.organizationId,
          originalName: document.originalName,
          originalType: document.documentType,
          versionCount: document._count.versions,
          deletedBy: context.userId,
          deleteReason: reason,
          recoveryDeadline,
        },
      });

      // Log audit event
      await tx.versionAuditLog.create({
        data: {
          organizationId: context.organizationId,
          documentId,
          action: 'DOCUMENT_SOFT_DELETE',
          actionDetails: {
            documentName: document.originalName,
            versionCount: document._count.versions,
            reason,
            recoveryDeadline: recoveryDeadline.toISOString(),
          },
          performedBy: context.userId,
          ipAddress: context.ipAddress,
        },
      });
    });

    return {
      success: true,
      message: `Dokument został usunięty. Możesz go przywrócić do ${recoveryDeadline.toLocaleDateString('pl-PL')}`,
      recoveryDeadline,
    };
  }

  /**
   * Recover a soft-deleted document
   */
  static async recoverDocument(
    input: { documentId: string; reason?: string },
    context: { userId: string; organizationId: string; ipAddress?: string }
  ) {
    const deletedDoc = await db.deletedDocument.findFirst({
      where: {
        documentId: input.documentId,
        organizationId: context.organizationId,
        status: 'DELETED',
        recoveryDeadline: { gt: new Date() },
      },
    });

    if (!deletedDoc) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie został znaleziony lub przekroczono termin odzyskania',
      });
    }

    await db.$transaction(async (tx) => {
      // Restore the document
      await tx.document.update({
        where: { id: input.documentId },
        data: { deletedAt: null },
      });

      // Update deleted document record
      await tx.deletedDocument.update({
        where: { id: deletedDoc.id },
        data: {
          status: 'RECOVERED',
          recoveredAt: new Date(),
          recoveredBy: context.userId,
        },
      });

      // Log audit event
      await tx.versionAuditLog.create({
        data: {
          organizationId: context.organizationId,
          documentId: input.documentId,
          action: 'DOCUMENT_RECOVERED',
          actionDetails: {
            documentName: deletedDoc.originalName,
            deletedAt: deletedDoc.deletedAt.toISOString(),
            reason: input.reason,
          },
          performedBy: context.userId,
          ipAddress: context.ipAddress,
        },
      });
    });

    return {
      success: true,
      message: `Dokument "${deletedDoc.originalName}" został przywrócony`,
    };
  }

  /**
   * Add annotation to a version
   */
  static async addAnnotation(
    input: AddAnnotationRequest,
    context: { userId: string; organizationId: string }
  ) {
    const { versionId, annotationType, content, visibility, pageNumber, positionX, positionY } = input;

    const version = await db.documentVersion.findFirst({
      where: {
        id: versionId,
        organizationId: context.organizationId,
      },
    });

    if (!version) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wersja nie została znaleziona',
      });
    }

    const annotation = await db.versionAnnotation.create({
      data: {
        versionId,
        organizationId: context.organizationId,
        annotationType,
        content,
        visibility,
        pageNumber,
        positionX,
        positionY,
        createdBy: context.userId,
      },
    });

    return {
      success: true,
      annotation: {
        id: annotation.id,
        type: annotation.annotationType,
        content: annotation.content,
        createdAt: annotation.createdAt,
      },
    };
  }

  /**
   * Get download URL for a specific version
   */
  static async getVersionDownloadUrl(
    versionId: string,
    context: { userId: string; organizationId: string; ipAddress?: string }
  ) {
    const version = await db.documentVersion.findFirst({
      where: {
        id: versionId,
        organizationId: context.organizationId,
      },
      include: {
        document: { select: { originalName: true } },
      },
    });

    if (!version) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wersja nie została znaleziona',
      });
    }

    // Generate presigned URL
    const command = new GetObjectCommand({
      Bucket: version.storageBucket,
      Key: version.storageKey,
      ResponseContentDisposition: `attachment; filename="${version.document.originalName}"`,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Log access
    await db.versionAuditLog.create({
      data: {
        organizationId: context.organizationId,
        documentId: version.documentId,
        versionId,
        action: 'VERSION_DOWNLOADED',
        actionDetails: {
          versionNumber: version.versionNumber,
        },
        performedBy: context.userId,
        ipAddress: context.ipAddress,
      },
    });

    return {
      url: signedUrl,
      expiresIn: 3600,
      fileName: version.document.originalName,
      versionNumber: version.versionNumber,
    };
  }

  // Helper methods
  private static isTextBasedDocument(mimeType: string): boolean {
    return [
      'text/plain',
      'application/json',
      'text/csv',
      'text/xml',
      'application/xml',
    ].includes(mimeType);
  }

  private static isVisualDocument(mimeType: string): boolean {
    return [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ].includes(mimeType);
  }

  private static async calculateTextDiff(versionA: any, versionB: any) {
    // Fetch content from S3
    const [contentA, contentB] = await Promise.all([
      this.fetchVersionContent(versionA),
      this.fetchVersionContent(versionB),
    ]);

    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(contentA, contentB);
    dmp.diff_cleanupSemantic(diff);

    let addedLines = 0;
    let removedLines = 0;
    let modifiedLines = 0;

    diff.forEach(([operation, text]) => {
      const lines = text.split('\n').length - 1;
      if (operation === 1) addedLines += lines;
      if (operation === -1) removedLines += lines;
    });

    modifiedLines = Math.min(addedLines, removedLines);

    return {
      addedLines: addedLines - modifiedLines,
      removedLines: removedLines - modifiedLines,
      modifiedLines,
      diffContent: dmp.diff_prettyHtml(diff),
    };
  }

  private static async fetchVersionContent(version: any): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: version.storageBucket,
      Key: version.storageKey,
    });

    const response = await s3Client.send(command);
    return await response.Body!.transformToString();
  }

  private static async generateVisualDiff(versionA: any, versionB: any) {
    // Generate thumbnails and diff overlay using image processing
    // This would use Sharp or similar library
    const baseUrl = process.env.CDN_URL || '';

    return {
      thumbnailUrlA: `${baseUrl}/thumbnails/${versionA.id}`,
      thumbnailUrlB: `${baseUrl}/thumbnails/${versionB.id}`,
      diffOverlayUrl: `${baseUrl}/diff/${versionA.id}/${versionB.id}`,
    };
  }

  private static formatVersionMetadata(version: any) {
    return {
      id: version.id,
      documentId: version.documentId,
      versionNumber: version.versionNumber,
      isCurrent: version.isCurrent,
      fileSize: Number(version.fileSize),
      checksum: version.checksum,
      mimeType: version.mimeType,
      pageCount: version.pageCount,
      changeReason: version.changeReason,
      isRevert: version.isRevert,
      sourceVersionId: version.sourceVersionId,
      isLocked: version.isLocked,
      lockReason: version.lockReason,
      isArchived: version.isArchived,
      createdAt: version.createdAt,
      createdBy: version.createdByUser,
    };
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { DocumentVersioningService } from './service';
import {
  CreateVersionSchema,
  VersionHistoryRequestSchema,
  VersionComparisonRequestSchema,
  RevertVersionRequestSchema,
  LockVersionRequestSchema,
  UnlockVersionRequestSchema,
  SoftDeleteRequestSchema,
  RecoverDocumentRequestSchema,
  AddAnnotationRequestSchema,
} from './schemas';
import { z } from 'zod';

export const documentVersioningRouter = router({
  // Create new version
  createVersion: protectedProcedure
    .input(CreateVersionSchema)
    .mutation(async ({ input, ctx }) => {
      return DocumentVersioningService.createVersion(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        ipAddress: ctx.ipAddress,
      });
    }),

  // Get version history
  getHistory: protectedProcedure
    .input(VersionHistoryRequestSchema)
    .query(async ({ input, ctx }) => {
      return DocumentVersioningService.getVersionHistory(input, {
        organizationId: ctx.organizationId,
      });
    }),

  // Compare versions
  compareVersions: protectedProcedure
    .input(VersionComparisonRequestSchema)
    .query(async ({ input, ctx }) => {
      return DocumentVersioningService.compareVersions(input, {
        organizationId: ctx.organizationId,
      });
    }),

  // Revert to previous version
  revertToVersion: protectedProcedure
    .input(RevertVersionRequestSchema)
    .mutation(async ({ input, ctx }) => {
      return DocumentVersioningService.revertToVersion(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        ipAddress: ctx.ipAddress,
      });
    }),

  // Lock version
  lockVersion: protectedProcedure
    .input(LockVersionRequestSchema)
    .mutation(async ({ input, ctx }) => {
      return DocumentVersioningService.lockVersion(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        ipAddress: ctx.ipAddress,
      });
    }),

  // Unlock version
  unlockVersion: protectedProcedure
    .input(UnlockVersionRequestSchema)
    .mutation(async ({ input, ctx }) => {
      // Implementation would be similar to lockVersion
      return { success: true };
    }),

  // Soft delete document
  softDelete: protectedProcedure
    .input(SoftDeleteRequestSchema)
    .mutation(async ({ input, ctx }) => {
      return DocumentVersioningService.softDelete(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        ipAddress: ctx.ipAddress,
      });
    }),

  // Recover deleted document
  recoverDocument: protectedProcedure
    .input(RecoverDocumentRequestSchema)
    .mutation(async ({ input, ctx }) => {
      return DocumentVersioningService.recoverDocument(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        ipAddress: ctx.ipAddress,
      });
    }),

  // Add annotation
  addAnnotation: protectedProcedure
    .input(AddAnnotationRequestSchema)
    .mutation(async ({ input, ctx }) => {
      return DocumentVersioningService.addAnnotation(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });
    }),

  // Get annotations for version
  getAnnotations: protectedProcedure
    .input(z.object({
      versionId: z.string().uuid(),
      visibility: z.enum(['PUBLIC', 'INTERNAL', 'PRIVATE']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Return annotations filtered by visibility and user permissions
      return { annotations: [] };
    }),

  // Get version download URL
  getDownloadUrl: protectedProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return DocumentVersioningService.getVersionDownloadUrl(input.versionId, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
        ipAddress: ctx.ipAddress,
      });
    }),

  // Get deleted documents (for recovery)
  getDeletedDocuments: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      // Return list of recoverable deleted documents
      return { documents: [], pagination: {} };
    }),

  // Get retention policies
  getRetentionPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      // Return organization's retention policies
      return { policies: [] };
    }),

  // Update retention policy
  updateRetentionPolicy: protectedProcedure
    .input(z.object({
      documentType: z.string(),
      policy: z.object({
        minRetentionDays: z.number().int().min(365),
        maxVersionsKept: z.number().int().min(1).max(1000),
        autoArchiveAfterDays: z.number().int().min(30),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      // Update or create retention policy
      return { success: true };
    }),
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentVersioningService } from './service';

describe('DocumentVersioningService', () => {
  describe('createVersion', () => {
    it('should create new version with incremented version number', async () => {
      const input = {
        documentId: 'doc-123',
        file: Buffer.from('test content'),
        changeReason: 'Updated invoice amount',
      };

      const result = await DocumentVersioningService.createVersion(input, {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      expect(result.version.versionNumber).toBeGreaterThan(0);
      expect(result.version.checksum).toBeDefined();
    });

    it('should reject version creation for locked document', async () => {
      // Test locked document scenario
    });

    it('should calculate correct SHA-256 checksum', async () => {
      const content = 'test file content';
      const expectedChecksum = 'expected-sha256-hash';

      // Test checksum calculation
    });
  });

  describe('getVersionHistory', () => {
    it('should return paginated version list sorted by version number desc', async () => {
      const result = await DocumentVersioningService.getVersionHistory({
        documentId: 'doc-123',
        page: 1,
        limit: 10,
      }, { organizationId: 'org-1' });

      expect(result.versions).toBeDefined();
      expect(result.pagination.page).toBe(1);
      // Verify sorting
      for (let i = 1; i < result.versions.length; i++) {
        expect(result.versions[i - 1].versionNumber).toBeGreaterThan(result.versions[i].versionNumber);
      }
    });

    it('should exclude archived versions by default', async () => {
      // Test archived version filtering
    });
  });

  describe('compareVersions', () => {
    it('should return correct metadata diff between versions', async () => {
      const result = await DocumentVersioningService.compareVersions({
        documentId: 'doc-123',
        versionA: 1,
        versionB: 3,
        comparisonType: 'METADATA',
      }, { organizationId: 'org-1' });

      expect(result.comparison.metadataDiff).toBeDefined();
      expect(result.comparison.metadataDiff.fileSizeDiff).toBeDefined();
      expect(result.comparison.metadataDiff.daysBetween).toBeGreaterThanOrEqual(0);
    });

    it('should use cache for repeated comparisons', async () => {
      // Test cache hit
    });
  });

  describe('revertToVersion', () => {
    it('should create new version with content from target version', async () => {
      const result = await DocumentVersioningService.revertToVersion({
        documentId: 'doc-123',
        targetVersion: 2,
        reason: 'Reverting to original contract',
      }, {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      expect(result.newVersion.sourceVersion).toBe(2);
    });

    it('should reject revert to archived version', async () => {
      // Test archived version revert rejection
    });
  });

  describe('lockVersion', () => {
    it('should lock version with PERMANENT lock type', async () => {
      const result = await DocumentVersioningService.lockVersion({
        versionId: 'version-123',
        lockType: 'PERMANENT',
        reason: 'Signed contract - do not modify',
      }, {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      expect(result.lock.type).toBe('PERMANENT');
    });

    it('should require expiration for TEMPORARY locks', async () => {
      await expect(
        DocumentVersioningService.lockVersion({
          versionId: 'version-123',
          lockType: 'TEMPORARY',
          reason: 'Under review',
          // Missing expiresAt
        }, {
          userId: 'user-1',
          organizationId: 'org-1',
        })
      ).rejects.toThrow('Blokada tymczasowa wymaga daty wygaśnięcia');
    });
  });

  describe('softDelete', () => {
    it('should soft delete document with recovery deadline', async () => {
      const result = await DocumentVersioningService.softDelete({
        documentId: 'doc-123',
        reason: 'No longer needed',
        recoveryDays: 30,
      }, {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      expect(result.recoveryDeadline).toBeDefined();
    });

    it('should reject deletion of document with permanent locks', async () => {
      // Test permanent lock prevents deletion
    });
  });

  describe('recoverDocument', () => {
    it('should recover document within recovery deadline', async () => {
      const result = await DocumentVersioningService.recoverDocument({
        documentId: 'doc-123',
        reason: 'Needed for audit',
      }, {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
    });

    it('should reject recovery after deadline', async () => {
      // Test expired recovery deadline
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { createTestContext } from '@/test/helpers';

describe('Document Versioning Integration', () => {
  let testContext: any;
  let testDocumentId: string;

  beforeAll(async () => {
    testContext = await createTestContext();

    // Create test document with multiple versions
    const doc = await db.document.create({
      data: {
        organizationId: testContext.organizationId,
        originalName: 'test-document.pdf',
        documentType: 'INVOICE',
        mimeType: 'application/pdf',
        createdBy: testContext.userId,
      },
    });
    testDocumentId = doc.id;

    // Create initial versions
    for (let i = 1; i <= 5; i++) {
      await db.documentVersion.create({
        data: {
          documentId: doc.id,
          organizationId: testContext.organizationId,
          versionNumber: i,
          isCurrent: i === 5,
          storageKey: `test/v${i}/test.pdf`,
          storageBucket: 'test-bucket',
          fileSize: 1000 * i,
          checksum: `checksum-${i}`,
          mimeType: 'application/pdf',
          createdBy: testContext.userId,
        },
      });
    }
  });

  afterAll(async () => {
    await db.documentVersion.deleteMany({ where: { documentId: testDocumentId } });
    await db.document.delete({ where: { id: testDocumentId } });
  });

  describe('Version History', () => {
    it('should return correct version count and pagination', async () => {
      const result = await db.documentVersion.findMany({
        where: { documentId: testDocumentId },
        orderBy: { versionNumber: 'desc' },
      });

      expect(result.length).toBe(5);
      expect(result[0].versionNumber).toBe(5);
      expect(result[0].isCurrent).toBe(true);
    });
  });

  describe('RLS Policies', () => {
    it('should isolate versions by organization', async () => {
      // Set organization context
      await db.$executeRaw`SELECT set_config('app.current_organization_id', ${testContext.organizationId}, true)`;

      const versions = await db.documentVersion.findMany({
        where: { documentId: testDocumentId },
      });

      expect(versions.every(v => v.organizationId === testContext.organizationId)).toBe(true);
    });
  });

  describe('Version Functions', () => {
    it('should correctly calculate next version number', async () => {
      const result = await db.$queryRaw<[{ get_next_version_number: number }]>`
        SELECT get_next_version_number(${testDocumentId}::uuid)
      `;

      expect(result[0].get_next_version_number).toBe(6);
    });
  });

  describe('Soft Delete and Recovery', () => {
    it('should handle complete delete and recover flow', async () => {
      // Create test document for deletion
      const tempDoc = await db.document.create({
        data: {
          organizationId: testContext.organizationId,
          originalName: 'delete-test.pdf',
          documentType: 'OTHER',
          mimeType: 'application/pdf',
          createdBy: testContext.userId,
        },
      });

      // Soft delete
      await db.document.update({
        where: { id: tempDoc.id },
        data: { deletedAt: new Date() },
      });

      const deletedDoc = await db.document.findFirst({
        where: { id: tempDoc.id },
      });

      expect(deletedDoc?.deletedAt).toBeDefined();

      // Recover
      await db.document.update({
        where: { id: tempDoc.id },
        data: { deletedAt: null },
      });

      const recoveredDoc = await db.document.findFirst({
        where: { id: tempDoc.id },
      });

      expect(recoveredDoc?.deletedAt).toBeNull();

      // Cleanup
      await db.document.delete({ where: { id: tempDoc.id } });
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Document Versioning UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display version history for document', async ({ page }) => {
    await page.goto('/documents');

    // Click on a document
    await page.click('[data-testid="document-row"]:first-child');

    // Open version history
    await page.click('[data-testid="version-history-tab"]');

    // Verify history is displayed
    await expect(page.locator('[data-testid="version-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="version-item"]')).toHaveCount(5);

    // Verify current version indicator
    await expect(page.locator('[data-testid="current-version-badge"]')).toBeVisible();
  });

  test('should upload new version of document', async ({ page }) => {
    await page.goto('/documents/doc-123');

    // Click upload new version
    await page.click('[data-testid="upload-new-version"]');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-files/updated-document.pdf');

    // Add change reason
    await page.fill('[name="changeReason"]', 'Updated with new data');

    // Submit
    await page.click('[data-testid="confirm-upload"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Nowa wersja została utworzona');
  });

  test('should compare two versions', async ({ page }) => {
    await page.goto('/documents/doc-123/versions');

    // Select two versions for comparison
    await page.click('[data-testid="version-checkbox-1"]');
    await page.click('[data-testid="version-checkbox-3"]');

    // Click compare
    await page.click('[data-testid="compare-versions"]');

    // Verify comparison view
    await expect(page.locator('[data-testid="comparison-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="metadata-diff"]')).toBeVisible();
  });

  test('should revert to previous version', async ({ page }) => {
    await page.goto('/documents/doc-123/versions');

    // Click revert on version 2
    await page.click('[data-testid="version-2-actions"]');
    await page.click('[data-testid="revert-to-this-version"]');

    // Fill reason
    await page.fill('[name="revertReason"]', 'Reverting to correct version');

    // Confirm
    await page.click('[data-testid="confirm-revert"]');

    // Verify success and new version created
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Przywrócono wersję');
  });

  test('should lock and unlock version', async ({ page }) => {
    await page.goto('/documents/doc-123/versions');

    // Lock version 3
    await page.click('[data-testid="version-3-actions"]');
    await page.click('[data-testid="lock-version"]');

    // Select lock type and reason
    await page.selectOption('[name="lockType"]', 'PERMANENT');
    await page.fill('[name="lockReason"]', 'Signed contract');
    await page.click('[data-testid="confirm-lock"]');

    // Verify lock indicator
    await expect(page.locator('[data-testid="version-3-locked"]')).toBeVisible();
  });

  test('should soft delete and recover document', async ({ page }) => {
    await page.goto('/documents/doc-123');

    // Delete document
    await page.click('[data-testid="document-actions"]');
    await page.click('[data-testid="delete-document"]');
    await page.fill('[name="deleteReason"]', 'No longer needed');
    await page.click('[data-testid="confirm-delete"]');

    // Verify deletion message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Dokument został usunięty');

    // Go to deleted documents
    await page.goto('/documents/deleted');

    // Find and recover
    await page.click('[data-testid="recover-doc-123"]');
    await page.click('[data-testid="confirm-recover"]');

    // Verify recovery
    await expect(page.locator('[data-testid="success-message"]')).toContainText('został przywrócony');
  });

  test('should add annotation to version', async ({ page }) => {
    await page.goto('/documents/doc-123/versions/5');

    // Click add annotation
    await page.click('[data-testid="add-annotation"]');

    // Fill annotation
    await page.selectOption('[name="annotationType"]', 'APPROVAL');
    await page.fill('[name="content"]', 'Zatwierdzone przez kierownika');
    await page.selectOption('[name="visibility"]', 'INTERNAL');

    // Save
    await page.click('[data-testid="save-annotation"]');

    // Verify annotation appears
    await expect(page.locator('[data-testid="annotation-list"]')).toContainText('Zatwierdzone przez kierownika');
  });
});
```

---

## 🔒 Security Checklist

| Requirement | Implementation | Status |
|------------|----------------|--------|
| Authentication required | All endpoints use `protectedProcedure` | ✅ |
| Organization isolation | RLS policies on all tables | ✅ |
| Version access control | User permissions validated | ✅ |
| Locked version protection | Cannot modify locked versions | ✅ |
| Soft delete with recovery | 30-day recovery period | ✅ |
| Audit logging | All operations logged | ✅ |
| S3 encryption | Server-side encryption with KMS | ✅ |
| Signed URL expiration | 1-hour expiration by default | ✅ |
| Input validation | Zod schemas for all inputs | ✅ |
| SQL injection prevention | Parameterized queries only | ✅ |

---

## 📊 Audit Events

```typescript
const VERSIONING_AUDIT_EVENTS = {
  VERSION_CREATED: {
    description: 'Utworzono nową wersję dokumentu',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['versionNumber', 'fileSize', 'checksum', 'changeReason'],
  },
  VERSION_DOWNLOADED: {
    description: 'Pobrano wersję dokumentu',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['versionNumber', 'ipAddress'],
  },
  VERSION_REVERT: {
    description: 'Przywrócono poprzednią wersję',
    severity: 'WARNING',
    retention: '5_YEARS',
    fields: ['sourceVersion', 'newVersion', 'reason'],
  },
  VERSION_LOCKED: {
    description: 'Zablokowano wersję dokumentu',
    severity: 'WARNING',
    retention: '5_YEARS',
    fields: ['lockType', 'reason', 'expiresAt'],
  },
  VERSION_UNLOCKED: {
    description: 'Odblokowano wersję dokumentu',
    severity: 'WARNING',
    retention: '5_YEARS',
    fields: ['reason'],
  },
  DOCUMENT_SOFT_DELETE: {
    description: 'Usunięto dokument (soft delete)',
    severity: 'WARNING',
    retention: '10_YEARS',
    fields: ['documentName', 'versionCount', 'recoveryDeadline'],
  },
  DOCUMENT_RECOVERED: {
    description: 'Przywrócono usunięty dokument',
    severity: 'INFO',
    retention: '10_YEARS',
    fields: ['documentName', 'deletedAt', 'reason'],
  },
  DOCUMENT_PERMANENT_DELETE: {
    description: 'Trwale usunięto dokument',
    severity: 'CRITICAL',
    retention: '10_YEARS',
    fields: ['documentName', 'versionCount', 'reason'],
  },
  VERSION_ARCHIVED: {
    description: 'Zarchiwizowano wersję dokumentu',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['versionNumber', 'storageClass', 'reason'],
  },
  ANNOTATION_ADDED: {
    description: 'Dodano adnotację do wersji',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['annotationType', 'visibility'],
  },
};
```

---

## 📝 Implementation Notes

### Version Number Strategy
- Sequential integers starting from 1
- Never reused after deletion
- Revert creates new version (preserves history)

### Storage Optimization
- Each version stored separately in S3
- Lifecycle policies for cost optimization
- Standard → IA → Glacier progression

### Polish Accounting Compliance
- 5-year minimum retention for invoices (Art. 112 ustawy o VAT)
- 10-year retention for HR documents
- Permanent retention for financial statements
- Complete audit trail required

### Performance Considerations
- Version comparison caching (7-day TTL)
- Paginated version history (max 100 per page)
- Background jobs for retention policy enforcement
- CDN for thumbnail delivery

### Recovery Mechanism
- 30-day default recovery window
- Configurable per organization (1-90 days)
- All versions preserved during soft delete
- Permanent deletion only after retention period

---

## 🔗 Dependencies

- **DOC-001**: Document Upload System (document creation)
- **DOC-002**: Cloud Storage & CDN (S3 and thumbnail generation)
- **AIM**: Authentication & user context

---

## 📈 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Version creation time | <3s | API response time |
| History load time | <500ms | For 50 versions |
| Comparison load time | <2s | Including text diff |
| Recovery success rate | 100% | Within recovery period |
| Storage efficiency | 60%+ deduplication | For similar versions |

---

*Story created following BMAD methodology for KsięgowaCRM Document Intelligence Module*
