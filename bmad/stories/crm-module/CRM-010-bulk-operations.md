# CRM-010: Bulk Operations

> **Story ID**: CRM-010
> **Epic**: Core CRM Module
> **Priority**: P1
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 7

---

## User Story

**As an** accountant,
**I want** bulk import/export capabilities,
**So that** I can efficiently manage large client datasets.

---

## Acceptance Criteria

### AC1: CSV/Excel Import
```gherkin
Feature: Client Data Import
  As an accountant
  I want to import clients from CSV or Excel files
  So that I can migrate data efficiently

  Background:
    Given I am logged in as "accountant@firma.pl"
    And I have "admin" role in organization "Biuro Rachunkowe XYZ"

  Scenario: Upload import file
    Given I am on the bulk import page
    When I upload file "clients.csv" with 100 client records
    Then the system should parse the file
    And display preview of first 10 records
    And show column mapping interface
    And detect file encoding automatically

  Scenario: Map columns to fields
    Given I have uploaded "clients.csv"
    And the file has columns "Nazwa,NIP,Adres,Miasto,Kod"
    When I map "Nazwa" to "company_name"
    And I map "NIP" to "nip"
    And I map "Adres" to "address_street"
    And I map "Miasto" to "address_city"
    And I map "Kod" to "address_postal_code"
    Then the mapping should be saved
    And I can proceed to validation

  Scenario: Validate import data
    Given I have mapped columns for "clients.csv"
    When the system validates the data
    Then it should check NIP format for all records
    And identify duplicate NIPs within file
    And identify NIPs already in database
    And report validation errors with row numbers
    And show validation summary

  Scenario: Execute import with duplicate handling
    Given validation passed for 95 of 100 records
    And 5 records have duplicate NIPs in database
    When I select "update existing" for duplicates
    And I click "Import"
    Then 90 new clients should be created
    And 5 existing clients should be updated
    And 5 records with errors should be skipped
    And import log should be available for download
```

### AC2: Bulk Export
```gherkin
Feature: Client Data Export
  As an accountant
  I want to export client data to various formats
  So that I can share data with external systems

  Scenario: Export all clients to CSV
    Given I have 500 clients in my organization
    When I navigate to export page
    And I select "CSV" format
    And I select all fields
    And I click "Export"
    Then a CSV file should be generated
    And contain all 500 client records
    And use UTF-8 encoding with BOM
    And include header row

  Scenario: Export filtered clients to Excel
    Given I have filtered clients by status "ACTIVE"
    And the filter returns 350 clients
    When I click "Export filtered"
    And I select "Excel" format
    And I select fields: company_name, nip, status, vat_status
    Then an Excel file should be generated
    And contain 350 records
    And have proper column formatting
    And include Polish characters correctly

  Scenario: Export with custom fields
    Given I have custom fields defined for clients
    When I export clients
    And I include custom fields in export
    Then custom field values should be included
    And custom field names should be column headers
```

### AC3: Bulk Update Operations
```gherkin
Feature: Bulk Client Updates
  As an accountant
  I want to update multiple clients at once
  So that I can make mass changes efficiently

  Scenario: Bulk status change
    Given I have selected 50 clients from the list
    When I click "Bulk Actions"
    And I select "Change Status"
    And I set new status to "INACTIVE"
    And I provide reason "Zakończenie współpracy"
    And I confirm the action
    Then all 50 clients should have status "INACTIVE"
    And timeline entries should be created for each
    And audit log should record the bulk operation

  Scenario: Bulk tag assignment
    Given I have selected 30 clients
    When I click "Bulk Actions"
    And I select "Add Tags"
    And I select tags "VIP" and "Priorytet"
    And I confirm
    Then tags should be added to all 30 clients
    And existing tags should be preserved

  Scenario: Bulk field update
    Given I have selected 20 clients
    When I click "Bulk Actions"
    And I select "Update Field"
    And I select field "service_manager"
    And I set value to "jan.kowalski@firma.pl"
    And I confirm
    Then all 20 clients should have updated field
```

### AC4: Import Templates
```gherkin
Feature: Import Templates
  As an accountant
  I want to use and save import templates
  So that I can streamline repeated imports

  Scenario: Download import template
    Given I am on import page
    When I click "Download Template"
    And I select "Full template with all fields"
    Then an Excel file should be downloaded
    And contain all importable fields as headers
    And include example data row
    And include validation rules sheet

  Scenario: Save column mapping as template
    Given I have configured column mapping for import
    When I click "Save as Template"
    And I enter name "Import z systemu ABC"
    Then the mapping template should be saved
    And be available for future imports

  Scenario: Use saved mapping template
    Given I have saved template "Import z systemu ABC"
    When I upload a new file from same source
    And I select the saved template
    Then columns should be mapped automatically
    And I can proceed to validation immediately
```

### AC5: Background Processing
```gherkin
Feature: Background Import/Export Processing
  As an accountant
  I want large operations to run in background
  So that I can continue working during processing

  Scenario: Large import runs in background
    Given I have uploaded file with 5000 records
    And validation has passed
    When I start the import
    Then I should see "Import started in background"
    And I should be able to navigate away
    And I should see progress indicator in header
    And I should receive notification when complete

  Scenario: Monitor background job progress
    Given a background import is running
    When I click on the progress indicator
    Then I should see detailed progress
    And current record being processed
    And estimated time remaining
    And option to cancel the job

  Scenario: Resume failed import
    Given a background import failed at record 2500
    When I view the import status
    Then I should see error details
    And have option to "Resume from failure point"
    And have option to "Download error log"
```

---

## Technical Specification

### Database Schema

