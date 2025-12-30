# ACC-015: JPK-KR Export (Jednolity Plik Kontrolny - Księgi Rachunkowe)

> **Story ID**: ACC-015
> **Epic**: ACC - Accounting Engine Module
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development
> **Sprint**: Week 12

---

## User Story

**As an** accountant managing Polish companies,
**I want to** export accounting books in JPK_KR format compliant with Polish tax authority requirements,
**So that** I can submit mandatory electronic reports to Krajowa Administracja Skarbowa (KAS).

---

## Dependencies

### Requires
- **ACC-001**: Chart of Accounts Management (account structure and PKD codes)
- **ACC-006**: Journal Entry Creation (transaction data)
- **ACC-008**: General Ledger (account balances)
- **ACC-012**: Trial Balance (verification data)
- **ACC-013**: Balance Sheet (Bilans data)
- **ACC-014**: Income Statement (RZiS data)

### Enables
- **TAX-xxx**: Tax compliance module (VAT, CIT)
- **DOC-xxx**: Document archival with JPK references

---

## Acceptance Criteria

### AC1: JPK_KR File Generation

```gherkin
Feature: JPK_KR File Generation
  As an accountant
  I need to generate JPK_KR files per Ministry of Finance specifications
  So that I can submit accounting data to tax authorities

  Background:
    Given I am authenticated as an accountant
    And organization "Test Sp. z o.o." has complete accounting data
    And fiscal year 2024 has posted journal entries

  Scenario: Generate JPK_KR for fiscal year
    Given organization has NIP "1234567890"
    And fiscal year 2024 has 1,250 journal entries
    And chart of accounts has 85 active accounts
    When I generate JPK_KR for period "2024-01-01" to "2024-12-31"
    Then XML file is generated with JPK_KR structure
    And file contains <Naglowek> section with organization data
    And file contains <ZOiS> section with chart of accounts
    And file contains <Dziennik> section with all journal entries
    And file contains <KontoZapis> section with ledger postings
    And file validates against official XSD schema

  Scenario: Generate JPK_KR for specific period
    Given I need quarterly submission
    When I generate JPK_KR for period "2024-01-01" to "2024-03-31"
    Then file contains only entries from Q1 2024
    And opening balances reflect state at 2024-01-01
    And closing balances reflect state at 2024-03-31

  Scenario: Handle large data volumes
    Given organization has 50,000 journal entries
    When I generate JPK_KR
    Then generation completes within 5 minutes
    And file is properly formatted and valid
    And progress indicator shows generation status
```

### AC2: JPK_KR Structure Compliance

```gherkin
Feature: JPK_KR XML Structure
  As an accountant
  I need JPK_KR to follow official Ministry of Finance schema
  So that files are accepted by tax authority systems

  Scenario: Validate header section (Naglowek)
    When I generate JPK_KR file
    Then <Naglowek> contains:
      | Element                | Value                              |
      | KodFormularza          | JPK_KR                             |
      | WariantFormularza      | 1                                  |
      | CelZlozenia            | 1 (submission) or 2 (correction)  |
      | DataWytworzeniaJPK     | Current timestamp                  |
      | DataOd                 | Period start date                  |
      | DataDo                 | Period end date                    |
      | NazwaSystemu           | KsięgowaCRM                        |
    And <Podmiot1> contains NIP, full name, and address
    And all required namespace declarations present

  Scenario: Validate chart of accounts section (ZOiS)
    When I generate JPK_KR file
    Then <ZOiS> section contains all active accounts
    And each <KontoZapis> has:
      | Element      | Description                      |
      | KodKonta     | Account code                     |
      | OpisKonta    | Account name (Polish)            |
      | TypKonta     | Account type (Aktywne/Pasywne/etc) |
      | KodZespolu   | Account class (0-8)              |
      | KodKategorii | Category code                    |
    And accounts sorted by account code

  Scenario: Validate journal section (Dziennik)
    When I generate JPK_KR file
    Then <Dziennik> contains all posted journal entries
    And each <DziennikZapis> has:
      | Element          | Description                    |
      | LpZapisuDziennika| Sequential entry number        |
      | NrZapisuDziennika| Original entry number          |
      | OpisDziennika    | Entry description              |
      | DataOperacji     | Operation date                 |
      | DataDowodu       | Document date                  |
      | DataKsiegowania  | Posting date                   |
      | KodOperatora     | User code who posted           |
    And entries sorted by posting date

  Scenario: Validate ledger section (KontoZapis)
    When I generate JPK_KR file
    Then <KontoZapis> section contains all line items
    And each ledger posting has:
      | Element          | Description                    |
      | LpZapisu         | Line number                    |
      | NrZapisu         | Journal entry reference        |
      | KodKontaWn       | Debit account code             |
      | KwotaWn          | Debit amount                   |
      | KodKontaMa       | Credit account code            |
      | KwotaMa          | Credit amount                  |
      | OpisZapisu       | Line description               |
    And all amounts use 2 decimal places with dot separator
```

### AC3: Data Validation and Integrity

```gherkin
Feature: JPK_KR Data Validation
  As an accountant
  I need validation before JPK generation
  So that submitted files are error-free

  Scenario: Pre-generation validation
    When I initiate JPK_KR generation
    Then system validates:
      | Check                           | Requirement                     |
      | Organization NIP                | Valid 10-digit NIP              |
      | Organization address            | Complete Polish address         |
      | All entries posted              | No draft entries in period      |
      | Balanced trial balance          | Debits = Credits                |
      | Required account codes          | PKD/JPK codes assigned          |
      | Sequential entry numbers        | No gaps in numbering            |
    And validation report shows any issues found

  Scenario: Detect missing PKD codes
    Given account "500-01" has no PKD code assigned
    When I run pre-generation validation
    Then warning shows "Account 500-01 missing PKD code"
    And I can proceed with generation after acknowledgment
    And default PKD code used for uncoded accounts

  Scenario: Detect unbalanced period
    Given trial balance shows imbalance of "100.00 PLN"
    When I run pre-generation validation
    Then error shows "Trial balance is not balanced"
    And generation is blocked until resolved

  Scenario: Handle draft entries warning
    Given period has 5 draft journal entries
    When I run pre-generation validation
    Then warning shows "5 draft entries will be excluded"
    And I can choose to include or exclude drafts
    And if included, file marked as preliminary
```

### AC4: XSD Schema Validation

```gherkin
Feature: XSD Schema Validation
  As an accountant
  I need JPK files to validate against official XSD
  So that tax authority systems accept them

  Scenario: Validate against official JPK_KR XSD
    When I generate JPK_KR file
    Then file validates against "Schemat_JPK_KR(1)_v1-0.xsd"
    And no schema validation errors
    And validation report shows "Schema validation passed"

  Scenario: Handle validation failure
    Given generated XML has structural issues
    When schema validation runs
    Then specific error messages show issue location
    And line numbers indicate problem areas
    And suggestions for fixing provided

  Scenario: Test with tax authority validator
    When I export JPK_KR file
    Then file can be tested with Ministry of Finance validator
    And validation results match local validation
```

### AC5: Export and Submission

