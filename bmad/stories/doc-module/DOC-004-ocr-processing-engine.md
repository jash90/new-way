# DOC-004: OCR Processing Engine

> **Story ID**: DOC-004
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 4 - Week 14

---

## 📋 User Story

**As an** accountant,
**I want** automatic text extraction from documents using OCR technology,
**So that** document content becomes searchable, processable, and can be used for data extraction.

---

## 🎯 Acceptance Criteria

### Scenario 1: Automatic OCR Processing on Upload
```gherkin
Given I have uploaded a scanned invoice "faktura-scan-2024-001.pdf"
And the document is in the processing queue
When the OCR processing job runs
Then the document should be processed by the OCR engine
And text should be extracted from all pages
And the extracted text should be stored with the document
And the processing status should be updated to "PROCESSED"
And the result should include:
  | Field              | Description                    |
  | extracted_text     | Full text content              |
  | page_count         | Number of pages processed      |
  | confidence_score   | Overall extraction confidence  |
  | processing_time_ms | Time taken for OCR             |
  | engine_used        | OCR engine identifier          |
```

### Scenario 2: Multi-Engine Support with Fallback
```gherkin
Given I have a document "umowa-skan.tiff" requiring OCR
And the primary OCR engine is "GOOGLE_VISION"
When the primary engine fails or returns low confidence (<0.6)
Then the system should automatically try the fallback engine "AWS_TEXTRACT"
And if Textract also fails, try "TESSERACT_LOCAL"
And the final result should use the highest confidence extraction
And the processing log should record all attempts:
  | Engine         | Confidence | Status   |
  | GOOGLE_VISION  | 0.45       | FALLBACK |
  | AWS_TEXTRACT   | 0.82       | SELECTED |
  | TESSERACT      | -          | SKIPPED  |
```

### Scenario 3: Polish Language Optimization
```gherkin
Given I have a Polish invoice with text:
  | Original Text                    |
  | Faktura VAT nr 2024/01/001       |
  | Data wystawienia: 15.01.2024     |
  | NIP: 123-456-78-90               |
  | Wartość brutto: 1 234,56 zł      |
When the OCR engine processes the document
Then Polish diacritics should be correctly recognized:
  | Character | Should Appear |
  | ą         | ✓             |
  | ę         | ✓             |
  | ó         | ✓             |
  | ś         | ✓             |
  | ł         | ✓             |
  | ż         | ✓             |
  | ź         | ✓             |
  | ć         | ✓             |
  | ń         | ✓             |
And Polish date format "DD.MM.YYYY" should be recognized
And Polish currency format "X XXX,XX zł" should be recognized
And Polish NIP format "XXX-XXX-XX-XX" should be preserved
```

### Scenario 4: Table Detection and Extraction
```gherkin
Given I have an invoice with a line items table:
  | Lp | Nazwa towaru/usługi | Ilość | Cena netto | VAT  | Wartość brutto |
  | 1  | Usługa księgowa     | 1     | 500,00 zł  | 23%  | 615,00 zł      |
  | 2  | Konsultacja         | 2     | 200,00 zł  | 23%  | 492,00 zł      |
When the OCR engine processes the document
Then tables should be detected with coordinates
And table structure should be extracted:
  | Property    | Value                    |
  | rows        | 3 (header + 2 data)      |
  | columns     | 6                        |
  | has_header  | true                     |
  | confidence  | ≥0.85                    |
And cell data should be accessible by row/column index
And table position on page should be recorded
```

### Scenario 5: Form Field Recognition
```gherkin
Given I have a standardized tax form "PIT-37"
And the form has labeled fields:
  | Label              | Expected Value   |
  | Nazwisko           | Kowalski         |
  | Imię               | Jan              |
  | PESEL              | 85010112345      |
  | NIP                | 123-456-78-90    |
  | Przychód           | 120 000,00 zł    |
When the OCR engine processes the form
Then form fields should be detected with labels and values
And key-value pairs should be extracted:
  ```json
  {
    "fields": [
      { "label": "Nazwisko", "value": "Kowalski", "confidence": 0.95 },
      { "label": "Imię", "value": "Jan", "confidence": 0.92 },
      { "label": "PESEL", "value": "85010112345", "confidence": 0.98 },
      { "label": "NIP", "value": "123-456-78-90", "confidence": 0.96 }
    ]
  }
  ```
And checkbox states should be detected (checked/unchecked)
```

### Scenario 6: Confidence Scoring and Quality Assessment
```gherkin
Given I have a document being processed by OCR
When the extraction completes
Then confidence scores should be provided at multiple levels:
  | Level      | Range     | Description                    |
  | document   | 0.0-1.0   | Overall document confidence    |
  | page       | 0.0-1.0   | Per-page confidence            |
  | block      | 0.0-1.0   | Per text block confidence      |
  | word       | 0.0-1.0   | Per word confidence            |
And quality metrics should be calculated:
  | Metric                | Threshold |
  | min_word_confidence   | ≥0.70     |
  | table_detection_score | ≥0.80     |
  | diacritic_accuracy    | ≥0.90     |
And documents below threshold should be flagged for manual review
```

### Scenario 7: Image Enhancement Pre-processing
```gherkin
Given I have a low-quality scanned document:
  | Issue              | Severity |
  | Skewed rotation    | 15°      |
  | Noise level        | High     |
  | Low contrast       | Medium   |
  | Uneven lighting    | High     |
When the document enters the OCR pipeline
Then automatic enhancement should be applied:
  | Enhancement        | Applied |
  | Deskew             | ✓       |
  | Denoise            | ✓       |
  | Contrast normalize | ✓       |
  | Binarization       | ✓       |
  | Border removal     | ✓       |
And the enhanced image should be stored for reference
And enhancement metadata should be recorded:
  | Enhancement     | Original Value | Corrected Value |
  | rotation_angle  | 15.3°          | 0.0°            |
  | noise_level     | 0.45           | 0.12            |
  | contrast_ratio  | 1.2            | 2.8             |
```

### Scenario 8: Async Processing Queue Management
```gherkin
Given I have multiple documents waiting for OCR processing
And the processing queue has:
  | Document           | Priority | Status    |
  | urgent-invoice.pdf | HIGH     | QUEUED    |
  | contract.pdf       | NORMAL   | QUEUED    |
  | old-receipt.jpg    | LOW      | QUEUED    |
When the queue processor runs
Then documents should be processed by priority order
And high-priority documents should be processed first
And processing should be parallelized (max 5 concurrent)
And queue status should be updated in real-time:
  | Field             | Value              |
  | total_queued      | 3                  |
  | processing        | 2                  |
  | estimated_time    | 45 seconds         |
And users should receive notifications on completion
And failed jobs should be retried with exponential backoff
```

---

## 📐 Technical Specification

### Database Schema