```sql
-- Import/Export jobs table
CREATE TABLE bulk_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('IMPORT', 'EXPORT')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    )),

    -- Job configuration
    file_name VARCHAR(255),
    file_type VARCHAR(10) CHECK (file_type IN ('CSV', 'XLSX', 'XLS')),
    file_size_bytes BIGINT,
    file_path VARCHAR(500), -- S3 path

    -- Column mapping (for imports)
    column_mapping JSONB DEFAULT '{}',
    mapping_template_id UUID REFERENCES import_templates(id),

    -- Export configuration
    export_filters JSONB DEFAULT '{}',
    export_fields TEXT[] DEFAULT '{}',

    -- Progress tracking
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,

    -- Duplicate handling
    duplicate_strategy VARCHAR(20) DEFAULT 'SKIP' CHECK (duplicate_strategy IN (
        'SKIP', 'UPDATE', 'CREATE_NEW'
    )),

    -- Results
    result_file_path VARCHAR(500), -- For exports or error logs
    error_summary JSONB DEFAULT '[]',

    -- Metadata
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Import templates for saved column mappings
CREATE TABLE import_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Mapping configuration
    column_mapping JSONB NOT NULL,
    file_type VARCHAR(10),
    expected_columns TEXT[],

    -- Usage tracking
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_template_name UNIQUE (organization_id, name)
);

-- Import validation errors log
CREATE TABLE import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES bulk_jobs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    field_name VARCHAR(100),
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    raw_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bulk operation history (for updates)
CREATE TABLE bulk_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    operation_type VARCHAR(50) NOT NULL,

    -- Affected entities
    entity_type VARCHAR(50) NOT NULL DEFAULT 'CLIENT',
    entity_ids UUID[] NOT NULL,
    entity_count INTEGER NOT NULL,

    -- Operation details
    field_changes JSONB DEFAULT '{}',
    reason TEXT,

    -- Results
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_details JSONB DEFAULT '[]',

    -- Rollback support
    previous_values JSONB DEFAULT '{}',
    is_reversible BOOLEAN DEFAULT TRUE,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES users(id),

    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY bulk_jobs_org_isolation ON bulk_jobs
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY import_templates_org_isolation ON import_templates
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY import_errors_via_job ON import_errors
    FOR ALL USING (
        job_id IN (
            SELECT id FROM bulk_jobs
            WHERE organization_id = current_setting('app.current_organization_id')::uuid
        )
    );

CREATE POLICY bulk_operations_org_isolation ON bulk_operations
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Indexes
CREATE INDEX idx_bulk_jobs_org_status ON bulk_jobs(organization_id, status);
CREATE INDEX idx_bulk_jobs_created_at ON bulk_jobs(created_at DESC);
CREATE INDEX idx_import_errors_job ON import_errors(job_id);
CREATE INDEX idx_bulk_operations_org ON bulk_operations(organization_id, created_at DESC);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Import file upload
export const ImportFileUploadSchema = z.object({
  fileName: z.string().max(255),
  fileType: z.enum(['CSV', 'XLSX', 'XLS']),
  fileContent: z.string(), // Base64 encoded
  encoding: z.enum(['UTF-8', 'UTF-16', 'ISO-8859-2', 'WINDOWS-1250']).optional(),
});

// Column mapping
export const ColumnMappingSchema = z.record(
  z.string(), // Source column name
  z.object({
    targetField: z.string(),
    transformation: z.enum(['NONE', 'UPPERCASE', 'LOWERCASE', 'TRIM', 'NIP_FORMAT']).optional(),
    defaultValue: z.string().optional(),
    required: z.boolean().default(false),
  })
);

// Import configuration
export const ImportConfigSchema = z.object({
  columnMapping: ColumnMappingSchema,
  duplicateStrategy: z.enum(['SKIP', 'UPDATE', 'CREATE_NEW']).default('SKIP'),
  duplicateField: z.enum(['nip', 'regon', 'email']).default('nip'),
  skipHeaderRows: z.number().min(0).max(10).default(1),
  dateFormat: z.string().default('YYYY-MM-DD'),
  mappingTemplateId: z.string().uuid().optional(),
  validateOnly: z.boolean().default(false),
});

// Start import
export const StartImportSchema = z.object({
  fileId: z.string().uuid(),
  config: ImportConfigSchema,
});

// Export configuration
export const ExportConfigSchema = z.object({
  format: z.enum(['CSV', 'XLSX']),
  fields: z.array(z.string()).min(1),
  filters: z.object({
    status: z.array(z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED'])).optional(),
    tags: z.array(z.string().uuid()).optional(),
    vatStatus: z.array(z.enum(['ACTIVE', 'NOT_REGISTERED', 'INVALID', 'EXEMPT'])).optional(),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    searchQuery: z.string().optional(),
  }).optional(),
  includeCustomFields: z.boolean().default(false),
  includeContacts: z.boolean().default(false),
});

// Bulk update
export const BulkUpdateSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(1000),
  operation: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('STATUS_CHANGE'),
      newStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED']),
      reason: z.string().min(3).max(500),
    }),
    z.object({
      type: z.literal('ADD_TAGS'),
      tagIds: z.array(z.string().uuid()).min(1),
    }),
    z.object({
      type: z.literal('REMOVE_TAGS'),
      tagIds: z.array(z.string().uuid()).min(1),
    }),
    z.object({
      type: z.literal('UPDATE_FIELD'),
      fieldName: z.string(),
      fieldValue: z.unknown(),
    }),
    z.object({
      type: z.literal('ASSIGN_MANAGER'),
      managerId: z.string().uuid(),
    }),
    z.object({
      type: z.literal('BATCH_DELETE'),
      hardDelete: z.boolean().default(false),
    }),
  ]),
});

// Import template
export const ImportTemplateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  columnMapping: ColumnMappingSchema,
  fileType: z.enum(['CSV', 'XLSX', 'XLS']).optional(),
  expectedColumns: z.array(z.string()).optional(),
});

// Job status response
export const BulkJobStatusSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['IMPORT', 'EXPORT']),
  status: z.enum(['PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  fileName: z.string().optional(),
  totalRecords: z.number(),
  processedRecords: z.number(),
  successfulRecords: z.number(),
  failedRecords: z.number(),
  progress: z.number().min(0).max(100),
  errors: z.array(z.object({
    rowNumber: z.number(),
    field: z.string().optional(),
    message: z.string(),
  })).optional(),
  resultFileUrl: z.string().url().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  estimatedTimeRemaining: z.number().optional(), // seconds
});
```

### Service Layer