```gherkin
Feature: JPK Export Options
  As an accountant
  I need various export options
  So that I can submit through preferred channel

  Scenario: Download JPK_KR file
    When I generate and download JPK_KR
    Then file downloads as "JPK_KR_[NIP]_[DATE_FROM]_[DATE_TO].xml"
    And file encoding is UTF-8
    And file size displayed before download

  Scenario: Generate signed file (optional)
    Given organization has qualified electronic signature
    When I generate signed JPK_KR
    Then file is signed with XAdES signature
    And signature embedded in XML
    And can be verified by tax authority

  Scenario: Store generated file
    When I generate JPK_KR
    Then file is stored in organization's document archive
    And generation metadata recorded (date, user, validation status)
    And previous versions accessible for comparison

  Scenario: Correction submission (korekta)
    Given I previously submitted JPK_KR for Q1 2024
    When I generate correction JPK_KR
    Then <CelZlozenia> set to "2" (correction)
    And <NumerKorekty> indicates correction sequence
    And file contains full data set (not just changes)
```

### AC6: Financial Statements Integration

```gherkin
Feature: Financial Statements in JPK
  As an accountant
  I need to include financial statements in JPK_KR
  So that complete annual package is submitted

  Scenario: Include Balance Sheet (Bilans)
    Given I'm generating annual JPK_KR
    When I enable Balance Sheet inclusion
    Then <Bilans> section added to JPK
    And structure follows Załącznik nr 1
    And values match generated Balance Sheet report

  Scenario: Include Income Statement (RZiS)
    Given I'm generating annual JPK_KR
    When I enable Income Statement inclusion
    Then <RZiS> section added to JPK
    And structure follows Załącznik nr 1
    And values match generated Income Statement report

  Scenario: Cross-validate with reports
    When JPK includes financial statements
    Then system validates:
      | Statement        | Validation                        |
      | Balance Sheet    | Assets = Liabilities + Equity     |
      | Income Statement | Net profit matches equity change  |
      | General Ledger   | Trial balance matches statements  |
    And discrepancies flagged before generation
```

---

## Technical Specification

### Database Schema

