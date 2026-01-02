// TAX-013: White List Verification Schemas
// Manages Polish White List (Biała Lista) verification for VAT payer status and bank accounts

import { z } from 'zod';

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * NIP checksum validation weights
 */
const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

/**
 * Validates Polish NIP number with checksum verification
 */
export function validateWhiteListNIP(nip: string): boolean {
  // Remove formatting
  const cleanNip = nip.replace(/[\s-]/g, '');

  // Must be 10 digits
  if (!/^\d{10}$/.test(cleanNip)) {
    return false;
  }

  // Calculate checksum
  const digits = cleanNip.split('').map(Number);
  const sum = NIP_WEIGHTS.reduce((acc, weight, i) => acc + weight * (digits[i] ?? 0), 0);
  const checksum = sum % 11;

  // Checksum must equal the last digit (and cannot be 10)
  return checksum !== 10 && checksum === digits[9];
}

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Verification types
 */
export const verificationTypeSchema = z.enum([
  'nip_only',
  'iban_only',
  'nip_and_iban',
  'batch',
]);
export type VerificationType = z.infer<typeof verificationTypeSchema>;

/**
 * Verification context types
 */
export const verificationContextTypeSchema = z.enum([
  'manual',
  'invoice',
  'payment',
  'scheduled',
  'api',
]);
export type VerificationContextType = z.infer<typeof verificationContextTypeSchema>;

/**
 * NIP/VAT status from MF API
 */
export const nipStatusSchema = z.enum([
  'active',        // Czynny - active VAT payer
  'inactive',      // Zwolniony - VAT exempt
  'not_registered', // Niezarejestrowany - not registered
  'error',         // Error during verification
]);
export type NIPStatus = z.infer<typeof nipStatusSchema>;

/**
 * Risk level assessment
 */
export const whiteListRiskLevelSchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);
export type WhiteListRiskLevel = z.infer<typeof whiteListRiskLevelSchema>;

/**
 * Alert types
 */
export const whiteListAlertTypeSchema = z.enum([
  'unverified_payment',
  'verification_failed',
  'account_not_registered',
  'vat_status_changed',
  'split_payment_required',
  'verification_expired',
]);
export type WhiteListAlertType = z.infer<typeof whiteListAlertTypeSchema>;

/**
 * Alert severity levels
 */
export const whiteListAlertSeveritySchema = z.enum([
  'info',
  'warning',
  'error',
  'critical',
]);
export type WhiteListAlertSeverity = z.infer<typeof whiteListAlertSeveritySchema>;

/**
 * Alert status
 */
export const whiteListAlertStatusSchema = z.enum([
  'open',
  'acknowledged',
  'resolved',
  'escalated',
  'dismissed',
]);
export type WhiteListAlertStatus = z.infer<typeof whiteListAlertStatusSchema>;

/**
 * Batch job types
 */
export const batchJobTypeSchema = z.enum([
  'client_verification',
  'payment_check',
  'expiring_cache_refresh',
]);
export type BatchJobType = z.infer<typeof batchJobTypeSchema>;

/**
 * Batch job status
 */
export const batchJobStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type BatchJobStatus = z.infer<typeof batchJobStatusSchema>;

/**
 * Payment authorization status
 */
export const paymentAuthorizationStatusSchema = z.enum([
  'approved',
  'requires_split_payment',
  'blocked_unregistered_account',
  'blocked_inactive_vat',
  'blocked_verification_failed',
  'warning_below_threshold',
]);
export type PaymentAuthorizationStatus = z.infer<typeof paymentAuthorizationStatusSchema>;

// =========================================================================
// BASE VALIDATION SCHEMAS
// =========================================================================

/**
 * Polish NIP validation with checksum
 * Transforms and validates NIP format and checksum
 */
export const nipSchema = z.string()
  .transform(val => val.replace(/[\s-]/g, ''))
  .refine(val => /^\d{10}$/.test(val), {
    message: 'NIP must be 10 digits',
  })
  .refine(val => validateWhiteListNIP(val), {
    message: 'Invalid NIP checksum',
  });