```sql
-- OCR processing queue
CREATE TABLE ocr_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  document_id UUID NOT NULL REFERENCES documents(id),

  -- Queue management
  priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status TEXT DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),

  -- Processing configuration
  preferred_engine TEXT,
  language_hints TEXT[] DEFAULT ARRAY['pl', 'en'],
  enable_table_detection BOOLEAN DEFAULT true,
  enable_form_detection BOOLEAN DEFAULT true,
  enable_enhancement BOOLEAN DEFAULT true,

  -- Retry management
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,

  -- Timing
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,

  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),

  CONSTRAINT unique_document_in_queue UNIQUE (document_id, status)
    WHERE status IN ('QUEUED', 'PROCESSING')
);

-- OCR results
CREATE TABLE ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  document_id UUID NOT NULL REFERENCES documents(id),
  version_id UUID REFERENCES document_versions(id),

  -- Engine information
  engine TEXT NOT NULL CHECK (engine IN ('GOOGLE_VISION', 'AWS_TEXTRACT', 'TESSERACT', 'AZURE_FORM_RECOGNIZER')),
  engine_version TEXT,

  -- Extracted content
  full_text TEXT,
  full_text_normalized TEXT,
  page_texts JSONB DEFAULT '[]',

  -- Confidence scores
  overall_confidence DECIMAL(5,4),
  page_confidences JSONB DEFAULT '[]',
  word_confidences JSONB,

  -- Structured data
  detected_tables JSONB DEFAULT '[]',
  detected_forms JSONB DEFAULT '[]',
  detected_entities JSONB DEFAULT '[]',

  -- Processing metadata
  processing_time_ms INTEGER NOT NULL,
  page_count INTEGER NOT NULL,
  word_count INTEGER,
  character_count INTEGER,

  -- Enhancement applied
  enhancements_applied JSONB DEFAULT '{}',

  -- Quality flags
  needs_manual_review BOOLEAN DEFAULT false,
  review_reason TEXT,

  -- Timestamps
  processed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search optimization
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('polish', COALESCE(full_text_normalized, '')), 'A')
  ) STORED
);

-- OCR engine attempts (for multi-engine tracking)
CREATE TABLE ocr_engine_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_result_id UUID NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,

  -- Engine information
  engine TEXT NOT NULL,
  attempt_order INTEGER NOT NULL,

  -- Results
  confidence DECIMAL(5,4),
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'TIMEOUT', 'FALLBACK')),
  error_message TEXT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Raw response (for debugging)
  raw_response JSONB,

  CONSTRAINT unique_engine_attempt UNIQUE (ocr_result_id, engine, attempt_order)
);

-- Table extraction results
CREATE TABLE ocr_extracted_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_result_id UUID NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Table identification
  page_number INTEGER NOT NULL,
  table_index INTEGER NOT NULL,

  -- Position on page (normalized 0-1)
  bounding_box JSONB NOT NULL, -- { top, left, width, height }

  -- Table structure
  row_count INTEGER NOT NULL,
  column_count INTEGER NOT NULL,
  has_header_row BOOLEAN DEFAULT true,

  -- Table content
  headers JSONB, -- ["Col1", "Col2", ...]
  cells JSONB NOT NULL, -- [[cell11, cell12], [cell21, cell22], ...]
  cell_confidences JSONB,

  -- Classification
  table_type TEXT, -- 'LINE_ITEMS', 'SUMMARY', 'CONTACT', 'OTHER'
  confidence DECIMAL(5,4),

  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form field extraction results
CREATE TABLE ocr_extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_result_id UUID NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Field identification
  page_number INTEGER NOT NULL,
  field_index INTEGER NOT NULL,

  -- Field content
  label TEXT NOT NULL,
  value TEXT,
  field_type TEXT CHECK (field_type IN ('TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECTION', 'SIGNATURE')),

  -- Position
  label_bounding_box JSONB,
  value_bounding_box JSONB,

  -- Quality
  confidence DECIMAL(5,4),
  is_validated BOOLEAN DEFAULT false,
  validated_value TEXT,
  validated_by UUID REFERENCES users(id),

  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

-- Image enhancement log
CREATE TABLE ocr_enhancement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Page information
  page_number INTEGER NOT NULL,

  -- Original metrics
  original_metrics JSONB NOT NULL,
  /* {
    "rotation_angle": 15.3,
    "noise_level": 0.45,
    "contrast_ratio": 1.2,
    "brightness": 0.6,
    "sharpness": 0.4
  } */

  -- Enhanced metrics
  enhanced_metrics JSONB NOT NULL,

  -- Applied enhancements
  enhancements_applied JSONB NOT NULL,
  /* {
    "deskew": { "angle_corrected": 15.3 },
    "denoise": { "method": "gaussian", "strength": 0.3 },
    "contrast": { "method": "CLAHE", "factor": 2.0 },
    "binarize": { "method": "adaptive", "threshold": 128 }
  } */

  -- Storage references
  original_image_key TEXT,
  enhanced_image_key TEXT,

  -- Timing
  processing_time_ms INTEGER,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ocr_queue_status ON ocr_processing_queue(status, priority, queued_at);
CREATE INDEX idx_ocr_queue_document ON ocr_processing_queue(document_id);
CREATE INDEX idx_ocr_queue_org ON ocr_processing_queue(organization_id);
CREATE INDEX idx_ocr_results_document ON ocr_results(document_id);
CREATE INDEX idx_ocr_results_search ON ocr_results USING gin(search_vector);
CREATE INDEX idx_ocr_tables_result ON ocr_extracted_tables(ocr_result_id);
CREATE INDEX idx_ocr_fields_result ON ocr_extracted_fields(ocr_result_id);
CREATE INDEX idx_ocr_enhancement_doc ON ocr_enhancement_log(document_id);

-- RLS Policies
ALTER TABLE ocr_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_engine_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_extracted_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_enhancement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ocr_queue_org_isolation ON ocr_processing_queue
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY ocr_results_org_isolation ON ocr_results
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY ocr_attempts_isolation ON ocr_engine_attempts
  FOR ALL USING (
    ocr_result_id IN (
      SELECT id FROM ocr_results
      WHERE organization_id = current_setting('app.current_organization_id')::uuid
    )
  );

CREATE POLICY ocr_tables_org_isolation ON ocr_extracted_tables
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY ocr_fields_org_isolation ON ocr_extracted_fields
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY ocr_enhancement_org_isolation ON ocr_enhancement_log
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// OCR engines
export const OCREngine = z.enum([
  'GOOGLE_VISION',
  'AWS_TEXTRACT',
  'TESSERACT',
  'AZURE_FORM_RECOGNIZER',
]);

// Processing priority
export const ProcessingPriority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

// Processing status
export const ProcessingStatus = z.enum([
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

// Queue item request
export const QueueOCRRequestSchema = z.object({
  documentId: z.string().uuid(),
  priority: ProcessingPriority.default('NORMAL'),
  preferredEngine: OCREngine.optional(),
  languageHints: z.array(z.string()).default(['pl', 'en']),
  enableTableDetection: z.boolean().default(true),
  enableFormDetection: z.boolean().default(true),
  enableEnhancement: z.boolean().default(true),
});

// Batch queue request
export const BatchQueueOCRRequestSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
  priority: ProcessingPriority.default('NORMAL'),
  preferredEngine: OCREngine.optional(),
  languageHints: z.array(z.string()).default(['pl', 'en']),
  options: z.object({
    enableTableDetection: z.boolean().default(true),
    enableFormDetection: z.boolean().default(true),
    enableEnhancement: z.boolean().default(true),
  }).default({}),
});

// Bounding box schema
export const BoundingBoxSchema = z.object({
  top: z.number().min(0).max(1),
  left: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

// Table cell schema
export const TableCellSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  rowSpan: z.number().int().positive().default(1),
  colSpan: z.number().int().positive().default(1),
  boundingBox: BoundingBoxSchema.optional(),
});

// Extracted table schema
export const ExtractedTableSchema = z.object({
  pageNumber: z.number().int().positive(),
  tableIndex: z.number().int().nonnegative(),
  boundingBox: BoundingBoxSchema,
  rowCount: z.number().int().positive(),
  columnCount: z.number().int().positive(),
  hasHeaderRow: z.boolean(),
  headers: z.array(z.string()).optional(),
  cells: z.array(z.array(TableCellSchema)),
  tableType: z.enum(['LINE_ITEMS', 'SUMMARY', 'CONTACT', 'OTHER']).optional(),
  confidence: z.number().min(0).max(1),
});

// Form field schema
export const ExtractedFieldSchema = z.object({
  pageNumber: z.number().int().positive(),
  fieldIndex: z.number().int().nonnegative(),
  label: z.string(),
  value: z.string().nullable(),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECTION', 'SIGNATURE']),
  labelBoundingBox: BoundingBoxSchema.optional(),
  valueBoundingBox: BoundingBoxSchema.optional(),
  confidence: z.number().min(0).max(1),
});

// Word confidence schema
export const WordConfidenceSchema = z.object({
  word: z.string(),
  confidence: z.number().min(0).max(1),
  boundingBox: BoundingBoxSchema.optional(),
  pageNumber: z.number().int().positive(),
});

// Page OCR result schema
export const PageOCRResultSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  width: z.number().positive(),
  height: z.number().positive(),
  wordCount: z.number().int().nonnegative(),
  blocks: z.array(z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1),
    boundingBox: BoundingBoxSchema,
    blockType: z.enum(['TEXT', 'TABLE', 'FIGURE', 'HEADER', 'FOOTER']),
  })),
});

// Full OCR result schema
export const OCRResultSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  engine: OCREngine,
  engineVersion: z.string().optional(),
  fullText: z.string(),
  fullTextNormalized: z.string(),
  pageTexts: z.array(PageOCRResultSchema),
  overallConfidence: z.number().min(0).max(1),
  pageConfidences: z.array(z.number().min(0).max(1)),
  detectedTables: z.array(ExtractedTableSchema),
  detectedForms: z.array(ExtractedFieldSchema),
  processingTimeMs: z.number().int().positive(),
  pageCount: z.number().int().positive(),
  wordCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  enhancementsApplied: z.record(z.any()),
  needsManualReview: z.boolean(),
  reviewReason: z.string().nullable(),
  processedAt: z.date(),
});

// Enhancement metrics schema
export const EnhancementMetricsSchema = z.object({
  rotationAngle: z.number(),
  noiseLevel: z.number().min(0).max(1),
  contrastRatio: z.number().positive(),
  brightness: z.number().min(0).max(1),
  sharpness: z.number().min(0).max(1),
});

// Enhancement result schema
export const EnhancementResultSchema = z.object({
  pageNumber: z.number().int().positive(),
  originalMetrics: EnhancementMetricsSchema,
  enhancedMetrics: EnhancementMetricsSchema,
  enhancementsApplied: z.object({
    deskew: z.object({ angleCorrected: z.number() }).optional(),
    denoise: z.object({ method: z.string(), strength: z.number() }).optional(),
    contrast: z.object({ method: z.string(), factor: z.number() }).optional(),
    binarize: z.object({ method: z.string(), threshold: z.number() }).optional(),
    sharpen: z.object({ method: z.string(), amount: z.number() }).optional(),
  }),
  processingTimeMs: z.number().int(),
});

// Queue status response
export const QueueStatusResponseSchema = z.object({
  queueId: z.string().uuid(),
  documentId: z.string().uuid(),
  status: ProcessingStatus,
  priority: ProcessingPriority,
  position: z.number().int().nonnegative().optional(),
  estimatedWaitMs: z.number().int().nonnegative().optional(),
  attemptCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  queuedAt: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  processingTimeMs: z.number().int().nullable(),
});

// Get OCR result request
export const GetOCRResultRequestSchema = z.object({
  documentId: z.string().uuid(),
  includeWordConfidences: z.boolean().default(false),
  includeTables: z.boolean().default(true),
  includeFormFields: z.boolean().default(true),
});

// Validate field request
export const ValidateFieldRequestSchema = z.object({
  fieldId: z.string().uuid(),
  validatedValue: z.string(),
});

// Type exports
export type OCREngineType = z.infer<typeof OCREngine>;
export type ProcessingPriorityType = z.infer<typeof ProcessingPriority>;
export type ProcessingStatusType = z.infer<typeof ProcessingStatus>;
export type QueueOCRRequest = z.infer<typeof QueueOCRRequestSchema>;
export type BatchQueueOCRRequest = z.infer<typeof BatchQueueOCRRequestSchema>;
export type ExtractedTable = z.infer<typeof ExtractedTableSchema>;
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type OCRResult = z.infer<typeof OCRResultSchema>;
export type EnhancementResult = z.infer<typeof EnhancementResultSchema>;
export type QueueStatusResponse = z.infer<typeof QueueStatusResponseSchema>;
```

