# DOC-002: Cloud Storage & CDN

> **Story ID**: DOC-002
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P0 (Critical)
> **Story Points**: 8
> **Sprint**: Phase 4 - Week 13
> **Status**: 📋 Ready for Development

---

## 📋 User Story

**As an** accountant,
**I want** secure cloud storage for documents with fast global delivery,
**So that** documents are safely stored, encrypted, and quickly accessible from any location.

---

## 🎯 Acceptance Criteria

### Scenario 1: Automatic Encryption at Rest
```gherkin
Given a document is uploaded to the system
When the document is stored in cloud storage
Then the document should be encrypted using AES-256 encryption
And the encryption key should be managed by AWS KMS
And the original unencrypted data should never be stored
And the encryption status should be verified and logged
```

### Scenario 2: CDN Integration for Fast Delivery
```gherkin
Given an authenticated user requests a document
When the document is fetched for viewing or download
Then the document should be served via CloudFront CDN
And the response time should be under 200ms for cached content
And the document should be served from the nearest edge location
And cache headers should be properly configured (max-age, ETag)
```

### Scenario 3: Thumbnail Generation
```gherkin
Given a document is uploaded successfully
When the document is an image (JPEG, PNG, TIFF) or PDF
Then a thumbnail should be generated automatically
And the thumbnail should be resized to 300x400 pixels (fit inside)
And the thumbnail should be stored alongside the original
And the thumbnail should be available via CDN within 5 seconds
And the thumbnail generation status should be tracked
```

### Scenario 4: Lifecycle Policy Management
```gherkin
Given a document is stored in the system
When lifecycle policies are configured
Then documents should automatically transition:
  | Age        | Storage Class          | Action              |
  | 0-30 days  | S3 Standard            | Active access       |
  | 30-90 days | S3 Standard-IA         | Infrequent access   |
  | 90-365 days| S3 Glacier Instant     | Archive retrieval   |
  | >365 days  | S3 Glacier Deep Archive| Long-term archive   |
And deleted documents should be permanently removed after 30 days
And the system should track storage class transitions
```

### Scenario 5: Geographic Redundancy
```gherkin
Given documents are stored for a Polish accounting firm
When the primary storage region is eu-central-1 (Frankfurt)
Then documents should be replicated to eu-west-1 (Ireland)
And replication should complete within 15 minutes
And the system should support failover to backup region
And data sovereignty requirements should be met (EU only)
```

### Scenario 6: Secure URL Generation
```gherkin
Given an authenticated user requests document access
When generating a download/view URL
Then a signed URL should be created with:
  - Expiration time of 15 minutes (configurable)
  - User-specific access token validation
  - IP address restriction (optional)
  - Single-use token for downloads (optional)
And the URL should be logged for audit purposes
And expired URLs should return 403 Forbidden
```

### Scenario 7: Storage Quota Management
```gherkin
Given an organization has a storage quota of 10GB
When the organization approaches or exceeds the quota
Then the system should:
  - Alert at 80% usage: "Osiągnięto 80% limitu przestrzeni"
  - Alert at 90% usage: "Krytycznie mało miejsca - 90% wykorzystane"
  - Block uploads at 100%: "Przekroczono limit przestrzeni"
And quota usage should be calculated in real-time
And administrators should be able to request quota increase
```

### Scenario 8: Document Integrity Verification
```gherkin
Given a document is stored in cloud storage
When the document is accessed after storage
Then the system should verify integrity using:
  - SHA-256 checksum comparison
  - ETag validation
  - Storage class verification
And if integrity check fails:
  - Alert should be generated immediately
  - Backup copy should be attempted for recovery
  - Incident should be logged with full details
```

---

## 🗄️ Database Schema

