// TAX-007: JPK Reporting Schema
// Manages JPK (Jednolity Plik Kontrolny - Standard Audit File) generation for Polish tax compliance
// Supports JPK_VAT, JPK_FA, JPK_KR, JPK_WB, JPK_MAG

import { z } from 'zod';

// ===========================================================================
// ENUMS AND BASE TYPES
// ===========================================================================

/**
 * JPK report types as defined by Polish Ministry of Finance
 */
export const jpkReportTypeSchema = z.enum([
  'JPK_VAT',      // VAT records - monthly/quarterly
  'JPK_V7M',      // New VAT declaration with records (monthly) - since 2020-10
  'JPK_V7K',      // New VAT declaration with records (quarterly)
  'JPK_FA',       // Invoices (faktury) - on demand
  'JPK_KR',       // Accounting books (księgi rachunkowe) - on demand
  'JPK_WB',       // Bank statements (wyciągi bankowe) - on demand
  'JPK_MAG',      // Warehouse (magazyn) - on demand
  'JPK_PKPIR',    // Revenue and expense ledger (podatkowa księga przychodów i rozchodów) - on demand
  'JPK_EWP',      // Records of revenues (ewidencja przychodów) - on demand for ryczałt
]);
export type JPKReportType = z.infer<typeof jpkReportTypeSchema>;

/**
 * JPK report status
 */
export const jpkReportStatusSchema = z.enum([
  'DRAFT',           // Being prepared
  'GENERATING',      // XML generation in progress
  'GENERATED',       // XML file created
  'VALIDATING',      // Schema validation in progress
  'VALIDATED',       // Schema validation passed
  'SIGNING',         // Digital signature in progress
  'SIGNED',          // Digitally signed
  'SUBMITTING',      // Being submitted to Ministry
  'SUBMITTED',       // Submitted to tax authority
  'ACCEPTED',        // Accepted by tax authority (UPO received)
  'REJECTED',        // Rejected by tax authority
  'ERROR',           // Generation/submission error
]);
export type JPKReportStatus = z.infer<typeof jpkReportStatusSchema>;

/**
 * JPK submission purpose
 */
export const jpkSubmissionPurposeSchema = z.enum([
  'FIRST',       // Pierwsza deklaracja (cel złożenia = 1)
  'CORRECTION',  // Korekta (cel złożenia = 2)
]);
export type JPKSubmissionPurpose = z.infer<typeof jpkSubmissionPurposeSchema>;

/**
 * GTU (Goods and Services Groups) codes for JPK_V7
 */
export const gtuCodeSchema = z.enum([
  'GTU_01',  // Alcoholic beverages
  'GTU_02',  // Fuel
  'GTU_03',  // Heating oil
  'GTU_04',  // Tobacco
  'GTU_05',  // Waste
  'GTU_06',  // Electronic devices
  'GTU_07',  // Vehicles and parts
  'GTU_08',  // Precious metals
  'GTU_09',  // Medicines
  'GTU_10',  // Buildings, land, structures
  'GTU_11',  // Services for settling GHG emissions
  'GTU_12',  // Intangible services (consulting, legal, etc.)
  'GTU_13',  // Transport services
]);
export type GTUCode = z.infer<typeof gtuCodeSchema>;

/**
 * Transaction procedure codes for JPK_V7
 */
export const procedureCodeSchema = z.enum([
  'SW',      // Mail order / distance sale
  'EE',      // Electronic services
  'TP',      // Related party transactions
  'TT_WNT',  // Triangular WNT
  'TT_D',    // Triangular delivery
  'MR_T',    // Tourism margin scheme
  'MR_UZ',   // Second-hand goods margin
  'I_42',    // Import customs procedure 42
  'I_63',    // Import customs procedure 63
  'B_SPV',   // Transfer of single purpose voucher
  'B_SPV_DOSTAWA',  // Delivery of SPV goods
  'B_MPV_PROWIZJA', // MPV commission
  'MPP',     // Split payment
  'IMP',     // Import of services art. 28b
  'WSTO_EE', // Distance sale within EU
]);
export type ProcedureCode = z.infer<typeof procedureCodeSchema>;