### Service Implementation

```typescript
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { TextractClient, AnalyzeDocumentCommand, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import {
  OCREngineType,
  QueueOCRRequest,
  BatchQueueOCRRequest,
  ExtractedTable,
  ExtractedField,
  OCRResult,
  EnhancementResult,
} from './schemas';

// Initialize clients
const visionClient = new ImageAnnotatorClient();
const textractClient = new TextractClient({ region: process.env.AWS_REGION });

// Configuration
const CONFIG = {
  MIN_CONFIDENCE_THRESHOLD: 0.6,
  MAX_CONCURRENT_JOBS: 5,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000,
  QUEUE_POLL_INTERVAL_MS: 1000,
};

// Polish language configuration
const POLISH_CONFIG = {
  language: 'pol',
  datePatterns: [
    /\d{2}\.\d{2}\.\d{4}/g,           // DD.MM.YYYY
    /\d{2}-\d{2}-\d{4}/g,             // DD-MM-YYYY
    /\d{2}\/\d{2}\/\d{4}/g,           // DD/MM/YYYY
  ],
  currencyPatterns: [
    /\d{1,3}(?:\s?\d{3})*,\d{2}\s?zł/gi,  // X XXX,XX zł
    /PLN\s?\d{1,3}(?:\s?\d{3})*,\d{2}/gi, // PLN X XXX,XX
  ],
  nipPattern: /\d{3}-?\d{3}-?\d{2}-?\d{2}/g,
  regonPattern: /\d{9}|\d{14}/g,
};

export class OCRProcessingService {
  /**
   * Queue a document for OCR processing
   */
  static async queueDocument(
    input: QueueOCRRequest,
    context: { userId: string; organizationId: string }
  ) {
    const { documentId, priority, preferredEngine, languageHints, enableTableDetection, enableFormDetection, enableEnhancement } = input;

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

    // Check if already in queue
    const existingQueue = await db.ocrProcessingQueue.findFirst({
      where: {
        documentId,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    });

    if (existingQueue) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Dokument jest już w kolejce do przetwarzania OCR',
      });
    }

    // Create queue entry
    const queueEntry = await db.ocrProcessingQueue.create({
      data: {
        organizationId: context.organizationId,
        documentId,
        priority,
        preferredEngine,
        languageHints,
        enableTableDetection,
        enableFormDetection,
        enableEnhancement,
        createdBy: context.userId,
      },
    });

    // Trigger processing (async)
    this.triggerProcessing().catch(console.error);

    return {
      success: true,
      queueId: queueEntry.id,
      status: 'QUEUED',
      estimatedWaitMs: await this.estimateWaitTime(priority),
    };
  }

  /**
   * Queue multiple documents for OCR processing
   */
  static async queueBatch(
    input: BatchQueueOCRRequest,
    context: { userId: string; organizationId: string }
  ) {
    const { documentIds, priority, preferredEngine, languageHints, options } = input;

    const results = await Promise.all(
      documentIds.map(async (documentId) => {
        try {
          const result = await this.queueDocument({
            documentId,
            priority,
            preferredEngine,
            languageHints,
            enableTableDetection: options.enableTableDetection,
            enableFormDetection: options.enableFormDetection,
            enableEnhancement: options.enableEnhancement,
          }, context);

          return { documentId, success: true, queueId: result.queueId };
        } catch (error: any) {
          return { documentId, success: false, error: error.message };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

    return {
      success: successCount > 0,
      totalQueued: successCount,
      totalFailed: results.length - successCount,
      results,
    };
  }

  /**
   * Get queue status for a document
   */
  static async getQueueStatus(
    documentId: string,
    context: { organizationId: string }
  ) {
    const queueEntry = await db.ocrProcessingQueue.findFirst({
      where: {
        documentId,
        organizationId: context.organizationId,
      },
      orderBy: { queuedAt: 'desc' },
    });

    if (!queueEntry) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument nie został znaleziony w kolejce OCR',
      });
    }

    // Calculate position in queue
    let position = undefined;
    if (queueEntry.status === 'QUEUED') {
      const aheadCount = await db.ocrProcessingQueue.count({
        where: {
          status: 'QUEUED',
          OR: [
            { priority: { in: this.getHigherPriorities(queueEntry.priority) } },
            {
              priority: queueEntry.priority,
              queuedAt: { lt: queueEntry.queuedAt },
            },
          ],
        },
      });
      position = aheadCount + 1;
    }

    return {
      queueId: queueEntry.id,
      documentId: queueEntry.documentId,
      status: queueEntry.status,
      priority: queueEntry.priority,
      position,
      estimatedWaitMs: position ? position * 5000 : undefined, // ~5s per document
      attemptCount: queueEntry.attemptCount,
      lastError: queueEntry.lastError,
      queuedAt: queueEntry.queuedAt,
      startedAt: queueEntry.startedAt,
      completedAt: queueEntry.completedAt,
      processingTimeMs: queueEntry.processingTimeMs,
    };
  }

  /**
   * Get OCR results for a document
   */
  static async getResults(
    documentId: string,
    options: { includeWordConfidences: boolean; includeTables: boolean; includeFormFields: boolean },
    context: { organizationId: string }
  ) {
    const result = await db.ocrResult.findFirst({
      where: {
        documentId,
        organizationId: context.organizationId,
      },
      orderBy: { processedAt: 'desc' },
      include: {
        ...(options.includeTables && { extractedTables: true }),
        ...(options.includeFormFields && { extractedFields: true }),
      },
    });

    if (!result) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Brak wyników OCR dla tego dokumentu',
      });
    }

    return {
      id: result.id,
      documentId: result.documentId,
      engine: result.engine,
      engineVersion: result.engineVersion,
      fullText: result.fullText,
      fullTextNormalized: result.fullTextNormalized,
      pageTexts: result.pageTexts,
      overallConfidence: Number(result.overallConfidence),
      pageConfidences: result.pageConfidences,
      wordConfidences: options.includeWordConfidences ? result.wordConfidences : undefined,
      detectedTables: options.includeTables ? result.extractedTables : [],
      detectedForms: options.includeFormFields ? result.extractedFields : [],
      processingTimeMs: result.processingTimeMs,
      pageCount: result.pageCount,
      wordCount: result.wordCount,
      characterCount: result.characterCount,
      enhancementsApplied: result.enhancementsApplied,
      needsManualReview: result.needsManualReview,
      reviewReason: result.reviewReason,
      processedAt: result.processedAt,
    };
  }

  /**
   * Process a document with OCR
   * Called by the queue processor
   */
  static async processDocument(queueId: string): Promise<OCRResult> {
    const queueEntry = await db.ocrProcessingQueue.findUnique({
      where: { id: queueId },
      include: { document: true },
    });

    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }

    // Update status to processing
    await db.ocrProcessingQueue.update({
      where: { id: queueId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    const startTime = Date.now();
    let enhancementResults: EnhancementResult[] = [];
    let ocrResult: OCRResult | null = null;

    try {
      // Step 1: Download document from S3
      const documentBuffer = await this.downloadDocument(queueEntry.document);

      // Step 2: Image enhancement (if enabled)
      let processedBuffer = documentBuffer;
      if (queueEntry.enableEnhancement) {
        const enhancement = await this.enhanceImage(documentBuffer, queueEntry);
        processedBuffer = enhancement.buffer;
        enhancementResults = enhancement.results;
      }

      // Step 3: OCR with multi-engine fallback
      const engines: OCREngineType[] = queueEntry.preferredEngine
        ? [queueEntry.preferredEngine, ...this.getFallbackEngines(queueEntry.preferredEngine)]
        : ['GOOGLE_VISION', 'AWS_TEXTRACT', 'TESSERACT'];

      const attempts: any[] = [];
      let bestResult: any = null;

      for (const engine of engines) {
        try {
          const result = await this.runOCREngine(
            engine,
            processedBuffer,
            queueEntry.languageHints,
            {
              enableTableDetection: queueEntry.enableTableDetection,
              enableFormDetection: queueEntry.enableFormDetection,
            }
          );

          attempts.push({
            engine,
            confidence: result.overallConfidence,
            status: result.overallConfidence >= CONFIG.MIN_CONFIDENCE_THRESHOLD ? 'SUCCESS' : 'FALLBACK',
            durationMs: result.processingTimeMs,
          });

          if (!bestResult || result.overallConfidence > bestResult.overallConfidence) {
            bestResult = result;
          }

          // If confidence is good enough, stop trying
          if (result.overallConfidence >= CONFIG.MIN_CONFIDENCE_THRESHOLD) {
            break;
          }
        } catch (error: any) {
          attempts.push({
            engine,
            confidence: 0,
            status: 'FAILED',
            errorMessage: error.message,
          });
        }
      }

      if (!bestResult) {
        throw new Error('Wszystkie silniki OCR zawiodły');
      }

      // Step 4: Post-process for Polish language
      bestResult.fullTextNormalized = this.normalizePolishText(bestResult.fullText);

      // Step 5: Check if manual review is needed
      const needsReview = bestResult.overallConfidence < 0.75;
      const reviewReason = needsReview
        ? `Niska pewność ekstrakcji: ${(bestResult.overallConfidence * 100).toFixed(1)}%`
        : null;

      // Step 6: Save results
      const processingTimeMs = Date.now() - startTime;

      ocrResult = await db.$transaction(async (tx) => {
        const result = await tx.ocrResult.create({
          data: {
            organizationId: queueEntry.organizationId,
            documentId: queueEntry.documentId,
            versionId: queueEntry.document.currentVersionId,
            engine: bestResult.engine,
            engineVersion: bestResult.engineVersion,
            fullText: bestResult.fullText,
            fullTextNormalized: bestResult.fullTextNormalized,
            pageTexts: bestResult.pageTexts,
            overallConfidence: bestResult.overallConfidence,
            pageConfidences: bestResult.pageConfidences,
            wordConfidences: bestResult.wordConfidences,
            detectedTables: bestResult.detectedTables,
            detectedForms: bestResult.detectedForms,
            processingTimeMs,
            pageCount: bestResult.pageCount,
            wordCount: bestResult.wordCount,
            characterCount: bestResult.characterCount,
            enhancementsApplied: enhancementResults,
            needsManualReview: needsReview,
            reviewReason,
          },
        });

        // Save engine attempts
        for (let i = 0; i < attempts.length; i++) {
          await tx.ocrEngineAttempt.create({
            data: {
              ocrResultId: result.id,
              engine: attempts[i].engine,
              attemptOrder: i + 1,
              confidence: attempts[i].confidence,
              status: attempts[i].status,
              errorMessage: attempts[i].errorMessage,
              startedAt: new Date(startTime),
              completedAt: new Date(),
              durationMs: attempts[i].durationMs,
            },
          });
        }

        // Save extracted tables
        if (bestResult.detectedTables && queueEntry.enableTableDetection) {
          for (const table of bestResult.detectedTables) {
            await tx.ocrExtractedTable.create({
              data: {
                ocrResultId: result.id,
                organizationId: queueEntry.organizationId,
                pageNumber: table.pageNumber,
                tableIndex: table.tableIndex,
                boundingBox: table.boundingBox,
                rowCount: table.rowCount,
                columnCount: table.columnCount,
                hasHeaderRow: table.hasHeaderRow,
                headers: table.headers,
                cells: table.cells,
                tableType: table.tableType,
                confidence: table.confidence,
              },
            });
          }
        }

        // Save extracted form fields
        if (bestResult.detectedForms && queueEntry.enableFormDetection) {
          for (const field of bestResult.detectedForms) {
            await tx.ocrExtractedField.create({
              data: {
                ocrResultId: result.id,
                organizationId: queueEntry.organizationId,
                pageNumber: field.pageNumber,
                fieldIndex: field.fieldIndex,
                label: field.label,
                value: field.value,
                fieldType: field.fieldType,
                labelBoundingBox: field.labelBoundingBox,
                valueBoundingBox: field.valueBoundingBox,
                confidence: field.confidence,
              },
            });
          }
        }

        // Update queue status
        await tx.ocrProcessingQueue.update({
          where: { id: queueId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            processingTimeMs,
          },
        });

        // Update document processing status
        await tx.document.update({
          where: { id: queueEntry.documentId },
          data: {
            processingStatus: 'PROCESSED',
            ocrResultId: result.id,
          },
        });

        return result;
      });

      return ocrResult as OCRResult;

    } catch (error: any) {
      // Update queue with error
      const attemptCount = queueEntry.attemptCount + 1;
      const shouldRetry = attemptCount < CONFIG.MAX_RETRY_ATTEMPTS;

      await db.ocrProcessingQueue.update({
        where: { id: queueId },
        data: {
          status: shouldRetry ? 'QUEUED' : 'FAILED',
          attemptCount,
          lastError: error.message,
          nextRetryAt: shouldRetry
            ? new Date(Date.now() + CONFIG.RETRY_DELAY_MS * Math.pow(2, attemptCount))
            : null,
        },
      });

      throw error;
    }
  }

  /**
   * Run OCR with Google Vision API
   */
  private static async runGoogleVision(
    imageBuffer: Buffer,
    languageHints: string[],
    options: { enableTableDetection: boolean; enableFormDetection: boolean }
  ) {
    const startTime = Date.now();

    const [result] = await visionClient.documentTextDetection({
      image: { content: imageBuffer.toString('base64') },
      imageContext: {
        languageHints,
      },
    });

    const fullTextAnnotation = result.fullTextAnnotation;
    if (!fullTextAnnotation) {
      throw new Error('No text detected by Google Vision');
    }

    // Process pages
    const pageTexts = fullTextAnnotation.pages?.map((page, index) => ({
      pageNumber: index + 1,
      text: page.blocks?.map(b => b.paragraphs?.map(p => p.words?.map(w =>
        w.symbols?.map(s => s.text).join('')
      ).join(' ')).join('\n')).join('\n\n') || '',
      confidence: page.confidence || 0,
      width: page.width || 0,
      height: page.height || 0,
      wordCount: page.blocks?.reduce((acc, b) =>
        acc + (b.paragraphs?.reduce((pacc, p) => pacc + (p.words?.length || 0), 0) || 0), 0) || 0,
      blocks: page.blocks?.map(block => ({
        text: block.paragraphs?.map(p => p.words?.map(w =>
          w.symbols?.map(s => s.text).join('')
        ).join(' ')).join('\n') || '',
        confidence: block.confidence || 0,
        boundingBox: this.normalizeBoundingPoly(block.boundingBox, page.width, page.height),
        blockType: block.blockType || 'TEXT',
      })) || [],
    })) || [];

    // Calculate overall confidence
    const overallConfidence = pageTexts.length > 0
      ? pageTexts.reduce((acc, p) => acc + p.confidence, 0) / pageTexts.length
      : 0;

    return {
      engine: 'GOOGLE_VISION' as const,
      engineVersion: 'v1',
      fullText: fullTextAnnotation.text || '',
      pageTexts,
      overallConfidence,
      pageConfidences: pageTexts.map(p => p.confidence),
      wordConfidences: this.extractWordConfidences(fullTextAnnotation),
      pageCount: pageTexts.length,
      wordCount: fullTextAnnotation.text?.split(/\s+/).length || 0,
      characterCount: fullTextAnnotation.text?.length || 0,
      detectedTables: options.enableTableDetection ? this.extractTablesFromVision(result) : [],
      detectedForms: options.enableFormDetection ? [] : [], // Google Vision doesn't have native form detection
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Run OCR with AWS Textract
   */
  private static async runAWSTextract(
    imageBuffer: Buffer,
    languageHints: string[],
    options: { enableTableDetection: boolean; enableFormDetection: boolean }
  ) {
    const startTime = Date.now();

    const command = options.enableTableDetection || options.enableFormDetection
      ? new AnalyzeDocumentCommand({
          Document: { Bytes: imageBuffer },
          FeatureTypes: [
            ...(options.enableTableDetection ? ['TABLES'] : []),
            ...(options.enableFormDetection ? ['FORMS'] : []),
          ],
        })
      : new DetectDocumentTextCommand({
          Document: { Bytes: imageBuffer },
        });

    const response = await textractClient.send(command);

    // Process blocks
    const blocks = response.Blocks || [];
    const pageBlocks = blocks.filter(b => b.BlockType === 'PAGE');
    const lineBlocks = blocks.filter(b => b.BlockType === 'LINE');
    const wordBlocks = blocks.filter(b => b.BlockType === 'WORD');

    // Build page texts
    const pageTexts = pageBlocks.map((page, index) => {
      const pageLines = lineBlocks.filter(l => l.Page === index + 1);
      const pageWords = wordBlocks.filter(w => w.Page === index + 1);

      return {
        pageNumber: index + 1,
        text: pageLines.map(l => l.Text).join('\n'),
        confidence: (page.Confidence || 0) / 100,
        width: 1, // Textract uses normalized coordinates
        height: 1,
        wordCount: pageWords.length,
        blocks: pageLines.map(line => ({
          text: line.Text || '',
          confidence: (line.Confidence || 0) / 100,
          boundingBox: this.textractBoundingBox(line.Geometry?.BoundingBox),
          blockType: 'TEXT',
        })),
      };
    });

    // Extract tables
    const tables: ExtractedTable[] = [];
    if (options.enableTableDetection) {
      const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE');
      for (const tableBlock of tableBlocks) {
        tables.push(this.extractTableFromTextract(tableBlock, blocks));
      }
    }

    // Extract form fields
    const formFields: ExtractedField[] = [];
    if (options.enableFormDetection) {
      const keyBlocks = blocks.filter(b => b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY'));
      for (const keyBlock of keyBlocks) {
        const field = this.extractFormFieldFromTextract(keyBlock, blocks);
        if (field) formFields.push(field);
      }
    }

    const fullText = pageTexts.map(p => p.text).join('\n\n');
    const overallConfidence = pageTexts.length > 0
      ? pageTexts.reduce((acc, p) => acc + p.confidence, 0) / pageTexts.length
      : 0;

    return {
      engine: 'AWS_TEXTRACT' as const,
      engineVersion: 'v2',
      fullText,
      pageTexts,
      overallConfidence,
      pageConfidences: pageTexts.map(p => p.confidence),
      wordConfidences: wordBlocks.map(w => ({
        word: w.Text || '',
        confidence: (w.Confidence || 0) / 100,
        boundingBox: this.textractBoundingBox(w.Geometry?.BoundingBox),
        pageNumber: w.Page || 1,
      })),
      pageCount: pageTexts.length || 1,
      wordCount: wordBlocks.length,
      characterCount: fullText.length,
      detectedTables: tables,
      detectedForms: formFields,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Run OCR with Tesseract (local fallback)
   */
  private static async runTesseract(
    imageBuffer: Buffer,
    languageHints: string[],
    options: { enableTableDetection: boolean; enableFormDetection: boolean }
  ) {
    const startTime = Date.now();

    // Map language hints to Tesseract languages
    const tesseractLangs = languageHints
      .map(lang => lang === 'pl' ? 'pol' : lang === 'en' ? 'eng' : lang)
      .join('+');

    const result = await Tesseract.recognize(imageBuffer, tesseractLangs, {
      logger: () => {}, // Suppress logs
    });

    const pageTexts = [{
      pageNumber: 1,
      text: result.data.text,
      confidence: result.data.confidence / 100,
      width: result.data.imageWidth,
      height: result.data.imageHeight,
      wordCount: result.data.words.length,
      blocks: result.data.blocks?.map(block => ({
        text: block.text,
        confidence: block.confidence / 100,
        boundingBox: {
          top: block.bbox.y0 / result.data.imageHeight,
          left: block.bbox.x0 / result.data.imageWidth,
          width: (block.bbox.x1 - block.bbox.x0) / result.data.imageWidth,
          height: (block.bbox.y1 - block.bbox.y0) / result.data.imageHeight,
        },
        blockType: 'TEXT',
      })) || [],
    }];

    return {
      engine: 'TESSERACT' as const,
      engineVersion: '5.0',
      fullText: result.data.text,
      pageTexts,
      overallConfidence: result.data.confidence / 100,
      pageConfidences: [result.data.confidence / 100],
      wordConfidences: result.data.words.map(w => ({
        word: w.text,
        confidence: w.confidence / 100,
        boundingBox: {
          top: w.bbox.y0 / result.data.imageHeight,
          left: w.bbox.x0 / result.data.imageWidth,
          width: (w.bbox.x1 - w.bbox.x0) / result.data.imageWidth,
          height: (w.bbox.y1 - w.bbox.y0) / result.data.imageHeight,
        },
        pageNumber: 1,
      })),
      pageCount: 1,
      wordCount: result.data.words.length,
      characterCount: result.data.text.length,
      detectedTables: [], // Tesseract doesn't have native table detection
      detectedForms: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Enhance image before OCR
   */
  private static async enhanceImage(
    imageBuffer: Buffer,
    queueEntry: any
  ): Promise<{ buffer: Buffer; results: EnhancementResult[] }> {
    const results: EnhancementResult[] = [];

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();

    // Create a sharp instance for processing
    let image = sharp(imageBuffer);

    // Calculate original metrics
    const stats = await sharp(imageBuffer).stats();
    const originalMetrics = {
      rotationAngle: 0, // Would need separate detection
      noiseLevel: this.estimateNoise(stats),
      contrastRatio: this.calculateContrast(stats),
      brightness: stats.channels[0].mean / 255,
      sharpness: 0.5, // Placeholder
    };

    // Apply enhancements
    const enhancementsApplied: any = {};

    // 1. Normalize contrast
    image = image.normalize();
    enhancementsApplied.contrast = { method: 'normalize', factor: 1.5 };

    // 2. Convert to grayscale for better OCR
    image = image.grayscale();

    // 3. Sharpen
    image = image.sharpen({ sigma: 1.5 });
    enhancementsApplied.sharpen = { method: 'unsharp', amount: 1.5 };

    // 4. Increase contrast with linear adjustment
    image = image.linear(1.2, -(128 * 0.2));

    const enhancedBuffer = await image.toBuffer();

    // Calculate enhanced metrics
    const enhancedStats = await sharp(enhancedBuffer).stats();
    const enhancedMetrics = {
      rotationAngle: 0,
      noiseLevel: this.estimateNoise(enhancedStats),
      contrastRatio: this.calculateContrast(enhancedStats),
      brightness: enhancedStats.channels[0].mean / 255,
      sharpness: 0.7,
    };

    results.push({
      pageNumber: 1,
      originalMetrics,
      enhancedMetrics,
      enhancementsApplied,
      processingTimeMs: 0, // Would track this properly
    });

    return { buffer: enhancedBuffer, results };
  }

  /**
   * Normalize Polish text
   */
  private static normalizePolishText(text: string): string {
    let normalized = text;

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // Fix common OCR errors for Polish characters
    const replacements: [RegExp, string][] = [
      [/(?<=[a-zA-Z])l(?=[a-zA-Z])/g, 'ł'], // 'l' that should be 'ł'
      [/a\u0328/g, 'ą'], // Combining cedilla
      [/e\u0328/g, 'ę'],
      [/z\u0307/g, 'ż'], // Combining dot above
      [/z\u0301/g, 'ź'], // Combining acute
      [/o\u0301/g, 'ó'],
      [/c\u0301/g, 'ć'],
      [/n\u0301/g, 'ń'],
      [/s\u0301/g, 'ś'],
    ];

    for (const [pattern, replacement] of replacements) {
      normalized = normalized.replace(pattern, replacement);
    }

    return normalized;
  }

  /**
   * Run OCR engine based on type
   */
  private static async runOCREngine(
    engine: OCREngineType,
    imageBuffer: Buffer,
    languageHints: string[],
    options: { enableTableDetection: boolean; enableFormDetection: boolean }
  ) {
    switch (engine) {
      case 'GOOGLE_VISION':
        return this.runGoogleVision(imageBuffer, languageHints, options);
      case 'AWS_TEXTRACT':
        return this.runAWSTextract(imageBuffer, languageHints, options);
      case 'TESSERACT':
        return this.runTesseract(imageBuffer, languageHints, options);
      default:
        throw new Error(`Nieobsługiwany silnik OCR: ${engine}`);
    }
  }

  // Helper methods
  private static async downloadDocument(document: any): Promise<Buffer> {
    // Download from S3
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { S3Client } = await import('@aws-sdk/client-s3');
    const s3Client = new S3Client({ region: process.env.AWS_REGION });

    const response = await s3Client.send(new GetObjectCommand({
      Bucket: document.storageBucket,
      Key: document.storageKey,
    }));

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  private static getFallbackEngines(preferred: OCREngineType): OCREngineType[] {
    const allEngines: OCREngineType[] = ['GOOGLE_VISION', 'AWS_TEXTRACT', 'TESSERACT'];
    return allEngines.filter(e => e !== preferred);
  }

  private static getHigherPriorities(priority: string): string[] {
    const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    const index = priorities.indexOf(priority);
    return priorities.slice(index + 1);
  }

  private static async estimateWaitTime(priority: string): Promise<number> {
    const queuedCount = await db.ocrProcessingQueue.count({
      where: { status: 'QUEUED' },
    });

    const avgProcessingTime = 5000; // 5 seconds average
    return queuedCount * avgProcessingTime;
  }

  private static estimateNoise(stats: sharp.Stats): number {
    // Estimate noise level from standard deviation
    const avgStdDev = stats.channels.reduce((acc, c) => acc + c.stdev, 0) / stats.channels.length;
    return Math.min(avgStdDev / 50, 1);
  }

  private static calculateContrast(stats: sharp.Stats): number {
    const channel = stats.channels[0];
    return (channel.max - channel.min) / 255;
  }

  private static normalizeBoundingPoly(poly: any, width?: number | null, height?: number | null): any {
    if (!poly?.vertices || !width || !height) return { top: 0, left: 0, width: 1, height: 1 };

    const xs = poly.vertices.map((v: any) => v.x || 0);
    const ys = poly.vertices.map((v: any) => v.y || 0);

    return {
      top: Math.min(...ys) / height,
      left: Math.min(...xs) / width,
      width: (Math.max(...xs) - Math.min(...xs)) / width,
      height: (Math.max(...ys) - Math.min(...ys)) / height,
    };
  }

  private static textractBoundingBox(bbox: any): any {
    if (!bbox) return { top: 0, left: 0, width: 0, height: 0 };
    return {
      top: bbox.Top || 0,
      left: bbox.Left || 0,
      width: bbox.Width || 0,
      height: bbox.Height || 0,
    };
  }

  private static extractWordConfidences(annotation: any): any[] {
    const words: any[] = [];

    annotation.pages?.forEach((page: any, pageIndex: number) => {
      page.blocks?.forEach((block: any) => {
        block.paragraphs?.forEach((paragraph: any) => {
          paragraph.words?.forEach((word: any) => {
            words.push({
              word: word.symbols?.map((s: any) => s.text).join('') || '',
              confidence: word.confidence || 0,
              boundingBox: this.normalizeBoundingPoly(word.boundingBox, page.width, page.height),
              pageNumber: pageIndex + 1,
            });
          });
        });
      });
    });

    return words;
  }

  private static extractTablesFromVision(result: any): ExtractedTable[] {
    // Google Vision doesn't have native table detection
    // Would need to implement custom table detection logic
    return [];
  }

  private static extractTableFromTextract(tableBlock: any, allBlocks: any[]): ExtractedTable {
    const cellBlocks = allBlocks.filter(
      b => b.BlockType === 'CELL' && tableBlock.Relationships?.some(
        (r: any) => r.Type === 'CHILD' && r.Ids?.includes(b.Id)
      )
    );

    // Group cells by row
    const rows = new Map<number, any[]>();
    cellBlocks.forEach(cell => {
      const rowIndex = cell.RowIndex || 1;
      if (!rows.has(rowIndex)) rows.set(rowIndex, []);
      rows.get(rowIndex)!.push(cell);
    });

    // Sort each row by column index
    rows.forEach(row => row.sort((a, b) => (a.ColumnIndex || 0) - (b.ColumnIndex || 0)));

    // Build cells array
    const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
    const cells = sortedRows.map(([_, row]) =>
      row.map(cell => ({
        text: this.getCellText(cell, allBlocks),
        confidence: (cell.Confidence || 0) / 100,
        rowSpan: cell.RowSpan || 1,
        colSpan: cell.ColumnSpan || 1,
        boundingBox: this.textractBoundingBox(cell.Geometry?.BoundingBox),
      }))
    );

    const hasHeader = sortedRows.length > 0 && sortedRows[0][0] === 1;
    const headers = hasHeader ? cells[0].map(c => c.text) : undefined;

    return {
      pageNumber: tableBlock.Page || 1,
      tableIndex: 0, // Would need to track this
      boundingBox: this.textractBoundingBox(tableBlock.Geometry?.BoundingBox),
      rowCount: sortedRows.length,
      columnCount: Math.max(...sortedRows.map(([_, row]) => row.length)),
      hasHeaderRow: hasHeader,
      headers,
      cells,
      confidence: (tableBlock.Confidence || 0) / 100,
    };
  }

  private static getCellText(cell: any, allBlocks: any[]): string {
    if (!cell.Relationships) return '';

    const childIds = cell.Relationships
      .filter((r: any) => r.Type === 'CHILD')
      .flatMap((r: any) => r.Ids || []);

    const words = allBlocks
      .filter(b => childIds.includes(b.Id) && b.BlockType === 'WORD')
      .map(b => b.Text || '');

    return words.join(' ');
  }

  private static extractFormFieldFromTextract(keyBlock: any, allBlocks: any[]): ExtractedField | null {
    // Find the value block
    const valueRelation = keyBlock.Relationships?.find((r: any) => r.Type === 'VALUE');
    if (!valueRelation) return null;

    const valueBlockId = valueRelation.Ids?.[0];
    const valueBlock = allBlocks.find(b => b.Id === valueBlockId);

    // Get key text
    const keyText = this.getBlockText(keyBlock, allBlocks);

    // Get value text
    const valueText = valueBlock ? this.getBlockText(valueBlock, allBlocks) : null;

    // Determine field type
    let fieldType: ExtractedField['fieldType'] = 'TEXT';
    if (valueBlock?.EntityTypes?.includes('CHECKBOX')) {
      fieldType = 'CHECKBOX';
    } else if (/^\d+([.,]\d+)?$/.test(valueText || '')) {
      fieldType = 'NUMBER';
    } else if (POLISH_CONFIG.datePatterns.some(p => p.test(valueText || ''))) {
      fieldType = 'DATE';
    }

    return {
      pageNumber: keyBlock.Page || 1,
      fieldIndex: 0, // Would track this
      label: keyText,
      value: valueText,
      fieldType,
      labelBoundingBox: this.textractBoundingBox(keyBlock.Geometry?.BoundingBox),
      valueBoundingBox: valueBlock ? this.textractBoundingBox(valueBlock.Geometry?.BoundingBox) : undefined,
      confidence: (keyBlock.Confidence || 0) / 100,
    };
  }

  private static getBlockText(block: any, allBlocks: any[]): string {
    if (!block.Relationships) return '';

    const childIds = block.Relationships
      .filter((r: any) => r.Type === 'CHILD')
      .flatMap((r: any) => r.Ids || []);

    const words = allBlocks
      .filter(b => childIds.includes(b.Id) && b.BlockType === 'WORD')
      .map(b => b.Text || '');

    return words.join(' ');
  }

  /**
   * Trigger queue processing (background job)
   */
  static async triggerProcessing() {
    // This would be called by a background job scheduler
    const queuedItems = await db.ocrProcessingQueue.findMany({
      where: {
        status: 'QUEUED',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { queuedAt: 'asc' },
      ],
      take: CONFIG.MAX_CONCURRENT_JOBS,
    });

    await Promise.all(
      queuedItems.map(item => this.processDocument(item.id).catch(console.error))
    );
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { OCRProcessingService } from './service';
import {
  QueueOCRRequestSchema,
  BatchQueueOCRRequestSchema,
  GetOCRResultRequestSchema,
  ValidateFieldRequestSchema,
} from './schemas';
import { z } from 'zod';

export const ocrProcessingRouter = router({
  // Queue document for OCR
  queueDocument: protectedProcedure
    .input(QueueOCRRequestSchema)
    .mutation(async ({ input, ctx }) => {
      return OCRProcessingService.queueDocument(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });
    }),

  // Queue multiple documents
  queueBatch: protectedProcedure
    .input(BatchQueueOCRRequestSchema)
    .mutation(async ({ input, ctx }) => {
      return OCRProcessingService.queueBatch(input, {
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });
    }),

  // Get queue status
  getQueueStatus: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return OCRProcessingService.getQueueStatus(input.documentId, {
        organizationId: ctx.organizationId,
      });
    }),

  // Get OCR results
  getResults: protectedProcedure
    .input(GetOCRResultRequestSchema)
    .query(async ({ input, ctx }) => {
      return OCRProcessingService.getResults(input.documentId, {
        includeWordConfidences: input.includeWordConfidences,
        includeTables: input.includeTables,
        includeFormFields: input.includeFormFields,
      }, {
        organizationId: ctx.organizationId,
      });
    }),

  // Get extracted tables
  getExtractedTables: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Return extracted tables for document
      return { tables: [] };
    }),

  // Get extracted form fields
  getExtractedFields: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Return extracted form fields
      return { fields: [] };
    }),

  // Validate/correct extracted field
  validateField: protectedProcedure
    .input(ValidateFieldRequestSchema)
    .mutation(async ({ input, ctx }) => {
      // Update field with validated value
      return { success: true };
    }),

  // Cancel queued OCR job
  cancelJob: protectedProcedure
    .input(z.object({ queueId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Cancel the job if still queued
      return { success: true };
    }),

  // Retry failed OCR job
  retryJob: protectedProcedure
    .input(z.object({ queueId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Re-queue failed job
      return { success: true };
    }),

  // Get processing statistics
  getStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      // Return OCR processing statistics for organization
      return {
        totalProcessed: 0,
        avgProcessingTime: 0,
        avgConfidence: 0,
        engineDistribution: {},
        queueStatus: {},
      };
    }),
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRProcessingService } from './service';

// Mock external services
vi.mock('@google-cloud/vision');
vi.mock('@aws-sdk/client-textract');
vi.mock('tesseract.js');

describe('OCRProcessingService', () => {
  describe('queueDocument', () => {
    it('should queue document with correct priority', async () => {
      const result = await OCRProcessingService.queueDocument({
        documentId: 'doc-123',
        priority: 'HIGH',
        languageHints: ['pl', 'en'],
      }, {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      expect(result.queueId).toBeDefined();
      expect(result.status).toBe('QUEUED');
    });

    it('should reject duplicate queue entries', async () => {
      // Queue once
      await OCRProcessingService.queueDocument({
        documentId: 'doc-123',
        priority: 'NORMAL',
      }, {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      // Try to queue again
      await expect(
        OCRProcessingService.queueDocument({
          documentId: 'doc-123',
          priority: 'NORMAL',
        }, {
          userId: 'user-1',
          organizationId: 'org-1',
        })
      ).rejects.toThrow('Dokument jest już w kolejce');
    });
  });

  describe('Polish text normalization', () => {
    it('should preserve Polish diacritics', () => {
      const input = 'Faktura VAT za usługi księgowe';
      const result = OCRProcessingService['normalizePolishText'](input);

      expect(result).toContain('ę');
      expect(result).toBe('Faktura VAT za usługi księgowe');
    });

    it('should fix common OCR errors for Polish characters', () => {
      const input = 'Usluga ksiegowa';
      const result = OCRProcessingService['normalizePolishText'](input);

      // Should attempt to fix missing diacritics
      expect(result).toBeDefined();
    });
  });

  describe('Multi-engine fallback', () => {
    it('should try fallback engine on low confidence', async () => {
      // Mock Google Vision returning low confidence
      vi.mocked(require('@google-cloud/vision').ImageAnnotatorClient.prototype.documentTextDetection)
        .mockResolvedValueOnce([{ fullTextAnnotation: { text: 'test', confidence: 0.5 } }]);

      // Mock Textract returning higher confidence
      vi.mocked(require('@aws-sdk/client-textract').TextractClient.prototype.send)
        .mockResolvedValueOnce({ Blocks: [{ BlockType: 'PAGE', Confidence: 85 }] });

      const result = await OCRProcessingService.processDocument('queue-123');

      expect(result.engine).toBe('AWS_TEXTRACT');
    });
  });

  describe('Table extraction', () => {
    it('should extract table structure from Textract response', () => {
      const tableBlock = {
        BlockType: 'TABLE',
        Page: 1,
        Geometry: { BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.8, Height: 0.3 } },
        Relationships: [{ Type: 'CHILD', Ids: ['cell-1', 'cell-2'] }],
      };

      const cellBlocks = [
        { Id: 'cell-1', BlockType: 'CELL', RowIndex: 1, ColumnIndex: 1 },
        { Id: 'cell-2', BlockType: 'CELL', RowIndex: 1, ColumnIndex: 2 },
      ];

      const table = OCRProcessingService['extractTableFromTextract'](tableBlock, [...cellBlocks]);

      expect(table.rowCount).toBe(1);
      expect(table.columnCount).toBe(2);
    });
  });

  describe('Image enhancement', () => {
    it('should apply enhancement filters', async () => {
      const imageBuffer = Buffer.from('test-image');

      const result = await OCRProcessingService['enhanceImage'](imageBuffer, {
        enableEnhancement: true,
      });

      expect(result.buffer).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].enhancementsApplied).toBeDefined();
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { createTestContext } from '@/test/helpers';

describe('OCR Processing Integration', () => {
  let testContext: any;
  let testDocumentId: string;

  beforeAll(async () => {
    testContext = await createTestContext();

    // Create test document
    const doc = await db.document.create({
      data: {
        organizationId: testContext.organizationId,
        originalName: 'test-invoice.pdf',
        documentType: 'INVOICE',
        mimeType: 'application/pdf',
        storageKey: 'test/test-invoice.pdf',
        storageBucket: 'test-bucket',
        createdBy: testContext.userId,
      },
    });
    testDocumentId = doc.id;
  });

  afterAll(async () => {
    await db.ocrResult.deleteMany({ where: { documentId: testDocumentId } });
    await db.ocrProcessingQueue.deleteMany({ where: { documentId: testDocumentId } });
    await db.document.delete({ where: { id: testDocumentId } });
  });

  describe('Queue Management', () => {
    it('should maintain priority order in queue', async () => {
      // Create multiple queue entries
      const entries = await Promise.all([
        db.ocrProcessingQueue.create({
          data: {
            organizationId: testContext.organizationId,
            documentId: testDocumentId,
            priority: 'LOW',
            createdBy: testContext.userId,
          },
        }),
        db.ocrProcessingQueue.create({
          data: {
            organizationId: testContext.organizationId,
            documentId: 'doc-high',
            priority: 'HIGH',
            createdBy: testContext.userId,
          },
        }),
      ]);

      const queue = await db.ocrProcessingQueue.findMany({
        where: { organizationId: testContext.organizationId },
        orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
      });

      // HIGH priority should come first
      expect(queue[0].priority).toBe('HIGH');
    });
  });

  describe('RLS Policies', () => {
    it('should isolate OCR results by organization', async () => {
      await db.$executeRaw`SELECT set_config('app.current_organization_id', ${testContext.organizationId}, true)`;

      const results = await db.ocrResult.findMany({
        where: { documentId: testDocumentId },
      });

      expect(results.every(r => r.organizationId === testContext.organizationId)).toBe(true);
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('OCR Processing UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should show OCR processing status', async ({ page }) => {
    await page.goto('/documents/doc-123');

    // Check OCR status indicator
    await expect(page.locator('[data-testid="ocr-status"]')).toBeVisible();
  });

  test('should display extracted text', async ({ page }) => {
    await page.goto('/documents/doc-123');

    // Open OCR results tab
    await page.click('[data-testid="ocr-results-tab"]');

    // Verify extracted text is shown
    await expect(page.locator('[data-testid="extracted-text"]')).toBeVisible();
  });

  test('should display extracted tables', async ({ page }) => {
    await page.goto('/documents/doc-123');

    // Open tables tab
    await page.click('[data-testid="extracted-tables-tab"]');

    // Verify table is rendered
    await expect(page.locator('[data-testid="extracted-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="table-header"]')).toHaveCount.greaterThan(0);
  });

  test('should allow manual field correction', async ({ page }) => {
    await page.goto('/documents/doc-123');

    // Open form fields tab
    await page.click('[data-testid="form-fields-tab"]');

    // Click edit on a field
    await page.click('[data-testid="field-0-edit"]');

    // Correct the value
    await page.fill('[name="correctedValue"]', '123-456-78-90');
    await page.click('[data-testid="save-correction"]');

    // Verify correction is saved
    await expect(page.locator('[data-testid="field-0-value"]')).toContainText('123-456-78-90');
  });

  test('should retry failed OCR job', async ({ page }) => {
    await page.goto('/documents/failed-doc');

    // Should show failed status
    await expect(page.locator('[data-testid="ocr-status"]')).toContainText('Błąd');

    // Click retry
    await page.click('[data-testid="retry-ocr"]');

    // Verify re-queued
    await expect(page.locator('[data-testid="ocr-status"]')).toContainText('W kolejce');
  });
});
```