/**
 * Polish IBAN validation
 * Validates and normalizes Polish bank account numbers
 */
export const polishIBANSchema = z.string()
  .transform(val => val.replace(/\s/g, '').toUpperCase())
  .refine(val => /^(PL)?\d{26}$/.test(val), {
    message: 'Invalid Polish IBAN format - must be 26 digits with optional PL prefix',
  })
  .transform(val => val.startsWith('PL') ? val : `PL${val}`);

// =========================================================================
// INPUT SCHEMAS - Verification Requests
// =========================================================================

/**
 * Verify NIP against White List
 */
export const verifyNIPRequestSchema = z.object({
  nip: nipSchema,
  date: z.string().date().optional(), // Verification date, defaults to today
  forceRefresh: z.boolean().default(false),
});
export type VerifyNIPRequestInput = z.infer<typeof verifyNIPRequestSchema>;

/**
 * Verify NIP and IBAN combination
 */
export const verifyIBANRequestSchema = z.object({
  nip: nipSchema,
  iban: polishIBANSchema,
  amount: z.number().positive().optional(),
  date: z.string().date().optional(),
  forceRefresh: z.boolean().default(false),
});
export type VerifyIBANRequestInput = z.infer<typeof verifyIBANRequestSchema>;

/**
 * Batch verification request
 */
export const batchVerifyRequestSchema = z.object({
  nips: z.array(nipSchema).min(1).max(30),
  date: z.string().date().optional(),
  forceRefresh: z.boolean().default(false),
});
export type BatchVerifyRequestInput = z.infer<typeof batchVerifyRequestSchema>;

/**
 * Payment verification request
 */
export const paymentVerificationRequestSchema = z.object({
  recipientNip: nipSchema,
  recipientIban: polishIBANSchema,
  amount: z.number().positive(),
  paymentDate: z.string().date(),
  invoiceId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  pkdCodes: z.array(z.string()).optional(), // For split payment detection
  forceRefresh: z.boolean().default(false),
});
export type PaymentVerificationRequestInput = z.infer<typeof paymentVerificationRequestSchema>;

// =========================================================================
// INPUT SCHEMAS - History and Filters
// =========================================================================

/**
 * Verification history filter
 */