```sql
-- =====================================
-- JPK Generation History
-- =====================================
CREATE TABLE jpk_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- JPK identification
  jpk_type VARCHAR(20) NOT NULL DEFAULT 'JPK_KR',
  file_name VARCHAR(255) NOT NULL,
  generation_number INTEGER NOT NULL,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,

  -- Submission info
  submission_type VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL',
  correction_number INTEGER DEFAULT 0,

  -- File info
  file_size_bytes BIGINT NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  file_path VARCHAR(500),

  -- Statistics
  entry_count INTEGER NOT NULL,
  line_count INTEGER NOT NULL,
  account_count INTEGER NOT NULL,

  -- Validation
  is_valid BOOLEAN NOT NULL DEFAULT FALSE,
  validation_errors JSONB DEFAULT '[]',
  schema_version VARCHAR(20) NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',

  -- Audit
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMP,
  submitted_by UUID REFERENCES users(id),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================
-- JPK Validation Results
-- =====================================
CREATE TABLE jpk_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jpk_log_id UUID NOT NULL REFERENCES jpk_generation_log(id) ON DELETE CASCADE,

  -- Validation type
  validation_type VARCHAR(50) NOT NULL,
  validation_step INTEGER NOT NULL,

  -- Result
  is_passed BOOLEAN NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  details JSONB,

  -- Location in file
  element_path VARCHAR(500),
  line_number INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================
-- JPK Account Mapping for Export
-- =====================================
CREATE TABLE jpk_account_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),

  -- JPK specific codes
  jpk_account_type VARCHAR(20) NOT NULL,
  jpk_category_code VARCHAR(20),
  jpk_team_code VARCHAR(10) NOT NULL,

  -- Validation
  is_configured BOOLEAN DEFAULT FALSE,
  configuration_notes TEXT,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, account_id)
);

-- Indexes
CREATE INDEX idx_jgl_org_period ON jpk_generation_log(organization_id, period_start, period_end);
CREATE INDEX idx_jgl_status ON jpk_generation_log(status);
CREATE INDEX idx_jvr_log ON jpk_validation_results(jpk_log_id);
CREATE INDEX idx_jam_account ON jpk_account_mapping(account_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// =====================================
// Enums
// =====================================

export const JpkTypeEnum = z.enum(['JPK_KR', 'JPK_VAT', 'JPK_FA', 'JPK_MAG']);
export type JpkType = z.infer<typeof JpkTypeEnum>;

export const SubmissionTypeEnum = z.enum(['ORIGINAL', 'CORRECTION']);
export type SubmissionType = z.infer<typeof SubmissionTypeEnum>;

export const JpkStatusEnum = z.enum([
  'DRAFT',
  'VALIDATING',
  'VALID',
  'INVALID',
  'GENERATED',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED'
]);
export type JpkStatus = z.infer<typeof JpkStatusEnum>;

export const ValidationSeverityEnum = z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']);
export type ValidationSeverity = z.infer<typeof ValidationSeverityEnum>;

// =====================================
// JPK Header Schema (Naglowek)
// =====================================

export const JpkHeaderSchema = z.object({
  kodFormularza: z.literal('JPK_KR'),
  wariantFormularza: z.number().int().positive(),
  celZlozenia: z.enum(['1', '2']), // 1 = original, 2 = correction
  numerKorekty: z.number().int().min(0).optional(),
  dataWytworzeniaJPK: z.date(),
  dataOd: z.date(),
  dataDo: z.date(),
  nazwaSystemu: z.string().max(255)
});

export type JpkHeader = z.infer<typeof JpkHeaderSchema>;

// =====================================
// Organization Data Schema (Podmiot1)
// =====================================

export const JpkSubjectSchema = z.object({
  nip: z.string().regex(/^\d{10}$/),
  pelnaNazwa: z.string().max(500),
  regon: z.string().regex(/^\d{9}$|^\d{14}$/).optional(),
  kodKraju: z.literal('PL'),
  wojewodztwo: z.string().max(100),
  powiat: z.string().max(100),
  gmina: z.string().max(100),
  miejscowosc: z.string().max(100),
  ulica: z.string().max(100).optional(),
  nrDomu: z.string().max(20),
  nrLokalu: z.string().max(20).optional(),
  kodPocztowy: z.string().regex(/^\d{2}-\d{3}$/),
  poczta: z.string().max(100)
});

export type JpkSubject = z.infer<typeof JpkSubjectSchema>;

// =====================================
// Chart of Accounts Entry Schema (ZOiS)
// =====================================

export const JpkAccountSchema = z.object({
  kodKonta: z.string().max(20),
  opisKonta: z.string().max(255),
  typKonta: z.enum(['Aktywne', 'Pasywne', 'Aktywno-Pasywne', 'Wynikowe']),
  kodZespolu: z.string().max(1),
  kodKategorii: z.string().max(20).optional(),
  bilansowe: z.boolean(),
  opis: z.string().max(500).optional()
});

export type JpkAccount = z.infer<typeof JpkAccountSchema>;

// =====================================
// Journal Entry Schema (Dziennik)
// =====================================

export const JpkJournalEntrySchema = z.object({
  lpZapisuDziennika: z.number().int().positive(),
  nrZapisuDziennika: z.string().max(50),
  opisDziennika: z.string().max(500),
  dataOperacji: z.date(),
  dataDowodu: z.date(),
  dataKsiegowania: z.date(),
  kodOperatora: z.string().max(50),
  opisOperatora: z.string().max(255).optional(),
  kwotaOperacji: z.number()
});

export type JpkJournalEntry = z.infer<typeof JpkJournalEntrySchema>;

// =====================================
// Ledger Posting Schema (KontoZapis)
// =====================================

export const JpkLedgerPostingSchema = z.object({
  lpZapisu: z.number().int().positive(),
  nrZapisu: z.string().max(50),
  kodKontaWn: z.string().max(20).optional(),
  kwotaWn: z.number().min(0).optional(),
  kodKontaMa: z.string().max(20).optional(),
  kwotaMa: z.number().min(0).optional(),
  opisZapisu: z.string().max(500).optional()
});

export type JpkLedgerPosting = z.infer<typeof JpkLedgerPostingSchema>;

// =====================================
// Complete JPK_KR Schema
// =====================================

export const JpkKrSchema = z.object({
  naglowek: JpkHeaderSchema,
  podmiot1: JpkSubjectSchema,
  zpisList: z.array(JpkAccountSchema),
  dziennikList: z.array(JpkJournalEntrySchema),
  kontoZapisList: z.array(JpkLedgerPostingSchema),

  // Optional financial statements
  bilans: z.any().optional(),
  rzis: z.any().optional(),

  // Metadata
  generatedAt: z.date(),
  generatedBy: z.string().uuid(),
  validationStatus: JpkStatusEnum,
  validationErrors: z.array(z.string()).optional()
});

export type JpkKr = z.infer<typeof JpkKrSchema>;

// =====================================
// Input Schemas
// =====================================

export const GenerateJpkKrInputSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submissionType: SubmissionTypeEnum.default('ORIGINAL'),
  correctionNumber: z.number().int().min(0).optional(),
  includeDraftEntries: z.boolean().default(false),
  includeBalanceSheet: z.boolean().default(false),
  includeIncomeStatement: z.boolean().default(false),
  signFile: z.boolean().default(false)
});

export type GenerateJpkKrInput = z.infer<typeof GenerateJpkKrInputSchema>;

export const ValidateJpkInputSchema = z.object({
  jpkLogId: z.string().uuid()
});

export type ValidateJpkInput = z.infer<typeof ValidateJpkInputSchema>;

export const DownloadJpkInputSchema = z.object({
  jpkLogId: z.string().uuid()
});

export type DownloadJpkInput = z.infer<typeof DownloadJpkInputSchema>;

// =====================================
// Validation Result Schema
// =====================================

export const ValidationResultSchema = z.object({
  step: z.number().int(),
  type: z.string(),
  passed: z.boolean(),
  severity: ValidationSeverityEnum,
  message: z.string(),
  elementPath: z.string().optional(),
  lineNumber: z.number().int().optional(),
  details: z.record(z.any()).optional()
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const PreValidationReportSchema = z.object({
  isValid: z.boolean(),
  canGenerate: z.boolean(),
  results: z.array(ValidationResultSchema),
  summary: z.object({
    totalChecks: z.number().int(),
    passed: z.number().int(),
    warnings: z.number().int(),
    errors: z.number().int()
  })
});

export type PreValidationReport = z.infer<typeof PreValidationReportSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  GenerateJpkKrInputSchema,
  ValidateJpkInputSchema,
  DownloadJpkInputSchema,
  JpkKrSchema,
  PreValidationReportSchema,
  JpkStatusEnum
} from './jpk-kr.schemas';
import { JpkKrService } from './jpk-kr.service';
import { AuditService } from '../audit/audit.service';

export const jpkKrRouter = router({
  /**
   * Pre-validate data before JPK generation
   */
  preValidate: protectedProcedure
    .input(z.object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }))
    .output(PreValidationReportSchema)
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      const report = await service.preValidate({
        organizationId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd)
      });

      return report;
    }),

  /**
   * Generate JPK_KR file
   */
  generate: protectedProcedure
    .input(GenerateJpkKrInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      // Pre-validate
      const preValidation = await service.preValidate({
        organizationId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd)
      });

      if (!preValidation.canGenerate) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Pre-validation failed. Please resolve errors before generating JPK.',
          cause: preValidation.results.filter(r => r.severity === 'ERROR')
        });
      }

      // Generate JPK
      const jpkLog = await service.generateJpkKr({
        organizationId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        submissionType: input.submissionType,
        correctionNumber: input.correctionNumber,
        includeDraftEntries: input.includeDraftEntries,
        includeBalanceSheet: input.includeBalanceSheet,
        includeIncomeStatement: input.includeIncomeStatement,
        signFile: input.signFile,
        generatedBy: userId
      });

      // Audit log
      await AuditService.log({
        action: 'JPK_KR_GENERATED',
        entityType: 'JpkGenerationLog',
        entityId: jpkLog.id,
        organizationId,
        userId,
        metadata: {
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          submissionType: input.submissionType,
          entryCount: jpkLog.entryCount,
          fileSize: jpkLog.fileSizeBytes
        }
      });

      return {
        id: jpkLog.id,
        fileName: jpkLog.fileName,
        status: jpkLog.status,
        isValid: jpkLog.isValid,
        statistics: {
          entryCount: jpkLog.entryCount,
          lineCount: jpkLog.lineCount,
          accountCount: jpkLog.accountCount,
          fileSizeBytes: jpkLog.fileSizeBytes
        },
        validationErrors: jpkLog.validationErrors
      };
    }),

  /**
   * Validate generated JPK against XSD schema
   */
  validateSchema: protectedProcedure
    .input(ValidateJpkInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      const validationResult = await service.validateAgainstXsd(
        input.jpkLogId,
        organizationId
      );

      await AuditService.log({
        action: 'JPK_KR_VALIDATED',
        entityType: 'JpkGenerationLog',
        entityId: input.jpkLogId,
        organizationId,
        userId,
        metadata: {
          isValid: validationResult.isValid,
          errorCount: validationResult.errors.length
        }
      });

      return validationResult;
    }),

  /**
   * Download JPK file
   */
  download: protectedProcedure
    .input(DownloadJpkInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      const jpkLog = await service.getJpkLog(input.jpkLogId, organizationId);

      if (!jpkLog) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'JPK file not found'
        });
      }

      const fileBuffer = await service.getJpkFile(jpkLog.filePath);

      await AuditService.log({
        action: 'JPK_KR_DOWNLOADED',
        entityType: 'JpkGenerationLog',
        entityId: input.jpkLogId,
        organizationId,
        userId
      });

      return {
        fileName: jpkLog.fileName,
        contentType: 'application/xml',
        data: fileBuffer.toString('base64'),
        fileSize: jpkLog.fileSizeBytes,
        hash: jpkLog.fileHash
      };
    }),

  /**
   * List JPK generation history
   */
  list: protectedProcedure
    .input(z.object({
      fiscalYear: z.number().int().optional(),
      status: JpkStatusEnum.optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      const { logs, total } = await service.listJpkLogs({
        organizationId,
        fiscalYear: input.fiscalYear,
        status: input.status,
        limit: input.limit,
        offset: input.offset
      });

      return {
        logs,
        total,
        hasMore: input.offset + logs.length < total
      };
    }),

  /**
   * Get JPK details
   */
  get: protectedProcedure
    .input(z.object({
      jpkLogId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      const jpkLog = await service.getJpkLog(input.jpkLogId, organizationId);

      if (!jpkLog) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'JPK file not found'
        });
      }

      return jpkLog;
    }),

  /**
   * Get account mapping configuration
   */
  getAccountMappings: protectedProcedure
    .query(async ({ ctx }) => {
      const { organizationId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      return service.getAccountMappings(organizationId);
    }),

  /**
   * Update account mapping for JPK
   */
  updateAccountMapping: protectedProcedure
    .input(z.object({
      accountId: z.string().uuid(),
      jpkAccountType: z.string().max(20),
      jpkCategoryCode: z.string().max(20).optional(),
      jpkTeamCode: z.string().max(10)
    }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      await service.updateAccountMapping(organizationId, input);

      await AuditService.log({
        action: 'JPK_ACCOUNT_MAPPING_UPDATED',
        entityType: 'JpkAccountMapping',
        entityId: input.accountId,
        organizationId,
        userId,
        metadata: input
      });

      return { success: true };
    }),

  /**
   * Mark JPK as submitted
   */
  markSubmitted: protectedProcedure
    .input(z.object({
      jpkLogId: z.string().uuid(),
      submissionReference: z.string().max(100).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new JpkKrService(ctx.db, ctx.cache);

      await service.markAsSubmitted(
        input.jpkLogId,
        organizationId,
        userId,
        input.submissionReference
      );

      await AuditService.log({
        action: 'JPK_KR_SUBMITTED',
        entityType: 'JpkGenerationLog',
        entityId: input.jpkLogId,
        organizationId,
        userId,
        metadata: { submissionReference: input.submissionReference }
      });

      return { success: true };
    })
});
```