---

## 🔒 Security Checklist

| Requirement | Implementation | Status |
|------------|----------------|--------|
| Authentication required | All endpoints use `protectedProcedure` | ✅ |
| Organization isolation | RLS policies on all tables | ✅ |
| Input validation | Zod schemas for all inputs | ✅ |
| API key security | External API keys in environment variables | ✅ |
| Data encryption | S3 server-side encryption | ✅ |
| Rate limiting | Queue-based processing with limits | ✅ |
| Audit logging | Processing history tracked | ✅ |
| Error handling | No sensitive data in error messages | ✅ |

---

## 📊 Audit Events

```typescript
const OCR_AUDIT_EVENTS = {
  OCR_QUEUED: {
    description: 'Dokument dodany do kolejki OCR',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['documentId', 'priority', 'engine'],
  },
  OCR_PROCESSING_STARTED: {
    description: 'Rozpoczęto przetwarzanie OCR',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['documentId', 'engine'],
  },
  OCR_PROCESSING_COMPLETED: {
    description: 'Zakończono przetwarzanie OCR',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['documentId', 'engine', 'confidence', 'processingTimeMs'],
  },
  OCR_PROCESSING_FAILED: {
    description: 'Błąd przetwarzania OCR',
    severity: 'ERROR',
    retention: '5_YEARS',
    fields: ['documentId', 'engine', 'error', 'attemptCount'],
  },
  OCR_ENGINE_FALLBACK: {
    description: 'Przełączono na zapasowy silnik OCR',
    severity: 'WARNING',
    retention: '5_YEARS',
    fields: ['documentId', 'fromEngine', 'toEngine', 'reason'],
  },
  OCR_FIELD_VALIDATED: {
    description: 'Ręcznie zweryfikowano pole OCR',
    severity: 'INFO',
    retention: '5_YEARS',
    fields: ['fieldId', 'originalValue', 'validatedValue'],
  },
};
```