```typescript
// src/server/services/bulk-operations.service.ts
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';
import { parse as parseCSV } from 'papaparse';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface ImportContext {
  organizationId: string;
  userId: string;
  jobId: string;
}

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    rowNumber: number;
    field?: string;
    errorType: string;
    message: string;
    rawValue?: string;
  }>;
  duplicates: Array<{
    rowNumber: number;
    nip: string;
    existsInFile: boolean;
    existsInDb: boolean;
  }>;
  validRecords: number;
  totalRecords: number;
}

export class BulkOperationsService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.bucketName = process.env.S3_BUCKET_NAME || 'bulk-operations';
  }

  // =====================
  // File Upload & Parsing
  // =====================

  async uploadImportFile(
    organizationId: string,
    userId: string,
    file: { fileName: string; fileType: string; fileContent: string; encoding?: string }
  ): Promise<{ jobId: string; preview: ParsedRow[]; columns: string[] }> {
    // Decode base64 content
    const buffer = Buffer.from(file.fileContent, 'base64');

    // Generate job ID and S3 path
    const jobId = uuidv4();
    const s3Key = `imports/${organizationId}/${jobId}/${file.fileName}`;

    // Upload to S3
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: file.fileType === 'CSV' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));

    // Parse file for preview
    const parsed = await this.parseFile(buffer, file.fileType, file.encoding);

    // Create job record
    await db.bulkJobs.create({
      data: {
        id: jobId,
        organizationId,
        type: 'IMPORT',
        status: 'PENDING',
        fileName: file.fileName,
        fileType: file.fileType,
        fileSizeBytes: buffer.length,
        filePath: s3Key,
        totalRecords: parsed.length,
        createdBy: userId,
      },
    });

    // Get column names
    const columns = parsed.length > 0 ? Object.keys(parsed[0].data) : [];

    return {
      jobId,
      preview: parsed.slice(0, 10),
      columns,
    };
  }

  private async parseFile(
    buffer: Buffer,
    fileType: string,
    encoding?: string
  ): Promise<ParsedRow[]> {
    if (fileType === 'CSV') {
      return this.parseCSV(buffer, encoding);
    } else {
      return this.parseExcel(buffer);
    }
  }

  private async parseCSV(buffer: Buffer, encoding?: string): Promise<ParsedRow[]> {
    const content = buffer.toString(encoding as BufferEncoding || 'utf-8');

    return new Promise((resolve, reject) => {
      parseCSV(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          const rows: ParsedRow[] = results.data.map((data, index) => ({
            rowNumber: index + 2, // +2 for header row and 1-based indexing
            data: data as Record<string, string>,
          }));
          resolve(rows);
        },
        error: reject,
      });
    });
  }

  private async parseExcel(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Plik Excel nie zawiera arkuszy' });
    }

    const rows: ParsedRow[] = [];
    const headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Header row
        row.eachCell((cell) => {
          headers.push(String(cell.value || '').trim());
        });
      } else {
        // Data rows
        const data: Record<string, string> = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            data[header] = String(cell.value || '');
          }
        });
        rows.push({ rowNumber, data });
      }
    });

    return rows;
  }

  // =====================
  // Validation
  // =====================

  async validateImport(
    jobId: string,
    config: {
      columnMapping: Record<string, { targetField: string; required?: boolean }>;
      duplicateField: string;
    }
  ): Promise<ValidationResult> {
    const job = await db.bulkJobs.findUniqueOrThrow({
      where: { id: jobId },
    });

    // Update status
    await db.bulkJobs.update({
      where: { id: jobId },
      data: { status: 'VALIDATING' },
    });

    // Get file from S3 and parse
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: job.filePath!,
    }));
    const buffer = Buffer.from(await response.Body!.transformToByteArray());
    const rows = await this.parseFile(buffer, job.fileType!, 'utf-8');

    const errors: ValidationResult['errors'] = [];
    const duplicates: ValidationResult['duplicates'] = [];
    const seenValues = new Map<string, number>(); // For within-file duplicates

    // Get existing NIPs from database
    const existingNips = await db.clients.findMany({
      where: { organizationId: job.organizationId },
      select: { nip: true },
    });
    const existingNipSet = new Set(existingNips.map(c => c.nip).filter(Boolean));

    for (const row of rows) {
      // Validate each mapped field
      for (const [sourceCol, mapping] of Object.entries(config.columnMapping)) {
        const value = row.data[sourceCol];
        const targetField = mapping.targetField;

        // Required field check
        if (mapping.required && (!value || value.trim() === '')) {
          errors.push({
            rowNumber: row.rowNumber,
            field: targetField,
            errorType: 'REQUIRED',
            message: `Pole "${targetField}" jest wymagane`,
            rawValue: value,
          });
          continue;
        }

        // Field-specific validation
        if (value) {
          const fieldError = this.validateField(targetField, value, row.rowNumber);
          if (fieldError) {
            errors.push(fieldError);
          }
        }
      }

      // Check for duplicates
      const duplicateFieldMapping = Object.entries(config.columnMapping)
        .find(([_, m]) => m.targetField === config.duplicateField);

      if (duplicateFieldMapping) {
        const duplicateValue = row.data[duplicateFieldMapping[0]]?.trim();
        if (duplicateValue) {
          const existsInFile = seenValues.has(duplicateValue);
          const existsInDb = existingNipSet.has(duplicateValue);

          if (existsInFile || existsInDb) {
            duplicates.push({
              rowNumber: row.rowNumber,
              nip: duplicateValue,
              existsInFile,
              existsInDb,
            });
          }

          seenValues.set(duplicateValue, row.rowNumber);
        }
      }
    }

    // Save errors to database
    if (errors.length > 0) {
      await db.importErrors.createMany({
        data: errors.map(e => ({
          jobId,
          rowNumber: e.rowNumber,
          fieldName: e.field,
          errorType: e.errorType,
          errorMessage: e.message,
          rawValue: e.rawValue,
        })),
      });
    }

    const validRecords = rows.length - new Set(errors.map(e => e.rowNumber)).size;

    return {
      isValid: errors.length === 0,
      errors,
      duplicates,
      validRecords,
      totalRecords: rows.length,
    };
  }

  private validateField(
    fieldName: string,
    value: string,
    rowNumber: number
  ): ValidationResult['errors'][0] | null {
    switch (fieldName) {
      case 'nip':
        if (!this.isValidNIP(value)) {
          return {
            rowNumber,
            field: 'nip',
            errorType: 'INVALID_FORMAT',
            message: 'Nieprawidłowy format NIP',
            rawValue: value,
          };
        }
        break;

      case 'regon':
        if (!this.isValidREGON(value)) {
          return {
            rowNumber,
            field: 'regon',
            errorType: 'INVALID_FORMAT',
            message: 'Nieprawidłowy format REGON',
            rawValue: value,
          };
        }
        break;

      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return {
            rowNumber,
            field: 'email',
            errorType: 'INVALID_FORMAT',
            message: 'Nieprawidłowy format email',
            rawValue: value,
          };
        }
        break;

      case 'address_postal_code':
        if (!/^\d{2}-\d{3}$/.test(value)) {
          return {
            rowNumber,
            field: 'address_postal_code',
            errorType: 'INVALID_FORMAT',
            message: 'Nieprawidłowy format kodu pocztowego (XX-XXX)',
            rawValue: value,
          };
        }
        break;
    }

    return null;
  }

  private isValidNIP(nip: string): boolean {
    const cleanNip = nip.replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(cleanNip)) return false;

    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanNip[i]) * weights[i];
    }
    const checksum = sum % 11;
    return checksum === parseInt(cleanNip[9]);
  }

  private isValidREGON(regon: string): boolean {
    const cleanRegon = regon.replace(/[\s-]/g, '');
    if (!/^(\d{9}|\d{14})$/.test(cleanRegon)) return false;

    // Basic REGON validation (9 digits)
    const weights9 = [8, 9, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(cleanRegon[i]) * weights9[i];
    }
    const checksum = sum % 11;
    return checksum % 10 === parseInt(cleanRegon[8]);
  }

  // =====================
  // Import Execution
  // =====================

  async executeImport(
    jobId: string,
    config: {
      columnMapping: Record<string, { targetField: string; transformation?: string; defaultValue?: string }>;
      duplicateStrategy: 'SKIP' | 'UPDATE' | 'CREATE_NEW';
      duplicateField: string;
    }
  ): Promise<void> {
    const job = await db.bulkJobs.findUniqueOrThrow({
      where: { id: jobId },
    });

    // Update status and save config
    await db.bulkJobs.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        columnMapping: config.columnMapping,
        duplicateStrategy: config.duplicateStrategy,
        startedAt: new Date(),
      },
    });

    try {
      // Get file and parse
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: job.filePath!,
      }));
      const buffer = Buffer.from(await response.Body!.transformToByteArray());
      const rows = await this.parseFile(buffer, job.fileType!, 'utf-8');

      // Get existing records for duplicate checking
      const existingClients = await db.clients.findMany({
        where: { organizationId: job.organizationId },
        select: { id: true, nip: true, regon: true },
      });
      const existingMap = new Map<string, string>();
      for (const client of existingClients) {
        if (client.nip) existingMap.set(`nip:${client.nip}`, client.id);
        if (client.regon) existingMap.set(`regon:${client.regon}`, client.id);
      }

      let successful = 0;
      let failed = 0;

      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        for (const row of batch) {
          try {
            const clientData = this.mapRowToClient(row.data, config.columnMapping);

            // Check for duplicate
            const duplicateKey = `${config.duplicateField}:${clientData[config.duplicateField]}`;
            const existingId = existingMap.get(duplicateKey);

            if (existingId) {
              if (config.duplicateStrategy === 'UPDATE') {
                await db.clients.update({
                  where: { id: existingId },
                  data: {
                    ...clientData,
                    updatedAt: new Date(),
                  },
                });
                successful++;
              } else if (config.duplicateStrategy === 'CREATE_NEW') {
                // Create with modified identifier
                await db.clients.create({
                  data: {
                    ...clientData,
                    organizationId: job.organizationId,
                    status: 'PENDING',
                    createdBy: job.createdBy,
                  },
                });
                successful++;
              }
              // SKIP: do nothing
            } else {
              // Create new client
              await db.clients.create({
                data: {
                  ...clientData,
                  organizationId: job.organizationId,
                  status: 'PENDING',
                  createdBy: job.createdBy,
                },
              });
              successful++;
            }
          } catch (error) {
            failed++;
            await db.importErrors.create({
              data: {
                jobId,
                rowNumber: row.rowNumber,
                errorType: 'PROCESSING_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Nieznany błąd',
              },
            });
          }
        }

        // Update progress
        await db.bulkJobs.update({
          where: { id: jobId },
          data: {
            processedRecords: i + batch.length,
            successfulRecords: successful,
            failedRecords: failed,
          },
        });
      }

      // Complete
      await db.bulkJobs.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          processedRecords: rows.length,
          successfulRecords: successful,
          failedRecords: failed,
          completedAt: new Date(),
        },
      });

    } catch (error) {
      await db.bulkJobs.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorSummary: [{ message: error instanceof Error ? error.message : 'Nieznany błąd' }],
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private mapRowToClient(
    rowData: Record<string, string>,
    columnMapping: Record<string, { targetField: string; transformation?: string; defaultValue?: string }>
  ): Record<string, any> {
    const clientData: Record<string, any> = {};

    for (const [sourceCol, mapping] of Object.entries(columnMapping)) {
      let value = rowData[sourceCol] || mapping.defaultValue || null;

      if (value && mapping.transformation) {
        switch (mapping.transformation) {
          case 'UPPERCASE':
            value = value.toUpperCase();
            break;
          case 'LOWERCASE':
            value = value.toLowerCase();
            break;
          case 'TRIM':
            value = value.trim();
            break;
          case 'NIP_FORMAT':
            value = value.replace(/[\s-]/g, '');
            break;
        }
      }

      if (value) {
        clientData[mapping.targetField] = value;
      }
    }

    return clientData;
  }

  // =====================
  // Export
  // =====================

  async createExport(
    organizationId: string,
    userId: string,
    config: {
      format: 'CSV' | 'XLSX';
      fields: string[];
      filters?: Record<string, any>;
      includeCustomFields?: boolean;
      includeContacts?: boolean;
    }
  ): Promise<{ jobId: string }> {
    const jobId = uuidv4();

    await db.bulkJobs.create({
      data: {
        id: jobId,
        organizationId,
        type: 'EXPORT',
        status: 'PROCESSING',
        exportFilters: config.filters || {},
        exportFields: config.fields,
        startedAt: new Date(),
        createdBy: userId,
      },
    });

    // Execute export (in production, this would be queued)
    this.executeExport(jobId, organizationId, config).catch(console.error);

    return { jobId };
  }

  private async executeExport(
    jobId: string,
    organizationId: string,
    config: {
      format: 'CSV' | 'XLSX';
      fields: string[];
      filters?: Record<string, any>;
      includeCustomFields?: boolean;
      includeContacts?: boolean;
    }
  ): Promise<void> {
    try {
      // Build query
      const where: any = { organizationId, isDeleted: false };

      if (config.filters?.status) {
        where.status = { in: config.filters.status };
      }
      if (config.filters?.vatStatus) {
        where.vatStatus = { in: config.filters.vatStatus };
      }
      if (config.filters?.createdAfter) {
        where.createdAt = { ...where.createdAt, gte: config.filters.createdAfter };
      }
      if (config.filters?.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: config.filters.createdBefore };
      }

      // Fetch clients
      const clients = await db.clients.findMany({
        where,
        include: {
          contacts: config.includeContacts ? true : false,
          customFieldValues: config.includeCustomFields ? {
            include: { fieldDefinition: true },
          } : false,
          tags: { include: { tag: true } },
        },
        orderBy: { companyName: 'asc' },
      });

      await db.bulkJobs.update({
        where: { id: jobId },
        data: { totalRecords: clients.length },
      });

      // Generate file
      let fileBuffer: Buffer;
      let fileName: string;

      if (config.format === 'CSV') {
        fileBuffer = await this.generateCSV(clients, config.fields);
        fileName = `export_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        fileBuffer = await this.generateExcel(clients, config.fields);
        fileName = `export_${new Date().toISOString().split('T')[0]}.xlsx`;
      }

      // Upload to S3
      const s3Key = `exports/${organizationId}/${jobId}/${fileName}`;
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
      }));

      // Update job
      await db.bulkJobs.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          processedRecords: clients.length,
          successfulRecords: clients.length,
          resultFilePath: s3Key,
          fileName,
          completedAt: new Date(),
        },
      });

    } catch (error) {
      await db.bulkJobs.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorSummary: [{ message: error instanceof Error ? error.message : 'Błąd eksportu' }],
          completedAt: new Date(),
        },
      });
    }
  }

  private async generateCSV(clients: any[], fields: string[]): Promise<Buffer> {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const rows: string[] = [];

    // Header
    rows.push(fields.join(','));

    // Data rows
    for (const client of clients) {
      const values = fields.map(field => {
        const value = this.getFieldValue(client, field);
        // Escape CSV values
        if (value?.toString().includes(',') || value?.toString().includes('"')) {
          return `"${value.toString().replace(/"/g, '""')}"`;
        }
        return value || '';
      });
      rows.push(values.join(','));
    }

    return Buffer.from(BOM + rows.join('\n'), 'utf-8');
  }

  private async generateExcel(clients: any[], fields: string[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Klienci');

    // Header row with styling
    worksheet.addRow(fields);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Data rows
    for (const client of clients) {
      const values = fields.map(field => this.getFieldValue(client, field));
      worksheet.addRow(values);
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 20;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private getFieldValue(client: any, field: string): string {
    const fieldMap: Record<string, () => string> = {
      company_name: () => client.companyName,
      nip: () => client.nip,
      regon: () => client.regon,
      krs: () => client.krs,
      status: () => client.status,
      vat_status: () => client.vatStatus,
      address_street: () => client.addressStreet,
      address_city: () => client.addressCity,
      address_postal_code: () => client.addressPostalCode,
      address_country: () => client.addressCountry,
      email: () => client.email,
      phone: () => client.phone,
      website: () => client.website,
      tags: () => client.tags?.map((t: any) => t.tag.name).join('; '),
      created_at: () => client.createdAt?.toISOString(),
      updated_at: () => client.updatedAt?.toISOString(),
    };

    return fieldMap[field]?.() || '';
  }

  // =====================
  // Bulk Updates
  // =====================

  async executeBulkUpdate(
    organizationId: string,
    userId: string,
    params: {
      clientIds: string[];
      operation: {
        type: string;
        [key: string]: any;
      };
    }
  ): Promise<{ operationId: string; successful: number; failed: number }> {
    const operationId = uuidv4();
    let successful = 0;
    let failed = 0;
    const errorDetails: any[] = [];
    const previousValues: Record<string, any> = {};

    // Verify all clients belong to organization
    const clients = await db.clients.findMany({
      where: {
        id: { in: params.clientIds },
        organizationId,
        isDeleted: false,
      },
      select: { id: true, status: true, companyName: true },
    });

    if (clients.length !== params.clientIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Niektóre klienci nie zostali znalezieni lub nie należą do tej organizacji',
      });
    }

    // Store previous values for rollback
    for (const client of clients) {
      previousValues[client.id] = { status: client.status };
    }

    // Execute operation
    switch (params.operation.type) {
      case 'STATUS_CHANGE':
        for (const client of clients) {
          try {
            await db.$transaction([
              db.clients.update({
                where: { id: client.id },
                data: { status: params.operation.newStatus },
              }),
              db.clientTimeline.create({
                data: {
                  clientId: client.id,
                  eventType: 'SYSTEM',
                  eventCategory: 'status_change',
                  title: `Zmiana statusu: ${client.status} → ${params.operation.newStatus}`,
                  description: params.operation.reason,
                  createdBy: userId,
                  metadata: {
                    previousStatus: client.status,
                    newStatus: params.operation.newStatus,
                    bulkOperationId: operationId,
                  },
                },
              }),
            ]);
            successful++;
          } catch {
            failed++;
            errorDetails.push({ clientId: client.id, error: 'Nie udało się zaktualizować statusu' });
          }
        }
        break;

      case 'ADD_TAGS':
        for (const client of clients) {
          try {
            await db.clientTags.createMany({
              data: params.operation.tagIds.map((tagId: string) => ({
                clientId: client.id,
                tagId,
              })),
              skipDuplicates: true,
            });
            successful++;
          } catch {
            failed++;
            errorDetails.push({ clientId: client.id, error: 'Nie udało się dodać tagów' });
          }
        }
        break;

      case 'REMOVE_TAGS':
        for (const client of clients) {
          try {
            await db.clientTags.deleteMany({
              where: {
                clientId: client.id,
                tagId: { in: params.operation.tagIds },
              },
            });
            successful++;
          } catch {
            failed++;
            errorDetails.push({ clientId: client.id, error: 'Nie udało się usunąć tagów' });
          }
        }
        break;

      case 'BATCH_DELETE':
        for (const client of clients) {
          try {
            if (params.operation.hardDelete) {
              await db.clients.delete({ where: { id: client.id } });
            } else {
              await db.clients.update({
                where: { id: client.id },
                data: { isDeleted: true, deletedAt: new Date(), deletedBy: userId },
              });
            }
            successful++;
          } catch {
            failed++;
            errorDetails.push({ clientId: client.id, error: 'Nie udało się usunąć klienta' });
          }
        }
        break;
    }

    // Save operation record
    await db.bulkOperations.create({
      data: {
        id: operationId,
        organizationId,
        operationType: params.operation.type,
        entityType: 'CLIENT',
        entityIds: params.clientIds,
        entityCount: params.clientIds.length,
        fieldChanges: params.operation,
        successfulCount: successful,
        failedCount: failed,
        errorDetails,
        previousValues,
        isReversible: params.operation.type !== 'BATCH_DELETE' || !params.operation.hardDelete,
        createdBy: userId,
      },
    });

    return { operationId, successful, failed };
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await db.bulkJobs.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        _count: { select: { errors: true } },
      },
    });

    const progress = job.totalRecords > 0
      ? Math.round((job.processedRecords / job.totalRecords) * 100)
      : 0;

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | undefined;
    if (job.status === 'PROCESSING' && job.startedAt && job.processedRecords > 0) {
      const elapsed = Date.now() - job.startedAt.getTime();
      const perRecord = elapsed / job.processedRecords;
      const remaining = job.totalRecords - job.processedRecords;
      estimatedTimeRemaining = Math.round((perRecord * remaining) / 1000);
    }

    // Generate signed URL for result file
    let resultFileUrl: string | undefined;
    if (job.resultFilePath && job.status === 'COMPLETED') {
      resultFileUrl = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({ Bucket: this.bucketName, Key: job.resultFilePath }),
        { expiresIn: 3600 }
      );
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      fileName: job.fileName,
      totalRecords: job.totalRecords,
      processedRecords: job.processedRecords,
      successfulRecords: job.successfulRecords,
      failedRecords: job.failedRecords,
      progress,
      errorCount: job._count.errors,
      resultFileUrl,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedTimeRemaining,
    };
  }
}

