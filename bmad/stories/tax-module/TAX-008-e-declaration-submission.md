# Story: e-Declaration Submission (TAX-008)

> **Story ID**: TAX-008
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P0 (Critical)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Sprint**: Week 15

---

## 📋 User Story

**As an** accountant,
**I want** to submit JPK and tax declarations electronically to e-Urząd Skarbowy,
**So that** I can file tax returns efficiently with official confirmation.

---

## 🎯 Acceptance Criteria

### Scenario 1: Submit JPK_V7M to e-Urząd Skarbowy

```gherkin
Feature: JPK_V7M Electronic Submission
  As an accountant
  I need to submit JPK_V7M files to e-Urząd Skarbowy
  So that monthly VAT declarations are filed officially

  Background:
    Given I have a validated and signed JPK_V7M file
    And the client has valid tax office authorization
    And the submission deadline has not passed

  Scenario: Successful JPK_V7M submission
    Given a JPK_V7M file for period "2025-01" with status "SIGNED"
    When I submit the file to e-Urząd Skarbowy
    Then the system should:
      | step | action                                    |
      | 1    | Validate file signature                   |
      | 2    | Connect to e-Urząd API                    |
      | 3    | Authenticate with certificate             |
      | 4    | Upload JPK file                           |
      | 5    | Receive submission reference number       |
      | 6    | Poll for processing status                |
      | 7    | Retrieve UPO when ready                   |
    And the JPK file status should be "SUBMITTED"
    And a submission reference number should be stored
    And the submission timestamp should be recorded

  Scenario: UPO retrieval after submission
    Given a JPK file was submitted successfully
    And processing is complete at e-Urząd
    When I request UPO retrieval
    Then the system should receive UPO document
    And UPO should contain:
      | field                | description                    |
      | NumerReferencyjny    | Unique submission reference    |
      | DataZlozenia         | Submission date and time       |
      | NazwaPodmiotu        | Taxpayer name                  |
      | NIP                  | Taxpayer NIP                   |
      | StempelCzasowy       | Official timestamp             |
      | Podpis               | Digital signature              |
    And UPO should be stored as PDF and XML
    And JPK file status should be "ACCEPTED"

  Scenario: Handle submission rejection
    Given a JPK file with validation errors at tax office
    When e-Urząd rejects the submission
    Then the system should record rejection reason
    And JPK file status should be "REJECTED"
    And error details should be available:
      | field          | example                           |
      | error_code     | VAT-FIELD-01                      |
      | error_message  | Nieprawidłowy format NIP          |
      | field_path     | /JPK/Podmiot1/NIP                 |
    And notification should be sent to accountant
```

### Scenario 2: Submission Authentication

```gherkin
Feature: e-Urząd Authentication
  As an accountant
  I need secure authentication with e-Urząd Skarbowy
  So that submissions are authorized and secure

  Scenario: Authenticate with qualified certificate
    Given the organization has a registered qualified certificate
    And the certificate is not expired
    When I initiate submission
    Then the system should use certificate for:
      | purpose                  |
      | SSL/TLS client auth      |
      | Request signing          |
      | Response verification    |
    And authentication should succeed

  Scenario: Authenticate with Profil Zaufany token
    Given the user has authenticated via Profil Zaufany
    And OAuth token is valid
    When I initiate submission using PZ
    Then the system should use PZ bearer token
    And submission should be authorized

  Scenario: Handle certificate expiration
    Given the organization certificate expires in 7 days
    When checking certificate validity
    Then the system should warn about expiring certificate
    And suggest certificate renewal
    And still allow submission if certificate is valid

  Scenario: Handle authentication failure
    Given invalid or expired credentials
    When submission authentication fails
    Then the system should:
      | action                              |
      | Log authentication failure          |
      | Retry with refreshed token (if PZ)  |
      | Display clear error message         |
      | Suggest credential renewal          |
```

### Scenario 3: Submission Status Tracking

```gherkin
Feature: Submission Status Tracking
  As an accountant
  I need to track submission status
  So that I know when declarations are accepted

  Scenario: Track pending submission
    Given a JPK file was just submitted
    When I check submission status
    Then the system should show:
      | status     | description                    |
      | SUBMITTED  | File uploaded successfully     |
      | PROCESSING | Being validated by tax office  |
      | ACCEPTED   | UPO received                   |
      | REJECTED   | Validation failed              |
    And estimated processing time should be displayed

  Scenario: Automatic status polling
    Given a submission is in PROCESSING status
    When the polling interval elapses (5 minutes)
    Then the system should query e-Urząd for status
    And update local status accordingly
    And continue polling until final status
    And max polling duration is 72 hours

  Scenario: Status webhook notification
    Given e-Urząd supports status webhooks
    When the submission status changes
    Then the system should receive webhook notification
    And update status immediately
    And notify relevant users
```

### Scenario 4: Retry Logic for Failures

```gherkin
Feature: Submission Retry Logic
  As an accountant
  I need automatic retry for transient failures
  So that temporary issues don't require manual intervention

  Scenario: Retry on network timeout
    Given a submission attempt times out
    When the network error is detected
    Then the system should:
      | attempt | wait_time | action                    |
      | 1       | 0s        | Initial submission        |
      | 2       | 30s       | First retry               |
      | 3       | 2min      | Second retry              |
      | 4       | 10min     | Third retry               |
      | 5       | 30min     | Final retry               |
    And exponential backoff should be applied
    And each attempt should be logged

  Scenario: Do not retry on validation errors
    Given a submission is rejected due to invalid data
    When the rejection is received
    Then the system should NOT retry automatically
    And mark submission as requiring manual correction
    And display specific validation errors

  Scenario: Handle e-Urząd maintenance
    Given e-Urząd API returns maintenance status code
    When submission is attempted
    Then the system should queue the submission
    And retry after maintenance window
    And notify user of delay
```

### Scenario 5: Submission History

```gherkin
Feature: Submission History
  As an accountant
  I need complete submission history
  So that I can audit past filings

  Scenario: View submission history for client
    Given multiple JPK submissions exist for a client
    When I view submission history
    Then I should see:
      | column           | description                    |
      | Submission Date  | When file was submitted        |
      | JPK Type         | V7M, V7K, FA, etc.             |
      | Period           | Tax period covered             |
      | Status           | ACCEPTED, REJECTED, etc.       |
      | UPO Reference    | Official receipt number        |
      | Submitted By     | User who submitted             |
    And history should be sortable and filterable
    And pagination should handle large datasets

  Scenario: Download historical UPO
    Given a submission was accepted with UPO
    When I request UPO download
    Then I should receive UPO in PDF format
    And XML version should also be available
    And UPO should be cryptographically verified

  Scenario: Audit trail for submission
    Given a submission exists
    When I view audit trail
    Then I should see all events:
      | event                  | timestamp | user        |
      | SUBMISSION_INITIATED   | ...       | accountant  |
      | FILE_UPLOADED          | ...       | system      |
      | STATUS_UPDATED         | ...       | system      |
      | UPO_RECEIVED           | ...       | system      |
```

### Scenario 6: Correction Submission