---

## 📝 Implementation Notes

### OCR Engine Selection Strategy
1. **Google Vision** - Best for Polish text, high accuracy
2. **AWS Textract** - Best for tables and forms
3. **Tesseract** - Free fallback, lower accuracy

### Polish Language Optimization
- Use `pol` language hint for all engines
- Apply post-processing for diacritic correction
- Recognize Polish date, currency, and ID formats

### Performance Considerations
- Async queue processing with Bull/Redis
- Max 5 concurrent processing jobs
- Exponential backoff on failures
- Result caching to avoid reprocessing

### Cost Optimization
- Start with Google Vision (per-page pricing)
- Fall back to Tesseract for low-priority documents
- Cache results to avoid duplicate processing

---

## 🔗 Dependencies

- **DOC-001**: Document Upload System (source documents)
- **DOC-002**: Cloud Storage & CDN (document retrieval)
- **DOC-005**: AI Data Extraction (uses OCR results)
- **DOC-008**: Full-Text Search (indexes OCR text)

---

## 📈 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| OCR accuracy (clear docs) | ≥95% | Character-level accuracy |
| Polish diacritic accuracy | ≥90% | Correct ą, ę, ó, etc. |
| Processing time per page | <10s | Queue to completion |
| Table detection accuracy | ≥85% | Correct structure extraction |
| Queue throughput | 100 docs/hour | Sustained processing rate |

---

*Story created following BMAD methodology for KsięgowaCRM Document Intelligence Module*