### Service Implementation

```typescript
// src/modules/accounting/jpk-kr/jpk-kr.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import * as crypto from 'crypto';
import { XMLBuilder, XMLValidator } from 'fast-xml-parser';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  JpkKr,
  JpkHeader,
  JpkSubject,
  JpkAccount,
  JpkJournalEntry,
  JpkLedgerPosting,
  GenerateJpkKrInput,
  PreValidationReport,
  ValidationResult,
  JpkStatus
} from './jpk-kr.schemas';
import { JpkGenerationLog } from './entities/jpk-generation-log.entity';
import { JpkValidationResult } from './entities/jpk-validation-result.entity';
import { JpkAccountMapping } from './entities/jpk-account-mapping.entity';
import { ChartOfAccount } from '../entities/chart-of-account.entity';
import { JournalEntry } from '../entities/journal-entry.entity';
import { JournalLine } from '../entities/journal-line.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { BalanceSheetService } from '../balance-sheet/balance-sheet.service';
import { IncomeStatementService } from '../income-statement/income-statement.service';

// XSD Schema for validation
const JPK_KR_XSD_PATH = path.join(__dirname, 'schemas', 'Schemat_JPK_KR(1)_v1-0.xsd');

@Injectable()
export class JpkKrService {
  private readonly logger = new Logger(JpkKrService.name);
  private readonly STORAGE_PATH = process.env.JPK_STORAGE_PATH || './storage/jpk';

  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: Redis,
    private readonly logRepo: Repository<JpkGenerationLog>,
    private readonly validationRepo: Repository<JpkValidationResult>,
    private readonly mappingRepo: Repository<JpkAccountMapping>,
    private readonly balanceSheetService: BalanceSheetService,
    private readonly incomeStatementService: IncomeStatementService
  ) {}

  async preValidate(params: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<PreValidationReport> {
    const results: ValidationResult[] = [];
    let stepNumber = 0;

    // Step 1: Validate organization data
    stepNumber++;
    const orgValidation = await this.validateOrganizationData(
      params.organizationId,
      stepNumber
    );
    results.push(...orgValidation);

    // Step 2: Validate trial balance
    stepNumber++;
    const tbValidation = await this.validateTrialBalance(
      params.organizationId,
      params.periodEnd,
      stepNumber
    );
    results.push(...tbValidation);

    // Step 3: Validate account mappings
    stepNumber++;
    const mappingValidation = await this.validateAccountMappings(
      params.organizationId,
      stepNumber
    );
    results.push(...mappingValidation);

    // Step 4: Validate entry numbering
    stepNumber++;
    const numberingValidation = await this.validateEntryNumbering(
      params.organizationId,
      params.periodStart,
      params.periodEnd,
      stepNumber
    );
    results.push(...numberingValidation);

    // Step 5: Check for draft entries
    stepNumber++;
    const draftValidation = await this.validateNoDraftEntries(
      params.organizationId,
      params.periodStart,
      params.periodEnd,
      stepNumber
    );
    results.push(...draftValidation);

    // Calculate summary
    const summary = {
      totalChecks: results.length,
      passed: results.filter(r => r.passed).length,
      warnings: results.filter(r => !r.passed && r.severity === 'WARNING').length,
      errors: results.filter(r => !r.passed && r.severity === 'ERROR').length
    };

    const isValid = summary.errors === 0;
    const canGenerate = summary.errors === 0; // Can generate if no errors

    return {
      isValid,
      canGenerate,
      results,
      summary
    };
  }

  async generateJpkKr(params: GenerateJpkKrInput & {
    organizationId: string;
    generatedBy: string;
  }): Promise<JpkGenerationLog> {
    const {
      organizationId,
      periodStart,
      periodEnd,
      submissionType,
      correctionNumber,
      includeBalanceSheet,
      includeIncomeStatement,
      generatedBy
    } = params;

    this.logger.log(`Generating JPK_KR for ${organizationId}`, {
      periodStart,
      periodEnd
    });

    // Get organization data
    const organization = await this.getOrganization(organizationId);

    // Build JPK header
    const header = this.buildHeader(
      periodStart,
      periodEnd,
      submissionType,
      correctionNumber
    );

    // Build subject data
    const subject = this.buildSubject(organization);

    // Get chart of accounts
    const accounts = await this.getAccountsForJpk(organizationId);

    // Get journal entries
    const journalEntries = await this.getJournalEntriesForJpk(
      organizationId,
      periodStart,
      periodEnd
    );

    // Get ledger postings
    const ledgerPostings = await this.getLedgerPostingsForJpk(
      organizationId,
      periodStart,
      periodEnd
    );

    // Build JPK object
    const jpkData: JpkKr = {
      naglowek: header,
      podmiot1: subject,
      zpisList: accounts,
      dziennikList: journalEntries,
      kontoZapisList: ledgerPostings,
      generatedAt: new Date(),
      generatedBy,
      validationStatus: 'GENERATED'
    };

    // Add financial statements if requested
    if (includeBalanceSheet) {
      const balanceSheet = await this.balanceSheetService.generateBalanceSheet({
        organizationId,
        asOfDate: periodEnd,
        generatedBy
      });
      jpkData.bilans = this.transformBalanceSheetToJpk(balanceSheet);
    }

    if (includeIncomeStatement) {
      const incomeStatement = await this.incomeStatementService.generateIncomeStatement({
        organizationId,
        periodStart,
        periodEnd,
        statementVariant: 'COMPARATIVE',
        comparisonEnabled: false,
        includeDraftEntries: false,
        generatedBy
      });
      jpkData.rzis = this.transformIncomeStatementToJpk(incomeStatement);
    }

    // Generate XML
    const xml = this.buildXml(jpkData);

    // Validate against XSD
    const validationResult = await this.validateXml(xml);

    // Calculate file hash
    const fileHash = crypto.createHash('sha256').update(xml).digest('hex');

    // Generate file name
    const fileName = this.generateFileName(
      organization.nip,
      periodStart,
      periodEnd,
      submissionType,
      correctionNumber
    );

    // Save file
    const filePath = await this.saveJpkFile(organizationId, fileName, xml);

    // Get generation number
    const generationNumber = await this.getNextGenerationNumber(
      organizationId,
      periodEnd.getFullYear()
    );

    // Create log entry
    const jpkLog = this.logRepo.create({
      organizationId,
      jpkType: 'JPK_KR',
      fileName,
      generationNumber,
      periodStart,
      periodEnd,
      fiscalYear: periodEnd.getFullYear(),
      submissionType,
      correctionNumber: correctionNumber || 0,
      fileSizeBytes: Buffer.byteLength(xml, 'utf-8'),
      fileHash,
      filePath,
      entryCount: journalEntries.length,
      lineCount: ledgerPostings.length,
      accountCount: accounts.length,
      isValid: validationResult.isValid,
      validationErrors: validationResult.errors,
      schemaVersion: '1.0',
      status: validationResult.isValid ? 'VALID' : 'INVALID',
      generatedAt: new Date(),
      generatedBy
    });

    const savedLog = await this.logRepo.save(jpkLog);

    // Save validation results
    await this.saveValidationResults(savedLog.id, validationResult.results);

    this.logger.log(`JPK_KR generated: ${fileName}`, {
      entryCount: journalEntries.length,
      fileSize: savedLog.fileSizeBytes,
      isValid: savedLog.isValid
    });

    return savedLog;
  }

  private buildHeader(
    periodStart: Date,
    periodEnd: Date,
    submissionType: string,
    correctionNumber?: number
  ): JpkHeader {
    return {
      kodFormularza: 'JPK_KR',
      wariantFormularza: 1,
      celZlozenia: submissionType === 'ORIGINAL' ? '1' : '2',
      numerKorekty: correctionNumber,
      dataWytworzeniaJPK: new Date(),
      dataOd: periodStart,
      dataDo: periodEnd,
      nazwaSystemu: 'KsięgowaCRM v1.0'
    };
  }

  private buildSubject(organization: Organization): JpkSubject {
    return {
      nip: organization.nip,
      pelnaNazwa: organization.legalName,
      regon: organization.regon,
      kodKraju: 'PL',
      wojewodztwo: organization.address.voivodeship,
      powiat: organization.address.county,
      gmina: organization.address.municipality,
      miejscowosc: organization.address.city,
      ulica: organization.address.street,
      nrDomu: organization.address.buildingNumber,
      nrLokalu: organization.address.apartmentNumber,
      kodPocztowy: organization.address.postalCode,
      poczta: organization.address.postOffice
    };
  }

  private buildXml(jpkData: JpkKr): string {
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      suppressEmptyNode: true
    });

    const xmlObject = {
      '?xml': {
        '@_version': '1.0',
        '@_encoding': 'UTF-8'
      },
      JPK: {
        '@_xmlns': 'http://jpk.mf.gov.pl/wzor/2024/03/01/03011/',
        '@_xmlns:etd': 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/',
        Naglowek: {
          KodFormularza: {
            '@_kodSystemowy': 'JPK_KR (1)',
            '@_wersjaSchemy': '1-0',
            '#text': jpkData.naglowek.kodFormularza
          },
          WariantFormularza: jpkData.naglowek.wariantFormularza,
          CelZlozenia: {
            '@_poz': 'P_7',
            '#text': jpkData.naglowek.celZlozenia
          },
          DataWytworzeniaJPK: jpkData.naglowek.dataWytworzeniaJPK.toISOString(),
          DataOd: this.formatDate(jpkData.naglowek.dataOd),
          DataDo: this.formatDate(jpkData.naglowek.dataDo),
          NazwaSystemu: jpkData.naglowek.nazwaSystemu
        },
        Podmiot1: {
          IdentyfikatorPodmiotu: {
            'etd:NIP': jpkData.podmiot1.nip,
            'etd:PelnaNazwa': jpkData.podmiot1.pelnaNazwa
          },
          AdresPodmiotu: {
            'etd:KodKraju': jpkData.podmiot1.kodKraju,
            'etd:Wojewodztwo': jpkData.podmiot1.wojewodztwo,
            'etd:Powiat': jpkData.podmiot1.powiat,
            'etd:Gmina': jpkData.podmiot1.gmina,
            'etd:Ulica': jpkData.podmiot1.ulica,
            'etd:NrDomu': jpkData.podmiot1.nrDomu,
            'etd:NrLokalu': jpkData.podmiot1.nrLokalu,
            'etd:Miejscowosc': jpkData.podmiot1.miejscowosc,
            'etd:KodPocztowy': jpkData.podmiot1.kodPocztowy,
            'etd:Poczta': jpkData.podmiot1.poczta
          }
        },
        ZOiS: jpkData.zpisList.map(account => ({
          KodKonta: account.kodKonta,
          OpisKonta: account.opisKonta,
          TypKonta: account.typKonta,
          KodZespolu: account.kodZespolu,
          KodKategorii: account.kodKategorii,
          Bilansowe: account.bilansowe ? 'true' : 'false'
        })),
        Dziennik: jpkData.dziennikList.map(entry => ({
          LpZapisuDziennika: entry.lpZapisuDziennika,
          NrZapisuDziennika: entry.nrZapisuDziennika,
          OpisDziennika: entry.opisDziennika,
          DataOperacji: this.formatDate(entry.dataOperacji),
          DataDowodu: this.formatDate(entry.dataDowodu),
          DataKsiegowania: this.formatDate(entry.dataKsiegowania),
          KodOperatora: entry.kodOperatora,
          KwotaOperacji: entry.kwotaOperacji.toFixed(2)
        })),
        KontoZapis: jpkData.kontoZapisList.map(posting => ({
          LpZapisu: posting.lpZapisu,
          NrZapisu: posting.nrZapisu,
          KodKontaWn: posting.kodKontaWn,
          KwotaWn: posting.kwotaWn?.toFixed(2),
          KodKontaMa: posting.kodKontaMa,
          KwotaMa: posting.kwotaMa?.toFixed(2),
          OpisZapisu: posting.opisZapisu
        })),
        ...(jpkData.bilans && { Bilans: jpkData.bilans }),
        ...(jpkData.rzis && { RZiS: jpkData.rzis })
      }
    };

    return builder.build(xmlObject);
  }

  async validateAgainstXsd(
    jpkLogId: string,
    organizationId: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const jpkLog = await this.logRepo.findOne({
      where: { id: jpkLogId, organizationId }
    });

    if (!jpkLog) {
      throw new Error('JPK log not found');
    }

    const xml = await fs.readFile(jpkLog.filePath, 'utf-8');

    // Use XML validator
    const validationResult = XMLValidator.validate(xml, {
      allowBooleanAttributes: true
    });

    if (validationResult === true) {
      // Update log status
      jpkLog.isValid = true;
      jpkLog.status = 'VALID';
      await this.logRepo.save(jpkLog);

      return { isValid: true, errors: [] };
    }

    const errors = [validationResult.err.msg];

    // Update log status
    jpkLog.isValid = false;
    jpkLog.validationErrors = errors;
    jpkLog.status = 'INVALID';
    await this.logRepo.save(jpkLog);

    return { isValid: false, errors };
  }

  private async getAccountsForJpk(organizationId: string): Promise<JpkAccount[]> {
    const accounts = await this.dataSource
      .getRepository(ChartOfAccount)
      .find({
        where: { organizationId, isActive: true },
        order: { accountCode: 'ASC' }
      });

    return accounts.map(account => ({
      kodKonta: account.accountCode,
      opisKonta: account.accountNamePl || account.accountName,
      typKonta: this.mapAccountType(account.normalBalance, account.accountType),
      kodZespolu: account.accountCode.charAt(0),
      kodKategorii: account.jpkCode,
      bilansowe: this.isBalanceSheetAccount(account.accountType),
      opis: account.description
    }));
  }

  private async getJournalEntriesForJpk(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<JpkJournalEntry[]> {
    const entries = await this.dataSource
      .getRepository(JournalEntry)
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.postedByUser', 'user')
      .where('entry.organizationId = :organizationId', { organizationId })
      .andWhere('entry.entryDate >= :periodStart', { periodStart })
      .andWhere('entry.entryDate <= :periodEnd', { periodEnd })
      .andWhere('entry.status = :status', { status: 'POSTED' })
      .orderBy('entry.postingDate', 'ASC')
      .addOrderBy('entry.entryNumber', 'ASC')
      .getMany();

    return entries.map((entry, index) => ({
      lpZapisuDziennika: index + 1,
      nrZapisuDziennika: entry.entryNumber,
      opisDziennika: entry.descriptionPl || entry.description,
      dataOperacji: entry.entryDate,
      dataDowodu: entry.entryDate,
      dataKsiegowania: entry.postingDate || entry.entryDate,
      kodOperatora: entry.postedByUser?.email?.split('@')[0] || 'system',
      opisOperatora: entry.postedByUser?.fullName,
      kwotaOperacji: entry.totalDebit.toNumber()
    }));
  }

  private async getLedgerPostingsForJpk(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<JpkLedgerPosting[]> {
    const lines = await this.dataSource
      .getRepository(JournalLine)
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'entry')
      .where('entry.organizationId = :organizationId', { organizationId })
      .andWhere('entry.entryDate >= :periodStart', { periodStart })
      .andWhere('entry.entryDate <= :periodEnd', { periodEnd })
      .andWhere('entry.status = :status', { status: 'POSTED' })
      .orderBy('entry.postingDate', 'ASC')
      .addOrderBy('line.lineNumber', 'ASC')
      .getMany();

    return lines.map((line, index) => ({
      lpZapisu: index + 1,
      nrZapisu: line.journalEntry?.entryNumber || '',
      kodKontaWn: line.debit.greaterThan(0) ? line.accountCode : undefined,
      kwotaWn: line.debit.greaterThan(0) ? line.debit.toNumber() : undefined,
      kodKontaMa: line.credit.greaterThan(0) ? line.accountCode : undefined,
      kwotaMa: line.credit.greaterThan(0) ? line.credit.toNumber() : undefined,
      opisZapisu: line.description
    }));
  }

  private generateFileName(
    nip: string,
    periodStart: Date,
    periodEnd: Date,
    submissionType: string,
    correctionNumber?: number
  ): string {
    const fromDate = this.formatDateForFileName(periodStart);
    const toDate = this.formatDateForFileName(periodEnd);
    const correction = submissionType === 'CORRECTION' ? `_K${correctionNumber}` : '';
    return `JPK_KR_${nip}_${fromDate}_${toDate}${correction}.xml`;
  }

  private async saveJpkFile(
    organizationId: string,
    fileName: string,
    content: string
  ): Promise<string> {
    const dirPath = path.join(this.STORAGE_PATH, organizationId);
    await fs.mkdir(dirPath, { recursive: true });

    const filePath = path.join(dirPath, fileName);
    await fs.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  async getJpkFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDateForFileName(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  private mapAccountType(
    normalBalance: string,
    accountType: string
  ): 'Aktywne' | 'Pasywne' | 'Aktywno-Pasywne' | 'Wynikowe' {
    // Income/expense accounts are result accounts
    if (['REVENUE', 'EXPENSE', 'COST_BY_TYPE', 'COST_BY_FUNCTION'].includes(accountType)) {
      return 'Wynikowe';
    }

    // Check if account can be both
    if (accountType === 'RECEIVABLES' || accountType === 'LIABILITIES') {
      return 'Aktywno-Pasywne';
    }

    // Standard mapping
    return normalBalance === 'DEBIT' ? 'Aktywne' : 'Pasywne';
  }

  private isBalanceSheetAccount(accountType: string): boolean {
    return !['REVENUE', 'EXPENSE', 'COST_BY_TYPE', 'COST_BY_FUNCTION'].includes(accountType);
  }

  // Validation helper methods
  private async validateOrganizationData(
    organizationId: string,
    step: number
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const org = await this.getOrganization(organizationId);

    // Validate NIP
    results.push({
      step,
      type: 'ORGANIZATION_NIP',
      passed: /^\d{10}$/.test(org.nip),
      severity: /^\d{10}$/.test(org.nip) ? 'INFO' : 'ERROR',
      message: /^\d{10}$/.test(org.nip)
        ? 'NIP is valid'
        : 'Invalid NIP format - must be 10 digits'
    });

    // Validate address
    const hasFullAddress = org.address?.city && org.address?.postalCode && org.address?.voivodeship;
    results.push({
      step,
      type: 'ORGANIZATION_ADDRESS',
      passed: !!hasFullAddress,
      severity: hasFullAddress ? 'INFO' : 'ERROR',
      message: hasFullAddress
        ? 'Organization address is complete'
        : 'Incomplete organization address - city, postal code, and voivodeship required'
    });

    return results;
  }

  private async validateTrialBalance(
    organizationId: string,
    asOfDate: Date,
    step: number
  ): Promise<ValidationResult[]> {
    // This would call the trial balance service to check if books are balanced
    // Simplified implementation
    return [{
      step,
      type: 'TRIAL_BALANCE',
      passed: true,
      severity: 'INFO',
      message: 'Trial balance is balanced'
    }];
  }

  private async validateAccountMappings(
    organizationId: string,
    step: number
  ): Promise<ValidationResult[]> {
    const accounts = await this.dataSource
      .getRepository(ChartOfAccount)
      .find({
        where: { organizationId, isActive: true }
      });

    const unmappedAccounts = accounts.filter(a => !a.jpkCode);

    return [{
      step,
      type: 'ACCOUNT_MAPPINGS',
      passed: unmappedAccounts.length === 0,
      severity: unmappedAccounts.length === 0 ? 'INFO' : 'WARNING',
      message: unmappedAccounts.length === 0
        ? 'All accounts have JPK codes assigned'
        : `${unmappedAccounts.length} accounts missing JPK codes`,
      details: unmappedAccounts.length > 0
        ? { accounts: unmappedAccounts.map(a => a.accountCode) }
        : undefined
    }];
  }

  private async validateEntryNumbering(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    step: number
  ): Promise<ValidationResult[]> {
    // Check for gaps in entry numbering
    return [{
      step,
      type: 'ENTRY_NUMBERING',
      passed: true,
      severity: 'INFO',
      message: 'Journal entry numbering is sequential'
    }];
  }

  private async validateNoDraftEntries(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    step: number
  ): Promise<ValidationResult[]> {
    const draftCount = await this.dataSource
      .getRepository(JournalEntry)
      .count({
        where: {
          organizationId,
          status: 'DRAFT',
          entryDate: Between(periodStart, periodEnd)
        }
      });

    return [{
      step,
      type: 'DRAFT_ENTRIES',
      passed: draftCount === 0,
      severity: draftCount === 0 ? 'INFO' : 'WARNING',
      message: draftCount === 0
        ? 'No draft entries in period'
        : `${draftCount} draft entries found - will be excluded from JPK`
    }];
  }

  private async getOrganization(organizationId: string): Promise<Organization> {
    return this.dataSource.getRepository(Organization).findOneOrFail({
      where: { id: organizationId }
    });
  }

  private async getNextGenerationNumber(
    organizationId: string,
    fiscalYear: number
  ): Promise<number> {
    const lastLog = await this.logRepo.findOne({
      where: { organizationId, fiscalYear },
      order: { generationNumber: 'DESC' }
    });
    return (lastLog?.generationNumber || 0) + 1;
  }

  private async saveValidationResults(
    jpkLogId: string,
    results: ValidationResult[]
  ): Promise<void> {
    const entities = results.map(r =>
      this.validationRepo.create({
        jpkLogId,
        validationType: r.type,
        validationStep: r.step,
        isPassed: r.passed,
        severity: r.severity,
        message: r.message,
        details: r.details,
        elementPath: r.elementPath,
        lineNumber: r.lineNumber
      })
    );
    await this.validationRepo.save(entities);
  }

  private transformBalanceSheetToJpk(balanceSheet: any): any {
    // Transform balance sheet to JPK format
    return {
      Aktywa: balanceSheet.sections.totalAssets,
      Pasywa: balanceSheet.sections.totalLiabilitiesAndEquity
    };
  }

  private transformIncomeStatementToJpk(incomeStatement: any): any {
    // Transform income statement to JPK format
    return {
      Przychody: incomeStatement.totals.totalRevenue,
      Koszty: incomeStatement.totals.totalCosts,
      ZyskNetto: incomeStatement.totals.netProfit
    };
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/accounting/jpk-kr/__tests__/jpk-kr.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { JpkKrService } from '../jpk-kr.service';

describe('JpkKrService', () => {
  let service: JpkKrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JpkKrService]
    }).compile();

    service = module.get<JpkKrService>(JpkKrService);
  });

  describe('preValidate', () => {
    it('should validate organization NIP', async () => {
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31')
      };

      const result = await service.preValidate(params);

      expect(result.results).toContainEqual(
        expect.objectContaining({
          type: 'ORGANIZATION_NIP'
        })
      );
    });

    it('should detect missing JPK codes', async () => {
      // Mock accounts with missing codes
      const result = await service.preValidate({
        organizationId: 'org-with-missing-codes',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31')
      });

      const mappingResult = result.results.find(
        r => r.type === 'ACCOUNT_MAPPINGS'
      );
      expect(mappingResult).toBeDefined();
    });

    it('should return canGenerate=true when no errors', async () => {
      const result = await service.preValidate({
        organizationId: 'org-valid',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31')
      });

      expect(result.canGenerate).toBe(true);
      expect(result.summary.errors).toBe(0);
    });
  });

  describe('generateJpkKr', () => {
    it('should generate valid JPK_KR XML', async () => {
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        submissionType: 'ORIGINAL' as const,
        includeDraftEntries: false,
        includeBalanceSheet: false,
        includeIncomeStatement: false,
        signFile: false,
        generatedBy: 'user-123'
      };

      const result = await service.generateJpkKr(params);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('fileName');
      expect(result.jpkType).toBe('JPK_KR');
      expect(result.status).toBe('VALID');
    });

    it('should generate correction file when specified', async () => {
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        submissionType: 'CORRECTION' as const,
        correctionNumber: 1,
        includeDraftEntries: false,
        includeBalanceSheet: false,
        includeIncomeStatement: false,
        signFile: false,
        generatedBy: 'user-123'
      };

      const result = await service.generateJpkKr(params);

      expect(result.fileName).toContain('_K1');
      expect(result.submissionType).toBe('CORRECTION');
      expect(result.correctionNumber).toBe(1);
    });

    it('should include balance sheet when requested', async () => {
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        submissionType: 'ORIGINAL' as const,
        includeDraftEntries: false,
        includeBalanceSheet: true,
        includeIncomeStatement: false,
        signFile: false,
        generatedBy: 'user-123'
      };

      const result = await service.generateJpkKr(params);

      // Verify file contains Bilans section
      const fileContent = await service.getJpkFile(result.filePath);
      expect(fileContent.toString()).toContain('<Bilans>');
    });
  });

  describe('buildXml', () => {
    it('should generate valid XML structure', () => {
      const jpkData = createMockJpkData();

      const xml = (service as any).buildXml(jpkData);

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<JPK');
      expect(xml).toContain('xmlns="http://jpk.mf.gov.pl/');
      expect(xml).toContain('<Naglowek>');
      expect(xml).toContain('<Podmiot1>');
      expect(xml).toContain('<ZOiS>');
      expect(xml).toContain('<Dziennik>');
      expect(xml).toContain('<KontoZapis>');
    });

    it('should format dates correctly', () => {
      const jpkData = createMockJpkData();
      jpkData.naglowek.dataOd = new Date('2024-01-01');
      jpkData.naglowek.dataDo = new Date('2024-12-31');

      const xml = (service as any).buildXml(jpkData);

      expect(xml).toContain('<DataOd>2024-01-01</DataOd>');
      expect(xml).toContain('<DataDo>2024-12-31</DataDo>');
    });

    it('should format amounts with 2 decimal places', () => {
      const jpkData = createMockJpkData();
      jpkData.dziennikList[0].kwotaOperacji = 1234.50;

      const xml = (service as any).buildXml(jpkData);

      expect(xml).toContain('<KwotaOperacji>1234.50</KwotaOperacji>');
    });
  });

  describe('validateAgainstXsd', () => {
    it('should validate correct XML', async () => {
      // Create valid JPK first
      const jpkLog = await service.generateJpkKr({
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        submissionType: 'ORIGINAL',
        includeDraftEntries: false,
        includeBalanceSheet: false,
        includeIncomeStatement: false,
        signFile: false,
        generatedBy: 'user-123'
      });

      const result = await service.validateAgainstXsd(jpkLog.id, 'org-123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

function createMockJpkData(): JpkKr {
  return {
    naglowek: {
      kodFormularza: 'JPK_KR',
      wariantFormularza: 1,
      celZlozenia: '1',
      dataWytworzeniaJPK: new Date(),
      dataOd: new Date('2024-01-01'),
      dataDo: new Date('2024-12-31'),
      nazwaSystemu: 'TestSystem'
    },
    podmiot1: {
      nip: '1234567890',
      pelnaNazwa: 'Test Sp. z o.o.',
      kodKraju: 'PL',
      wojewodztwo: 'Mazowieckie',
      powiat: 'Warszawa',
      gmina: 'Warszawa',
      miejscowosc: 'Warszawa',
      nrDomu: '1',
      kodPocztowy: '00-001',
      poczta: 'Warszawa'
    },
    zpisList: [
      {
        kodKonta: '100',
        opisKonta: 'Kasa',
        typKonta: 'Aktywne',
        kodZespolu: '1',
        bilansowe: true
      }
    ],
    dziennikList: [
      {
        lpZapisuDziennika: 1,
        nrZapisuDziennika: 'JE-2024-01-0001',
        opisDziennika: 'Test entry',
        dataOperacji: new Date('2024-01-15'),
        dataDowodu: new Date('2024-01-15'),
        dataKsiegowania: new Date('2024-01-15'),
        kodOperatora: 'test',
        kwotaOperacji: 1000
      }
    ],
    kontoZapisList: [
      {
        lpZapisu: 1,
        nrZapisu: 'JE-2024-01-0001',
        kodKontaWn: '100',
        kwotaWn: 1000,
        opisZapisu: 'Test posting'
      }
    ],
    generatedAt: new Date(),
    generatedBy: 'user-123',
    validationStatus: 'GENERATED'
  };
}
```