export const verificationHistoryFilterSchema = z.object({
  nip: nipSchema.optional(),
  clientId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  status: nipStatusSchema.optional(),
  riskLevel: whiteListRiskLevelSchema.optional(),
  verificationType: verificationTypeSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type VerificationHistoryFilterInput = z.infer<typeof verificationHistoryFilterSchema>;

/**
 * Get verification by ID
 */
export const getVerificationByIdSchema = z.object({
  verificationId: z.string().uuid(),
});
export type GetVerificationByIdInput = z.infer<typeof getVerificationByIdSchema>;

// =========================================================================
// INPUT SCHEMAS - Alerts
// =========================================================================

/**
 * Get alerts filter
 */
export const getAlertsSchema = z.object({
  status: whiteListAlertStatusSchema.optional(),
  severity: whiteListAlertSeveritySchema.optional(),
  alertType: whiteListAlertTypeSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type GetAlertsInput = z.infer<typeof getAlertsSchema>;

/**
 * Create alert
 */
export const createAlertSchema = z.object({
  alertType: whiteListAlertTypeSchema,
  severity: whiteListAlertSeveritySchema,
  nip: nipSchema.optional(),
  iban: polishIBANSchema.optional(),
  paymentId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  title: z.string().max(200),
  message: z.string(),
  amount: z.number().positive().optional(),
  deadline: z.string().datetime().optional(),
});
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

/**
 * Resolve alert
 */
export const resolveAlertSchema = z.object({
  alertId: z.string().uuid(),
  status: z.enum(['resolved', 'dismissed']),
  resolutionNotes: z.string().optional(),
});
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>;

/**
 * Acknowledge alert
 */
export const acknowledgeAlertSchema = z.object({
  alertId: z.string().uuid(),
});
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;

/**
 * Escalate alert
 */
export const escalateAlertSchema = z.object({
  alertId: z.string().uuid(),
  escalateTo: z.string().uuid(),
  notes: z.string().optional(),
});
export type EscalateAlertInput = z.infer<typeof escalateAlertSchema>;

// =========================================================================
// INPUT SCHEMAS - Configuration
// =========================================================================

/**
 * Alert recipient configuration
 */
export const alertRecipientSchema = z.object({
  userId: z.string().uuid(),
  email: z.boolean().default(true),
  sms: z.boolean().default(false),
});
export type AlertRecipient = z.infer<typeof alertRecipientSchema>;

/**
 * White List configuration
 */
export const whiteListConfigSchema = z.object({
  autoVerifyInvoices: z.boolean().default(true),
  autoVerifyPayments: z.boolean().default(true),
  verificationThreshold: z.number().min(0).default(15000),
  blockUnverifiedInvoices: z.boolean().default(false),
  blockUnverifiedPayments: z.boolean().default(true),
  cacheDurationHours: z.number().min(1).max(24).default(24),
  forceFreshOnPayment: z.boolean().default(true),
  alertThresholdHours: z.number().min(1).default(24),
  escalationThresholdHours: z.number().min(1).default(48),
  alertRecipients: z.array(alertRecipientSchema).default([]),
  autoDetectSplitPayment: z.boolean().default(true),
  splitPaymentPkdCodes: z.array(z.string()).default([]),
  apiTimeoutMs: z.number().min(1000).max(30000).default(5000),
  maxRetries: z.number().min(1).max(5).default(3),
});
export type WhiteListConfig = z.infer<typeof whiteListConfigSchema>;

/**
 * Update configuration
 */
export const updateWhiteListConfigSchema = whiteListConfigSchema.partial();
export type UpdateWhiteListConfigInput = z.infer<typeof updateWhiteListConfigSchema>;

// =========================================================================
// INPUT SCHEMAS - Export
// =========================================================================

/**
 * Export verification history
 */
export const exportHistorySchema = z.object({
  nip: nipSchema.optional(),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  format: z.enum(['pdf', 'csv', 'json']),
});
export type ExportHistoryInput = z.infer<typeof exportHistorySchema>;

// =========================================================================
// OUTPUT SCHEMAS - Verification Results
// =========================================================================

/**
 * Registered bank account info
 */
export const registeredAccountSchema = z.object({
  iban: z.string(),
  bankName: z.string().nullable(),
  assignmentDate: z.string().date().nullable(),
});
export type RegisteredAccount = z.infer<typeof registeredAccountSchema>;

/**
 * Verification result
 */
export const verificationResultSchema = z.object({
  verificationId: z.string().uuid(),
  nip: z.string(),
  iban: z.string().optional(),

  // NIP verification
  nipStatus: nipStatusSchema,
  registrationDate: z.string().date().nullable(),
  deregistrationDate: z.string().date().nullable(),

  // Subject details
  subjectName: z.string().nullable(),
  subjectAddress: z.string().nullable(),
  krs: z.string().nullable(),
  regon: z.string().nullable(),

  // IBAN verification
  ibanRegistered: z.boolean().nullable(),
  registeredAccounts: z.array(registeredAccountSchema),

  // Risk assessment
  riskLevel: whiteListRiskLevelSchema,
  riskReasons: z.array(z.string()),
  requiresSplitPayment: z.boolean(),

  // Cache info
  isCached: z.boolean(),
  verifiedAt: z.string().datetime(),
  cacheExpiresAt: z.string().datetime().nullable(),

  // Request metadata
  requestId: z.string(),
  responseTimeMs: z.number(),
});
export type VerificationResult = z.infer<typeof verificationResultSchema>;

/**
 * Payment authorization result
 */
export const paymentAuthorizationResultSchema = z.object({
  authorized: z.boolean(),
  status: paymentAuthorizationStatusSchema,
  verification: verificationResultSchema,
  message: z.string(),
  recommendations: z.array(z.string()),
});
export type PaymentAuthorizationResult = z.infer<typeof paymentAuthorizationResultSchema>;

/**
 * Batch verification summary
 */
export const batchVerificationSummarySchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  inactive: z.number().int(),
  notRegistered: z.number().int(),
  errors: z.number().int(),
});
export type BatchVerificationSummary = z.infer<typeof batchVerificationSummarySchema>;

/**
 * Batch verification result
 */
export const batchVerificationResultSchema = z.object({
  results: z.array(verificationResultSchema),
  summary: batchVerificationSummarySchema,
});
export type BatchVerificationResult = z.infer<typeof batchVerificationResultSchema>;

// =========================================================================
// OUTPUT SCHEMAS - Entities
// =========================================================================

/**
 * White List verification entity
 */
export const whiteListVerificationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),

  // Subject of verification
  nip: z.string(),
  iban: z.string().nullable(),

  // Verification context
  verificationType: verificationTypeSchema,
  contextType: verificationContextTypeSchema.nullable(),
  contextReferenceId: z.string().uuid().nullable(),
  contextReferenceType: z.string().nullable(),

  // Request details
  requestId: z.string().nullable(),
  requestTimestamp: z.date(),
  requestDate: z.date(),

  // Response details
  responseTimestamp: z.date().nullable(),
  responseTimeMs: z.number().nullable(),

  // NIP verification result
  nipStatus: nipStatusSchema.nullable(),
  registrationDate: z.date().nullable(),
  deregistrationDate: z.date().nullable(),
  restorationDate: z.date().nullable(),

  // IBAN verification result
  ibanRegistered: z.boolean().nullable(),
  ibanAssignmentDate: z.date().nullable(),

  // Subject details
  subjectName: z.string().nullable(),
  subjectLegalForm: z.string().nullable(),
  subjectAddress: z.string().nullable(),
  krsNumber: z.string().nullable(),
  regon: z.string().nullable(),

  // Registered accounts
  registeredAccounts: z.array(z.any()).default([]),

  // Risk assessment
  amountVerified: z.string().nullable(),
  requiresSplitPayment: z.boolean().default(false),
  riskLevel: whiteListRiskLevelSchema.default('low'),
  riskReasons: z.array(z.string()).default([]),

  // Metadata
  verifiedBy: z.string().uuid().nullable(),
  isCached: z.boolean().default(false),
  cacheSourceId: z.string().uuid().nullable(),

  createdAt: z.date(),
});
export type WhiteListVerification = z.infer<typeof whiteListVerificationSchema>;