export const bulkOperationsService = new BulkOperationsService();
```

### tRPC Router

```typescript
// src/server/routers/crm/bulk.router.ts
import { router, protectedProcedure, adminProcedure } from '@/server/trpc';
import { z } from 'zod';
import { bulkOperationsService } from '@/server/services/bulk-operations.service';
import {
  ImportFileUploadSchema,
  ImportConfigSchema,
  ExportConfigSchema,
  BulkUpdateSchema,
  ImportTemplateSchema,
} from '@/shared/schemas/bulk.schema';
import { TRPCError } from '@trpc/server';

export const bulkRouter = router({
  // Upload import file
  uploadImportFile: protectedProcedure
    .input(ImportFileUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bulkOperationsService.uploadImportFile(
        ctx.session.organizationId,
        ctx.session.userId,
        input
      );

      await ctx.audit.log('bulk.import.upload', {
        jobId: result.jobId,
        fileName: input.fileName,
        recordCount: result.preview.length,
      });

      return result;
    }),

  // Validate import
  validateImport: protectedProcedure
    .input(z.object({
      jobId: z.string().uuid(),
      config: ImportConfigSchema.pick({ columnMapping: true, duplicateField: true }),
    }))
    .mutation(async ({ ctx, input }) => {
      return bulkOperationsService.validateImport(input.jobId, {
        columnMapping: input.config.columnMapping as any,
        duplicateField: input.config.duplicateField || 'nip',
      });
    }),

  // Execute import
  executeImport: protectedProcedure
    .input(z.object({
      jobId: z.string().uuid(),
      config: ImportConfigSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Start in background
      bulkOperationsService.executeImport(input.jobId, {
        columnMapping: input.config.columnMapping as any,
        duplicateStrategy: input.config.duplicateStrategy,
        duplicateField: input.config.duplicateField || 'nip',
      }).catch(console.error);

      await ctx.audit.log('bulk.import.start', {
        jobId: input.jobId,
        duplicateStrategy: input.config.duplicateStrategy,
      });

      return { started: true, jobId: input.jobId };
    }),

  // Create export
  createExport: protectedProcedure
    .input(ExportConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bulkOperationsService.createExport(
        ctx.session.organizationId,
        ctx.session.userId,
        input
      );

      await ctx.audit.log('bulk.export.start', {
        jobId: result.jobId,
        format: input.format,
        fieldCount: input.fields.length,
      });

      return result;
    }),

  // Get job status
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input }) => {
      return bulkOperationsService.getJobStatus(input.jobId);
    }),

  // List jobs
  listJobs: protectedProcedure
    .input(z.object({
      type: z.enum(['IMPORT', 'EXPORT']).optional(),
      status: z.enum(['PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const jobs = await ctx.db.bulkJobs.findMany({
        where: {
          organizationId: ctx.session.organizationId,
          ...(input.type && { type: input.type }),
          ...(input.status && { status: input.status }),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      let nextCursor: string | undefined;
      if (jobs.length > input.limit) {
        const nextItem = jobs.pop();
        nextCursor = nextItem?.id;
      }

      return { jobs, nextCursor };
    }),

  // Cancel job
  cancelJob: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.bulkJobs.findUnique({
        where: { id: input.jobId },
      });

      if (!job || job.organizationId !== ctx.session.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (!['PENDING', 'VALIDATING', 'PROCESSING'].includes(job.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nie można anulować zakończonego zadania',
        });
      }

      await ctx.db.bulkJobs.update({
        where: { id: input.jobId },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });

      await ctx.audit.log('bulk.job.cancel', { jobId: input.jobId });

      return { success: true };
    }),

  // Execute bulk update
  executeBulkUpdate: protectedProcedure
    .input(BulkUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bulkOperationsService.executeBulkUpdate(
        ctx.session.organizationId,
        ctx.session.userId,
        input
      );

      await ctx.audit.log('bulk.update.execute', {
        operationId: result.operationId,
        operationType: input.operation.type,
        clientCount: input.clientIds.length,
        successful: result.successful,
        failed: result.failed,
      });

      return result;
    }),

  // Import templates
  saveImportTemplate: protectedProcedure
    .input(ImportTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.importTemplates.create({
        data: {
          organizationId: ctx.session.organizationId,
          name: input.name,
          description: input.description,
          columnMapping: input.columnMapping,
          fileType: input.fileType,
          expectedColumns: input.expectedColumns,
          createdBy: ctx.session.userId,
        },
      });

      await ctx.audit.log('bulk.template.create', { templateId: template.id, name: input.name });

      return template;
    }),

  listImportTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.importTemplates.findMany({
        where: { organizationId: ctx.session.organizationId },
        orderBy: [{ useCount: 'desc' }, { name: 'asc' }],
      });
    }),

  deleteImportTemplate: adminProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.importTemplates.delete({
        where: { id: input.templateId },
      });

      await ctx.audit.log('bulk.template.delete', { templateId: input.templateId });

      return { success: true };
    }),

  // Download import template file
  downloadImportTemplate: protectedProcedure
    .input(z.object({
      templateType: z.enum(['minimal', 'full']),
      format: z.enum(['CSV', 'XLSX']),
    }))
    .mutation(async ({ input }) => {
      const fields = input.templateType === 'minimal'
        ? ['company_name', 'nip', 'email']
        : [
            'company_name', 'nip', 'regon', 'krs',
            'address_street', 'address_city', 'address_postal_code', 'address_country',
            'email', 'phone', 'website',
            'tax_form', 'vat_payer',
          ];

      // Generate template file
      // Implementation would generate actual file
      return {
        fileName: `import_template.${input.format.toLowerCase()}`,
        fields,
      };
    }),

  // Get import errors
  getImportErrors: protectedProcedure
    .input(z.object({
      jobId: z.string().uuid(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const [errors, total] = await Promise.all([
        ctx.db.importErrors.findMany({
          where: { jobId: input.jobId },
          orderBy: { rowNumber: 'asc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.importErrors.count({
          where: { jobId: input.jobId },
        }),
      ]);

      return { errors, total };
    }),

  // Get bulk operations history
  listBulkOperations: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const operations = await ctx.db.bulkOperations.findMany({
        where: { organizationId: ctx.session.organizationId },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
        include: {
          createdByUser: { select: { email: true, fullName: true } },
        },
      });

      let nextCursor: string | undefined;
      if (operations.length > input.limit) {
        const nextItem = operations.pop();
        nextCursor = nextItem?.id;
      }

      return { operations, nextCursor };
    }),

  // Reverse bulk operation
  reverseBulkOperation: adminProcedure
    .input(z.object({ operationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const operation = await ctx.db.bulkOperations.findUnique({
        where: { id: input.operationId },
      });

      if (!operation || operation.organizationId !== ctx.session.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (!operation.isReversible) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ta operacja nie może być cofnięta',
        });
      }

      if (operation.reversedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ta operacja została już cofnięta',
        });
      }

      // Reverse the operation
      const previousValues = operation.previousValues as Record<string, any>;

      for (const [clientId, values] of Object.entries(previousValues)) {
        await ctx.db.clients.update({
          where: { id: clientId },
          data: values,
        });
      }

      await ctx.db.bulkOperations.update({
        where: { id: input.operationId },
        data: {
          reversedAt: new Date(),
          reversedBy: ctx.session.userId,
        },
      });

      await ctx.audit.log('bulk.operation.reverse', {
        operationId: input.operationId,
        affectedClients: Object.keys(previousValues).length,
      });

      return { success: true };
    }),
});
```

---

## Test Specification

### Unit Tests

```typescript
// tests/unit/bulk-operations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkOperationsService } from '@/server/services/bulk-operations.service';