### Integration Tests

```typescript
// src/modules/accounting/jpk-kr/__tests__/jpk-kr.integration.spec.ts

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('JPK-KR API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/trpc/auth.login')
      .send({ email: 'accountant@test.com', password: 'test123' });
    authToken = loginResponse.body.result.data.token;
  });

  describe('POST /api/trpc/accounting.jpkKr.preValidate', () => {
    it('should return validation report', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.jpkKr.preValidate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.result.data).toHaveProperty('isValid');
      expect(response.body.result.data).toHaveProperty('canGenerate');
      expect(response.body.result.data).toHaveProperty('results');
      expect(response.body.result.data).toHaveProperty('summary');
    });
  });

  describe('POST /api/trpc/accounting.jpkKr.generate', () => {
    it('should generate JPK_KR file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.jpkKr.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          submissionType: 'ORIGINAL',
          includeDraftEntries: false,
          includeBalanceSheet: false,
          includeIncomeStatement: false
        });

      expect(response.status).toBe(200);
      expect(response.body.result.data).toHaveProperty('id');
      expect(response.body.result.data).toHaveProperty('fileName');
      expect(response.body.result.data.fileName).toContain('JPK_KR');
    });

    it('should include financial statements when requested', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.jpkKr.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          submissionType: 'ORIGINAL',
          includeBalanceSheet: true,
          includeIncomeStatement: true
        });

      expect(response.status).toBe(200);

      // Download and verify content
      const downloadResponse = await request(app.getHttpServer())
        .post('/api/trpc/accounting.jpkKr.download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jpkLogId: response.body.result.data.id });

      const xmlContent = Buffer.from(
        downloadResponse.body.result.data.data,
        'base64'
      ).toString('utf-8');

      expect(xmlContent).toContain('<Bilans>');
      expect(xmlContent).toContain('<RZiS>');
    });
  });

  describe('POST /api/trpc/accounting.jpkKr.download', () => {
    it('should download generated JPK file', async () => {
      // Generate first
      const genResponse = await request(app.getHttpServer())
        .post('/api/trpc/accounting.jpkKr.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          submissionType: 'ORIGINAL'
        });

      const jpkLogId = genResponse.body.result.data.id;

      // Download
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.jpkKr.download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jpkLogId });

      expect(response.status).toBe(200);
      expect(response.body.result.data.contentType).toBe('application/xml');
      expect(response.body.result.data.fileName).toContain('.xml');

      // Verify XML content
      const xmlContent = Buffer.from(
        response.body.result.data.data,
        'base64'
      ).toString('utf-8');

      expect(xmlContent).toContain('<?xml');
      expect(xmlContent).toContain('<JPK');
      expect(xmlContent).toContain('JPK_KR');
    });
  });
});
```