/**
 * Document type for JPK_V7
 */
export const jpkDocumentTypeSchema = z.enum([
  'FP',      // Invoice for physical person (faktura do paragonu)
  'RO',      // Internal settlement document
  'WEW',     // Internal document
  'MK',      // Cash register method adjustment
]);
export type JPKDocumentType = z.infer<typeof jpkDocumentTypeSchema>;

/**
 * Validation severity
 */
export const validationSeveritySchema = z.enum(['error', 'warning', 'info']);
export type ValidationSeverity = z.infer<typeof validationSeveritySchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * JPK Report Header (Naglowek)
 */
export const jpkHeaderSchema = z.object({
  formCode: z.string().min(1).max(30),         // KodFormularza
  formCodeVersion: z.string().min(1).max(10),  // wariantFormularza
  systemCode: z.string().min(1).max(50),       // kodSystemowy
  formVersion: z.string().min(1).max(10),      // wersjaSchemy
  purpose: jpkSubmissionPurposeSchema,         // CelZlozenia
  dateFrom: z.string().datetime(),             // DataOd
  dateTo: z.string().datetime(),               // DataDo
  createdAt: z.string().datetime(),            // DataWytworzeniaJPK
  currency: z.string().length(3).default('PLN'),
  officeName: z.string().optional(),           // NazwaUrzedu
  officeCode: z.string().optional(),           // KodUrzedu
});
export type JPKHeader = z.infer<typeof jpkHeaderSchema>;

/**
 * JPK Subject (Podmiot - taxpayer info)
 */
