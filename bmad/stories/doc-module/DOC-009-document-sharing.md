# DOC-009: Document Sharing

> **Story ID**: DOC-009
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P1 (Essential)
> **Story Points**: 5
> **Sprint**: Week 15
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** share documents securely with clients and colleagues,
**So that** they can access specific files without needing full system access.

---

## Business Context

### Problem Statement
Accountants need to share financial documents (invoices, contracts, statements) with clients for review, approval, or record-keeping. Current methods like email attachments are insecure, untrackable, and don't provide control over document access after sharing.

### Business Value
- **Security**: Controlled access with password protection and expiration
- **Compliance**: Full audit trail of who accessed documents and when
- **Convenience**: Clients access documents without system accounts
- **Control**: Instant link revocation if needed
- **Professional**: Branded sharing pages with QR codes

### Success Metrics
- Share link generation <500ms
- 100% access tracking accuracy
- Zero unauthorized document access
- Client satisfaction with sharing experience >4.5/5
- Share link resolution <100ms

---

## Acceptance Criteria

### Scenario 1: Create Basic Share Link
```gherkin
Given I am an authenticated accountant
And I have access to a document "Faktura FV/2024/001"
When I click "Udostępnij" (Share) on the document
Then I see sharing options dialog
And I can generate a unique share link
And the link format is "https://app.example.com/share/{unique-token}"
And the token is cryptographically secure (256-bit)
And the link is copied to my clipboard automatically
```

### Scenario 2: Password Protection
```gherkin
Given I am creating a share link for a sensitive document
When I enable password protection
And I set password "SecurePass123!"
Then the share link requires password entry before access
And password attempts are rate-limited (5 per minute)
And incorrect password attempts are logged
And after 10 failed attempts, the link is temporarily disabled
```

### Scenario 3: Expiration Date Settings
```gherkin
Given I am configuring a share link
When I set expiration options:
  | Option        | Value              |
  | Quick preset  | 24 hours           |
  | Quick preset  | 7 days             |
  | Quick preset  | 30 days            |
  | Custom date   | 2024-12-31 23:59   |
  | No expiration | Never (requires admin approval) |
Then the link becomes invalid after the expiration date
And visitors to expired links see a clear "Link wygasł" message
And link owners receive notification 24h before expiration (optional)
```

### Scenario 4: Access Permissions
```gherkin
Given I am setting share link permissions
When I configure access level:
  | Permission      | Description                              |
  | View only       | Document visible but not downloadable    |
  | View & Download | Can view and download original file      |
  | View & Print    | Can view, print via browser              |
  | Full access     | View, download, print (all permissions)  |
Then the shared document respects these permissions
And watermarks are applied to view-only documents
And download buttons are hidden for view-only links
```

### Scenario 5: Access Tracking
```gherkin
Given a share link "https://app.example.com/share/abc123" exists
When a visitor accesses the link
Then I can see in the access log:
  | Field            | Example Value                     |
  | Timestamp        | 2024-12-15 14:30:22              |
  | IP Address       | 192.168.1.100                    |
  | Country          | Poland                           |
  | Device           | Chrome 120 / Windows 10          |
  | Action           | Viewed / Downloaded / Print      |
  | Duration         | 45 seconds (for views)           |
And I receive real-time notifications for first access (optional)
And access statistics are aggregated in a dashboard
```

### Scenario 6: Link Revocation
```gherkin
Given I have shared a document with multiple share links
When I need to revoke access
Then I can revoke a single link
Or I can revoke all links for a document at once
And revoked links immediately show "Dostęp cofnięty" message
And I can optionally notify recipients of revocation
And revocation is logged in audit trail
```

### Scenario 7: QR Code Generation
```gherkin
Given I have created a share link
When I click "Generuj kod QR"
Then a QR code is generated containing the share link
And the QR code can be downloaded as PNG (300x300, 600x600)
And the QR code can be embedded in documents or printed
And the QR code includes optional branding (company logo center)
And scanning the QR code opens the shared document
```

### Scenario 8: Bulk Sharing
```gherkin
Given I need to share multiple documents with a client
When I select 5 documents and click "Udostępnij wybrane"
Then I can create a shared folder/collection link
And all documents are accessible from a single link
And permissions apply uniformly to all documents
And I can add or remove documents from the collection later
And the collection shows document thumbnails and metadata
```

---

## Technical Specification

### Database Schema