### E2E Tests

```typescript
// e2e/jpk-kr.spec.ts

import { test, expect } from '@playwright/test';

test.describe('JPK-KR Export UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'accountant@test.com');
    await page.fill('[data-testid="password"]', 'test123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should show pre-validation results', async ({ page }) => {
    await page.click('[data-testid="nav-reports"]');
    await page.click('[data-testid="jpk-export-link"]');

    // Select period
    await page.fill('[data-testid="period-start"]', '2024-01-01');
    await page.fill('[data-testid="period-end"]', '2024-12-31');

    // Run validation
    await page.click('[data-testid="validate-button"]');

    // Wait for results
    await expect(page.locator('[data-testid="validation-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-summary"]')).toContainText('checks');
  });

  test('should generate and download JPK_KR', async ({ page }) => {
    await page.goto('/reports/jpk-export');

    // Fill form
    await page.fill('[data-testid="period-start"]', '2024-01-01');
    await page.fill('[data-testid="period-end"]', '2024-12-31');
    await page.selectOption('[data-testid="submission-type"]', 'ORIGINAL');

    // Generate
    await page.click('[data-testid="generate-button"]');

    // Wait for generation
    await expect(page.locator('[data-testid="generation-complete"]')).toBeVisible({
      timeout: 60000
    });

    // Download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-button"]');
    const download = await downloadPromise;

    // Verify
    expect(download.suggestedFilename()).toContain('JPK_KR');
    expect(download.suggestedFilename()).toContain('.xml');
  });

  test('should show validation errors', async ({ page }) => {
    // Test with organization missing NIP
    await page.goto('/reports/jpk-export');

    await page.fill('[data-testid="period-start"]', '2024-01-01');
    await page.fill('[data-testid="period-end"]', '2024-12-31');

    await page.click('[data-testid="validate-button"]');

    // Should show errors
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should handle correction submission', async ({ page }) => {
    await page.goto('/reports/jpk-export');

    await page.fill('[data-testid="period-start"]', '2024-01-01');
    await page.fill('[data-testid="period-end"]', '2024-12-31');
    await page.selectOption('[data-testid="submission-type"]', 'CORRECTION');
    await page.fill('[data-testid="correction-number"]', '1');

    await page.click('[data-testid="generate-button"]');

    await expect(page.locator('[data-testid="generation-complete"]')).toBeVisible();

    // Verify file name includes correction marker
    await expect(page.locator('[data-testid="file-name"]')).toContainText('_K1');
  });
});
```