/**
 * White List alert entity
 */
export const whiteListAlertSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),

  // Alert context
  alertType: whiteListAlertTypeSchema,
  severity: whiteListAlertSeveritySchema,

  // Related entities
  nip: z.string().nullable(),
  iban: z.string().nullable(),
  paymentId: z.string().uuid().nullable(),
  invoiceId: z.string().uuid().nullable(),
  verificationId: z.string().uuid().nullable(),

  // Alert details
  title: z.string(),
  message: z.string(),
  amount: z.string().nullable(),
  deadline: z.date().nullable(),

  // Resolution
  status: whiteListAlertStatusSchema.default('open'),
  resolvedAt: z.date().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  resolutionNotes: z.string().nullable(),

  // Escalation
  escalatedAt: z.date().nullable(),
  escalatedTo: z.string().uuid().nullable(),

  // Notifications
  notificationsSent: z.array(z.any()).default([]),

  createdAt: z.date(),
  updatedAt: z.date(),
});
export type WhiteListAlert = z.infer<typeof whiteListAlertSchema>;

/**
 * Batch job entity
 */
export const whiteListBatchJobSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),

  // Job details
  jobType: batchJobTypeSchema,
  status: batchJobStatusSchema.default('pending'),

  // Input
  inputNips: z.array(z.string()),
  totalCount: z.number().int(),

  // Progress
  processedCount: z.number().int().default(0),
  successCount: z.number().int().default(0),
  failureCount: z.number().int().default(0),

  // Results
  results: z.record(z.any()).default({}),
  errors: z.array(z.any()).default([]),

  // Timing
  scheduledAt: z.date().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),

  // Metadata
  createdBy: z.string().uuid().nullable(),
  createdAt: z.date(),
});
export type WhiteListBatchJob = z.infer<typeof whiteListBatchJobSchema>;