```sql
-- Share links table
CREATE TABLE document_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),

  -- Security token
  token VARCHAR(64) NOT NULL UNIQUE, -- Cryptographically secure
  token_hash VARCHAR(128) NOT NULL, -- SHA-256 hash for lookups

  -- Access settings
  permissions VARCHAR(20) NOT NULL DEFAULT 'view_download',
    -- 'view_only', 'view_download', 'view_print', 'full_access'
  password_hash VARCHAR(255), -- bcrypt hash, NULL if no password
  password_salt VARCHAR(32),

  -- Expiration
  expires_at TIMESTAMPTZ,
  never_expires BOOLEAN DEFAULT FALSE,

  -- Restrictions
  max_views INTEGER, -- NULL for unlimited
  max_downloads INTEGER,
  allowed_ip_ranges INET[], -- CIDR notation, NULL for any
  allowed_emails TEXT[], -- Email whitelist, NULL for public

  -- Branding & customization
  custom_message TEXT,
  show_watermark BOOLEAN DEFAULT FALSE,
  watermark_text VARCHAR(100),
  custom_branding JSONB DEFAULT '{}', -- logo_url, colors, etc.

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'revoked', 'disabled'
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,

  -- Notifications
  notify_on_access BOOLEAN DEFAULT FALSE,
  notification_email VARCHAR(255),

  -- Metadata
  name VARCHAR(100), -- Optional friendly name
  description TEXT,
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared collections (for bulk sharing)
CREATE TABLE shared_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),

  -- Collection details
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Share link (same structure as single document)
  token VARCHAR(64) NOT NULL UNIQUE,
  token_hash VARCHAR(128) NOT NULL,
  permissions VARCHAR(20) NOT NULL DEFAULT 'view_download',
  password_hash VARCHAR(255),
  expires_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) DEFAULT 'active',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection documents junction
CREATE TABLE shared_collection_documents (
  collection_id UUID NOT NULL REFERENCES shared_collections(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID NOT NULL REFERENCES users(id),
  sort_order INTEGER DEFAULT 0,

  PRIMARY KEY (collection_id, document_id)
);

-- Access log table
CREATE TABLE share_link_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID REFERENCES document_share_links(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES shared_collections(id) ON DELETE SET NULL,
  document_id UUID NOT NULL REFERENCES documents(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Access details
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  action VARCHAR(20) NOT NULL, -- 'viewed', 'downloaded', 'printed', 'password_attempt'
  success BOOLEAN DEFAULT TRUE,

  -- Visitor information
  ip_address INET,
  country_code VARCHAR(2),
  city VARCHAR(100),
  user_agent TEXT,
  device_type VARCHAR(20), -- 'desktop', 'mobile', 'tablet'
  browser VARCHAR(50),
  os VARCHAR(50),

  -- Session data
  session_id VARCHAR(64),
  view_duration_seconds INTEGER,
  pages_viewed INTEGER,

  -- Authentication
  email_verified VARCHAR(255), -- If email whitelist used
  password_provided BOOLEAN DEFAULT FALSE,

  -- Metadata
  referrer TEXT,
  metadata JSONB DEFAULT '{}'
);

-- QR codes table
CREATE TABLE share_link_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES document_share_links(id) ON DELETE CASCADE,

  -- QR code data
  size INTEGER NOT NULL, -- 300, 600, etc.
  format VARCHAR(10) DEFAULT 'png', -- 'png', 'svg'
  include_logo BOOLEAN DEFAULT FALSE,
  logo_url TEXT,

  -- Storage
  storage_key VARCHAR(255) NOT NULL, -- S3 key
  storage_url TEXT NOT NULL,

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_share_links_token_hash ON document_share_links(token_hash);
CREATE INDEX idx_share_links_document ON document_share_links(document_id, status);
CREATE INDEX idx_share_links_org ON document_share_links(organization_id, created_at DESC);
CREATE INDEX idx_share_links_expires ON document_share_links(expires_at) WHERE status = 'active';
CREATE INDEX idx_share_links_creator ON document_share_links(created_by);

CREATE INDEX idx_collections_token_hash ON shared_collections(token_hash);
CREATE INDEX idx_collections_org ON shared_collections(organization_id);

CREATE INDEX idx_access_log_link ON share_link_access_log(share_link_id, accessed_at DESC);
CREATE INDEX idx_access_log_document ON share_link_access_log(document_id, accessed_at DESC);
CREATE INDEX idx_access_log_org ON share_link_access_log(organization_id, accessed_at DESC);
CREATE INDEX idx_access_log_ip ON share_link_access_log(ip_address);

-- RLS Policies
ALTER TABLE document_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_collection_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_link_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_link_qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_links_org_isolation ON document_share_links
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY collections_org_isolation ON shared_collections
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY collection_docs_org_isolation ON shared_collection_documents
  FOR ALL USING (
    collection_id IN (
      SELECT id FROM shared_collections
      WHERE organization_id = current_setting('app.organization_id')::UUID
    )
  );

CREATE POLICY access_log_org_isolation ON share_link_access_log
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY qr_codes_org_isolation ON share_link_qr_codes
  FOR ALL USING (
    share_link_id IN (
      SELECT id FROM document_share_links
      WHERE organization_id = current_setting('app.organization_id')::UUID
    )
  );

-- Function to check share link validity
CREATE OR REPLACE FUNCTION check_share_link_validity(p_token_hash VARCHAR)
RETURNS TABLE (
  is_valid BOOLEAN,
  reason VARCHAR,
  share_link_id UUID,
  document_id UUID,
  permissions VARCHAR,
  requires_password BOOLEAN,
  show_watermark BOOLEAN,
  watermark_text VARCHAR,
  custom_message TEXT
) AS $$
DECLARE
  v_link RECORD;
BEGIN
  SELECT * INTO v_link
  FROM document_share_links
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE::BOOLEAN,
      'not_found'::VARCHAR,
      NULL::UUID, NULL::UUID, NULL::VARCHAR, NULL::BOOLEAN, NULL::BOOLEAN, NULL::VARCHAR, NULL::TEXT;
    RETURN;
  END IF;

  -- Check status
  IF v_link.status = 'revoked' THEN
    RETURN QUERY SELECT
      FALSE::BOOLEAN, 'revoked'::VARCHAR,
      v_link.id, v_link.document_id, NULL::VARCHAR, NULL::BOOLEAN, NULL::BOOLEAN, NULL::VARCHAR, NULL::TEXT;
    RETURN;
  END IF;

  IF v_link.status = 'disabled' THEN
    RETURN QUERY SELECT
      FALSE::BOOLEAN, 'disabled'::VARCHAR,
      v_link.id, v_link.document_id, NULL::VARCHAR, NULL::BOOLEAN, NULL::BOOLEAN, NULL::VARCHAR, NULL::TEXT;
    RETURN;
  END IF;

  -- Check expiration
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
    UPDATE document_share_links SET status = 'expired' WHERE id = v_link.id;
    RETURN QUERY SELECT
      FALSE::BOOLEAN, 'expired'::VARCHAR,
      v_link.id, v_link.document_id, NULL::VARCHAR, NULL::BOOLEAN, NULL::BOOLEAN, NULL::VARCHAR, NULL::TEXT;
    RETURN;
  END IF;

  -- Check view limit
  IF v_link.max_views IS NOT NULL THEN
    DECLARE v_view_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_view_count
      FROM share_link_access_log
      WHERE share_link_id = v_link.id AND action = 'viewed' AND success = TRUE;

      IF v_view_count >= v_link.max_views THEN
        RETURN QUERY SELECT
          FALSE::BOOLEAN, 'view_limit_reached'::VARCHAR,
          v_link.id, v_link.document_id, NULL::VARCHAR, NULL::BOOLEAN, NULL::BOOLEAN, NULL::VARCHAR, NULL::TEXT;
        RETURN;
      END IF;
    END;
  END IF;

  -- Valid link
  RETURN QUERY SELECT
    TRUE::BOOLEAN,
    'valid'::VARCHAR,
    v_link.id,
    v_link.document_id,
    v_link.permissions,
    (v_link.password_hash IS NOT NULL)::BOOLEAN,
    v_link.show_watermark,
    v_link.watermark_text,
    v_link.custom_message;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired links (scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_share_links()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE document_share_links
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Permission levels
export const sharePermissionSchema = z.enum([
  'view_only',
  'view_download',
  'view_print',
  'full_access'
]);

export type SharePermission = z.infer<typeof sharePermissionSchema>;

// Expiration presets
export const expirationPresetSchema = z.enum([
  '1_hour',
  '24_hours',
  '7_days',
  '30_days',
  '90_days',
  'custom',
  'never'
]);

// IP range validation (CIDR notation)
const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
export const ipRangeSchema = z.string().regex(cidrRegex, 'Invalid CIDR notation');

// Create share link input
export const createShareLinkSchema = z.object({
  document_id: z.string().uuid(),

  // Access settings
  permissions: sharePermissionSchema.default('view_download'),

  // Password protection
  password: z.string().min(8).max(128).optional(),

  // Expiration
  expiration_preset: expirationPresetSchema.default('7_days'),
  custom_expiration: z.string().datetime().optional(),

  // Limits
  max_views: z.number().int().positive().max(10000).optional(),
  max_downloads: z.number().int().positive().max(1000).optional(),

  // Restrictions
  allowed_ip_ranges: z.array(ipRangeSchema).max(10).optional(),
  allowed_emails: z.array(z.string().email()).max(50).optional(),

  // Branding
  custom_message: z.string().max(500).optional(),
  show_watermark: z.boolean().default(false),
  watermark_text: z.string().max(100).optional(),

  // Notifications
  notify_on_access: z.boolean().default(false),
  notification_email: z.string().email().optional(),

  // Metadata
  name: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
}).refine(
  data => {
    if (data.expiration_preset === 'custom' && !data.custom_expiration) {
      return false;
    }
    return true;
  },
  { message: 'Custom expiration date required when preset is "custom"' }
).refine(
  data => {
    if (data.notify_on_access && !data.notification_email) {
      return false;
    }
    return true;
  },
  { message: 'Notification email required when notifications enabled' }
);

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;

// Update share link input
export const updateShareLinkSchema = z.object({
  id: z.string().uuid(),
  permissions: sharePermissionSchema.optional(),
  password: z.string().min(8).max(128).optional().nullable(), // null to remove
  expires_at: z.string().datetime().optional().nullable(),
  max_views: z.number().int().positive().optional().nullable(),
  max_downloads: z.number().int().positive().optional().nullable(),
  allowed_ip_ranges: z.array(ipRangeSchema).optional().nullable(),
  allowed_emails: z.array(z.string().email()).optional().nullable(),
  custom_message: z.string().max(500).optional().nullable(),
  show_watermark: z.boolean().optional(),
  watermark_text: z.string().max(100).optional().nullable(),
  notify_on_access: z.boolean().optional(),
  notification_email: z.string().email().optional().nullable(),
  name: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable()
});

// Share link response
export const shareLinkSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  token: z.string(),
  url: z.string().url(),
  permissions: sharePermissionSchema,
  has_password: z.boolean(),
  expires_at: z.string().datetime().nullable(),
  never_expires: z.boolean(),
  max_views: z.number().nullable(),
  max_downloads: z.number().nullable(),
  current_views: z.number(),
  current_downloads: z.number(),
  status: z.enum(['active', 'expired', 'revoked', 'disabled']),
  show_watermark: z.boolean(),
  custom_message: z.string().nullable(),
  notify_on_access: z.boolean(),
  name: z.string().nullable(),
  created_at: z.string().datetime(),
  created_by: z.object({
    id: z.string().uuid(),
    name: z.string()
  })
});

export type ShareLink = z.infer<typeof shareLinkSchema>;

// Revoke input
export const revokeShareLinkSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
  notify_recipients: z.boolean().default(false)
});

// Create collection input
export const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  document_ids: z.array(z.string().uuid()).min(1).max(100),
  permissions: sharePermissionSchema.default('view_download'),
  password: z.string().min(8).max(128).optional(),
  expires_at: z.string().datetime().optional()
});

// Access verification input
export const verifyAccessSchema = z.object({
  token: z.string().length(64),
  password: z.string().optional(),
  email: z.string().email().optional()
});

// Access verification response
export const accessVerificationSchema = z.object({
  is_valid: z.boolean(),
  reason: z.enum([
    'valid',
    'not_found',
    'expired',
    'revoked',
    'disabled',
    'view_limit_reached',
    'download_limit_reached',
    'password_required',
    'password_incorrect',
    'ip_not_allowed',
    'email_not_allowed'
  ]),
  document: z.object({
    id: z.string().uuid(),
    title: z.string(),
    file_type: z.string(),
    file_size: z.number(),
    preview_url: z.string().url().optional(),
    download_url: z.string().url().optional()
  }).optional(),
  permissions: sharePermissionSchema.optional(),
  watermark: z.object({
    enabled: z.boolean(),
    text: z.string().optional()
  }).optional(),
  custom_message: z.string().optional(),
  branding: z.object({
    logo_url: z.string().url().optional(),
    primary_color: z.string().optional(),
    company_name: z.string().optional()
  }).optional()
});

// Access log entry
export const accessLogEntrySchema = z.object({
  id: z.string().uuid(),
  accessed_at: z.string().datetime(),
  action: z.enum(['viewed', 'downloaded', 'printed', 'password_attempt']),
  success: z.boolean(),
  ip_address: z.string(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  device_type: z.string(),
  browser: z.string(),
  os: z.string(),
  view_duration_seconds: z.number().nullable(),
  email_verified: z.string().nullable()
});

// Access statistics
export const accessStatsSchema = z.object({
  total_views: z.number(),
  unique_visitors: z.number(),
  total_downloads: z.number(),
  total_prints: z.number(),
  failed_password_attempts: z.number(),
  top_countries: z.array(z.object({
    country: z.string(),
    count: z.number()
  })),
  access_by_device: z.object({
    desktop: z.number(),
    mobile: z.number(),
    tablet: z.number()
  }),
  access_timeline: z.array(z.object({
    date: z.string(),
    views: z.number(),
    downloads: z.number()
  }))
});

// QR code generation input
export const generateQRCodeSchema = z.object({
  share_link_id: z.string().uuid(),
  size: z.number().int().min(100).max(1000).default(300),
  format: z.enum(['png', 'svg']).default('png'),
  include_logo: z.boolean().default(false),
  logo_url: z.string().url().optional()
});

// QR code response
export const qrCodeSchema = z.object({
  id: z.string().uuid(),
  share_link_id: z.string().uuid(),
  url: z.string().url(),
  size: z.number(),
  format: z.string()
});
```