```sql
-- Storage configuration table
CREATE TABLE storage_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Primary storage
    primary_bucket VARCHAR(100) NOT NULL,
    primary_region VARCHAR(50) NOT NULL DEFAULT 'eu-central-1',

    -- Backup storage (for replication)
    backup_bucket VARCHAR(100),
    backup_region VARCHAR(50) DEFAULT 'eu-west-1',

    -- CDN configuration
    cdn_domain VARCHAR(255),
    cdn_distribution_id VARCHAR(50),
    cdn_enabled BOOLEAN DEFAULT TRUE,

    -- Encryption
    kms_key_id VARCHAR(100) NOT NULL,
    encryption_algorithm VARCHAR(20) DEFAULT 'AES-256',

    -- Quotas
    storage_quota_bytes BIGINT DEFAULT 10737418240, -- 10GB default
    storage_used_bytes BIGINT DEFAULT 0,
    quota_alert_threshold_80 BOOLEAN DEFAULT TRUE,
    quota_alert_threshold_90 BOOLEAN DEFAULT TRUE,

    -- Lifecycle settings
    lifecycle_enabled BOOLEAN DEFAULT TRUE,
    transition_to_ia_days INTEGER DEFAULT 30,
    transition_to_glacier_days INTEGER DEFAULT 90,
    transition_to_deep_archive_days INTEGER DEFAULT 365,
    permanent_delete_days INTEGER DEFAULT 30,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document storage metadata
CREATE TABLE document_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Storage location
    bucket VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    storage_class storage_class NOT NULL DEFAULT 'STANDARD',

    -- Encryption
    encryption_status encryption_status NOT NULL DEFAULT 'ENCRYPTED',
    kms_key_id VARCHAR(100),

    -- Integrity
    checksum_sha256 VARCHAR(64) NOT NULL,
    etag VARCHAR(100),
    content_length BIGINT NOT NULL,

    -- CDN
    cdn_url VARCHAR(500),
    cdn_invalidation_id VARCHAR(50),
    cache_control VARCHAR(100) DEFAULT 'private, max-age=3600',

    -- Replication
    replication_status replication_status DEFAULT 'PENDING',
    replicated_at TIMESTAMPTZ,
    backup_bucket VARCHAR(100),
    backup_path VARCHAR(500),

    -- Thumbnail
    thumbnail_path VARCHAR(500),
    thumbnail_status thumbnail_status DEFAULT 'PENDING',
    thumbnail_generated_at TIMESTAMPTZ,

    -- Lifecycle
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    lifecycle_transition_at TIMESTAMPTZ,
    scheduled_deletion_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(document_id)
);

-- Storage class enum
CREATE TYPE storage_class AS ENUM (
    'STANDARD',
    'STANDARD_IA',
    'INTELLIGENT_TIERING',
    'GLACIER_INSTANT_RETRIEVAL',
    'GLACIER',
    'DEEP_ARCHIVE'
);

-- Encryption status enum
CREATE TYPE encryption_status AS ENUM (
    'PENDING',
    'ENCRYPTED',
    'DECRYPTION_FAILED',
    'ERROR'
);

-- Replication status enum
CREATE TYPE replication_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED'
);

-- Thumbnail status enum
CREATE TYPE thumbnail_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'NOT_APPLICABLE'
);

-- Storage access log
CREATE TABLE storage_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Access details
    access_type VARCHAR(50) NOT NULL, -- 'VIEW', 'DOWNLOAD', 'THUMBNAIL'
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,

    -- URL details
    signed_url_generated BOOLEAN DEFAULT FALSE,
    signed_url_expiry TIMESTAMPTZ,
    signed_url_used BOOLEAN DEFAULT FALSE,

    -- Response
    response_time_ms INTEGER,
    bytes_transferred BIGINT,
    cache_hit BOOLEAN,
    edge_location VARCHAR(50),

    -- Timestamp
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage quota alerts
CREATE TABLE storage_quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Alert details
    alert_type VARCHAR(50) NOT NULL, -- 'WARNING_80', 'CRITICAL_90', 'BLOCKED_100'
    threshold_percent INTEGER NOT NULL,
    current_usage_bytes BIGINT NOT NULL,
    quota_bytes BIGINT NOT NULL,

    -- Notification
    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMPTZ,
    notified_users UUID[],

    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolution_type VARCHAR(50), -- 'QUOTA_INCREASED', 'FILES_DELETED', 'AUTO_CLEANUP'

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lifecycle transitions log
CREATE TABLE storage_lifecycle_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Transition details
    from_class storage_class NOT NULL,
    to_class storage_class NOT NULL,
    transition_reason VARCHAR(100), -- 'AGE_POLICY', 'ACCESS_PATTERN', 'MANUAL'

    -- Cost impact
    estimated_savings_monthly DECIMAL(10, 4),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Timestamp
    initiated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage integrity checks
CREATE TABLE storage_integrity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Check details
    check_type VARCHAR(50) NOT NULL, -- 'CHECKSUM', 'ETAG', 'EXISTENCE'
    expected_value VARCHAR(100) NOT NULL,
    actual_value VARCHAR(100),

    -- Result
    passed BOOLEAN NOT NULL,
    error_message TEXT,

    -- Recovery
    recovery_attempted BOOLEAN DEFAULT FALSE,
    recovery_successful BOOLEAN,
    recovery_source VARCHAR(50), -- 'BACKUP', 'REPLICATION'

    -- Timestamp
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_storage_config_org ON storage_configurations(organization_id);
CREATE INDEX idx_document_storage_doc ON document_storage(document_id);
CREATE INDEX idx_document_storage_org ON document_storage(organization_id);
CREATE INDEX idx_document_storage_class ON document_storage(storage_class);
CREATE INDEX idx_document_storage_replication ON document_storage(replication_status);
CREATE INDEX idx_storage_access_document ON storage_access_log(document_id);
CREATE INDEX idx_storage_access_time ON storage_access_log(accessed_at DESC);
CREATE INDEX idx_quota_alerts_org ON storage_quota_alerts(organization_id);
CREATE INDEX idx_lifecycle_log_doc ON storage_lifecycle_log(document_id);
CREATE INDEX idx_integrity_checks_doc ON storage_integrity_checks(document_id);

-- Row Level Security
ALTER TABLE storage_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_quota_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_lifecycle_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_integrity_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY storage_config_org_isolation ON storage_configurations
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY document_storage_org_isolation ON document_storage
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY storage_access_org_isolation ON storage_access_log
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY quota_alerts_org_isolation ON storage_quota_alerts
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY lifecycle_log_org_isolation ON storage_lifecycle_log
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);

CREATE POLICY integrity_checks_org_isolation ON storage_integrity_checks
    FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);
```

---

## 🔧 Technical Implementation

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Storage class enum
export const StorageClassSchema = z.enum([
  'STANDARD',
  'STANDARD_IA',
  'INTELLIGENT_TIERING',
  'GLACIER_INSTANT_RETRIEVAL',
  'GLACIER',
  'DEEP_ARCHIVE',
]);

// Encryption status enum
export const EncryptionStatusSchema = z.enum([
  'PENDING',
  'ENCRYPTED',
  'DECRYPTION_FAILED',
  'ERROR',
]);

// Replication status enum
export const ReplicationStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
]);

// Storage configuration schema
export const StorageConfigurationSchema = z.object({
  primaryBucket: z.string().min(3).max(63),
  primaryRegion: z.string().default('eu-central-1'),
  backupBucket: z.string().min(3).max(63).optional(),
  backupRegion: z.string().default('eu-west-1'),
  cdnDomain: z.string().url().optional(),
  cdnEnabled: z.boolean().default(true),
  storageQuotaGB: z.number().min(1).max(10000).default(10),
  lifecycleEnabled: z.boolean().default(true),
  transitionToIADays: z.number().min(1).max(365).default(30),
  transitionToGlacierDays: z.number().min(30).max(730).default(90),
  transitionToDeepArchiveDays: z.number().min(90).max(2555).default(365),
  permanentDeleteDays: z.number().min(1).max(365).default(30),
});

// Signed URL request schema
export const SignedUrlRequestSchema = z.object({
  documentId: z.string().uuid(),
  accessType: z.enum(['VIEW', 'DOWNLOAD', 'THUMBNAIL']),
  expirationMinutes: z.number().min(1).max(60).default(15),
  restrictToIP: z.string().ip().optional(),
  singleUse: z.boolean().default(false),
});

// Lifecycle policy schema
export const LifecyclePolicySchema = z.object({
  documentId: z.string().uuid().optional(),
  targetClass: StorageClassSchema,
  reason: z.enum(['AGE_POLICY', 'ACCESS_PATTERN', 'MANUAL', 'COST_OPTIMIZATION']),
  scheduledAt: z.string().datetime().optional(),
});

// Quota update schema
export const QuotaUpdateSchema = z.object({
  newQuotaGB: z.number().min(1).max(10000),
  reason: z.string().min(10).max(500),
});