describe('BulkOperationsService', () => {
  let service: BulkOperationsService;

  beforeEach(() => {
    service = new BulkOperationsService();
    vi.clearAllMocks();
  });

  describe('NIP validation', () => {
    it('validates correct NIP', () => {
      expect(service['isValidNIP']('1234567890')).toBe(false); // Invalid checksum
      expect(service['isValidNIP']('5213609787')).toBe(true); // Valid NIP
    });

    it('handles NIP with dashes and spaces', () => {
      expect(service['isValidNIP']('521-360-97-87')).toBe(true);
      expect(service['isValidNIP']('521 360 97 87')).toBe(true);
    });

    it('rejects invalid NIP format', () => {
      expect(service['isValidNIP']('123')).toBe(false);
      expect(service['isValidNIP']('abcdefghij')).toBe(false);
    });
  });

  describe('REGON validation', () => {
    it('validates correct 9-digit REGON', () => {
      expect(service['isValidREGON']('123456785')).toBe(true);
    });

    it('rejects invalid REGON', () => {
      expect(service['isValidREGON']('123456789')).toBe(false);
    });
  });

  describe('Field mapping', () => {
    it('maps row data to client fields', () => {
      const rowData = {
        'Nazwa firmy': 'Test Sp. z o.o.',
        'NIP': '521-360-97-87',
        'Email': 'test@example.com',
      };

      const mapping = {
        'Nazwa firmy': { targetField: 'companyName' },
        'NIP': { targetField: 'nip', transformation: 'NIP_FORMAT' },
        'Email': { targetField: 'email', transformation: 'LOWERCASE' },
      };

      const result = service['mapRowToClient'](rowData, mapping);

      expect(result.companyName).toBe('Test Sp. z o.o.');
      expect(result.nip).toBe('5213609787');
      expect(result.email).toBe('test@example.com');
    });

    it('applies default values', () => {
      const rowData = { 'Nazwa': 'Test' };
      const mapping = {
        'Nazwa': { targetField: 'companyName' },
        'Status': { targetField: 'status', defaultValue: 'PENDING' },
      };

      const result = service['mapRowToClient'](rowData, mapping);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('CSV generation', () => {
    it('generates CSV with UTF-8 BOM', async () => {
      const clients = [
        { companyName: 'Żółta Firma', nip: '1234567890' },
      ];

      const buffer = await service['generateCSV'](clients, ['company_name', 'nip']);
      const content = buffer.toString('utf-8');

      expect(content.startsWith('\uFEFF')).toBe(true);
      expect(content).toContain('Żółta Firma');
    });

    it('escapes CSV special characters', async () => {
      const clients = [
        { companyName: 'Firma "Test", Sp. z o.o.', nip: '1234567890' },
      ];

      const buffer = await service['generateCSV'](clients, ['company_name']);
      const content = buffer.toString('utf-8');

      expect(content).toContain('"Firma ""Test"", Sp. z o.o."');
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/bulk.router.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, createTestUser, cleanupTestData } from '../helpers';
import { bulkRouter } from '@/server/routers/crm/bulk.router';

describe('Bulk Operations Router', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let testOrg: { id: string };

  beforeEach(async () => {
    ctx = await createTestContext();
    testOrg = await ctx.db.organizations.create({
      data: { name: 'Test Org', slug: 'test-org' },
    });
    ctx.session.organizationId = testOrg.id;
  });

  afterEach(async () => {
    await cleanupTestData(ctx.db);
  });

  describe('uploadImportFile', () => {
    it('parses CSV file and returns preview', async () => {
      const csvContent = Buffer.from(
        'Nazwa,NIP,Email\nTest Firma,5213609787,test@example.com'
      ).toString('base64');

      const result = await bulkRouter.uploadImportFile({
        ctx,
        input: {
          fileName: 'test.csv',
          fileType: 'CSV',
          fileContent: csvContent,
        },
      });

      expect(result.jobId).toBeDefined();
      expect(result.columns).toEqual(['Nazwa', 'NIP', 'Email']);
      expect(result.preview).toHaveLength(1);
      expect(result.preview[0].data.Nazwa).toBe('Test Firma');
    });
  });

  describe('validateImport', () => {
    it('validates data and reports errors', async () => {
      const job = await ctx.db.bulkJobs.create({
        data: {
          organizationId: testOrg.id,
          type: 'IMPORT',
          status: 'PENDING',
          filePath: 'test/path',
          fileType: 'CSV',
          totalRecords: 2,
          createdBy: ctx.session.userId,
        },
      });

      // Mock S3 and parsing
      const result = await bulkRouter.validateImport({
        ctx,
        input: {
          jobId: job.id,
          config: {
            columnMapping: {
              'NIP': { targetField: 'nip', required: true },
            },
            duplicateField: 'nip',
          },
        },
      });

      expect(result.totalRecords).toBeDefined();
    });
  });

  describe('executeBulkUpdate', () => {
    it('updates status for multiple clients', async () => {
      const clients = await Promise.all([
        ctx.db.clients.create({
          data: {
            organizationId: testOrg.id,
            companyName: 'Client 1',
            status: 'ACTIVE',
            createdBy: ctx.session.userId,
          },
        }),
        ctx.db.clients.create({
          data: {
            organizationId: testOrg.id,
            companyName: 'Client 2',
            status: 'ACTIVE',
            createdBy: ctx.session.userId,
          },
        }),
      ]);

      const result = await bulkRouter.executeBulkUpdate({
        ctx,
        input: {
          clientIds: clients.map(c => c.id),
          operation: {
            type: 'STATUS_CHANGE',
            newStatus: 'INACTIVE',
            reason: 'Test reason',
          },
        },
      });

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);

      // Verify updates
      const updated = await ctx.db.clients.findMany({
        where: { id: { in: clients.map(c => c.id) } },
      });
      expect(updated.every(c => c.status === 'INACTIVE')).toBe(true);
    });
  });
});
```

### E2E Tests

```typescript
// tests/e2e/bulk-operations.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('imports clients from CSV', async ({ page }) => {
    await page.goto('/clients/import');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'clients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Nazwa,NIP,Email\nTest Firma,5213609787,test@example.com'),
    });

    // Wait for preview
    await expect(page.locator('[data-testid="import-preview"]')).toBeVisible();
    await expect(page.locator('text=Test Firma')).toBeVisible();

    // Map columns
    await page.selectOption('[data-testid="mapping-Nazwa"]', 'company_name');
    await page.selectOption('[data-testid="mapping-NIP"]', 'nip');
    await page.selectOption('[data-testid="mapping-Email"]', 'email');

    // Validate
    await page.click('button:has-text("Waliduj")');
    await expect(page.locator('text=Walidacja zakończona')).toBeVisible();

    // Import
    await page.click('button:has-text("Importuj")');
    await expect(page.locator('text=Import rozpoczęty')).toBeVisible();

    // Wait for completion
    await expect(page.locator('text=Import zakończony')).toBeVisible({ timeout: 30000 });
  });

  test('exports clients to Excel', async ({ page }) => {
    await page.goto('/clients');

    // Click export button
    await page.click('button:has-text("Eksportuj")');

    // Configure export
    await page.selectOption('[data-testid="export-format"]', 'XLSX');
    await page.check('[data-testid="field-company_name"]');
    await page.check('[data-testid="field-nip"]');
    await page.check('[data-testid="field-status"]');

    // Start export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Pobierz")'),
    ]);

    expect(download.suggestedFilename()).toMatch(/export.*\.xlsx$/);
  });

  test('bulk updates client status', async ({ page }) => {
    await page.goto('/clients');

    // Select multiple clients
    await page.check('[data-testid="select-client-0"]');
    await page.check('[data-testid="select-client-1"]');
    await page.check('[data-testid="select-client-2"]');

    // Open bulk actions
    await page.click('button:has-text("Akcje grupowe")');
    await page.click('text=Zmień status');

    // Configure action
    await page.selectOption('[data-testid="new-status"]', 'INACTIVE');
    await page.fill('[data-testid="reason"]', 'Zakończenie współpracy');

    // Confirm
    await page.click('button:has-text("Potwierdź")');

    // Verify success
    await expect(page.locator('text=Zaktualizowano 3 klientów')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] File upload validation (type, size, content)
- [x] S3 presigned URLs with expiration
- [x] Row Level Security on all tables
- [x] Input sanitization for imported data
- [x] NIP/REGON validation before import
- [x] Organization isolation for all operations
- [x] Rate limiting on import/export endpoints
- [x] Audit logging for all bulk operations
- [x] Rollback support for bulk updates
- [x] Background job monitoring and cancellation

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `bulk.import.upload` | File uploaded | jobId, fileName, recordCount |
| `bulk.import.start` | Import started | jobId, duplicateStrategy |
| `bulk.import.complete` | Import finished | jobId, successful, failed |
| `bulk.export.start` | Export started | jobId, format, fieldCount |
| `bulk.export.complete` | Export finished | jobId, recordCount |
| `bulk.update.execute` | Bulk update run | operationId, type, clientCount |
| `bulk.operation.reverse` | Operation reversed | operationId, affectedClients |
| `bulk.template.create` | Template saved | templateId, name |
| `bulk.template.delete` | Template deleted | templateId |
| `bulk.job.cancel` | Job cancelled | jobId |

---

## Implementation Notes

### Performance Considerations
- Process imports in batches of 100 records
- Use background jobs for large operations (>500 records)
- Generate exports asynchronously with progress tracking
- Cache validation results during import preview
- Use database transactions for bulk updates

### Polish Localization
- Support Polish character encodings (UTF-8, ISO-8859-2, Windows-1250)
- Date formats: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY
- Number formats with Polish decimal separator (comma)
- Error messages in Polish

### File Handling
- Maximum file size: 50MB
- Supported formats: CSV, XLSX, XLS
- Automatic encoding detection with fallback options
- UTF-8 BOM for Excel CSV compatibility

---

*Story created: December 2024*
*Template version: 1.0*