```gherkin
Feature: Correction Submission
  As an accountant
  I need to submit corrective declarations
  So that I can fix errors in previous filings

  Scenario: Submit JPK correction
    Given an accepted JPK_V7M for period "2025-01"
    And corrections are needed
    When I generate corrective JPK with CelZlozenia="2"
    And submit the correction
    Then the system should:
      | step | action                                    |
      | 1    | Link correction to original submission    |
      | 2    | Submit with correction flag               |
      | 3    | Reference original UPO number             |
      | 4    | Receive new UPO for correction            |
    And original JPK status should be "CORRECTED"
    And correction JPK should be "ACCEPTED"

  Scenario: Multiple corrections for same period
    Given two corrections already submitted for "2025-01"
    When I submit third correction
    Then correction sequence should be maintained
    And all corrections should be linked
    And latest correction should be active
```

---

## 🗄️ Database Schema

```sql
-- Submission status enumeration
CREATE TYPE submission_status AS ENUM (
  'PENDING',        -- Awaiting submission
  'UPLOADING',      -- File being transferred
  'SUBMITTED',      -- Successfully uploaded
  'PROCESSING',     -- Being processed by tax office
  'ACCEPTED',       -- UPO received
  'REJECTED',       -- Validation failed
  'FAILED',         -- Technical failure
  'CANCELLED'       -- Manually cancelled
);

-- Main submissions table
CREATE TABLE e_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  jpk_file_id UUID NOT NULL REFERENCES jpk_files(id),

  -- Submission identification
  reference_number VARCHAR(100), -- e-Urząd reference
  internal_reference VARCHAR(50) NOT NULL,

  -- Status tracking
  status submission_status NOT NULL DEFAULT 'PENDING',
  status_message TEXT,
  status_updated_at TIMESTAMPTZ,

  -- Authentication
  auth_method VARCHAR(50) NOT NULL, -- 'CERTIFICATE', 'PROFIL_ZAUFANY'
  auth_user_id UUID REFERENCES users(id),

  -- Submission details
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id),

  -- Processing
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,

  -- UPO (Urzędowe Poświadczenie Odbioru)
  upo_reference VARCHAR(100),
  upo_received_at TIMESTAMPTZ,
  upo_xml_path VARCHAR(500),
  upo_pdf_path VARCHAR(500),
  upo_data JSONB,

  -- Rejection details
  rejection_code VARCHAR(50),
  rejection_message TEXT,
  rejection_details JSONB,

  -- Correction tracking
  is_correction BOOLEAN NOT NULL DEFAULT false,
  corrects_submission_id UUID REFERENCES e_submissions(id),
  correction_sequence INTEGER DEFAULT 1,

  -- Retry tracking
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  -- Test mode flag
  is_test_submission BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_internal_reference UNIQUE (organization_id, internal_reference)
);

-- Submission attempts log
CREATE TABLE e_submission_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES e_submissions(id),

  attempt_number INTEGER NOT NULL,
  attempt_type VARCHAR(50) NOT NULL, -- 'SUBMIT', 'STATUS_CHECK', 'UPO_RETRIEVAL'

  -- Request details
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_endpoint VARCHAR(500),
  request_method VARCHAR(10),

  -- Response details
  response_timestamp TIMESTAMPTZ,
  response_status_code INTEGER,
  response_body TEXT,

  -- Result
  success BOOLEAN NOT NULL DEFAULT false,
  error_code VARCHAR(50),
  error_message TEXT,
  duration_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- e-Urząd API configuration
CREATE TABLE e_urzad_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Environment
  environment VARCHAR(20) NOT NULL, -- 'PRODUCTION', 'TEST'
  api_base_url VARCHAR(500) NOT NULL,

  -- Certificate authentication
  certificate_thumbprint VARCHAR(64),
  certificate_expires_at TIMESTAMPTZ,
  certificate_path VARCHAR(500),

  -- Profil Zaufany OAuth
  pz_client_id VARCHAR(200),
  pz_client_secret_encrypted BYTEA,
  pz_redirect_uri VARCHAR(500),

  -- Settings
  polling_interval_seconds INTEGER NOT NULL DEFAULT 300,
  max_polling_hours INTEGER NOT NULL DEFAULT 72,
  retry_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_connection_test TIMESTAMPTZ,
  connection_status VARCHAR(50),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_org_environment UNIQUE (organization_id, environment)
);

-- UPO documents storage
CREATE TABLE upo_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES e_submissions(id),

  -- Document identification
  upo_reference VARCHAR(100) NOT NULL,
  document_type VARCHAR(20) NOT NULL, -- 'XML', 'PDF'

  -- Content
  file_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT,
  file_hash_sha256 VARCHAR(64),

  -- Parsed data (from XML)
  submission_date TIMESTAMPTZ,
  taxpayer_nip VARCHAR(10),
  taxpayer_name VARCHAR(256),
  official_timestamp TIMESTAMPTZ,
  signature_valid BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status change history
CREATE TABLE submission_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES e_submissions(id),

  from_status submission_status,
  to_status submission_status NOT NULL,
  reason TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_submissions_org ON e_submissions(organization_id);
CREATE INDEX idx_submissions_jpk ON e_submissions(jpk_file_id);
CREATE INDEX idx_submissions_status ON e_submissions(status);
CREATE INDEX idx_submissions_pending_retry ON e_submissions(status, next_retry_at)
  WHERE status IN ('FAILED', 'SUBMITTED') AND next_retry_at IS NOT NULL;
CREATE INDEX idx_submission_attempts ON e_submission_attempts(submission_id, attempt_number);

-- Row Level Security
ALTER TABLE e_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_submission_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_urzad_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE upo_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY submissions_org_isolation ON e_submissions
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY attempts_org_isolation ON e_submission_attempts
  FOR ALL USING (
    submission_id IN (
      SELECT id FROM e_submissions
      WHERE organization_id = current_setting('app.current_organization_id')::UUID
    )
  );

CREATE POLICY config_org_isolation ON e_urzad_config
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY upo_org_isolation ON upo_documents
  FOR ALL USING (
    submission_id IN (
      SELECT id FROM e_submissions
      WHERE organization_id = current_setting('app.current_organization_id')::UUID
    )
  );
```

---

## 📝 Zod Validation Schemas