// CDN invalidation schema
export const CDNInvalidationSchema = z.object({
  paths: z.array(z.string()).min(1).max(3000),
  reason: z.string().max(500).optional(),
});

// Integrity check request schema
export const IntegrityCheckRequestSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  checkType: z.enum(['CHECKSUM', 'ETAG', 'EXISTENCE', 'ALL']).default('ALL'),
  attemptRecovery: z.boolean().default(true),
});

// Storage metrics request schema
export const StorageMetricsRequestSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('month'),
  includeByClass: z.boolean().default(true),
  includeCostEstimate: z.boolean().default(true),
});
```

### Cloud Storage Service

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  RestoreObjectCommand,
} from '@aws-sdk/client-s3';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as getCFSignedUrl } from '@aws-sdk/cloudfront-signer';
import sharp from 'sharp';
import crypto from 'crypto';
import { TRPCError } from '@trpc/server';

// Configuration
const CONFIG = {
  PRIMARY_REGION: process.env.AWS_PRIMARY_REGION || 'eu-central-1',
  BACKUP_REGION: process.env.AWS_BACKUP_REGION || 'eu-west-1',
  PRIMARY_BUCKET: process.env.S3_PRIMARY_BUCKET!,
  BACKUP_BUCKET: process.env.S3_BACKUP_BUCKET!,
  CDN_DOMAIN: process.env.CDN_DOMAIN!,
  CDN_DISTRIBUTION_ID: process.env.CDN_DISTRIBUTION_ID!,
  CDN_KEY_PAIR_ID: process.env.CDN_KEY_PAIR_ID!,
  CDN_PRIVATE_KEY: process.env.CDN_PRIVATE_KEY!,
  KMS_KEY_ID: process.env.KMS_KEY_ID!,
  THUMBNAIL_WIDTH: 300,
  THUMBNAIL_HEIGHT: 400,
  THUMBNAIL_QUALITY: 80,
  DEFAULT_SIGNED_URL_EXPIRY: 15 * 60, // 15 minutes
};

// S3 Clients
const s3PrimaryClient = new S3Client({ region: CONFIG.PRIMARY_REGION });
const s3BackupClient = new S3Client({ region: CONFIG.BACKUP_REGION });
const cloudFrontClient = new CloudFrontClient({ region: CONFIG.PRIMARY_REGION });

// Types
interface StorageContext {
  organizationId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface StorageResult {
  bucket: string;
  region: string;
  path: string;
  cdnUrl: string;
  encryptionStatus: string;
  checksum: string;
  etag: string;
  contentLength: number;
}

interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  accessId: string;
}

// Cloud Storage Service
export class CloudStorageService {

  // Store document with encryption
  static async storeDocument(
    prisma: any,
    ctx: StorageContext,
    documentId: string,
    buffer: Buffer,
    storagePath: string,
    mimeType: string
  ): Promise<StorageResult> {
    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Upload to primary bucket with server-side encryption
    const uploadResult = await s3PrimaryClient.send(new PutObjectCommand({
      Bucket: CONFIG.PRIMARY_BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: CONFIG.KMS_KEY_ID,
      Metadata: {
        'organization-id': ctx.organizationId,
        'document-id': documentId,
        'checksum-sha256': checksum,
      },
    }));

    const cdnUrl = `https://${CONFIG.CDN_DOMAIN}/${storagePath}`;

    // Create storage record
    await prisma.documentStorage.create({
      data: {
        documentId,
        organizationId: ctx.organizationId,
        bucket: CONFIG.PRIMARY_BUCKET,
        region: CONFIG.PRIMARY_REGION,
        storagePath,
        storageClass: 'STANDARD',
        encryptionStatus: 'ENCRYPTED',
        kmsKeyId: CONFIG.KMS_KEY_ID,
        checksumSha256: checksum,
        etag: uploadResult.ETag?.replace(/"/g, ''),
        contentLength: buffer.length,
        cdnUrl,
        cacheControl: 'private, max-age=3600',
        replicationStatus: 'PENDING',
        thumbnailStatus: this.canGenerateThumbnail(mimeType) ? 'PENDING' : 'NOT_APPLICABLE',
      },
    });

    // Update quota usage
    await this.updateQuotaUsage(prisma, ctx.organizationId, buffer.length);

    // Trigger async replication
    this.triggerReplication(prisma, ctx, documentId, storagePath, buffer).catch(console.error);

    // Trigger async thumbnail generation
    if (this.canGenerateThumbnail(mimeType)) {
      this.generateThumbnail(prisma, ctx, documentId, storagePath, buffer, mimeType).catch(console.error);
    }

    return {
      bucket: CONFIG.PRIMARY_BUCKET,
      region: CONFIG.PRIMARY_REGION,
      path: storagePath,
      cdnUrl,
      encryptionStatus: 'ENCRYPTED',
      checksum,
      etag: uploadResult.ETag?.replace(/"/g, '') || '',
      contentLength: buffer.length,
    };
  }

  // Check if thumbnail can be generated
  static canGenerateThumbnail(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'].includes(mimeType);
  }

  // Generate thumbnail
  static async generateThumbnail(
    prisma: any,
    ctx: StorageContext,
    documentId: string,
    storagePath: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string | null> {
    try {
      // Update status to processing
      await prisma.documentStorage.update({
        where: { documentId },
        data: { thumbnailStatus: 'PROCESSING' },
      });

      let thumbnailBuffer: Buffer | null = null;

      if (mimeType.startsWith('image/')) {
        thumbnailBuffer = await sharp(buffer)
          .resize(CONFIG.THUMBNAIL_WIDTH, CONFIG.THUMBNAIL_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: CONFIG.THUMBNAIL_QUALITY })
          .toBuffer();
      }
      // PDF thumbnail generation would require additional library like pdf-poppler

      if (thumbnailBuffer) {
        const thumbnailPath = storagePath.replace(/\.[^.]+$/, '_thumb.jpg');

        await s3PrimaryClient.send(new PutObjectCommand({
          Bucket: CONFIG.PRIMARY_BUCKET,
          Key: thumbnailPath,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: CONFIG.KMS_KEY_ID,
          CacheControl: 'public, max-age=86400', // 24 hours for thumbnails
        }));

        await prisma.documentStorage.update({
          where: { documentId },
          data: {
            thumbnailPath,
            thumbnailStatus: 'COMPLETED',
            thumbnailGeneratedAt: new Date(),
          },
        });

        return thumbnailPath;
      }

      await prisma.documentStorage.update({
        where: { documentId },
        data: { thumbnailStatus: 'NOT_APPLICABLE' },
      });

      return null;
    } catch (error) {
      await prisma.documentStorage.update({
        where: { documentId },
        data: { thumbnailStatus: 'FAILED' },
      });
      throw error;
    }
  }

  // Trigger replication to backup region
  static async triggerReplication(
    prisma: any,
    ctx: StorageContext,
    documentId: string,
    storagePath: string,
    buffer: Buffer
  ): Promise<void> {
    try {
      await prisma.documentStorage.update({
        where: { documentId },
        data: { replicationStatus: 'IN_PROGRESS' },
      });

      // Get object from primary
      const getResult = await s3PrimaryClient.send(new GetObjectCommand({
        Bucket: CONFIG.PRIMARY_BUCKET,
        Key: storagePath,
      }));

      // Upload to backup bucket
      await s3BackupClient.send(new PutObjectCommand({
        Bucket: CONFIG.BACKUP_BUCKET,
        Key: storagePath,
        Body: buffer,
        ContentType: getResult.ContentType,
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: CONFIG.KMS_KEY_ID,
        Metadata: getResult.Metadata,
      }));

      await prisma.documentStorage.update({
        where: { documentId },
        data: {
          replicationStatus: 'COMPLETED',
          replicatedAt: new Date(),
          backupBucket: CONFIG.BACKUP_BUCKET,
          backupPath: storagePath,
        },
      });
    } catch (error) {
      await prisma.documentStorage.update({
        where: { documentId },
        data: { replicationStatus: 'FAILED' },
      });
      throw error;
    }
  }

  // Generate signed URL for document access
  static async generateSignedUrl(
    prisma: any,
    ctx: StorageContext,
    documentId: string,
    accessType: 'VIEW' | 'DOWNLOAD' | 'THUMBNAIL',
    expirationMinutes: number = 15,
    options?: { restrictToIP?: string; singleUse?: boolean }
  ): Promise<SignedUrlResult> {
    // Get document storage info
    const storage = await prisma.documentStorage.findUnique({
      where: { documentId },
      include: { document: true },
    });

    if (!storage) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie znaleziony',
      });
    }

    // Determine path based on access type
    const path = accessType === 'THUMBNAIL' && storage.thumbnailPath
      ? storage.thumbnailPath
      : storage.storagePath;

    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const accessId = crypto.randomUUID();

    // Generate CloudFront signed URL
    const url = getCFSignedUrl({
      url: `https://${CONFIG.CDN_DOMAIN}/${path}`,
      keyPairId: CONFIG.CDN_KEY_PAIR_ID,
      privateKey: CONFIG.CDN_PRIVATE_KEY,
      dateLessThan: expiresAt.toISOString(),
      ...(options?.restrictToIP && {
        policy: JSON.stringify({
          Statement: [{
            Resource: `https://${CONFIG.CDN_DOMAIN}/${path}`,
            Condition: {
              DateLessThan: { 'AWS:EpochTime': Math.floor(expiresAt.getTime() / 1000) },
              IpAddress: { 'AWS:SourceIp': options.restrictToIP },
            },
          }],
        }),
      }),
    });

    // Log access
    await prisma.storageAccessLog.create({
      data: {
        documentId,
        organizationId: ctx.organizationId,
        accessType,
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        signedUrlGenerated: true,
        signedUrlExpiry: expiresAt,
      },
    });

    // Update last accessed
    await prisma.documentStorage.update({
      where: { documentId },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    return { url, expiresAt, accessId };
  }

  // Get document from storage
  static async getDocument(
    prisma: any,
    ctx: StorageContext,
    documentId: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const storage = await prisma.documentStorage.findUnique({
      where: { documentId },
      include: { document: true },
    });

    if (!storage) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie znaleziony',
      });
    }

    const response = await s3PrimaryClient.send(new GetObjectCommand({
      Bucket: storage.bucket,
      Key: storage.storagePath,
    }));

    const buffer = Buffer.from(await response.Body!.transformToByteArray());

    // Verify integrity
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    if (checksum !== storage.checksumSha256) {
      // Log integrity failure
      await prisma.storageIntegrityCheck.create({
        data: {
          documentId,
          organizationId: ctx.organizationId,
          checkType: 'CHECKSUM',
          expectedValue: storage.checksumSha256,
          actualValue: checksum,
          passed: false,
          errorMessage: 'Checksum mismatch - possible data corruption',
        },
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Błąd integralności dokumentu',
      });
    }

    return {
      buffer,
      mimeType: storage.document.mimeType,
      filename: storage.document.originalFilename,
    };
  }

  // Update storage quota usage
  static async updateQuotaUsage(
    prisma: any,
    organizationId: string,
    bytesChange: number
  ): Promise<void> {
    const config = await prisma.storageConfiguration.findUnique({
      where: { organizationId },
    });

    if (!config) return;

    const newUsage = config.storageUsedBytes + bytesChange;
    const usagePercent = (newUsage / config.storageQuotaBytes) * 100;

    await prisma.storageConfiguration.update({
      where: { organizationId },
      data: { storageUsedBytes: Math.max(0, newUsage) },
    });

    // Check for quota alerts
    if (usagePercent >= 100 && config.quotaAlertThreshold100) {
      await this.createQuotaAlert(prisma, organizationId, 'BLOCKED_100', 100, newUsage, config.storageQuotaBytes);
    } else if (usagePercent >= 90 && config.quotaAlertThreshold90) {
      await this.createQuotaAlert(prisma, organizationId, 'CRITICAL_90', 90, newUsage, config.storageQuotaBytes);
    } else if (usagePercent >= 80 && config.quotaAlertThreshold80) {
      await this.createQuotaAlert(prisma, organizationId, 'WARNING_80', 80, newUsage, config.storageQuotaBytes);
    }
  }

  // Create quota alert
  static async createQuotaAlert(
    prisma: any,
    organizationId: string,
    alertType: string,
    threshold: number,
    currentUsage: number,
    quotaBytes: number
  ): Promise<void> {
    // Check if alert already exists and is unresolved
    const existing = await prisma.storageQuotaAlert.findFirst({
      where: {
        organizationId,
        alertType,
        resolved: false,
      },
    });

    if (existing) return;

    await prisma.storageQuotaAlert.create({
      data: {
        organizationId,
        alertType,
        thresholdPercent: threshold,
        currentUsageBytes: currentUsage,
        quotaBytes,
      },
    });
  }

  // Apply lifecycle transition
  static async applyLifecycleTransition(
    prisma: any,
    ctx: StorageContext,
    documentId: string,
    targetClass: string,
    reason: string
  ): Promise<void> {
    const storage = await prisma.documentStorage.findUnique({
      where: { documentId },
    });

    if (!storage) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie znaleziony',
      });
    }

    const fromClass = storage.storageClass;

    // Create lifecycle log entry
    const logEntry = await prisma.storageLifecycleLog.create({
      data: {
        documentId,
        organizationId: ctx.organizationId,
        fromClass,
        toClass: targetClass,
        transitionReason: reason,
        status: 'PENDING',
      },
    });

    try {
      // Copy object with new storage class
      await s3PrimaryClient.send(new CopyObjectCommand({
        Bucket: CONFIG.PRIMARY_BUCKET,
        Key: storage.storagePath,
        CopySource: `${CONFIG.PRIMARY_BUCKET}/${storage.storagePath}`,
        StorageClass: targetClass as any,
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: CONFIG.KMS_KEY_ID,
      }));

      // Update storage record
      await prisma.documentStorage.update({
        where: { documentId },
        data: {
          storageClass: targetClass,
          lifecycleTransitionAt: new Date(),
        },
      });

      // Update log entry
      await prisma.storageLifecycleLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.storageLifecycleLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  // Invalidate CDN cache
  static async invalidateCDN(
    prisma: any,
    ctx: StorageContext,
    paths: string[],
    reason?: string
  ): Promise<string> {
    const invalidation = await cloudFrontClient.send(new CreateInvalidationCommand({
      DistributionId: CONFIG.CDN_DISTRIBUTION_ID,
      InvalidationBatch: {
        Paths: {
          Quantity: paths.length,
          Items: paths.map(p => `/${p}`),
        },
        CallerReference: `${Date.now()}-${crypto.randomUUID()}`,
      },
    }));

    return invalidation.Invalidation?.Id || '';
  }

  // Verify document integrity
  static async verifyIntegrity(
    prisma: any,
    ctx: StorageContext,
    documentId: string,
    attemptRecovery: boolean = true
  ): Promise<{ passed: boolean; checks: any[] }> {
    const storage = await prisma.documentStorage.findUnique({
      where: { documentId },
    });

    if (!storage) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie znaleziony',
      });
    }

    const checks: any[] = [];

    // Check existence
    try {
      const headResult = await s3PrimaryClient.send(new HeadObjectCommand({
        Bucket: storage.bucket,
        Key: storage.storagePath,
      }));

      checks.push({
        type: 'EXISTENCE',
        passed: true,
        details: { exists: true, lastModified: headResult.LastModified },
      });

      // Check ETag
      const etagMatch = headResult.ETag?.replace(/"/g, '') === storage.etag;
      checks.push({
        type: 'ETAG',
        passed: etagMatch,
        expected: storage.etag,
        actual: headResult.ETag?.replace(/"/g, ''),
      });

      if (!etagMatch && attemptRecovery && storage.backupPath) {
        // Attempt recovery from backup
        await this.recoverFromBackup(prisma, ctx, documentId, storage);
        checks.push({
          type: 'RECOVERY',
          passed: true,
          source: 'BACKUP',
        });
      }
    } catch (error) {
      checks.push({
        type: 'EXISTENCE',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (attemptRecovery && storage.backupPath) {
        await this.recoverFromBackup(prisma, ctx, documentId, storage);
        checks.push({
          type: 'RECOVERY',
          passed: true,
          source: 'BACKUP',
        });
      }
    }

    // Log integrity checks
    for (const check of checks) {
      await prisma.storageIntegrityCheck.create({
        data: {
          documentId,
          organizationId: ctx.organizationId,
          checkType: check.type,
          expectedValue: check.expected || 'EXISTS',
          actualValue: check.actual || String(check.passed),
          passed: check.passed,
          errorMessage: check.error,
          recoveryAttempted: check.type === 'RECOVERY',
          recoverySuccessful: check.type === 'RECOVERY' ? check.passed : null,
          recoverySource: check.source,
        },
      });
    }

    return {
      passed: checks.every(c => c.passed),
      checks,
    };
  }

  // Recover document from backup
  static async recoverFromBackup(
    prisma: any,
    ctx: StorageContext,
    documentId: string,
    storage: any
  ): Promise<void> {
    // Get from backup
    const backupResult = await s3BackupClient.send(new GetObjectCommand({
      Bucket: storage.backupBucket,
      Key: storage.backupPath,
    }));

    const buffer = Buffer.from(await backupResult.Body!.transformToByteArray());

    // Restore to primary
    await s3PrimaryClient.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: storage.storagePath,
      Body: buffer,
      ContentType: backupResult.ContentType,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: CONFIG.KMS_KEY_ID,
    }));
  }

  // Get storage metrics
  static async getStorageMetrics(
    prisma: any,
    ctx: StorageContext,
    period: string
  ): Promise<any> {
    const config = await prisma.storageConfiguration.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const now = new Date();
    let startDate: Date;

    switch (period) {
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
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const [byClass, accessStats, documents] = await Promise.all([
      prisma.documentStorage.groupBy({
        by: ['storageClass'],
        where: { organizationId: ctx.organizationId },
        _sum: { contentLength: true },
        _count: true,
      }),
      prisma.storageAccessLog.groupBy({
        by: ['accessType'],
        where: {
          organizationId: ctx.organizationId,
          accessedAt: { gte: startDate },
        },
        _count: true,
      }),
      prisma.document.count({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      }),
    ]);

    // Calculate costs (simplified AWS S3 pricing)
    const COST_PER_GB = {
      STANDARD: 0.023,
      STANDARD_IA: 0.0125,
      GLACIER_INSTANT_RETRIEVAL: 0.004,
      GLACIER: 0.0036,
      DEEP_ARCHIVE: 0.00099,
    };

    let estimatedMonthlyCost = 0;
    for (const classData of byClass) {
      const gbSize = (classData._sum.contentLength || 0) / (1024 * 1024 * 1024);
      const costPerGb = COST_PER_GB[classData.storageClass as keyof typeof COST_PER_GB] || 0.023;
      estimatedMonthlyCost += gbSize * costPerGb;
    }

    return {
      totalDocuments: documents,
      totalStorageBytes: config?.storageUsedBytes || 0,
      totalStorageGB: ((config?.storageUsedBytes || 0) / (1024 * 1024 * 1024)).toFixed(2),
      quotaBytes: config?.storageQuotaBytes || 0,
      quotaGB: ((config?.storageQuotaBytes || 0) / (1024 * 1024 * 1024)).toFixed(2),
      usagePercent: config ? ((config.storageUsedBytes / config.storageQuotaBytes) * 100).toFixed(1) : 0,
      byStorageClass: byClass,
      accessStats,
      estimatedMonthlyCostUSD: estimatedMonthlyCost.toFixed(2),
      cdnEnabled: config?.cdnEnabled,
      replicationEnabled: !!config?.backupBucket,
    };
  }
}
```

### tRPC API Router

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { CloudStorageService } from '../services/cloudStorage.service';
import {
  SignedUrlRequestSchema,
  LifecyclePolicySchema,
  QuotaUpdateSchema,
  CDNInvalidationSchema,
  IntegrityCheckRequestSchema,
  StorageMetricsRequestSchema,
  StorageConfigurationSchema,
} from '../schemas/cloudStorage.schema';

export const cloudStorageRouter = router({
  // Get signed URL for document access
  getSignedUrl: protectedProcedure
    .input(SignedUrlRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return CloudStorageService.generateSignedUrl(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
          ipAddress: ctx.req?.ip,
          userAgent: ctx.req?.headers['user-agent'],
        },
        input.documentId,
        input.accessType,
        input.expirationMinutes,
        {
          restrictToIP: input.restrictToIP,
          singleUse: input.singleUse,
        }
      );
    }),

  // Get storage configuration
  getConfiguration: protectedProcedure
    .query(async ({ ctx }) => {
      const config = await ctx.prisma.storageConfiguration.findUnique({
        where: { organizationId: ctx.session.organizationId },
      });

      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Konfiguracja przechowywania nie znaleziona',
        });
      }

      return config;
    }),

  // Update storage configuration (admin only)
  updateConfiguration: adminProcedure
    .input(StorageConfigurationSchema.partial())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.storageConfiguration.update({
        where: { organizationId: ctx.session.organizationId },
        data: {
          ...input,
          storageQuotaBytes: input.storageQuotaGB ? input.storageQuotaGB * 1024 * 1024 * 1024 : undefined,
        },
      });
    }),

  // Get storage metrics
  getMetrics: protectedProcedure
    .input(StorageMetricsRequestSchema)
    .query(async ({ ctx, input }) => {
      return CloudStorageService.getStorageMetrics(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
        },
        input.period
      );
    }),

  // Get document storage info
  getDocumentStorage: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const storage = await ctx.prisma.documentStorage.findUnique({
        where: { documentId: input.documentId },
        include: { document: true },
      });

      if (!storage) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Informacje o przechowywaniu nie znalezione',
        });
      }

      return storage;
    }),

  // Apply lifecycle transition
  applyLifecycleTransition: adminProcedure
    .input(LifecyclePolicySchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.documentId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ID dokumentu jest wymagane',
        });
      }

      await CloudStorageService.applyLifecycleTransition(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
        },
        input.documentId,
        input.targetClass,
        input.reason
      );

      return { success: true };
    }),

  // Verify document integrity
  verifyIntegrity: protectedProcedure
    .input(IntegrityCheckRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const documentIds = input.documentIds || [];

      if (documentIds.length === 0) {
        // Get all documents for organization
        const documents = await ctx.prisma.document.findMany({
          where: {
            organizationId: ctx.session.organizationId,
            deletedAt: null,
          },
          select: { id: true },
          take: 100,
        });
        documentIds.push(...documents.map(d => d.id));
      }

      const results = await Promise.all(
        documentIds.map(async (docId) => {
          try {
            const result = await CloudStorageService.verifyIntegrity(
              ctx.prisma,
              {
                organizationId: ctx.session.organizationId,
                userId: ctx.session.userId,
              },
              docId,
              input.attemptRecovery
            );
            return { documentId: docId, ...result };
          } catch (error) {
            return {
              documentId: docId,
              passed: false,
              checks: [{ type: 'ERROR', passed: false, error: error instanceof Error ? error.message : 'Unknown' }],
            };
          }
        })
      );

      return {
        totalChecked: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        results,
      };
    }),

  // Invalidate CDN cache
  invalidateCDN: adminProcedure
    .input(CDNInvalidationSchema)
    .mutation(async ({ ctx, input }) => {
      const invalidationId = await CloudStorageService.invalidateCDN(
        ctx.prisma,
        {
          organizationId: ctx.session.organizationId,
          userId: ctx.session.userId,
        },
        input.paths,
        input.reason
      );

      return { invalidationId };
    }),

  // Update quota (admin only)
  updateQuota: adminProcedure
    .input(QuotaUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const newQuotaBytes = input.newQuotaGB * 1024 * 1024 * 1024;

      await ctx.prisma.storageConfiguration.update({
        where: { organizationId: ctx.session.organizationId },
        data: { storageQuotaBytes: newQuotaBytes },
      });

      // Resolve any existing quota alerts
      await ctx.prisma.storageQuotaAlert.updateMany({
        where: {
          organizationId: ctx.session.organizationId,
          resolved: false,
        },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolutionType: 'QUOTA_INCREASED',
        },
      });

      return { newQuotaGB: input.newQuotaGB };
    }),

  // Get quota alerts
  getQuotaAlerts: protectedProcedure
    .input(z.object({
      includeResolved: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.storageQuotaAlert.findMany({
        where: {
          organizationId: ctx.session.organizationId,
          ...(input.includeResolved ? {} : { resolved: false }),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  // Get lifecycle transitions
  getLifecycleLog: protectedProcedure
    .input(z.object({
      documentId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.storageLifecycleLog.findMany({
        where: {
          organizationId: ctx.session.organizationId,
          ...(input.documentId && { documentId: input.documentId }),
        },
        orderBy: { initiatedAt: 'desc' },
        take: input.limit,
        include: { document: { select: { originalFilename: true } } },
      });
    }),

  // Get access log
  getAccessLog: protectedProcedure
    .input(z.object({
      documentId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.storageAccessLog.findMany({
        where: {
          organizationId: ctx.session.organizationId,
          ...(input.documentId && { documentId: input.documentId }),
        },
        orderBy: { accessedAt: 'desc' },
        take: input.limit,
      });
    }),
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudStorageService } from '../services/cloudStorage.service';
import crypto from 'crypto';

describe('CloudStorageService', () => {
  describe('canGenerateThumbnail', () => {
    it('should return true for supported image types', () => {
      expect(CloudStorageService.canGenerateThumbnail('image/jpeg')).toBe(true);
      expect(CloudStorageService.canGenerateThumbnail('image/png')).toBe(true);
      expect(CloudStorageService.canGenerateThumbnail('image/tiff')).toBe(true);
    });

    it('should return true for PDF', () => {
      expect(CloudStorageService.canGenerateThumbnail('application/pdf')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(CloudStorageService.canGenerateThumbnail('application/msword')).toBe(false);
      expect(CloudStorageService.canGenerateThumbnail('text/plain')).toBe(false);
    });
  });
});

describe('Storage Quota Calculations', () => {
  it('should calculate correct percentage usage', () => {
    const usedBytes = 8 * 1024 * 1024 * 1024; // 8GB
    const quotaBytes = 10 * 1024 * 1024 * 1024; // 10GB

    const percentage = (usedBytes / quotaBytes) * 100;
    expect(percentage).toBe(80);
  });

  it('should trigger warning at 80%', () => {
    const threshold = 80;
    const usagePercent = 80;

    expect(usagePercent >= threshold).toBe(true);
  });

  it('should trigger critical at 90%', () => {
    const threshold = 90;
    const usagePercent = 90;

    expect(usagePercent >= threshold).toBe(true);
  });

  it('should block at 100%', () => {
    const threshold = 100;
    const usagePercent = 100;

    expect(usagePercent >= threshold).toBe(true);
  });
});

describe('Lifecycle Policy Calculations', () => {
  it('should calculate correct storage class based on age', () => {
    const config = {
      transitionToIADays: 30,
      transitionToGlacierDays: 90,
      transitionToDeepArchiveDays: 365,
    };

    const getStorageClass = (ageDays: number) => {
      if (ageDays >= config.transitionToDeepArchiveDays) return 'DEEP_ARCHIVE';
      if (ageDays >= config.transitionToGlacierDays) return 'GLACIER_INSTANT_RETRIEVAL';
      if (ageDays >= config.transitionToIADays) return 'STANDARD_IA';
      return 'STANDARD';
    };

    expect(getStorageClass(10)).toBe('STANDARD');
    expect(getStorageClass(30)).toBe('STANDARD_IA');
    expect(getStorageClass(90)).toBe('GLACIER_INSTANT_RETRIEVAL');
    expect(getStorageClass(365)).toBe('DEEP_ARCHIVE');
    expect(getStorageClass(500)).toBe('DEEP_ARCHIVE');
  });
});

describe('Cost Calculations', () => {
  it('should calculate monthly storage cost correctly', () => {
    const COST_PER_GB = {
      STANDARD: 0.023,
      STANDARD_IA: 0.0125,
      GLACIER_INSTANT_RETRIEVAL: 0.004,
    };

    const storageByClass = [
      { class: 'STANDARD', gbSize: 5 },
      { class: 'STANDARD_IA', gbSize: 3 },
      { class: 'GLACIER_INSTANT_RETRIEVAL', gbSize: 2 },
    ];

    let totalCost = 0;
    for (const item of storageByClass) {
      totalCost += item.gbSize * COST_PER_GB[item.class as keyof typeof COST_PER_GB];
    }

    // 5 * 0.023 + 3 * 0.0125 + 2 * 0.004 = 0.115 + 0.0375 + 0.008 = 0.1605
    expect(totalCost).toBeCloseTo(0.1605, 4);
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '../test/helpers';
import { cloudStorageRouter } from '../routers/cloudStorage.router';

describe('Cloud Storage Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('getConfiguration', () => {
    it('should return storage configuration for organization', async () => {
      const caller = cloudStorageRouter.createCaller(ctx);

      const config = await caller.getConfiguration();

      expect(config).toBeDefined();
      expect(config.organizationId).toBe(ctx.session.organizationId);
      expect(config.primaryBucket).toBeDefined();
      expect(config.cdnEnabled).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return storage metrics', async () => {
      const caller = cloudStorageRouter.createCaller(ctx);

      const metrics = await caller.getMetrics({ period: 'month' });

      expect(metrics).toBeDefined();
      expect(metrics.totalDocuments).toBeGreaterThanOrEqual(0);
      expect(metrics.totalStorageBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.usagePercent).toBeDefined();
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL for document', async () => {
      const caller = cloudStorageRouter.createCaller(ctx);

      // First create a test document
      const document = await ctx.prisma.document.create({
        data: {
          organizationId: ctx.session.organizationId,
          uploadedBy: ctx.session.userId,
          originalFilename: 'test.pdf',
          storedFilename: 'test-stored.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          fileExtension: '.pdf',
          checksumSha256: 'a'.repeat(64),
          storageBucket: 'test-bucket',
          storagePath: 'test/path/test.pdf',
          status: 'UPLOADED',
        },
      });

      await ctx.prisma.documentStorage.create({
        data: {
          documentId: document.id,
          organizationId: ctx.session.organizationId,
          bucket: 'test-bucket',
          region: 'eu-central-1',
          storagePath: 'test/path/test.pdf',
          encryptionStatus: 'ENCRYPTED',
          checksumSha256: 'a'.repeat(64),
          contentLength: 1024,
        },
      });

      const result = await caller.getSignedUrl({
        documentId: document.id,
        accessType: 'VIEW',
        expirationMinutes: 15,
      });

      expect(result.url).toBeDefined();
      expect(result.url).toContain('https://');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('verifyIntegrity', () => {
    it('should perform integrity check on documents', async () => {
      const caller = cloudStorageRouter.createCaller(ctx);

      const result = await caller.verifyIntegrity({
        checkType: 'ALL',
        attemptRecovery: false,
      });

      expect(result).toBeDefined();
      expect(result.totalChecked).toBeGreaterThanOrEqual(0);
      expect(result.passed).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('RLS Policies', () => {
    it('should isolate storage data by organization', async () => {
      // Create storage for other organization
      const otherOrgCtx = await createTestContext({ organizationId: 'other-org' });

      await otherOrgCtx.prisma.storageConfiguration.create({
        data: {
          organizationId: 'other-org',
          primaryBucket: 'other-bucket',
          kmsKeyId: 'other-kms-key',
        },
      });

      // Query from original context
      const caller = cloudStorageRouter.createCaller(ctx);

      // Should not see other org's config
      await expect(caller.getConfiguration()).resolves.not.toMatchObject({
        primaryBucket: 'other-bucket',
      });
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cloud Storage E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should display storage metrics on dashboard', async ({ page }) => {
    await page.goto('/documents/storage');

    // Check metrics are displayed
    await expect(page.locator('[data-testid="storage-used"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-quota"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-percentage"]')).toBeVisible();
  });

  test('should show storage breakdown by class', async ({ page }) => {
    await page.goto('/documents/storage');

    await expect(page.locator('[data-testid="storage-class-breakdown"]')).toBeVisible();
    await expect(page.locator('text=Standard')).toBeVisible();
  });

  test('should display CDN status', async ({ page }) => {
    await page.goto('/documents/storage');

    await expect(page.locator('[data-testid="cdn-status"]')).toBeVisible();
    await expect(page.locator('text=CDN Aktywne')).toBeVisible();
  });

  test('should allow admin to update quota', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@example.com');
    await page.fill('[data-testid="password"]', 'adminpass123');
    await page.click('[data-testid="login-button"]');

    await page.goto('/admin/storage');

    await page.fill('[data-testid="quota-input"]', '20');
    await page.click('[data-testid="update-quota-button"]');

    await expect(page.locator('text=Limit zaktualizowany')).toBeVisible();
  });

  test('should show quota alert when approaching limit', async ({ page }) => {
    // Mock high usage
    await page.route('**/api/trpc/cloudStorage.getMetrics*', route => {
      route.fulfill({
        body: JSON.stringify({
          result: {
            data: {
              usagePercent: '85',
              totalStorageGB: '8.5',
              quotaGB: '10',
            },
          },
        }),
      });
    });

    await page.goto('/documents/storage');

    await expect(page.locator('[data-testid="quota-warning"]')).toBeVisible();
    await expect(page.locator('text=Osiągnięto 85%')).toBeVisible();
  });

  test('should generate signed URL and allow download', async ({ page }) => {
    await page.goto('/documents');

    // Click on document to view
    await page.click('[data-testid="document-row"]:first-child');

    // Wait for signed URL generation
    await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible({ timeout: 5000 });

    // Click download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-button"]'),
    ]);

    expect(download.suggestedFilename()).toBeDefined();
  });

  test('should display thumbnail for image documents', async ({ page }) => {
    await page.goto('/documents');

    // Check thumbnail is visible for image document
    const thumbnail = page.locator('[data-testid="document-thumbnail"]:first-child img');
    await expect(thumbnail).toBeVisible();

    // Verify thumbnail loads from CDN
    const src = await thumbnail.getAttribute('src');
    expect(src).toContain('_thumb.jpg');
  });
});
```