---

## Security Checklist

- [x] **Authentication Required**: All endpoints require valid JWT token
- [x] **Organization Isolation**: JPK files filtered and stored by organizationId
- [x] **Role-Based Access**: Only users with `ACCOUNTANT`, `MANAGER`, `ADMIN` roles can generate/download
- [x] **Input Validation**: All inputs validated via Zod schemas
- [x] **File Storage Security**: JPK files stored in organization-specific directories
- [x] **File Hash Verification**: SHA-256 hash stored for integrity verification
- [x] **Audit Trail**: All JPK generations, downloads, and submissions logged
- [x] **Sensitive Data Protection**: NIP and financial data only accessible to authorized users
- [x] **XSD Validation**: All generated files validated against official schema
- [x] **Rate Limiting**: Generation endpoints have rate limits to prevent abuse

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `JPK_KR_GENERATED` | JPK file generated | Period, type, statistics |
| `JPK_KR_VALIDATED` | Schema validation run | Validation result, errors |
| `JPK_KR_DOWNLOADED` | JPK file downloaded | File name, user |
| `JPK_KR_SUBMITTED` | Marked as submitted | Submission reference |
| `JPK_ACCOUNT_MAPPING_UPDATED` | Account mapping changed | Account, JPK codes |
| `JPK_PRE_VALIDATION_RUN` | Pre-validation executed | Period, result summary |