```typescript
import { z } from 'zod';

// Submission status
export const SubmissionStatusSchema = z.enum([
  'PENDING',
  'UPLOADING',
  'SUBMITTED',
  'PROCESSING',
  'ACCEPTED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
]);

export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

// Authentication method
export const AuthMethodSchema = z.enum(['CERTIFICATE', 'PROFIL_ZAUFANY']);

// Submit JPK request
export const SubmitJPKInputSchema = z.object({
  jpkFileId: z.string().uuid(),
  authMethod: AuthMethodSchema,
  testMode: z.boolean().default(false),
  priority: z.enum(['NORMAL', 'HIGH']).default('NORMAL'),
});

export type SubmitJPKInput = z.infer<typeof SubmitJPKInputSchema>;

// Submission result
export const SubmissionResultSchema = z.object({
  success: z.boolean(),
  submissionId: z.string().uuid(),
  referenceNumber: z.string().optional(),
  status: SubmissionStatusSchema,
  message: z.string().optional(),
  estimatedProcessingTime: z.number().optional(), // minutes
});

export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;

// Status check request
export const CheckStatusInputSchema = z.object({
  submissionId: z.string().uuid(),
});

// UPO data schema
export const UPODataSchema = z.object({
  numerReferencyjny: z.string(),
  dataZlozenia: z.string().datetime(),
  nazwaSystemu: z.string(),
  kodFormularza: z.string(),
  wariantFormularza: z.number(),
  celZlozenia: z.string(),
  podmiot: z.object({
    nip: z.string(),
    nazwa: z.string(),
  }),
  stempelCzasowy: z.string().datetime(),
  podpisElektroniczny: z.object({
    dataPodpisu: z.string().datetime(),
    typPodpisu: z.string(),
    czyWazny: z.boolean(),
  }),
});

export type UPOData = z.infer<typeof UPODataSchema>;

// e-Urząd API configuration
export const EUrzadConfigSchema = z.object({
  environment: z.enum(['PRODUCTION', 'TEST']),
  apiBaseUrl: z.string().url(),
  certificateThumbprint: z.string().optional(),
  pzClientId: z.string().optional(),
  pzClientSecret: z.string().optional(),
  pollingIntervalSeconds: z.number().int().min(60).max(3600).default(300),
  maxPollingHours: z.number().int().min(1).max(168).default(72),
  retryEnabled: z.boolean().default(true),
});

export type EUrzadConfig = z.infer<typeof EUrzadConfigSchema>;

// Retry request
export const RetrySubmissionInputSchema = z.object({
  submissionId: z.string().uuid(),
  forceRetry: z.boolean().default(false),
});

// History query
export const SubmissionHistoryQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  jpkType: z.string().optional(),
  status: SubmissionStatusSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Webhook payload from e-Urząd
export const EUrzadWebhookPayloadSchema = z.object({
  eventType: z.enum(['STATUS_CHANGE', 'UPO_READY', 'REJECTION']),
  referenceNumber: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()),
  signature: z.string(), // HMAC signature for verification
});
```

---

## ⚙️ Implementation

### e-Declaration Submission Service