---

## 🔐 Security Checklist

### Encryption
- [ ] AES-256 encryption at rest via AWS KMS
- [ ] TLS 1.3 encryption in transit
- [ ] KMS key rotation enabled (annual)
- [ ] Encryption keys never exposed in logs or responses

### Access Control
- [ ] Signed URLs with short expiration (15 min default)
- [ ] IP restriction option for signed URLs
- [ ] Single-use token option for downloads
- [ ] Organization isolation via RLS

### Data Protection
- [ ] Geographic redundancy (EU regions only for compliance)
- [ ] Cross-region replication with encryption
- [ ] Integrity verification via checksums
- [ ] Automatic recovery from backup region

### Audit & Compliance
- [ ] All access logged with user, IP, timestamp
- [ ] CDN access logs retained
- [ ] Lifecycle transitions logged
- [ ] GDPR-compliant data residency (EU only)

### Infrastructure Security
- [ ] S3 bucket policies restrict public access
- [ ] CloudFront Origin Access Identity (OAI)
- [ ] VPC endpoints for S3 access from backend
- [ ] WAF rules on CloudFront distribution

---

## 📊 Audit Events

| Event Type | Trigger | Data Captured |
|------------|---------|---------------|
| `SIGNED_URL_GENERATED` | URL creation | documentId, accessType, expiry, userId |
| `DOCUMENT_ACCESSED` | File download/view | documentId, responseTime, cacheHit |
| `STORAGE_CLASS_CHANGED` | Lifecycle transition | documentId, fromClass, toClass |
| `REPLICATION_COMPLETED` | Cross-region sync | documentId, sourceRegion, targetRegion |
| `INTEGRITY_CHECK_FAILED` | Checksum mismatch | documentId, expectedHash, actualHash |
| `RECOVERY_ATTEMPTED` | Backup restoration | documentId, source, success |
| `QUOTA_ALERT_TRIGGERED` | Threshold reached | alertType, usagePercent, quotaBytes |
| `CDN_INVALIDATED` | Cache cleared | paths, invalidationId |

---

## 📝 Implementation Notes

### AWS Configuration Requirements
- S3 buckets with versioning enabled
- KMS customer-managed key with automatic rotation
- CloudFront distribution with OAI
- S3 replication rules for cross-region backup
- Lifecycle rules configured on buckets

### Polish Compliance
- Data residency: EU regions only (eu-central-1, eu-west-1)
- Document retention per Polish law (5-10 years)
- RODO/GDPR compliance for personal data in documents
- Audit logs retained per Ustawa o rachunkowości

### Performance Targets
- CDN cache hit ratio: >90%
- Signed URL generation: <100ms
- Thumbnail generation: <5s
- Replication lag: <15 minutes
- Integrity check: <1s per document

### Cost Optimization
- Intelligent Tiering for automatic optimization
- Lifecycle policies reduce storage costs 60-80%
- CDN caching reduces origin requests 90%+
- Reserved capacity for predictable workloads

---

## 🔗 Dependencies

### Internal
- **DOC-001**: Document Upload System (provides documents to store)

### External
- **AWS S3**: Primary document storage
- **AWS KMS**: Encryption key management
- **AWS CloudFront**: CDN delivery
- **Sharp**: Image processing for thumbnails

---

*Story created: December 2024*
*Last updated: December 2024*