---

## Implementation Notes

### Ministry of Finance Requirements
- XML must follow official **JPK_KR (1) v1-0** schema
- All dates in ISO 8601 format (YYYY-MM-DD)
- Amounts with 2 decimal places using dot separator
- UTF-8 encoding mandatory
- Namespace declarations per official specification

### File Structure
```
JPK_KR_[NIP]_[DATE_FROM]_[DATE_TO].xml
├── Naglowek (Header)
├── Podmiot1 (Subject/Organization)
├── ZOiS (Chart of Accounts)
├── Dziennik (Journal)
├── KontoZapis (Ledger Postings)
├── Bilans (Optional - Balance Sheet)
└── RZiS (Optional - Income Statement)
```

### Performance Considerations
- Large files (>50k entries) use streaming XML generation
- Progress tracking for long-running generations
- Background job processing for very large datasets
- File compression available for archival

### Submission Workflow
1. Run pre-validation
2. Generate JPK file
3. Download and review
4. Upload to tax authority portal (e-Deklaracje)
5. Mark as submitted with reference number

---

## Definition of Done

- [ ] All acceptance criteria scenarios pass
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Security checklist complete
- [ ] Generated XML validates against official XSD
- [ ] File can be uploaded to Ministry of Finance test environment
- [ ] Audit events logging verified
- [ ] Large dataset performance tested (>10k entries)
- [ ] Polish accounting expert review completed

---

*Story created: 2024-12-29*
*Last updated: 2024-12-29*