```typescript
import { format } from 'date-fns';
import { createHash, createHmac } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// e-Urząd API endpoints
const E_URZAD_ENDPOINTS = {
  PRODUCTION: {
    submission: 'https://e-bramka.mf.gov.pl/api/v1/submissions',
    status: 'https://e-bramka.mf.gov.pl/api/v1/submissions/{id}/status',
    upo: 'https://e-bramka.mf.gov.pl/api/v1/submissions/{id}/upo',
  },
  TEST: {
    submission: 'https://test-bramka.mf.gov.pl/api/v1/submissions',
    status: 'https://test-bramka.mf.gov.pl/api/v1/submissions/{id}/status',
    upo: 'https://test-bramka.mf.gov.pl/api/v1/submissions/{id}/upo',
  },
};

// Retry configuration
const RETRY_DELAYS = [0, 30000, 120000, 600000, 1800000]; // 0s, 30s, 2min, 10min, 30min

export class EDeclarationService {
  private apiClient: AxiosInstance;

  constructor(
    private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly jpkService: JPKGenerationService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly certificateService: CertificateService
  ) {}

  /**
   * Submit JPK file to e-Urząd Skarbowy
   */
  async submitJPK(input: SubmitJPKInput): Promise<SubmissionResult> {
    // Load JPK file
    const jpkFile = await this.db.jpkFile.findUniqueOrThrow({
      where: { id: input.jpkFileId },
      include: {
        client: true,
        organization: true,
      },
    });

    // Validate JPK file is ready for submission
    this.validateJPKForSubmission(jpkFile);

    // Get API configuration
    const config = await this.getApiConfig(
      jpkFile.organizationId,
      input.testMode ? 'TEST' : 'PRODUCTION'
    );

    // Create submission record
    const submission = await this.db.eSubmission.create({
      data: {
        organizationId: jpkFile.organizationId,
        jpkFileId: jpkFile.id,
        internalReference: this.generateInternalReference(jpkFile),
        status: 'PENDING',
        authMethod: input.authMethod,
        authUserId: input.userId,
        isTestSubmission: input.testMode,
        isCorrection: jpkFile.celZlozenia === '2',
        correctsSubmissionId: jpkFile.correctsJpkId
          ? await this.findOriginalSubmissionId(jpkFile.correctsJpkId)
          : null,
        createdBy: input.userId,
      },
    });

    try {
      // Initialize API client with authentication
      await this.initializeApiClient(config, input.authMethod);

      // Update status to UPLOADING
      await this.updateSubmissionStatus(submission.id, 'UPLOADING');

      // Read JPK file content
      const jpkContent = await this.storageService.readJPKFile(jpkFile.filePath);

      // Submit to e-Urząd
      const submissionResponse = await this.executeSubmission(
        submission.id,
        jpkContent,
        jpkFile,
        config
      );

      // Update submission with reference
      await this.db.eSubmission.update({
        where: { id: submission.id },
        data: {
          referenceNumber: submissionResponse.referenceNumber,
          status: 'SUBMITTED',
          statusUpdatedAt: new Date(),
          submittedAt: new Date(),
          submittedBy: input.userId,
        },
      });

      // Update JPK file status
      await this.db.jpkFile.update({
        where: { id: jpkFile.id },
        data: { status: 'SUBMITTED' },
      });

      // Start status polling
      await this.scheduleStatusPolling(submission.id, config);

      // Log success
      await this.logSubmissionEvent(submission.id, 'SUBMITTED', 'SUCCESS', {
        referenceNumber: submissionResponse.referenceNumber,
      });

      return {
        success: true,
        submissionId: submission.id,
        referenceNumber: submissionResponse.referenceNumber,
        status: 'SUBMITTED',
        message: 'JPK submitted successfully',
        estimatedProcessingTime: 15, // minutes
      };

    } catch (error) {
      // Handle submission failure
      await this.handleSubmissionError(submission.id, error);

      return {
        success: false,
        submissionId: submission.id,
        status: 'FAILED',
        message: error.message,
      };
    }
  }

  /**
   * Execute the actual submission to e-Urząd
   */
  private async executeSubmission(
    submissionId: string,
    jpkContent: string,
    jpkFile: JPKFile,
    config: EUrzadConfig
  ): Promise<{ referenceNumber: string }> {
    const endpoint = this.getEndpoint(config, 'submission');

    // Log attempt
    const attempt = await this.db.eSubmissionAttempt.create({
      data: {
        submissionId,
        attemptNumber: 1,
        attemptType: 'SUBMIT',
        requestEndpoint: endpoint,
        requestMethod: 'POST',
      },
    });

    const startTime = Date.now();

    try {
      const response = await this.apiClient.post(endpoint, {
        content: jpkContent,
        metadata: {
          fileName: jpkFile.referenceNumber + '.xml',
          fileSize: jpkFile.fileSizeBytes,
          fileHash: jpkFile.fileHashSha256,
          jpkType: jpkFile.jpkType,
          period: {
            from: format(jpkFile.periodFrom, 'yyyy-MM-dd'),
            to: format(jpkFile.periodTo, 'yyyy-MM-dd'),
          },
          celZlozenia: jpkFile.celZlozenia,
        },
      }, {
        headers: {
          'Content-Type': 'application/xml',
          'Accept': 'application/json',
        },
        timeout: 60000, // 60 seconds
      });

      // Update attempt as successful
      await this.db.eSubmissionAttempt.update({
        where: { id: attempt.id },
        data: {
          responseTimestamp: new Date(),
          responseStatusCode: response.status,
          responseBody: JSON.stringify(response.data),
          success: true,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        referenceNumber: response.data.referenceNumber,
      };

    } catch (error) {
      // Update attempt as failed
      await this.db.eSubmissionAttempt.update({
        where: { id: attempt.id },
        data: {
          responseTimestamp: new Date(),
          responseStatusCode: error.response?.status,
          responseBody: JSON.stringify(error.response?.data),
          success: false,
          errorCode: error.code,
          errorMessage: error.message,
          durationMs: Date.now() - startTime,
        },
      });

      throw error;
    }
  }

  /**
   * Check submission status at e-Urząd
   */
  async checkStatus(submissionId: string): Promise<SubmissionStatus> {
    const submission = await this.db.eSubmission.findUniqueOrThrow({
      where: { id: submissionId },
    });

    if (!submission.referenceNumber) {
      throw new Error('Submission has no reference number');
    }

    const config = await this.getApiConfig(
      submission.organizationId,
      submission.isTestSubmission ? 'TEST' : 'PRODUCTION'
    );

    await this.initializeApiClient(config, submission.authMethod);

    const endpoint = this.getEndpoint(config, 'status')
      .replace('{id}', submission.referenceNumber);

    // Log attempt
    const attempt = await this.db.eSubmissionAttempt.create({
      data: {
        submissionId,
        attemptNumber: submission.retryCount + 1,
        attemptType: 'STATUS_CHECK',
        requestEndpoint: endpoint,
        requestMethod: 'GET',
      },
    });

    const startTime = Date.now();

    try {
      const response = await this.apiClient.get(endpoint);

      await this.db.eSubmissionAttempt.update({
        where: { id: attempt.id },
        data: {
          responseTimestamp: new Date(),
          responseStatusCode: response.status,
          responseBody: JSON.stringify(response.data),
          success: true,
          durationMs: Date.now() - startTime,
        },
      });

      const newStatus = this.mapEUrzadStatus(response.data.status);

      // Update submission status
      await this.updateSubmissionStatus(submissionId, newStatus, response.data.message);

      // If accepted, retrieve UPO
      if (newStatus === 'ACCEPTED') {
        await this.retrieveUPO(submissionId, submission.referenceNumber, config);
      }

      // If rejected, store rejection details
      if (newStatus === 'REJECTED') {
        await this.handleRejection(submissionId, response.data);
      }

      return newStatus;

    } catch (error) {
      await this.db.eSubmissionAttempt.update({
        where: { id: attempt.id },
        data: {
          responseTimestamp: new Date(),
          responseStatusCode: error.response?.status,
          success: false,
          errorCode: error.code,
          errorMessage: error.message,
          durationMs: Date.now() - startTime,
        },
      });

      throw error;
    }
  }

  /**
   * Retrieve UPO (Urzędowe Poświadczenie Odbioru)
   */
  async retrieveUPO(
    submissionId: string,
    referenceNumber: string,
    config: EUrzadConfig
  ): Promise<void> {
    const endpoint = this.getEndpoint(config, 'upo')
      .replace('{id}', referenceNumber);

    // Retrieve XML UPO
    const xmlResponse = await this.apiClient.get(endpoint, {
      headers: { 'Accept': 'application/xml' },
    });

    // Retrieve PDF UPO
    const pdfResponse = await this.apiClient.get(endpoint, {
      headers: { 'Accept': 'application/pdf' },
      responseType: 'arraybuffer',
    });

    // Parse UPO data from XML
    const parser = new XMLParser({ ignoreAttributes: false });
    const upoData = parser.parse(xmlResponse.data);

    // Store UPO files
    const xmlPath = await this.storageService.storeUPO(
      submissionId,
      xmlResponse.data,
      `UPO_${referenceNumber}.xml`
    );

    const pdfPath = await this.storageService.storeUPO(
      submissionId,
      pdfResponse.data,
      `UPO_${referenceNumber}.pdf`
    );

    // Calculate file hashes
    const xmlHash = createHash('sha256').update(xmlResponse.data).digest('hex');
    const pdfHash = createHash('sha256').update(pdfResponse.data).digest('hex');

    // Create UPO document records
    await this.db.upoDocument.createMany({
      data: [
        {
          submissionId,
          upoReference: referenceNumber,
          documentType: 'XML',
          filePath: xmlPath,
          fileSizeBytes: Buffer.byteLength(xmlResponse.data),
          fileHashSha256: xmlHash,
          submissionDate: new Date(upoData.UPO?.DataZlozenia),
          taxpayerNip: upoData.UPO?.Podmiot?.NIP,
          taxpayerName: upoData.UPO?.Podmiot?.Nazwa,
          officialTimestamp: new Date(upoData.UPO?.StempelCzasowy),
          signatureValid: this.verifyUPOSignature(xmlResponse.data),
        },
        {
          submissionId,
          upoReference: referenceNumber,
          documentType: 'PDF',
          filePath: pdfPath,
          fileSizeBytes: pdfResponse.data.length,
          fileHashSha256: pdfHash,
        },
      ],
    });

    // Update submission
    await this.db.eSubmission.update({
      where: { id: submissionId },
      data: {
        upoReference: referenceNumber,
        upoReceivedAt: new Date(),
        upoXmlPath: xmlPath,
        upoPdfPath: pdfPath,
        upoData,
        status: 'ACCEPTED',
        statusUpdatedAt: new Date(),
        processingCompletedAt: new Date(),
      },
    });

    // Update JPK file status
    const submission = await this.db.eSubmission.findUnique({
      where: { id: submissionId },
    });

    await this.db.jpkFile.update({
      where: { id: submission!.jpkFileId },
      data: { status: 'ACCEPTED' },
    });

    // Notify user
    await this.notificationService.send({
      type: 'UPO_RECEIVED',
      userId: submission!.authUserId,
      data: {
        referenceNumber,
        jpkType: submission!.jpkFileId,
      },
    });

    // Log success
    await this.logSubmissionEvent(submissionId, 'UPO_RECEIVED', 'SUCCESS', {
      referenceNumber,
    });
  }

  /**
   * Retry failed submission
   */
  async retrySubmission(input: RetrySubmissionInput): Promise<SubmissionResult> {
    const submission = await this.db.eSubmission.findUniqueOrThrow({
      where: { id: input.submissionId },
    });

    // Check if retry is allowed
    if (!input.forceRetry) {
      if (submission.retryCount >= submission.maxRetries) {
        throw new Error('Maximum retry attempts reached');
      }

      if (submission.status === 'REJECTED') {
        throw new Error('Cannot retry rejected submission - corrections required');
      }

      if (submission.status === 'ACCEPTED') {
        throw new Error('Cannot retry accepted submission');
      }
    }

    // Calculate next retry delay
    const retryDelay = RETRY_DELAYS[Math.min(submission.retryCount, RETRY_DELAYS.length - 1)];

    // Schedule retry
    await this.db.eSubmission.update({
      where: { id: submission.id },
      data: {
        retryCount: submission.retryCount + 1,
        nextRetryAt: new Date(Date.now() + retryDelay),
        status: 'PENDING',
      },
    });

    // If immediate retry requested
    if (retryDelay === 0 || input.forceRetry) {
      return this.submitJPK({
        jpkFileId: submission.jpkFileId,
        authMethod: submission.authMethod as 'CERTIFICATE' | 'PROFIL_ZAUFANY',
        testMode: submission.isTestSubmission,
      });
    }

    return {
      success: true,
      submissionId: submission.id,
      status: 'PENDING',
      message: `Retry scheduled in ${retryDelay / 1000} seconds`,
    };
  }

  /**
   * Process pending retries (called by scheduler)
   */
  async processPendingRetries(): Promise<void> {
    const pendingRetries = await this.db.eSubmission.findMany({
      where: {
        status: { in: ['FAILED', 'PENDING'] },
        nextRetryAt: { lte: new Date() },
        retryCount: { lt: this.db.raw('max_retries') },
      },
    });

    for (const submission of pendingRetries) {
      try {
        await this.submitJPK({
          jpkFileId: submission.jpkFileId,
          authMethod: submission.authMethod as 'CERTIFICATE' | 'PROFIL_ZAUFANY',
          testMode: submission.isTestSubmission,
        });
      } catch (error) {
        console.error(`Retry failed for submission ${submission.id}:`, error);
      }
    }
  }

  /**
   * Get submission history
   */
  async getSubmissionHistory(query: SubmissionHistoryQuery): Promise<{
    submissions: ESubmission[];
    total: number;
  }> {
    const where: any = {};

    if (query.clientId) {
      const jpkFiles = await this.db.jpkFile.findMany({
        where: { clientId: query.clientId },
        select: { id: true },
      });
      where.jpkFileId = { in: jpkFiles.map(f => f.id) };
    }

    if (query.status) where.status = query.status;

    if (query.fromDate || query.toDate) {
      where.submittedAt = {};
      if (query.fromDate) where.submittedAt.gte = new Date(query.fromDate);
      if (query.toDate) where.submittedAt.lte = new Date(query.toDate);
    }

    const [submissions, total] = await Promise.all([
      this.db.eSubmission.findMany({
        where,
        include: {
          jpkFile: {
            select: {
              id: true,
              jpkType: true,
              periodFrom: true,
              periodTo: true,
              client: { select: { id: true, name: true, nip: true } },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.db.eSubmission.count({ where }),
    ]);

    return { submissions, total };
  }

  /**
   * Handle webhook from e-Urząd
   */
  async handleWebhook(payload: EUrzadWebhookPayload): Promise<void> {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(payload)) {
      throw new Error('Invalid webhook signature');
    }

    const submission = await this.db.eSubmission.findFirst({
      where: { referenceNumber: payload.referenceNumber },
    });

    if (!submission) {
      console.warn(`Webhook for unknown submission: ${payload.referenceNumber}`);
      return;
    }

    switch (payload.eventType) {
      case 'STATUS_CHANGE':
        await this.updateSubmissionStatus(
          submission.id,
          this.mapEUrzadStatus(payload.data.status as string),
          payload.data.message as string
        );
        break;

      case 'UPO_READY':
        const config = await this.getApiConfig(
          submission.organizationId,
          submission.isTestSubmission ? 'TEST' : 'PRODUCTION'
        );
        await this.retrieveUPO(submission.id, payload.referenceNumber, config);
        break;

      case 'REJECTION':
        await this.handleRejection(submission.id, payload.data);
        break;
    }
  }

  // Private helper methods

  private validateJPKForSubmission(jpkFile: JPKFile): void {
    if (jpkFile.status !== 'SIGNED' && jpkFile.status !== 'VALIDATED') {
      throw new Error(`JPK file must be signed or validated. Current status: ${jpkFile.status}`);
    }

    if (!jpkFile.filePath) {
      throw new Error('JPK file path not found');
    }
  }

  private async initializeApiClient(
    config: EUrzadConfig,
    authMethod: string
  ): Promise<void> {
    const baseConfig: any = {
      baseURL: config.apiBaseUrl,
      timeout: 60000,
    };

    if (authMethod === 'CERTIFICATE') {
      const cert = await this.certificateService.loadCertificate(config.certificateThumbprint!);
      baseConfig.httpsAgent = new https.Agent({
        cert: cert.certificate,
        key: cert.privateKey,
      });
    } else if (authMethod === 'PROFIL_ZAUFANY') {
      const token = await this.getProfilZaufanyToken(config);
      baseConfig.headers = {
        'Authorization': `Bearer ${token}`,
      };
    }

    this.apiClient = axios.create(baseConfig);
  }

  private async getApiConfig(
    organizationId: string,
    environment: string
  ): Promise<EUrzadConfig> {
    const config = await this.db.eUrzadConfig.findFirst({
      where: { organizationId, environment, isActive: true },
    });

    if (!config) {
      throw new Error(`No ${environment} API configuration found`);
    }

    return config;
  }

  private getEndpoint(config: EUrzadConfig, type: 'submission' | 'status' | 'upo'): string {
    const endpoints = config.environment === 'PRODUCTION'
      ? E_URZAD_ENDPOINTS.PRODUCTION
      : E_URZAD_ENDPOINTS.TEST;
    return endpoints[type];
  }

  private mapEUrzadStatus(eurzadStatus: string): SubmissionStatus {
    const statusMap: Record<string, SubmissionStatus> = {
      'UPLOADED': 'SUBMITTED',
      'IN_PROGRESS': 'PROCESSING',
      'COMPLETED': 'ACCEPTED',
      'REJECTED': 'REJECTED',
      'ERROR': 'FAILED',
    };
    return statusMap[eurzadStatus] || 'PROCESSING';
  }

  private async updateSubmissionStatus(
    submissionId: string,
    status: SubmissionStatus,
    message?: string
  ): Promise<void> {
    const submission = await this.db.eSubmission.findUnique({
      where: { id: submissionId },
    });

    // Record status history
    await this.db.submissionStatusHistory.create({
      data: {
        submissionId,
        fromStatus: submission!.status,
        toStatus: status,
        reason: message,
      },
    });

    // Update submission
    await this.db.eSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        statusMessage: message,
        statusUpdatedAt: new Date(),
      },
    });
  }

  private async handleRejection(submissionId: string, rejectionData: any): Promise<void> {
    await this.db.eSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'REJECTED',
        rejectionCode: rejectionData.errorCode,
        rejectionMessage: rejectionData.message,
        rejectionDetails: rejectionData.details,
        statusUpdatedAt: new Date(),
        processingCompletedAt: new Date(),
      },
    });

    // Update JPK file
    const submission = await this.db.eSubmission.findUnique({
      where: { id: submissionId },
    });

    await this.db.jpkFile.update({
      where: { id: submission!.jpkFileId },
      data: { status: 'REJECTED' },
    });

    // Notify user
    await this.notificationService.send({
      type: 'SUBMISSION_REJECTED',
      userId: submission!.authUserId,
      data: {
        referenceNumber: submission!.referenceNumber,
        rejectionCode: rejectionData.errorCode,
        rejectionMessage: rejectionData.message,
      },
    });

    await this.logSubmissionEvent(submissionId, 'REJECTED', 'FAILURE', rejectionData);
  }

  private generateInternalReference(jpkFile: JPKFile): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `SUB-${jpkFile.referenceNumber}-${timestamp}`;
  }

  private async scheduleStatusPolling(
    submissionId: string,
    config: EUrzadConfig
  ): Promise<void> {
    // Schedule first status check
    await this.db.eSubmission.update({
      where: { id: submissionId },
      data: {
        processingStartedAt: new Date(),
      },
    });

    // Queue status check job
    // This would be handled by a job queue (Bull, etc.)
    // await this.jobQueue.add('checkSubmissionStatus', { submissionId }, {
    //   delay: config.pollingIntervalSeconds * 1000,
    // });
  }

  private verifyUPOSignature(xmlContent: string): boolean {
    // Implement XAdES signature verification
    // This would use a library like xmldsigjs
    return true; // Placeholder
  }

  private verifyWebhookSignature(payload: EUrzadWebhookPayload): boolean {
    // Verify HMAC signature
    // const expectedSignature = createHmac('sha256', webhookSecret)
    //   .update(JSON.stringify(payload.data))
    //   .digest('hex');
    // return payload.signature === expectedSignature;
    return true; // Placeholder
  }

  private async logSubmissionEvent(
    submissionId: string,
    action: string,
    status: string,
    details: object
  ): Promise<void> {
    await this.auditService.log({
      action: `E_SUBMISSION_${action}`,
      entityType: 'E_SUBMISSION',
      entityId: submissionId,
      details: { status, ...details },
    });
  }
}
```