### Document Sharing Service

```typescript
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import {
  documentShareLinks,
  sharedCollections,
  sharedCollectionDocuments,
  shareLinkAccessLog,
  shareLinkQrCodes,
  documents
} from '@/lib/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { s3Client, uploadFile, getSignedUrl } from '@/lib/storage';
import { sendEmail } from '@/lib/email';
import { lookup as geoLookup } from 'geoip-lite';
import QRCode from 'qrcode';
import {
  CreateShareLinkInput,
  ShareLink,
  AccessVerificationInput,
  createShareLinkSchema
} from './schemas';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com';
const TOKEN_LENGTH = 64; // 512-bit token
const BCRYPT_ROUNDS = 12;
const PASSWORD_ATTEMPT_LIMIT = 10;
const PASSWORD_LOCKOUT_MINUTES = 30;

export class DocumentSharingService {

  // ============================================
  // SHARE LINK CRUD
  // ============================================

  async createShareLink(
    organizationId: string,
    userId: string,
    input: CreateShareLinkInput
  ): Promise<ShareLink> {
    const validated = createShareLinkSchema.parse(input);

    // Verify document exists and user has access
    const [document] = await db.select()
      .from(documents)
      .where(and(
        eq(documents.id, validated.document_id),
        eq(documents.organization_id, organizationId)
      ))
      .limit(1);

    if (!document) {
      throw new Error('Document not found or access denied');
    }

    // Generate secure token
    const token = randomBytes(TOKEN_LENGTH / 2).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Hash password if provided
    let passwordHash: string | null = null;
    let passwordSalt: string | null = null;
    if (validated.password) {
      passwordSalt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      passwordHash = await bcrypt.hash(validated.password, passwordSalt);
    }

    // Calculate expiration date
    const expiresAt = this.calculateExpiration(
      validated.expiration_preset,
      validated.custom_expiration
    );

    // Create share link
    const [shareLink] = await db.insert(documentShareLinks)
      .values({
        organization_id: organizationId,
        document_id: validated.document_id,
        created_by: userId,
        token,
        token_hash: tokenHash,
        permissions: validated.permissions,
        password_hash: passwordHash,
        password_salt: passwordSalt,
        expires_at: expiresAt,
        never_expires: validated.expiration_preset === 'never',
        max_views: validated.max_views,
        max_downloads: validated.max_downloads,
        allowed_ip_ranges: validated.allowed_ip_ranges,
        allowed_emails: validated.allowed_emails,
        custom_message: validated.custom_message,
        show_watermark: validated.show_watermark,
        watermark_text: validated.watermark_text,
        notify_on_access: validated.notify_on_access,
        notification_email: validated.notification_email,
        name: validated.name,
        description: validated.description,
        tags: validated.tags
      })
      .returning();

    // Log audit event
    await this.logAuditEvent(organizationId, userId, 'share_link.created', {
      share_link_id: shareLink.id,
      document_id: validated.document_id,
      permissions: validated.permissions,
      has_password: !!validated.password,
      expires_at: expiresAt
    });

    return this.formatShareLink(shareLink, token);
  }

  async getShareLinks(
    organizationId: string,
    documentId?: string
  ): Promise<ShareLink[]> {
    const query = db.select()
      .from(documentShareLinks)
      .where(
        documentId
          ? and(
              eq(documentShareLinks.organization_id, organizationId),
              eq(documentShareLinks.document_id, documentId)
            )
          : eq(documentShareLinks.organization_id, organizationId)
      )
      .orderBy(desc(documentShareLinks.created_at));

    const links = await query;

    // Get access counts
    const linksWithCounts = await Promise.all(
      links.map(async (link) => {
        const [counts] = await db.select({
          views: sql<number>`COUNT(*) FILTER (WHERE action = 'viewed' AND success = TRUE)`,
          downloads: sql<number>`COUNT(*) FILTER (WHERE action = 'downloaded' AND success = TRUE)`
        })
          .from(shareLinkAccessLog)
          .where(eq(shareLinkAccessLog.share_link_id, link.id));

        return {
          ...link,
          current_views: counts?.views || 0,
          current_downloads: counts?.downloads || 0
        };
      })
    );

    return linksWithCounts.map(link => this.formatShareLink(link));
  }

  async updateShareLink(
    organizationId: string,
    userId: string,
    shareLinkId: string,
    updates: Partial<CreateShareLinkInput>
  ): Promise<ShareLink> {
    // Verify ownership
    const [existing] = await db.select()
      .from(documentShareLinks)
      .where(and(
        eq(documentShareLinks.id, shareLinkId),
        eq(documentShareLinks.organization_id, organizationId)
      ))
      .limit(1);

    if (!existing) {
      throw new Error('Share link not found');
    }

    // Process password update
    let passwordHash = existing.password_hash;
    let passwordSalt = existing.password_salt;
    if (updates.password !== undefined) {
      if (updates.password === null) {
        passwordHash = null;
        passwordSalt = null;
      } else {
        passwordSalt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        passwordHash = await bcrypt.hash(updates.password, passwordSalt);
      }
    }

    const [updated] = await db.update(documentShareLinks)
      .set({
        permissions: updates.permissions ?? existing.permissions,
        password_hash: passwordHash,
        password_salt: passwordSalt,
        expires_at: updates.custom_expiration ?? existing.expires_at,
        max_views: updates.max_views ?? existing.max_views,
        max_downloads: updates.max_downloads ?? existing.max_downloads,
        allowed_ip_ranges: updates.allowed_ip_ranges ?? existing.allowed_ip_ranges,
        allowed_emails: updates.allowed_emails ?? existing.allowed_emails,
        custom_message: updates.custom_message ?? existing.custom_message,
        show_watermark: updates.show_watermark ?? existing.show_watermark,
        watermark_text: updates.watermark_text ?? existing.watermark_text,
        notify_on_access: updates.notify_on_access ?? existing.notify_on_access,
        notification_email: updates.notification_email ?? existing.notification_email,
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        updated_at: sql`NOW()`
      })
      .where(eq(documentShareLinks.id, shareLinkId))
      .returning();

    await this.logAuditEvent(organizationId, userId, 'share_link.updated', {
      share_link_id: shareLinkId,
      updates: Object.keys(updates)
    });

    return this.formatShareLink(updated);
  }

  async revokeShareLink(
    organizationId: string,
    userId: string,
    shareLinkId: string,
    reason?: string,
    notifyRecipients: boolean = false
  ): Promise<void> {
    const [updated] = await db.update(documentShareLinks)
      .set({
        status: 'revoked',
        revoked_at: sql`NOW()`,
        revoked_by: userId,
        revoke_reason: reason,
        updated_at: sql`NOW()`
      })
      .where(and(
        eq(documentShareLinks.id, shareLinkId),
        eq(documentShareLinks.organization_id, organizationId)
      ))
      .returning();

    if (!updated) {
      throw new Error('Share link not found');
    }

    await this.logAuditEvent(organizationId, userId, 'share_link.revoked', {
      share_link_id: shareLinkId,
      reason
    });

    // Notify recipients if requested and email whitelist exists
    if (notifyRecipients && updated.allowed_emails?.length) {
      for (const email of updated.allowed_emails) {
        await sendEmail({
          to: email,
          subject: 'Dostęp do dokumentu został cofnięty',
          template: 'share-link-revoked',
          data: {
            document_name: updated.name || 'Dokument',
            reason: reason || 'Nie podano przyczyny'
          }
        });
      }
    }
  }

  async revokeAllLinksForDocument(
    organizationId: string,
    userId: string,
    documentId: string
  ): Promise<number> {
    const result = await db.update(documentShareLinks)
      .set({
        status: 'revoked',
        revoked_at: sql`NOW()`,
        revoked_by: userId,
        revoke_reason: 'Bulk revocation',
        updated_at: sql`NOW()`
      })
      .where(and(
        eq(documentShareLinks.document_id, documentId),
        eq(documentShareLinks.organization_id, organizationId),
        eq(documentShareLinks.status, 'active')
      ));

    await this.logAuditEvent(organizationId, userId, 'share_links.bulk_revoked', {
      document_id: documentId,
      count: result.rowCount
    });

    return result.rowCount || 0;
  }

  // ============================================
  // ACCESS VERIFICATION
  // ============================================

  async verifyAccess(
    token: string,
    password?: string,
    email?: string,
    ipAddress?: string
  ): Promise<{
    valid: boolean;
    reason: string;
    shareLink?: any;
    document?: any;
  }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find share link
    const [shareLink] = await db.select()
      .from(documentShareLinks)
      .where(eq(documentShareLinks.token_hash, tokenHash))
      .limit(1);

    if (!shareLink) {
      return { valid: false, reason: 'not_found' };
    }

    // Check status
    if (shareLink.status === 'revoked') {
      return { valid: false, reason: 'revoked', shareLink };
    }

    if (shareLink.status === 'disabled') {
      return { valid: false, reason: 'disabled', shareLink };
    }

    // Check expiration
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      await db.update(documentShareLinks)
        .set({ status: 'expired' })
        .where(eq(documentShareLinks.id, shareLink.id));
      return { valid: false, reason: 'expired', shareLink };
    }

    // Check view limit
    if (shareLink.max_views) {
      const [{ count }] = await db.select({
        count: sql<number>`COUNT(*)`
      })
        .from(shareLinkAccessLog)
        .where(and(
          eq(shareLinkAccessLog.share_link_id, shareLink.id),
          eq(shareLinkAccessLog.action, 'viewed'),
          eq(shareLinkAccessLog.success, true)
        ));

      if (count >= shareLink.max_views) {
        return { valid: false, reason: 'view_limit_reached', shareLink };
      }
    }

    // Check IP restriction
    if (shareLink.allowed_ip_ranges?.length && ipAddress) {
      const isAllowed = this.checkIPAllowed(ipAddress, shareLink.allowed_ip_ranges);
      if (!isAllowed) {
        await this.logAccess(shareLink.id, shareLink.document_id, shareLink.organization_id, {
          action: 'viewed',
          success: false,
          ip_address: ipAddress
        });
        return { valid: false, reason: 'ip_not_allowed', shareLink };
      }
    }

    // Check email restriction
    if (shareLink.allowed_emails?.length) {
      if (!email) {
        return { valid: false, reason: 'email_required', shareLink };
      }
      if (!shareLink.allowed_emails.includes(email.toLowerCase())) {
        await this.logAccess(shareLink.id, shareLink.document_id, shareLink.organization_id, {
          action: 'viewed',
          success: false,
          ip_address: ipAddress,
          email_verified: email
        });
        return { valid: false, reason: 'email_not_allowed', shareLink };
      }
    }

    // Check password
    if (shareLink.password_hash) {
      if (!password) {
        return { valid: false, reason: 'password_required', shareLink };
      }

      // Check for lockout
      const recentAttempts = await this.getRecentPasswordAttempts(shareLink.id, ipAddress);
      if (recentAttempts >= PASSWORD_ATTEMPT_LIMIT) {
        return { valid: false, reason: 'too_many_attempts', shareLink };
      }

      const passwordValid = await bcrypt.compare(password, shareLink.password_hash);
      if (!passwordValid) {
        await this.logAccess(shareLink.id, shareLink.document_id, shareLink.organization_id, {
          action: 'password_attempt',
          success: false,
          ip_address: ipAddress,
          password_provided: true
        });
        return { valid: false, reason: 'password_incorrect', shareLink };
      }
    }

    // Get document
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, shareLink.document_id))
      .limit(1);

    if (!document) {
      return { valid: false, reason: 'document_not_found', shareLink };
    }

    return {
      valid: true,
      reason: 'valid',
      shareLink,
      document
    };
  }

  async logAccess(
    shareLinkId: string,
    documentId: string,
    organizationId: string,
    data: {
      action: 'viewed' | 'downloaded' | 'printed' | 'password_attempt';
      success: boolean;
      ip_address?: string;
      user_agent?: string;
      view_duration_seconds?: number;
      email_verified?: string;
      password_provided?: boolean;
    }
  ): Promise<void> {
    // Parse user agent
    const deviceInfo = data.user_agent
      ? this.parseUserAgent(data.user_agent)
      : { device_type: 'unknown', browser: 'unknown', os: 'unknown' };

    // Geo lookup
    const geo = data.ip_address ? geoLookup(data.ip_address) : null;

    await db.insert(shareLinkAccessLog).values({
      share_link_id: shareLinkId,
      document_id: documentId,
      organization_id: organizationId,
      action: data.action,
      success: data.success,
      ip_address: data.ip_address,
      country_code: geo?.country,
      city: geo?.city,
      user_agent: data.user_agent,
      device_type: deviceInfo.device_type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      view_duration_seconds: data.view_duration_seconds,
      email_verified: data.email_verified,
      password_provided: data.password_provided
    });

    // Send notification if enabled
    const [shareLink] = await db.select()
      .from(documentShareLinks)
      .where(eq(documentShareLinks.id, shareLinkId))
      .limit(1);

    if (shareLink?.notify_on_access && shareLink.notification_email && data.success) {
      await sendEmail({
        to: shareLink.notification_email,
        subject: `Dokument "${shareLink.name || 'Udostępniony'}" został ${data.action === 'viewed' ? 'wyświetlony' : 'pobrany'}`,
        template: 'share-link-accessed',
        data: {
          action: data.action,
          document_name: shareLink.name,
          country: geo?.country,
          city: geo?.city,
          time: new Date().toISOString()
        }
      });
    }
  }

  // ============================================
  // ACCESS STATISTICS
  // ============================================

  async getAccessStats(
    organizationId: string,
    shareLinkId: string
  ) {
    const [link] = await db.select()
      .from(documentShareLinks)
      .where(and(
        eq(documentShareLinks.id, shareLinkId),
        eq(documentShareLinks.organization_id, organizationId)
      ))
      .limit(1);

    if (!link) {
      throw new Error('Share link not found');
    }

    // Basic counts
    const [counts] = await db.select({
      total_views: sql<number>`COUNT(*) FILTER (WHERE action = 'viewed' AND success = TRUE)`,
      total_downloads: sql<number>`COUNT(*) FILTER (WHERE action = 'downloaded' AND success = TRUE)`,
      total_prints: sql<number>`COUNT(*) FILTER (WHERE action = 'printed' AND success = TRUE)`,
      failed_passwords: sql<number>`COUNT(*) FILTER (WHERE action = 'password_attempt' AND success = FALSE)`,
      unique_ips: sql<number>`COUNT(DISTINCT ip_address)`
    })
      .from(shareLinkAccessLog)
      .where(eq(shareLinkAccessLog.share_link_id, shareLinkId));

    // Top countries
    const topCountries = await db.select({
      country: shareLinkAccessLog.country_code,
      count: sql<number>`COUNT(*)`
    })
      .from(shareLinkAccessLog)
      .where(and(
        eq(shareLinkAccessLog.share_link_id, shareLinkId),
        sql`${shareLinkAccessLog.country_code} IS NOT NULL`
      ))
      .groupBy(shareLinkAccessLog.country_code)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    // Device breakdown
    const [deviceStats] = await db.select({
      desktop: sql<number>`COUNT(*) FILTER (WHERE device_type = 'desktop')`,
      mobile: sql<number>`COUNT(*) FILTER (WHERE device_type = 'mobile')`,
      tablet: sql<number>`COUNT(*) FILTER (WHERE device_type = 'tablet')`
    })
      .from(shareLinkAccessLog)
      .where(eq(shareLinkAccessLog.share_link_id, shareLinkId));

    // Access timeline (last 30 days)
    const timeline = await db.select({
      date: sql<string>`DATE(accessed_at)`,
      views: sql<number>`COUNT(*) FILTER (WHERE action = 'viewed' AND success = TRUE)`,
      downloads: sql<number>`COUNT(*) FILTER (WHERE action = 'downloaded' AND success = TRUE)`
    })
      .from(shareLinkAccessLog)
      .where(and(
        eq(shareLinkAccessLog.share_link_id, shareLinkId),
        sql`accessed_at > NOW() - INTERVAL '30 days'`
      ))
      .groupBy(sql`DATE(accessed_at)`)
      .orderBy(sql`DATE(accessed_at)`);

    return {
      total_views: counts?.total_views || 0,
      unique_visitors: counts?.unique_ips || 0,
      total_downloads: counts?.total_downloads || 0,
      total_prints: counts?.total_prints || 0,
      failed_password_attempts: counts?.failed_passwords || 0,
      top_countries: topCountries.map(c => ({
        country: c.country || 'Unknown',
        count: c.count
      })),
      access_by_device: {
        desktop: deviceStats?.desktop || 0,
        mobile: deviceStats?.mobile || 0,
        tablet: deviceStats?.tablet || 0
      },
      access_timeline: timeline.map(t => ({
        date: t.date,
        views: t.views,
        downloads: t.downloads
      }))
    };
  }

  async getAccessLog(
    organizationId: string,
    shareLinkId: string,
    page: number = 1,
    pageSize: number = 50
  ) {
    const [link] = await db.select()
      .from(documentShareLinks)
      .where(and(
        eq(documentShareLinks.id, shareLinkId),
        eq(documentShareLinks.organization_id, organizationId)
      ))
      .limit(1);

    if (!link) {
      throw new Error('Share link not found');
    }

    const logs = await db.select()
      .from(shareLinkAccessLog)
      .where(eq(shareLinkAccessLog.share_link_id, shareLinkId))
      .orderBy(desc(shareLinkAccessLog.accessed_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await db.select({
      total: sql<number>`COUNT(*)`
    })
      .from(shareLinkAccessLog)
      .where(eq(shareLinkAccessLog.share_link_id, shareLinkId));

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // ============================================
  // COLLECTIONS (BULK SHARING)
  // ============================================

  async createCollection(
    organizationId: string,
    userId: string,
    input: {
      name: string;
      description?: string;
      document_ids: string[];
      permissions: string;
      password?: string;
      expires_at?: string;
    }
  ) {
    // Verify all documents exist and belong to organization
    const docs = await db.select()
      .from(documents)
      .where(and(
        inArray(documents.id, input.document_ids),
        eq(documents.organization_id, organizationId)
      ));

    if (docs.length !== input.document_ids.length) {
      throw new Error('One or more documents not found');
    }

    // Generate token
    const token = randomBytes(TOKEN_LENGTH / 2).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Hash password if provided
    let passwordHash: string | null = null;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }

    // Create collection
    const [collection] = await db.insert(sharedCollections)
      .values({
        organization_id: organizationId,
        created_by: userId,
        name: input.name,
        description: input.description,
        token,
        token_hash: tokenHash,
        permissions: input.permissions,
        password_hash: passwordHash,
        expires_at: input.expires_at
      })
      .returning();

    // Add documents to collection
    await db.insert(sharedCollectionDocuments)
      .values(input.document_ids.map((docId, index) => ({
        collection_id: collection.id,
        document_id: docId,
        added_by: userId,
        sort_order: index
      })));

    await this.logAuditEvent(organizationId, userId, 'collection.created', {
      collection_id: collection.id,
      document_count: input.document_ids.length
    });

    return {
      ...collection,
      url: `${BASE_URL}/share/collection/${token}`,
      document_count: input.document_ids.length
    };
  }

  // ============================================
  // QR CODE GENERATION
  // ============================================

  async generateQRCode(
    organizationId: string,
    shareLinkId: string,
    options: {
      size?: number;
      format?: 'png' | 'svg';
      include_logo?: boolean;
      logo_url?: string;
    } = {}
  ) {
    const { size = 300, format = 'png', include_logo = false, logo_url } = options;

    // Verify share link exists
    const [shareLink] = await db.select()
      .from(documentShareLinks)
      .where(and(
        eq(documentShareLinks.id, shareLinkId),
        eq(documentShareLinks.organization_id, organizationId)
      ))
      .limit(1);

    if (!shareLink) {
      throw new Error('Share link not found');
    }

    const shareUrl = `${BASE_URL}/share/${shareLink.token}`;

    // Generate QR code
    let qrCodeData: Buffer | string;

    if (format === 'svg') {
      qrCodeData = await QRCode.toString(shareUrl, {
        type: 'svg',
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } else {
      qrCodeData = await QRCode.toBuffer(shareUrl, {
        type: 'png',
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    }

    // Upload to S3
    const storageKey = `qr-codes/${organizationId}/${shareLinkId}-${size}.${format}`;
    const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png';

    await uploadFile(storageKey, qrCodeData, contentType);
    const storageUrl = await getSignedUrl(storageKey, 86400 * 365); // 1 year expiry

    // Save QR code record
    const [qrCode] = await db.insert(shareLinkQrCodes)
      .values({
        share_link_id: shareLinkId,
        size,
        format,
        include_logo,
        logo_url,
        storage_key: storageKey,
        storage_url: storageUrl
      })
      .returning();

    return {
      id: qrCode.id,
      share_link_id: shareLinkId,
      url: storageUrl,
      size,
      format
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private calculateExpiration(
    preset: string,
    customDate?: string
  ): Date | null {
    const now = new Date();

    switch (preset) {
      case '1_hour':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case '24_hours':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case '7_days':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case '30_days':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      case '90_days':
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      case 'custom':
        return customDate ? new Date(customDate) : null;
      case 'never':
        return null;
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  private formatShareLink(link: any, token?: string): ShareLink {
    return {
      id: link.id,
      document_id: link.document_id,
      token: token || '***', // Only show full token on creation
      url: `${BASE_URL}/share/${token || link.token}`,
      permissions: link.permissions,
      has_password: !!link.password_hash,
      expires_at: link.expires_at,
      never_expires: link.never_expires,
      max_views: link.max_views,
      max_downloads: link.max_downloads,
      current_views: link.current_views || 0,
      current_downloads: link.current_downloads || 0,
      status: link.status,
      show_watermark: link.show_watermark,
      custom_message: link.custom_message,
      notify_on_access: link.notify_on_access,
      name: link.name,
      created_at: link.created_at,
      created_by: link.created_by
    };
  }

  private checkIPAllowed(ip: string, allowedRanges: string[]): boolean {
    // Simplified CIDR check - in production use a proper IP library
    const ipToNum = (ip: string) => {
      const parts = ip.split('.').map(Number);
      return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    };

    const ipNum = ipToNum(ip);

    for (const range of allowedRanges) {
      const [network, bits] = range.split('/');
      const networkNum = ipToNum(network);
      const mask = ~((1 << (32 - parseInt(bits))) - 1);

      if ((ipNum & mask) === (networkNum & mask)) {
        return true;
      }
    }

    return false;
  }

  private async getRecentPasswordAttempts(
    shareLinkId: string,
    ipAddress?: string
  ): Promise<number> {
    const cutoff = new Date(Date.now() - PASSWORD_LOCKOUT_MINUTES * 60 * 1000);

    const [{ count }] = await db.select({
      count: sql<number>`COUNT(*)`
    })
      .from(shareLinkAccessLog)
      .where(and(
        eq(shareLinkAccessLog.share_link_id, shareLinkId),
        eq(shareLinkAccessLog.action, 'password_attempt'),
        eq(shareLinkAccessLog.success, false),
        sql`${shareLinkAccessLog.accessed_at} > ${cutoff}`,
        ipAddress ? eq(shareLinkAccessLog.ip_address, ipAddress) : sql`TRUE`
      ));

    return count;
  }

  private parseUserAgent(userAgent: string): {
    device_type: string;
    browser: string;
    os: string;
  } {
    // Simplified UA parsing - use a proper library in production
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    const isTablet = /iPad|Tablet/i.test(userAgent);

    let browser = 'Unknown';
    if (/Chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/Safari/i.test(userAgent)) browser = 'Safari';
    else if (/Edge/i.test(userAgent)) browser = 'Edge';

    let os = 'Unknown';
    if (/Windows/i.test(userAgent)) os = 'Windows';
    else if (/Mac/i.test(userAgent)) os = 'macOS';
    else if (/Linux/i.test(userAgent)) os = 'Linux';
    else if (/Android/i.test(userAgent)) os = 'Android';
    else if (/iOS/i.test(userAgent)) os = 'iOS';

    return {
      device_type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      browser,
      os
    };
  }

  private async logAuditEvent(
    organizationId: string,
    userId: string,
    event: string,
    data: any
  ): Promise<void> {
    // Integration with audit logging system
    console.log(`[AUDIT] ${event}`, {
      organization_id: organizationId,
      user_id: userId,
      ...data
    });
  }
}

export const documentSharingService = new DocumentSharingService();
```