// =========================================================================
// OUTPUT SCHEMAS - Lists and Pagination
// =========================================================================

/**
 * Pagination info
 */
export const paginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  pages: z.number().int(),
});
export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Verification history result
 */
export const verificationHistoryResultSchema = z.object({
  verifications: z.array(whiteListVerificationSchema),
  pagination: paginationSchema,
});
export type VerificationHistoryResult = z.infer<typeof verificationHistoryResultSchema>;

/**
 * Alert list result
 */
export const alertListResultSchema = z.object({
  alerts: z.array(whiteListAlertSchema),
  pagination: paginationSchema,
});
export type AlertListResult = z.infer<typeof alertListResultSchema>;

/**
 * Export result
 */
export const exportResultSchema = z.object({
  content: z.string(),
  filename: z.string(),
  contentType: z.string(),
});
export type ExportResult = z.infer<typeof exportResultSchema>;

// =========================================================================
// CONSTANTS
// =========================================================================

/**
 * Risk thresholds for payment verification
 */
export const RISK_THRESHOLDS = {
  MANDATORY_VERIFICATION_AMOUNT: 15000,
  HIGH_RISK_AMOUNT: 50000,
  CRITICAL_RISK_AMOUNT: 100000,
} as const;

/**
 * Annex 15 PKD codes requiring split payment
 * These are goods/services listed in Annex 15 to VAT Act
 */
export const SPLIT_PAYMENT_PKD_CODES = [
  '46.71', // Wholesale of fuels
  '46.72', // Wholesale of metals
  '46.77', // Wholesale of waste and scrap
  '47.30', // Retail sale of automotive fuel
  '25.11', // Manufacture of metal structures
  '25.12', // Manufacture of doors and windows
  '25.50', // Forging, pressing, stamping
  '25.61', // Treatment and coating of metals
  '25.62', // Machining
  '38.11', // Collection of non-hazardous waste
  '38.12', // Collection of hazardous waste
  '38.32', // Recovery of sorted materials
  '41.20', // Construction of buildings
  '42.11', // Construction of roads and motorways
  '42.21', // Construction of utility projects for fluids
  '42.22', // Construction of utility projects for electricity
  '42.99', // Construction of other civil engineering projects
  '43.11', // Demolition
  '43.12', // Site preparation
  '43.13', // Test drilling and boring
  '43.21', // Electrical installation
  '43.22', // Plumbing, heat and air-conditioning installation
  '43.29', // Other construction installation
  '43.31', // Plastering
  '43.32', // Joinery installation
  '43.33', // Floor and wall covering
  '43.34', // Painting and glazing
  '43.39', // Other building completion and finishing
  '43.91', // Roofing activities
  '43.99', // Other specialized construction activities
] as const;

/**
 * Polish bank codes mapping
 */
export const POLISH_BANK_CODES: Record<string, string> = {
  '1010': 'NBP',
  '1020': 'PKO BP',
  '1050': 'ING Bank Śląski',
  '1090': 'Santander Bank Polska',
  '1140': 'mBank',
  '1160': 'Bank Millennium',
  '1240': 'Pekao SA',
  '1320': 'Bank Pocztowy',
  '1540': 'BOŚ Bank',
  '1580': 'Mercedes-Benz Bank',
  '1610': 'SGB-Bank',
  '1680': 'Plus Bank',
  '1870': 'Nest Bank',
  '1930': 'Bank Polskiej Spółdzielczości',
  '1940': 'Credit Agricole',
  '2030': 'BNP Paribas',
  '2120': 'Santander Consumer',
  '2130': 'Volkswagen Bank',
  '2160': 'Toyota Bank',
  '2480': 'Getin Noble Bank',
  '2490': 'Alior Bank',
};