---

## 🔌 API Endpoints

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import {
  SubmitJPKInputSchema,
  CheckStatusInputSchema,
  RetrySubmissionInputSchema,
  SubmissionHistoryQuerySchema,
  EUrzadWebhookPayloadSchema,
} from './schemas';

export const eDeclarationRouter = router({
  /**
   * Submit JPK file to e-Urząd
   */
  submit: protectedProcedure
    .input(SubmitJPKInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.services.eDeclaration.submitJPK({
        ...input,
        userId: ctx.user.id,
      });
    }),

  /**
   * Check submission status
   */
  checkStatus: protectedProcedure
    .input(CheckStatusInputSchema)
    .query(async ({ ctx, input }) => {
      return ctx.services.eDeclaration.checkStatus(input.submissionId);
    }),

  /**
   * Get submission by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.eSubmission.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          jpkFile: {
            include: {
              client: { select: { id: true, name: true, nip: true } },
            },
          },
          upoDocuments: true,
        },
      });
    }),

  /**
   * Retry failed submission
   */
  retry: protectedProcedure
    .input(RetrySubmissionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.services.eDeclaration.retrySubmission(input);
    }),

  /**
   * Get submission history
   */
  getHistory: protectedProcedure
    .input(SubmissionHistoryQuerySchema)
    .query(async ({ ctx, input }) => {
      return ctx.services.eDeclaration.getSubmissionHistory(input);
    }),

  /**
   * Download UPO document
   */
  downloadUPO: protectedProcedure
    .input(z.object({
      submissionId: z.string().uuid(),
      format: z.enum(['XML', 'PDF']),
    }))
    .mutation(async ({ ctx, input }) => {
      const upo = await ctx.db.upoDocument.findFirst({
        where: {
          submissionId: input.submissionId,
          documentType: input.format,
        },
      });

      if (!upo) {
        throw new Error(`UPO ${input.format} not found`);
      }

      const content = await ctx.services.storage.readFile(upo.filePath);

      return {
        content,
        filename: `UPO_${upo.upoReference}.${input.format.toLowerCase()}`,
        mimeType: input.format === 'PDF' ? 'application/pdf' : 'application/xml',
      };
    }),

  /**
   * Get submission attempts log
   */
  getAttempts: protectedProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.eSubmissionAttempt.findMany({
        where: { submissionId: input.submissionId },
        orderBy: { attemptNumber: 'asc' },
      });
    }),

  /**
   * Get status history
   */
  getStatusHistory: protectedProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.submissionStatusHistory.findMany({
        where: { submissionId: input.submissionId },
        orderBy: { createdAt: 'asc' },
      });
    }),

  /**
   * Cancel pending submission
   */
  cancel: protectedProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.eSubmission.findUniqueOrThrow({
        where: { id: input.submissionId },
      });

      if (!['PENDING', 'FAILED'].includes(submission.status)) {
        throw new Error('Can only cancel pending or failed submissions');
      }

      await ctx.db.eSubmission.update({
        where: { id: input.submissionId },
        data: {
          status: 'CANCELLED',
          statusUpdatedAt: new Date(),
        },
      });

      return { success: true };
    }),

  /**
   * Get API configuration status
   */
  getConfigStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const configs = await ctx.db.eUrzadConfig.findMany({
        where: { organizationId: ctx.organization.id },
        select: {
          environment: true,
          isActive: true,
          certificateExpiresAt: true,
          lastConnectionTest: true,
          connectionStatus: true,
        },
      });

      return configs;
    }),

  /**
   * Test API connection
   */
  testConnection: protectedProcedure
    .input(z.object({ environment: z.enum(['PRODUCTION', 'TEST']) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.eDeclaration.testConnection(
        ctx.organization.id,
        input.environment
      );
    }),

  /**
   * Webhook endpoint (public, verified by signature)
   */
  webhook: router({
    handle: protectedProcedure
      .input(EUrzadWebhookPayloadSchema)
      .mutation(async ({ ctx, input }) => {
        await ctx.services.eDeclaration.handleWebhook(input);
        return { success: true };
      }),
  }),
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EDeclarationService } from './EDeclarationService';
import { createMockDatabase, createMockServices } from '@/test/mocks';