### tRPC Router

```typescript
import { router, protectedProcedure, publicProcedure } from '@/lib/trpc';
import { z } from 'zod';
import { documentSharingService } from './sharing.service';
import {
  createShareLinkSchema,
  updateShareLinkSchema,
  revokeShareLinkSchema,
  verifyAccessSchema,
  createCollectionSchema,
  generateQRCodeSchema
} from './schemas';

export const sharingRouter = router({
  // Share link CRUD
  createShareLink: protectedProcedure
    .input(createShareLinkSchema)
    .mutation(async ({ ctx, input }) => {
      return documentSharingService.createShareLink(
        ctx.organizationId,
        ctx.userId,
        input
      );
    }),

  getShareLinks: protectedProcedure
    .input(z.object({ document_id: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      return documentSharingService.getShareLinks(
        ctx.organizationId,
        input.document_id
      );
    }),

  getShareLink: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const links = await documentSharingService.getShareLinks(ctx.organizationId);
      const link = links.find(l => l.id === input.id);
      if (!link) throw new Error('Share link not found');
      return link;
    }),

  updateShareLink: protectedProcedure
    .input(updateShareLinkSchema)
    .mutation(async ({ ctx, input }) => {
      return documentSharingService.updateShareLink(
        ctx.organizationId,
        ctx.userId,
        input.id,
        input
      );
    }),

  revokeShareLink: protectedProcedure
    .input(revokeShareLinkSchema)
    .mutation(async ({ ctx, input }) => {
      return documentSharingService.revokeShareLink(
        ctx.organizationId,
        ctx.userId,
        input.id,
        input.reason,
        input.notify_recipients
      );
    }),

  revokeAllForDocument: protectedProcedure
    .input(z.object({ document_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const count = await documentSharingService.revokeAllLinksForDocument(
        ctx.organizationId,
        ctx.userId,
        input.document_id
      );
      return { revoked_count: count };
    }),

  // Public access verification (no auth required)
  verifyAccess: publicProcedure
    .input(verifyAccessSchema)
    .mutation(async ({ input, ctx }) => {
      const ipAddress = ctx.req?.ip || ctx.req?.headers['x-forwarded-for'];
      return documentSharingService.verifyAccess(
        input.token,
        input.password,
        input.email,
        ipAddress as string
      );
    }),

  // Log access (called from public share page)
  logAccess: publicProcedure
    .input(z.object({
      token: z.string(),
      action: z.enum(['viewed', 'downloaded', 'printed']),
      view_duration_seconds: z.number().int().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const verification = await documentSharingService.verifyAccess(input.token);
      if (!verification.valid || !verification.shareLink) {
        throw new Error('Invalid share link');
      }

      const userAgent = ctx.req?.headers['user-agent'];
      const ipAddress = ctx.req?.ip || ctx.req?.headers['x-forwarded-for'];

      await documentSharingService.logAccess(
        verification.shareLink.id,
        verification.shareLink.document_id,
        verification.shareLink.organization_id,
        {
          action: input.action,
          success: true,
          ip_address: ipAddress as string,
          user_agent: userAgent as string,
          view_duration_seconds: input.view_duration_seconds
        }
      );
    }),

  // Access statistics
  getAccessStats: protectedProcedure
    .input(z.object({ share_link_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return documentSharingService.getAccessStats(
        ctx.organizationId,
        input.share_link_id
      );
    }),

  getAccessLog: protectedProcedure
    .input(z.object({
      share_link_id: z.string().uuid(),
      page: z.number().int().min(1).default(1),
      page_size: z.number().int().min(1).max(100).default(50)
    }))
    .query(async ({ ctx, input }) => {
      return documentSharingService.getAccessLog(
        ctx.organizationId,
        input.share_link_id,
        input.page,
        input.page_size
      );
    }),

  // Collections
  createCollection: protectedProcedure
    .input(createCollectionSchema)
    .mutation(async ({ ctx, input }) => {
      return documentSharingService.createCollection(
        ctx.organizationId,
        ctx.userId,
        input
      );
    }),

  // QR Codes
  generateQRCode: protectedProcedure
    .input(generateQRCodeSchema)
    .mutation(async ({ ctx, input }) => {
      return documentSharingService.generateQRCode(
        ctx.organizationId,
        input.share_link_id,
        {
          size: input.size,
          format: input.format,
          include_logo: input.include_logo,
          logo_url: input.logo_url
        }
      );
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentSharingService } from './sharing.service';
import * as bcrypt from 'bcryptjs';

describe('DocumentSharingService', () => {
  let sharingService: DocumentSharingService;

  beforeEach(() => {
    sharingService = new DocumentSharingService();
    vi.clearAllMocks();
  });

  describe('createShareLink', () => {
    it('should generate cryptographically secure token', async () => {
      const link = await sharingService.createShareLink('org-1', 'user-1', {
        document_id: 'doc-1',
        permissions: 'view_download'
      });

      expect(link.token).toHaveLength(64);
      expect(link.url).toContain(link.token);
    });

    it('should hash password with bcrypt', async () => {
      const password = 'SecurePass123!';
      const link = await sharingService.createShareLink('org-1', 'user-1', {
        document_id: 'doc-1',
        permissions: 'view_download',
        password
      });

      expect(link.has_password).toBe(true);
    });

    it('should calculate expiration from presets', async () => {
      const link = await sharingService.createShareLink('org-1', 'user-1', {
        document_id: 'doc-1',
        permissions: 'view_download',
        expiration_preset: '7_days'
      });

      const expectedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const actualExpiry = new Date(link.expires_at!);

      // Within 1 second tolerance
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe('verifyAccess', () => {
    it('should return invalid for non-existent token', async () => {
      const result = await sharingService.verifyAccess('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should return expired for past expiration date', async () => {
      // Create link with past expiration (mock)
      const result = await sharingService.verifyAccess('expired-token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });

    it('should require password when set', async () => {
      const result = await sharingService.verifyAccess(
        'password-protected-token',
        undefined // no password
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('password_required');
    });

    it('should validate correct password', async () => {
      const result = await sharingService.verifyAccess(
        'password-protected-token',
        'correct-password'
      );

      expect(result.valid).toBe(true);
    });

    it('should block IP outside allowed ranges', async () => {
      const result = await sharingService.verifyAccess(
        'ip-restricted-token',
        undefined,
        undefined,
        '192.168.1.100' // not in allowed range
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('ip_not_allowed');
    });
  });

  describe('revokeShareLink', () => {
    it('should immediately invalidate the link', async () => {
      await sharingService.revokeShareLink('org-1', 'user-1', 'link-1', 'Testing');

      const verification = await sharingService.verifyAccess('revoked-link-token');

      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe('revoked');
    });
  });

  describe('QR code generation', () => {
    it('should generate QR code with correct URL', async () => {
      const qrCode = await sharingService.generateQRCode('org-1', 'link-1', {
        size: 300,
        format: 'png'
      });

      expect(qrCode.size).toBe(300);
      expect(qrCode.format).toBe('png');
      expect(qrCode.url).toBeDefined();
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { DocumentSharingService } from './sharing.service';

describe('DocumentSharingService Integration', () => {
  let sharingService: DocumentSharingService;
  const testOrgId = 'test-org-sharing';
  const testUserId = 'test-user-sharing';
  const testDocId = 'test-doc-sharing';

  beforeAll(async () => {
    sharingService = new DocumentSharingService();

    // Setup test data
    // ... create test organization, user, document
  });

  afterAll(async () => {
    // Cleanup test data
    await db.execute(sql`
      DELETE FROM document_share_links WHERE organization_id = ${testOrgId}
    `);
  });

  describe('Full sharing workflow', () => {
    let shareLink: any;

    it('should create share link', async () => {
      shareLink = await sharingService.createShareLink(testOrgId, testUserId, {
        document_id: testDocId,
        permissions: 'view_download',
        expiration_preset: '7_days',
        password: 'TestPass123!'
      });

      expect(shareLink.id).toBeDefined();
      expect(shareLink.token).toHaveLength(64);
    });

    it('should require password for access', async () => {
      const result = await sharingService.verifyAccess(shareLink.token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('password_required');
    });

    it('should grant access with correct password', async () => {
      const result = await sharingService.verifyAccess(
        shareLink.token,
        'TestPass123!'
      );

      expect(result.valid).toBe(true);
      expect(result.document).toBeDefined();
    });

    it('should log access correctly', async () => {
      await sharingService.logAccess(
        shareLink.id,
        testDocId,
        testOrgId,
        {
          action: 'viewed',
          success: true,
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0 Chrome/120'
        }
      );

      const stats = await sharingService.getAccessStats(testOrgId, shareLink.id);
      expect(stats.total_views).toBe(1);
    });

    it('should revoke link', async () => {
      await sharingService.revokeShareLink(
        testOrgId,
        testUserId,
        shareLink.id,
        'Test revocation'
      );

      const result = await sharingService.verifyAccess(
        shareLink.token,
        'TestPass123!'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('revoked');
    });
  });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Document Sharing', () => {
  let shareLinkUrl: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create share link from document page', async ({ page }) => {
    await page.goto('/documents/test-doc-id');

    // Click share button
    await page.click('[data-testid="share-document-button"]');
    await page.waitForSelector('[data-testid="share-dialog"]');

    // Configure sharing options
    await page.selectOption('[data-testid="permission-select"]', 'view_download');
    await page.selectOption('[data-testid="expiration-select"]', '7_days');

    // Enable password
    await page.check('[data-testid="enable-password"]');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');

    // Create link
    await page.click('[data-testid="create-share-link"]');

    // Verify link created
    await page.waitForSelector('[data-testid="share-link-created"]');
    shareLinkUrl = await page.locator('[data-testid="share-link-url"]').inputValue();

    expect(shareLinkUrl).toContain('/share/');
  });

  test('should access shared document with password', async ({ page, context }) => {
    // Open share link in new page (not logged in)
    const newPage = await context.newPage();
    await newPage.goto(shareLinkUrl);

    // Should show password prompt
    await expect(newPage.locator('[data-testid="password-prompt"]')).toBeVisible();

    // Enter wrong password
    await newPage.fill('[data-testid="password-input"]', 'WrongPass');
    await newPage.click('[data-testid="submit-password"]');
    await expect(newPage.locator('[data-testid="password-error"]')).toBeVisible();

    // Enter correct password
    await newPage.fill('[data-testid="password-input"]', 'SecurePass123!');
    await newPage.click('[data-testid="submit-password"]');

    // Should show document viewer
    await expect(newPage.locator('[data-testid="document-viewer"]')).toBeVisible();
  });

  test('should show access statistics', async ({ page }) => {
    await page.goto('/documents/test-doc-id');
    await page.click('[data-testid="share-document-button"]');

    // View existing share links
    await page.click('[data-testid="view-share-links"]');

    // Click on a share link
    await page.click('[data-testid="share-link-item"]:first-child');

    // Check stats displayed
    await expect(page.locator('[data-testid="total-views"]')).toBeVisible();
    await expect(page.locator('[data-testid="unique-visitors"]')).toBeVisible();
    await expect(page.locator('[data-testid="access-chart"]')).toBeVisible();
  });

  test('should generate and download QR code', async ({ page }) => {
    await page.goto('/documents/test-doc-id');
    await page.click('[data-testid="share-document-button"]');
    await page.click('[data-testid="view-share-links"]');
    await page.click('[data-testid="share-link-item"]:first-child');

    // Generate QR code
    await page.click('[data-testid="generate-qr-code"]');
    await page.waitForSelector('[data-testid="qr-code-image"]');

    // Download QR code
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-qr-code"]')
    ]);

    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('should revoke share link', async ({ page, context }) => {
    await page.goto('/documents/test-doc-id');
    await page.click('[data-testid="share-document-button"]');
    await page.click('[data-testid="view-share-links"]');

    // Revoke link
    await page.click('[data-testid="revoke-link-button"]:first-child');
    await page.click('[data-testid="confirm-revoke"]');

    // Verify revoked
    await expect(page.locator('[data-testid="link-status-revoked"]')).toBeVisible();

    // Try to access revoked link
    const newPage = await context.newPage();
    await newPage.goto(shareLinkUrl);
    await expect(newPage.locator('[data-testid="link-revoked-message"]')).toBeVisible();
  });

  test('should show expired link message', async ({ page, context }) => {
    // Create link with 1 hour expiration, then manually expire it
    // ... (setup)

    const newPage = await context.newPage();
    await newPage.goto('/share/expired-token');

    await expect(newPage.locator('text=Link wygasł')).toBeVisible();
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [ ] Token is 256-bit cryptographically secure (crypto.randomBytes)
- [ ] Token hash stored, not plaintext token
- [ ] Organization isolation enforced on all queries
- [ ] RLS policies prevent cross-tenant access
- [ ] Share link creator verified before update/revoke

### Password Protection
- [ ] Passwords hashed with bcrypt (12 rounds)
- [ ] Password attempts rate-limited (5/minute)
- [ ] Account lockout after 10 failed attempts
- [ ] Lockout duration: 30 minutes
- [ ] No password hints or recovery

### Access Control
- [ ] IP restriction via CIDR ranges
- [ ] Email whitelist enforcement
- [ ] View/download limits enforced
- [ ] Expiration dates checked on every access
- [ ] Revocation is immediate

### Data Protection
- [ ] Documents served via signed URLs
- [ ] Watermarks applied to view-only shares
- [ ] Download tracking for audit
- [ ] Print tracking via JavaScript hooks
- [ ] No document caching on share pages

### Audit & Compliance
- [ ] All access logged with IP, UA, timestamp
- [ ] Geo-location recorded
- [ ] Failed access attempts logged
- [ ] Audit log immutable
- [ ] Polish data retention compliance

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `share_link.created` | New share link | document_id, permissions, expiry, has_password |
| `share_link.updated` | Settings changed | share_link_id, changed_fields |
| `share_link.revoked` | Link revoked | share_link_id, reason, revoked_by |
| `share_link.accessed` | Document viewed | share_link_id, ip, country, device, action |
| `share_link.password_attempt` | Password entered | share_link_id, ip, success |
| `share_link.expired` | Link expired | share_link_id, expired_at |
| `share_link.download` | Document downloaded | share_link_id, ip |
| `collection.created` | New collection | collection_id, document_count |
| `qr_code.generated` | QR code created | share_link_id, size, format |

---

## Implementation Notes

### Security Considerations
- Use HTTPS only for share links
- Set `Content-Security-Policy` headers on share pages
- Implement CAPTCHA for password-protected links after 3 failures
- Consider using short-lived signed URLs for actual document access

### Performance Optimization
- Cache share link validity checks (1 minute TTL)
- Use CDN for QR code images
- Index token_hash for O(1) lookups
- Batch access log writes for high-traffic links

### User Experience
- Clipboard API for one-click copy
- Mobile-responsive share pages
- Clear Polish error messages
- Loading states for all async operations

### Dependencies
- `bcryptjs` for password hashing
- `qrcode` for QR generation
- `geoip-lite` for geo-location
- `ua-parser-js` for user agent parsing (production)

---

## Related Stories

- **DOC-001**: Document Upload System (documents to share)
- **DOC-002**: Cloud Storage & CDN (presigned URLs)
- **AIM**: Authentication & permissions
- **CRM**: Client access for shared documents

---

## Definition of Done

- [ ] All 8 acceptance scenarios passing
- [ ] Share link generation <500ms
- [ ] Password protection working with rate limiting
- [ ] Expiration enforcement complete
- [ ] Permission levels (view/download/print) enforced
- [ ] Access tracking 100% accurate
- [ ] Link revocation immediate
- [ ] QR code generation working
- [ ] Bulk sharing via collections
- [ ] RLS policies tested
- [ ] Unit test coverage ≥85%
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Security checklist complete
- [ ] Polish UI/UX complete

---

*Story created: December 2024*
*Template version: 1.0.0*