export const jpkSubjectSchema = z.object({
  nip: z.string().length(10),
  fullName: z.string().min(1).max(240),        // PelnaNazwa
  firstName: z.string().max(30).optional(),    // ImiePierwsze
  lastName: z.string().max(81).optional(),     // Nazwisko
  birthDate: z.string().optional(),            // DataUrodzenia
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type JPKSubject = z.infer<typeof jpkSubjectSchema>;

/**
 * JPK_V7 Sale record (Sprzedaz)
 */
export const jpkV7SaleRecordSchema = z.object({
  recordNumber: z.number().int().min(1),       // LpSprzedazy
  documentType: jpkDocumentTypeSchema.optional(),
  documentNumber: z.string().min(1).max(256),  // NrDokumentu
  documentDate: z.string().datetime(),         // DataWystawienia
  saleDate: z.string().datetime().optional(),  // DataSprzedazy

  // Buyer info
  buyerNIP: z.string().length(10).optional(),
  buyerName: z.string().max(256).optional(),
  buyerCountryCode: z.string().length(2).optional(),

  // Amounts by VAT rate
  netAmount23: z.string().optional(),          // K_19 (23%)
  vatAmount23: z.string().optional(),          // K_20
  netAmount8: z.string().optional(),           // K_17 (8%)
  vatAmount8: z.string().optional(),           // K_18
  netAmount5: z.string().optional(),           // K_15 (5%)
  vatAmount5: z.string().optional(),           // K_16
  netAmount0: z.string().optional(),           // K_13 (0%)
  netAmountExempt: z.string().optional(),      // K_10 (ZW - exempt)

  // EU/Export
  netAmountWDT: z.string().optional(),         // K_21 (WDT - intra-EU delivery)
  netAmountExport: z.string().optional(),      // K_22 (Export)

  // Special transactions
  gtuCodes: z.array(gtuCodeSchema).optional(),
  procedureCodes: z.array(procedureCodeSchema).optional(),
  correctedInvoiceNumber: z.string().optional(),
  correctedInvoiceDate: z.string().datetime().optional(),
});
export type JPKV7SaleRecord = z.infer<typeof jpkV7SaleRecordSchema>;

/**
 * JPK_V7 Purchase record (Zakup)
 */
export const jpkV7PurchaseRecordSchema = z.object({
  recordNumber: z.number().int().min(1),       // LpZakupu
  documentNumber: z.string().min(1).max(256),  // NrDostawcy + DowodZakupu
  documentDate: z.string().datetime(),         // DataZakupu
  receiptDate: z.string().datetime().optional(), // DataWplywu

  // Seller info
  sellerNIP: z.string().length(10).optional(),
  sellerName: z.string().max(256).optional(),
  sellerCountryCode: z.string().length(2).optional(),

  // Amounts
  netAmountTotal: z.string(),                  // K_42 (netto do odliczenia)
  vatAmountDeductible: z.string(),             // K_43 (VAT do odliczenia)
  vatAmountNonDeductible: z.string().optional(),

  // Special transactions
  isWNT: z.boolean().default(false),           // Import from EU (Wewnątrzwspólnotowe nabycie towarów)
  isImportServices: z.boolean().default(false), // Import of services
  isMPP: z.boolean().default(false),           // Split payment
  procedureCodes: z.array(procedureCodeSchema).optional(),
});
export type JPKV7PurchaseRecord = z.infer<typeof jpkV7PurchaseRecordSchema>;

/**
 * JPK_V7 Declaration section (Deklaracja)
 */
export const jpkV7DeclarationSchema = z.object({
  // Output VAT (należny)
  p_10: z.string().optional(), // WDT
  p_11: z.string().optional(), // Export
  p_13_1: z.string().optional(), // 0% net
  p_15: z.string().optional(), // 5% net
  p_16: z.string().optional(), // 5% VAT
  p_17: z.string().optional(), // 8% net (7% before 2011)
  p_18: z.string().optional(), // 8% VAT
  p_19: z.string().optional(), // 23% net (22% before 2011)
  p_20: z.string().optional(), // 23% VAT
  p_21: z.string().optional(), // WNT net
  p_22: z.string().optional(), // WNT VAT
  p_23: z.string().optional(), // Import of services net
  p_24: z.string().optional(), // Import of services VAT
  p_25: z.string().optional(), // Import net
  p_26: z.string().optional(), // Import VAT
  p_27: z.string().optional(), // Total net (sum)
  p_28: z.string().optional(), // Total output VAT

  // Input VAT (naliczony)
  p_40: z.string().optional(), // Total input VAT gross
  p_41: z.string().optional(), // Total input VAT deductible
  p_42: z.string().optional(), // Correction from previous periods
  p_43: z.string().optional(), // Total input VAT after corrections

  // Settlement
  p_46: z.string().optional(), // Excess output VAT
  p_48: z.string().optional(), // Tax to pay
  p_50: z.string().optional(), // Excess input VAT
  p_51: z.string().optional(), // Amount for refund
  p_52: z.string().optional(), // Refund period (days)
  p_53: z.string().optional(), // Carry forward to next period
  p_54: z.string().optional(), // Difference
  p_55: z.string().optional(), // Correction amount
  p_56: z.string().optional(), // Final tax to pay

  // Checkboxes
  p_60: z.boolean().optional(), // Metoda kasowa
  p_61: z.boolean().optional(), // Samofakturowanie
  p_62: z.boolean().optional(), // Import usług
  p_63: z.boolean().optional(), // Działalność sezonowa
  p_64: z.boolean().optional(), // Prowadzenie PKPiR
  p_65: z.boolean().optional(), // Prowadzenie ewidencji pełnej
  p_66: z.boolean().optional(), // Eksport 0%
  p_67: z.boolean().optional(), // Usługi teletrans
  p_68: z.string().optional(),  // Nazwa banku
  p_69: z.string().optional(),  // Swift
  p_70: z.string().optional(),  // Nr rachunku
});
export type JPKV7Declaration = z.infer<typeof jpkV7DeclarationSchema>;

/**
 * JPK Report entity
 */
export const jpkReportSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),

  reportType: jpkReportTypeSchema,
  status: jpkReportStatusSchema,

  // Period
  year: z.number().int().min(2016).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  periodFrom: z.string().datetime(),
  periodTo: z.string().datetime(),

  // Submission
  purpose: jpkSubmissionPurposeSchema,
  correctionNumber: z.number().int().min(1).optional(),
  originalReportId: z.string().uuid().optional(),
  correctionReason: z.string().optional(),

  // Report content
  header: jpkHeaderSchema.optional(),
  subject: jpkSubjectSchema.optional(),
  recordCount: z.number().int().min(0),
  saleRecordCount: z.number().int().min(0).optional(),
  purchaseRecordCount: z.number().int().min(0).optional(),

  // Totals
  totalSaleNet: z.string().optional(),
  totalSaleVAT: z.string().optional(),
  totalPurchaseNet: z.string().optional(),
  totalPurchaseVAT: z.string().optional(),

  // Files
  xmlFilePath: z.string().optional(),
  xmlFileSize: z.number().int().optional(),
  xmlHash: z.string().optional(),
  signedXmlFilePath: z.string().optional(),

  // Submission to Ministry
  submittedAt: z.string().datetime().optional(),
  referenceNumber: z.string().optional(),   // Numer referencyjny
  upoNumber: z.string().optional(),         // UPO (Urzędowe Poświadczenie Odbioru)
  upoReceivedAt: z.string().datetime().optional(),
  upoFilePath: z.string().optional(),

  // Error handling
  errorMessage: z.string().optional(),
  errorDetails: z.record(z.unknown()).optional(),

  // Metadata
  generatedBy: z.string().uuid(),
  generatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type JPKReport = z.infer<typeof jpkReportSchema>;

/**
 * Validation issue
 */
export const jpkValidationIssueSchema = z.object({
  code: z.string(),
  field: z.string().optional(),
  line: z.number().int().optional(),
  message: z.string(),
  severity: validationSeveritySchema,
  xPath: z.string().optional(),
});
export type JPKValidationIssue = z.infer<typeof jpkValidationIssueSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Create new JPK report
 */
export const createJPKReportSchema = z.object({
  clientId: z.string().uuid(),
  reportType: jpkReportTypeSchema,
  year: z.number().int().min(2016).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  purpose: jpkSubmissionPurposeSchema.default('FIRST'),
}).refine(
  (data) => {
    // JPK_V7M requires month, JPK_V7K requires quarter
    if (data.reportType === 'JPK_V7M' && !data.month) {
      return false;
    }
    if (data.reportType === 'JPK_V7K' && !data.quarter) {
      return false;
    }
    return true;
  },
  { message: 'JPK_V7M wymaga podania miesiąca, JPK_V7K wymaga podania kwartału' },
);
export type CreateJPKReportInput = z.infer<typeof createJPKReportSchema>;

/**
 * Generate JPK XML
 */
export const generateJPKXMLSchema = z.object({
  reportId: z.string().uuid(),
  regenerate: z.boolean().default(false), // Force regeneration if already generated
});
export type GenerateJPKXMLInput = z.infer<typeof generateJPKXMLSchema>;

/**
 * Add sale record to JPK_V7
 */
export const addJPKSaleRecordSchema = z.object({
  reportId: z.string().uuid(),
  record: jpkV7SaleRecordSchema.omit({ recordNumber: true }),
});
export type AddJPKSaleRecordInput = z.infer<typeof addJPKSaleRecordSchema>;

/**
 * Add purchase record to JPK_V7
 */
export const addJPKPurchaseRecordSchema = z.object({
  reportId: z.string().uuid(),
  record: jpkV7PurchaseRecordSchema.omit({ recordNumber: true }),
});
export type AddJPKPurchaseRecordInput = z.infer<typeof addJPKPurchaseRecordSchema>;

/**
 * Import records from VAT transactions
 */
export const importFromVATTransactionsSchema = z.object({
  reportId: z.string().uuid(),
  periodFrom: z.string().datetime(),
  periodTo: z.string().datetime(),
  overwriteExisting: z.boolean().default(false),
});
export type ImportFromVATTransactionsInput = z.infer<typeof importFromVATTransactionsSchema>;

/**
 * Validate JPK report
 */
export const validateJPKReportSchema = z.object({
  reportId: z.string().uuid(),
  validateXSD: z.boolean().default(true),  // Validate against XSD schema
  validateBusiness: z.boolean().default(true), // Validate business rules
});
export type ValidateJPKReportInput = z.infer<typeof validateJPKReportSchema>;

/**
 * Sign JPK report with digital signature
 */
export const signJPKReportSchema = z.object({
  reportId: z.string().uuid(),
  signatureType: z.enum(['qualified', 'trusted_profile']).default('qualified'),
  certificatePath: z.string().optional(), // Path to signing certificate
});
export type SignJPKReportInput = z.infer<typeof signJPKReportSchema>;

/**
 * Submit JPK report to tax authority
 */
export const submitJPKReportSchema = z.object({
  reportId: z.string().uuid(),
  testMode: z.boolean().default(false), // Send to test environment
});
export type SubmitJPKReportInput = z.infer<typeof submitJPKReportSchema>;

/**
 * Check submission status
 */
export const checkJPKStatusSchema = z.object({
  reportId: z.string().uuid(),
});
export type CheckJPKStatusInput = z.infer<typeof checkJPKStatusSchema>;

/**
 * Download UPO (official receipt)
 */
export const downloadUPOSchema = z.object({
  reportId: z.string().uuid(),
});
export type DownloadUPOInput = z.infer<typeof downloadUPOSchema>;

/**
 * Create correction report
 */
export const createJPKCorrectionSchema = z.object({
  originalReportId: z.string().uuid(),
  correctionReason: z.string().min(10).max(500),
});
export type CreateJPKCorrectionInput = z.infer<typeof createJPKCorrectionSchema>;

/**
 * Get report by ID
 */
export const getJPKReportSchema = z.object({
  reportId: z.string().uuid(),
  includeRecords: z.boolean().default(false),
  includeDeclaration: z.boolean().default(false),
});
export type GetJPKReportInput = z.infer<typeof getJPKReportSchema>;

/**
 * List reports with filters
 */
export const listJPKReportsSchema = z.object({
  clientId: z.string().uuid().optional(),
  reportType: jpkReportTypeSchema.optional(),
  status: jpkReportStatusSchema.optional(),
  year: z.number().int().min(2016).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListJPKReportsInput = z.infer<typeof listJPKReportsSchema>;

/**
 * Delete report (only draft/error status)
 */
export const deleteJPKReportSchema = z.object({
  reportId: z.string().uuid(),
});
export type DeleteJPKReportInput = z.infer<typeof deleteJPKReportSchema>;

/**
 * Download XML file
 */
export const downloadJPKXMLSchema = z.object({
  reportId: z.string().uuid(),
  signed: z.boolean().default(false), // Download signed or unsigned
});
export type DownloadJPKXMLInput = z.infer<typeof downloadJPKXMLSchema>;

/**
 * Update JPK_V7 declaration section
 */
export const updateJPKDeclarationSchema = z.object({
  reportId: z.string().uuid(),
  declaration: jpkV7DeclarationSchema,
});
export type UpdateJPKDeclarationInput = z.infer<typeof updateJPKDeclarationSchema>;

// ===========================================================================
// OUTPUT SCHEMAS
// ===========================================================================

/**
 * Validation result
 */
export const jpkValidationResultSchema = z.object({
  isValid: z.boolean(),
  xsdValid: z.boolean(),
  businessValid: z.boolean(),
  issues: z.array(jpkValidationIssueSchema),
  errorCount: z.number().int().min(0),
  warningCount: z.number().int().min(0),
});
export type JPKValidationResult = z.infer<typeof jpkValidationResultSchema>;

/**
 * Generation result
 */
export const jpkGenerationResultSchema = z.object({
  success: z.boolean(),
  reportId: z.string().uuid(),
  xmlFilePath: z.string().optional(),
  xmlFileSize: z.number().int().optional(),
  xmlHash: z.string().optional(),
  recordCount: z.number().int(),
  generatedAt: z.string().datetime(),
  errorMessage: z.string().optional(),
});
export type JPKGenerationResult = z.infer<typeof jpkGenerationResultSchema>;

/**
 * Submission result
 */
export const jpkSubmissionResultSchema = z.object({
  success: z.boolean(),
  reportId: z.string().uuid(),
  referenceNumber: z.string().optional(),
  status: jpkReportStatusSchema,
  submittedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
});
export type JPKSubmissionResult = z.infer<typeof jpkSubmissionResultSchema>;

/**
 * Status check result
 */
export const jpkStatusResultSchema = z.object({
  reportId: z.string().uuid(),
  status: jpkReportStatusSchema,
  referenceNumber: z.string().optional(),
  upoNumber: z.string().optional(),
  upoReceivedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  processingStage: z.string().optional(),
});
export type JPKStatusResult = z.infer<typeof jpkStatusResultSchema>;

/**
 * Report summary with records
 */
export const jpkReportSummarySchema = z.object({
  report: jpkReportSchema,
  saleRecords: z.array(jpkV7SaleRecordSchema).optional(),
  purchaseRecords: z.array(jpkV7PurchaseRecordSchema).optional(),
  declaration: jpkV7DeclarationSchema.optional(),
  validation: jpkValidationResultSchema.optional(),
});
export type JPKReportSummary = z.infer<typeof jpkReportSummarySchema>;

/**
 * List reports result
 */
export const listJPKReportsResultSchema = z.object({
  reports: z.array(jpkReportSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});
export type ListJPKReportsResult = z.infer<typeof listJPKReportsResultSchema>;

/**
 * Import result
 */
export const importRecordsResultSchema = z.object({
  success: z.boolean(),
  importedSaleRecords: z.number().int().min(0),
  importedPurchaseRecords: z.number().int().min(0),
  skippedRecords: z.number().int().min(0),
  errors: z.array(z.object({
    transactionId: z.string(),
    message: z.string(),
  })),
});
export type ImportRecordsResult = z.infer<typeof importRecordsResultSchema>;

/**
 * Download result
 */
export const downloadResultSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number().int(),
  content: z.string(), // Base64 encoded
});
export type DownloadResult = z.infer<typeof downloadResultSchema>;

// ===========================================================================
// CONSTANTS
// ===========================================================================

/**
 * Ministry of Finance API endpoints
 */
export const JPK_API_ENDPOINTS = {
  TEST: 'https://bramka-v3.t.mf.gov.pl',
  PRODUCTION: 'https://bramka-v3.mf.gov.pl',
} as const;

/**
 * XSD Schema versions
 */
export const JPK_SCHEMA_VERSIONS = {
  JPK_V7M: '1-2E',
  JPK_V7K: '1-2E',
  JPK_FA: '4',
  JPK_KR: '2',
  JPK_WB: '2',
  JPK_MAG: '1',
  JPK_PKPIR: '2',
  JPK_EWP: '2',
} as const;

/**
 * Polish tax office codes (sample - full list has 400+ entries)
 */
export const TAX_OFFICE_CODES = {
  '1401': { name: 'Urząd Skarbowy Warszawa-Śródmieście', city: 'Warszawa' },
  '1402': { name: 'Urząd Skarbowy Warszawa-Mokotów', city: 'Warszawa' },
  '1201': { name: 'Pierwszy Urząd Skarbowy Kraków', city: 'Kraków' },
  '1437': { name: 'Trzeci Mazowiecki Urząd Skarbowy w Radomiu', city: 'Radom' },
} as const;