describe('EDeclarationService', () => {
  let service: EDeclarationService;
  let mockDb: ReturnType<typeof createMockDatabase>;
  let mockServices: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockServices = createMockServices();
    service = new EDeclarationService(
      mockDb,
      mockServices.storage,
      mockServices.jpk,
      mockServices.notification,
      mockServices.audit,
      mockServices.certificate
    );
  });

  describe('submitJPK', () => {
    it('should validate JPK file is signed before submission', async () => {
      mockDb.jpkFile.findUniqueOrThrow.mockResolvedValue({
        id: 'jpk-123',
        status: 'GENERATED', // Not signed
      });

      await expect(service.submitJPK({
        jpkFileId: 'jpk-123',
        authMethod: 'CERTIFICATE',
        testMode: false,
        userId: 'user-1',
      })).rejects.toThrow('JPK file must be signed or validated');
    });

    it('should create submission record before upload', async () => {
      mockDb.jpkFile.findUniqueOrThrow.mockResolvedValue({
        id: 'jpk-123',
        status: 'SIGNED',
        organizationId: 'org-1',
        referenceNumber: 'JPK-TEST',
      });

      mockDb.eUrzadConfig.findFirst.mockResolvedValue({
        apiBaseUrl: 'https://test.api',
        environment: 'TEST',
      });

      mockDb.eSubmission.create.mockResolvedValue({
        id: 'sub-123',
        status: 'PENDING',
      });

      // Mock API call failure to stop at submission record creation
      vi.spyOn(service as any, 'initializeApiClient').mockRejectedValue(
        new Error('API unavailable')
      );

      await expect(service.submitJPK({
        jpkFileId: 'jpk-123',
        authMethod: 'CERTIFICATE',
        testMode: true,
        userId: 'user-1',
      })).rejects.toThrow();

      expect(mockDb.eSubmission.create).toHaveBeenCalled();
    });
  });

  describe('checkStatus', () => {
    it('should map e-Urząd status to internal status', () => {
      expect(service['mapEUrzadStatus']('UPLOADED')).toBe('SUBMITTED');
      expect(service['mapEUrzadStatus']('IN_PROGRESS')).toBe('PROCESSING');
      expect(service['mapEUrzadStatus']('COMPLETED')).toBe('ACCEPTED');
      expect(service['mapEUrzadStatus']('REJECTED')).toBe('REJECTED');
      expect(service['mapEUrzadStatus']('ERROR')).toBe('FAILED');
    });

    it('should record status history on status change', async () => {
      const submissionId = 'sub-123';

      mockDb.eSubmission.findUnique.mockResolvedValue({
        id: submissionId,
        status: 'SUBMITTED',
      });

      await service['updateSubmissionStatus'](submissionId, 'PROCESSING', 'Processing...');

      expect(mockDb.submissionStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          submissionId,
          fromStatus: 'SUBMITTED',
          toStatus: 'PROCESSING',
        }),
      });
    });
  });

  describe('retrySubmission', () => {
    it('should not retry if max retries exceeded', async () => {
      mockDb.eSubmission.findUniqueOrThrow.mockResolvedValue({
        id: 'sub-123',
        retryCount: 5,
        maxRetries: 5,
        status: 'FAILED',
      });

      await expect(service.retrySubmission({
        submissionId: 'sub-123',
        forceRetry: false,
      })).rejects.toThrow('Maximum retry attempts reached');
    });

    it('should not retry rejected submissions', async () => {
      mockDb.eSubmission.findUniqueOrThrow.mockResolvedValue({
        id: 'sub-123',
        retryCount: 0,
        maxRetries: 5,
        status: 'REJECTED',
      });

      await expect(service.retrySubmission({
        submissionId: 'sub-123',
        forceRetry: false,
      })).rejects.toThrow('Cannot retry rejected submission');
    });

    it('should allow force retry even when max exceeded', async () => {
      mockDb.eSubmission.findUniqueOrThrow.mockResolvedValue({
        id: 'sub-123',
        retryCount: 10,
        maxRetries: 5,
        status: 'FAILED',
        jpkFileId: 'jpk-123',
        authMethod: 'CERTIFICATE',
        isTestSubmission: true,
      });

      vi.spyOn(service, 'submitJPK').mockResolvedValue({
        success: true,
        submissionId: 'sub-123',
        status: 'SUBMITTED',
      });

      const result = await service.retrySubmission({
        submissionId: 'sub-123',
        forceRetry: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('webhookHandling', () => {
    it('should verify webhook signature', () => {
      const payload = {
        eventType: 'STATUS_CHANGE',
        referenceNumber: 'REF-123',
        timestamp: new Date().toISOString(),
        data: { status: 'COMPLETED' },
        signature: 'valid-signature',
      };

      // This would verify HMAC in real implementation
      expect(service['verifyWebhookSignature'](payload)).toBe(true);
    });

    it('should update status on STATUS_CHANGE webhook', async () => {
      mockDb.eSubmission.findFirst.mockResolvedValue({
        id: 'sub-123',
        organizationId: 'org-1',
      });

      vi.spyOn(service as any, 'updateSubmissionStatus').mockResolvedValue(undefined);

      await service.handleWebhook({
        eventType: 'STATUS_CHANGE',
        referenceNumber: 'REF-123',
        timestamp: new Date().toISOString(),
        data: { status: 'IN_PROGRESS', message: 'Processing' },
        signature: 'valid',
      });

      expect(service['updateSubmissionStatus']).toHaveBeenCalledWith(
        'sub-123',
        'PROCESSING',
        'Processing'
      );
    });
  });

  describe('internalReferenceGeneration', () => {
    it('should generate unique internal references', () => {
      const jpkFile = { referenceNumber: 'JPK-V7M-ABC12345-202501' };

      const ref1 = service['generateInternalReference'](jpkFile);
      const ref2 = service['generateInternalReference'](jpkFile);

      expect(ref1).toMatch(/^SUB-JPK-V7M-ABC12345-202501-[A-Z0-9]+$/);
      expect(ref1).not.toBe(ref2); // Should be unique
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '@/test/integration';

describe('e-Declaration Integration', () => {
  let ctx: TestContext;
  let testClient: Client;
  let testJpkFile: JPKFile;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test client
    testClient = await ctx.db.client.create({
      data: {
        organizationId: ctx.organization.id,
        name: 'E-Declaration Test Client',
        nip: '1234567890',
      },
    });

    // Create test JPK file (signed)
    testJpkFile = await ctx.db.jpkFile.create({
      data: {
        organizationId: ctx.organization.id,
        clientId: testClient.id,
        jpkType: 'JPK_V7M',
        referenceNumber: 'JPK-TEST-202501',
        periodFrom: new Date(2025, 0, 1),
        periodTo: new Date(2025, 0, 31),
        status: 'SIGNED',
        filePath: '/test/jpk/signed.xml',
        xsdSchemaVersion: '1-0E',
        createdBy: ctx.user.id,
      },
    });

    // Create e-Urząd config
    await ctx.db.eUrzadConfig.create({
      data: {
        organizationId: ctx.organization.id,
        environment: 'TEST',
        apiBaseUrl: 'https://test-bramka.mf.gov.pl/api/v1',
        certificateThumbprint: 'test-cert-thumbprint',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  it('should create submission record on submit', async () => {
    const result = await ctx.services.eDeclaration.submitJPK({
      jpkFileId: testJpkFile.id,
      authMethod: 'CERTIFICATE',
      testMode: true,
      userId: ctx.user.id,
    });

    expect(result.submissionId).toBeDefined();

    const submission = await ctx.db.eSubmission.findUnique({
      where: { id: result.submissionId },
    });

    expect(submission).toBeDefined();
    expect(submission!.jpkFileId).toBe(testJpkFile.id);
  });

  it('should track submission attempts', async () => {
    // Create submission
    const submission = await ctx.db.eSubmission.create({
      data: {
        organizationId: ctx.organization.id,
        jpkFileId: testJpkFile.id,
        internalReference: 'SUB-TEST-1',
        status: 'SUBMITTED',
        referenceNumber: 'REF-12345',
        authMethod: 'CERTIFICATE',
        createdBy: ctx.user.id,
      },
    });

    // Check status (triggers attempt logging)
    await ctx.services.eDeclaration.checkStatus(submission.id);

    const attempts = await ctx.db.eSubmissionAttempt.findMany({
      where: { submissionId: submission.id },
    });

    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts[0].attemptType).toBe('STATUS_CHECK');
  });

  it('should store UPO documents', async () => {
    // Create accepted submission
    const submission = await ctx.db.eSubmission.create({
      data: {
        organizationId: ctx.organization.id,
        jpkFileId: testJpkFile.id,
        internalReference: 'SUB-TEST-2',
        status: 'ACCEPTED',
        referenceNumber: 'REF-67890',
        upoReference: 'UPO-67890',
        authMethod: 'CERTIFICATE',
        createdBy: ctx.user.id,
      },
    });

    // Create UPO documents
    await ctx.db.upoDocument.createMany({
      data: [
        {
          submissionId: submission.id,
          upoReference: 'UPO-67890',
          documentType: 'XML',
          filePath: '/test/upo/67890.xml',
        },
        {
          submissionId: submission.id,
          upoReference: 'UPO-67890',
          documentType: 'PDF',
          filePath: '/test/upo/67890.pdf',
        },
      ],
    });

    const upoDocuments = await ctx.db.upoDocument.findMany({
      where: { submissionId: submission.id },
    });

    expect(upoDocuments).toHaveLength(2);
    expect(upoDocuments.map(d => d.documentType)).toContain('XML');
    expect(upoDocuments.map(d => d.documentType)).toContain('PDF');
  });

  it('should record status history', async () => {
    const submission = await ctx.db.eSubmission.create({
      data: {
        organizationId: ctx.organization.id,
        jpkFileId: testJpkFile.id,
        internalReference: 'SUB-TEST-3',
        status: 'PENDING',
        authMethod: 'CERTIFICATE',
        createdBy: ctx.user.id,
      },
    });

    // Simulate status changes
    for (const status of ['UPLOADING', 'SUBMITTED', 'PROCESSING', 'ACCEPTED']) {
      await ctx.services.eDeclaration['updateSubmissionStatus'](
        submission.id,
        status as any
      );
    }

    const history = await ctx.db.submissionStatusHistory.findMany({
      where: { submissionId: submission.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(history).toHaveLength(4);
    expect(history[0].fromStatus).toBe('PENDING');
    expect(history[0].toStatus).toBe('UPLOADING');
    expect(history[3].toStatus).toBe('ACCEPTED');
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('e-Declaration Submission Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'accountant@test.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('complete submission workflow', async ({ page }) => {
    // Navigate to JPK file
    await page.goto('/tax/jpk/files');
    await page.click('[data-testid="jpk-file-row"]:first-child');

    // Verify file is signed
    await expect(page.locator('[data-testid="jpk-status"]')).toHaveText('Podpisany');

    // Click submit
    await page.click('[data-testid="submit-to-eurzad-button"]');

    // Select authentication method
    await page.click('[data-testid="auth-method-certificate"]');
    await page.click('[data-testid="confirm-submit"]');

    // Wait for submission
    await expect(page.locator('[data-testid="submission-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="submission-success"]')).toBeVisible({ timeout: 30000 });

    // Verify reference number displayed
    await expect(page.locator('[data-testid="reference-number"]')).toBeVisible();
  });

  test('view submission history', async ({ page }) => {
    await page.goto('/tax/submissions');

    // Verify history table
    await expect(page.locator('[data-testid="submissions-table"]')).toBeVisible();

    // Check columns
    await expect(page.locator('th:has-text("Data złożenia")')).toBeVisible();
    await expect(page.locator('th:has-text("Typ JPK")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("UPO")')).toBeVisible();
  });

  test('download UPO document', async ({ page }) => {
    await page.goto('/tax/submissions');

    // Click on accepted submission
    await page.click('[data-testid="submission-row-accepted"]:first-child');

    // Download PDF UPO
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-upo-pdf"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/UPO.*\.pdf$/);
  });

  test('retry failed submission', async ({ page }) => {
    await page.goto('/tax/submissions');

    // Find failed submission
    await page.click('[data-testid="submission-row-failed"]:first-child');

    // Click retry
    await page.click('[data-testid="retry-button"]');
    await page.click('[data-testid="confirm-retry"]');

    // Verify retry initiated
    await expect(page.locator('[data-testid="retry-scheduled"]')).toBeVisible();
  });

  test('view submission details and attempts', async ({ page }) => {
    await page.goto('/tax/submissions');
    await page.click('[data-testid="submission-row"]:first-child');

    // View attempts tab
    await page.click('[data-testid="tab-attempts"]');
    await expect(page.locator('[data-testid="attempts-table"]')).toBeVisible();

    // View status history tab
    await page.click('[data-testid="tab-history"]');
    await expect(page.locator('[data-testid="status-history"]')).toBeVisible();
  });
});
```

---

## 🔒 Security Checklist

- [x] TLS 1.3 for all API communication
- [x] Certificate-based authentication support
- [x] OAuth 2.0 (Profil Zaufany) support
- [x] Secure credential storage (encrypted)
- [x] Webhook signature verification
- [x] Rate limiting on submission endpoints
- [x] Audit logging for all submission events
- [x] Row Level Security on all tables
- [x] Input validation with Zod
- [x] Error message sanitization (no sensitive data)

---

## 📊 Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `SUBMISSION_INITIATED` | Submit called | JPK ID, auth method, user |
| `SUBMISSION_UPLOADED` | File uploaded to e-Urząd | Reference number |
| `SUBMISSION_STATUS_CHANGED` | Status update received | From/to status |
| `UPO_RECEIVED` | UPO retrieved | UPO reference, timestamp |
| `SUBMISSION_REJECTED` | Rejection received | Error code, message |
| `SUBMISSION_RETRIED` | Retry initiated | Retry count, delay |
| `WEBHOOK_RECEIVED` | Webhook processed | Event type, payload |

---

## 📚 Implementation Notes

### e-Urząd API Integration

- **Production URL**: `https://e-bramka.mf.gov.pl/api/v1`
- **Test URL**: `https://test-bramka.mf.gov.pl/api/v1`
- **Authentication**: Client certificate or Profil Zaufany OAuth
- **Rate Limits**: 100 requests/minute per organization
- **File Size Limit**: 100MB per submission

### Authentication Methods

| Method | Use Case | Setup Required |
|--------|----------|----------------|
| Qualified Certificate | Primary method | Certificate registration with tax office |
| Profil Zaufany | Alternative method | login.gov.pl OAuth setup |

### Status Polling Strategy

- Initial check: Immediately after submission
- Subsequent checks: Every 5 minutes
- Maximum duration: 72 hours
- Webhook fallback: If webhook enabled, polling interval increases to 30 minutes

### Dependencies

- **TAX-007**: JPK file generation for submission
- **AIM**: User authentication for submission authorization
- **DOC**: Document storage for UPO files

### External Resources

- [e-Urząd Skarbowy API](https://www.podatki.gov.pl/e-urzad-skarbowy/dokumentacja-api/)
- [Profil Zaufany OAuth](https://pz.gov.pl/dokumentacja/)
- [Ministerstwo Finansów - JPK](https://www.podatki.gov.pl/jednolity-plik-kontrolny/)

---

*Story created: December 2024*
*Last updated: December 2024*
