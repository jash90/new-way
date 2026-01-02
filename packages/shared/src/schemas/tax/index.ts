// TAX (Tax Compliance) Module Schemas

// ===========================================================================
// CLIENT TAX CONFIGURATION (TAX-001)
// ===========================================================================

export {
  // Enums
  vatStatusSchema,
  vatPeriodSchema,
  incomeTaxFormSchema,
  pitTaxOptionSchema,
  zusTypeSchema,
  submissionMethodSchema,
  authorizationScopeSchema,
  auditActionSchema,
  nipSchema,

  // Helper functions
  validateNIP,

  // Configuration CRUD schemas
  createTaxConfigurationSchema,
  getTaxConfigurationSchema,
  getTaxConfigurationByClientSchema,
  listTaxConfigurationsSchema,
  updateTaxConfigurationSchema,
  deleteTaxConfigurationSchema,

  // Representative schemas
  addTaxRepresentativeSchema,
  updateTaxRepresentativeSchema,
  removeTaxRepresentativeSchema,
  listTaxRepresentativesSchema,

  // History and restore schemas
  getConfigurationHistorySchema,
  restoreConfigurationSchema,

  // Validation schemas
  validateConfigurationSchema,
  checkSmallTaxpayerStatusSchema,
  checkEstonianCitEligibilitySchema,
} from './tax-configuration.schema';

export type {
  // Enum types
  VATStatus,
  VATPeriod,
  IncomeTaxForm,
  PITTaxOption,
  ZUSType,
  SubmissionMethod,
  AuthorizationScope,
  AuditAction,

  // Entity types
  TaxConfiguration,
  TaxRepresentative,
  TaxConfigurationAudit,
  TaxConfigurationResponse,

  // Configuration input types
  CreateTaxConfigurationInput,
  GetTaxConfigurationInput,
  GetTaxConfigurationByClientInput,
  ListTaxConfigurationsInput,
  UpdateTaxConfigurationInput,
  DeleteTaxConfigurationInput,

  // Representative input types
  AddTaxRepresentativeInput,
  UpdateTaxRepresentativeInput,
  RemoveTaxRepresentativeInput,
  ListTaxRepresentativesInput,

  // History input types
  GetConfigurationHistoryInput,
  RestoreConfigurationInput,

  // Validation input types
  ValidateConfigurationInput,
  CheckSmallTaxpayerStatusInput,
  CheckEstonianCitEligibilityInput,

  // Result types
  CreateTaxConfigurationResult,
  ListTaxConfigurationsResult,
  UpdateTaxConfigurationResult,
  DeleteTaxConfigurationResult,
  AddTaxRepresentativeResult,
  UpdateTaxRepresentativeResult,
  RemoveTaxRepresentativeResult,
  ListTaxRepresentativesResult,
  ConfigurationHistoryEntry,
  GetConfigurationHistoryResult,
  RestoreConfigurationResult,
  ValidationIssue,
  ValidateConfigurationResult,
  CheckSmallTaxpayerStatusResult,
  EstonianCitRequirements,
  CheckEstonianCitEligibilityResult,
} from './tax-configuration.schema';

// ===========================================================================
// TAX RATES AND RULES MANAGEMENT (TAX-002)
// ===========================================================================

export {
  // Enums
  taxTypeSchema,
  appliesTo,
  vatRateCodeSchema,
  citRateCodeSchema,
  pitRateCodeSchema,
  zusRateCodeSchema,
  pitCalculationOptionSchema,
  activityTypeSchema,
  zusContributorTypeSchema,
  zusSelfEmployedTypeSchema,
  taxRateAuditActionSchema,

  // Entity schemas
  taxRateSchema,
  taxThresholdSchema,
  zusContributionBaseSchema,
  taxRateAuditSchema,

  // Get rates schemas
  getRatesSchema,
  getRateByCodeSchema,
  getRatesResultSchema,

  // Get thresholds schemas
  getThresholdsSchema,
  getThresholdsResultSchema,

  // Get ZUS bases schemas
  getZUSBasesSchema,
  getZUSBasesResultSchema,

  // VAT calculation schemas
  calculateVATSchema,
  calculateVATResultSchema,

  // PIT calculation schemas
  calculatePITSchema,
  pitBracketResultSchema,
  calculatePITResultSchema,

  // ZUS calculation schemas
  calculateZUSSchema,
  zusContributionDetailSchema,
  zusContributionsSchema,
  calculateZUSResultSchema,

  // Admin rate management schemas
  updateTaxRateSchema,
  updateTaxRateResultSchema,
  createTaxRateSchema,
  createTaxRateResultSchema,

  // Rate history schemas
  getRateHistorySchema,
  getRateHistoryResultSchema,

  // Impact analysis schemas
  analyzeRateChangeImpactSchema,
  analyzeRateChangeImpactResultSchema,

  // Lump sum rate schemas
  getLumpSumRateSchema,
  getLumpSumRateResultSchema,

  // Summary schemas
  getCurrentRatesSummarySchema,
  getCurrentRatesSummaryResultSchema,
} from './tax-rates.schema';

export type {
  // Enum types
  TaxType,
  AppliesTo,
  VATRateCode,
  CITRateCode,
  PITRateCode,
  ZUSRateCode,
  PITCalculationOption,
  ActivityType,
  ZUSContributorType,
  ZUSSelfEmployedType,
  TaxRateAuditAction,

  // Entity types
  TaxRate,
  TaxThreshold,
  ZUSContributionBase,
  TaxRateAudit,

  // Get rates types
  GetRatesInput,
  GetRateByCodeInput,
  GetRatesResult,

  // Get thresholds types
  GetThresholdsInput,
  GetThresholdsResult,

  // Get ZUS bases types
  GetZUSBasesInput,
  GetZUSBasesResult,

  // VAT calculation types
  CalculateVATInput,
  CalculateVATResult,

  // PIT calculation types
  CalculatePITInput,
  PITBracketResult,
  CalculatePITResult,

  // ZUS calculation types
  CalculateZUSInput,
  ZUSContributionDetail,
  ZUSContributions,
  CalculateZUSResult,

  // Admin rate management types
  UpdateTaxRateInput,
  UpdateTaxRateResult,
  CreateTaxRateInput,
  CreateTaxRateResult,

  // Rate history types
  GetRateHistoryInput,
  GetRateHistoryResult,

  // Impact analysis types
  AnalyzeRateChangeImpactInput,
  AnalyzeRateChangeImpactResult,

  // Lump sum rate types
  GetLumpSumRateInput,
  GetLumpSumRateResult,

  // Summary types
  GetCurrentRatesSummaryInput,
  GetCurrentRatesSummaryResult,
} from './tax-rates.schema';

// ===========================================================================
// TAX DEADLINE MANAGEMENT (TAX-003)
// ===========================================================================

export {
  // Enums
  deadlineTaxTypeSchema,
  deadlineStatusSchema,
  reminderLevelSchema,
  notificationChannelSchema,
  reminderStatusSchema,
  deadlineTypeCodeSchema,

  // Entity schemas
  taxDeadlineTypeSchema,
  polishHolidaySchema,
  clientTaxDeadlineSchema,
  deadlineReminderConfigSchema,
  deadlineReminderSentSchema,

  // Deadline retrieval schemas
  getDeadlinesSchema,
  getCalendarSchema,
  getHolidaysSchema,
  getDeadlineByIdSchema,
  getDeadlineTypesSchema,

  // Deadline management schemas
  generateDeadlinesSchema,
  updateDeadlineStatusSchema,
  calculateAdjustedDeadlineSchema,
  updateOverdueDeadlinesSchema,

  // Reminder configuration schemas
  configureRemindersSchema,
  getReminderConfigsSchema,
  snoozeReminderSchema,
  getPendingRemindersSchema,

  // Output schemas
  calendarSummarySchema,
  getCalendarResultSchema,
  adjustedDeadlineResultSchema,
  generateDeadlinesResultSchema,
  updateOverdueResultSchema,
  reminderNotificationResultSchema,
  clientDeadlineWithRelationsSchema,
  upcomingDeadlinesSummarySchema,
} from './tax-deadlines.schema';

export type {
  // Enum types
  DeadlineTaxType,
  DeadlineStatus,
  ReminderLevel,
  NotificationChannel,
  ReminderStatus,
  DeadlineTypeCode,

  // Entity types
  TaxDeadlineType,
  PolishHoliday,
  ClientTaxDeadline,
  DeadlineReminderConfig,
  DeadlineReminderSent,

  // Deadline retrieval types
  GetDeadlinesInput,
  GetCalendarInput,
  GetHolidaysInput,
  GetDeadlineByIdInput,
  GetDeadlineTypesInput,

  // Deadline management types
  GenerateDeadlinesInput,
  UpdateDeadlineStatusInput,
  CalculateAdjustedDeadlineInput,
  UpdateOverdueDeadlinesInput,

  // Reminder configuration types
  ConfigureRemindersInput,
  GetReminderConfigsInput,
  SnoozeReminderInput,
  GetPendingRemindersInput,

  // Output types
  CalendarSummary,
  GetCalendarResult,
  AdjustedDeadlineResult,
  GenerateDeadlinesResult,
  UpdateOverdueResult,
  ReminderNotificationResult,
  ClientDeadlineWithRelations,
  UpcomingDeadlinesSummary,
} from './tax-deadlines.schema';

// ===========================================================================
// VAT CALCULATION ENGINE (TAX-004)
// ===========================================================================

export {
  // Enums
  vatTransactionTypeSchema,
  vatDirectionSchema,
  vatRateCodeSchema as vatRateCodeSchema004, // Alias to avoid conflict with TAX-002
  vatTransactionStatusSchema,
  vatPeriodStatusSchema,
  vatPeriodTypeSchema,
  carryForwardStatusSchema,
  gtuCodeSchema,
  procedureCodeSchema,
  refundOptionSchema,

  // Entity schemas
  vatTransactionSchema,
  vatPeriodSummarySchema,
  vatCarryForwardSchema,
  euVatVerificationSchema,

  // Calculation input schemas
  calculateVatInputSchema,
  recordVatTransactionSchema,
  processWntSchema,
  processWdtSchema,
  processImportServicesSchema,
  createVatCorrectionSchema,

  // Settlement input schemas
  getVatSettlementSchema,
  finalizeVatSettlementSchema,
  applyCarryForwardSchema,

  // Retrieval input schemas
  getVatTransactionsSchema,
  getVatTransactionByIdSchema,
  verifyEuVatIdSchema,
  getCarryForwardsSchema,
  getPeriodSummariesSchema,

  // Output schemas
  vatCalculationResultSchema,
  outputVatBreakdownSchema,
  inputVatBreakdownSchema,
  vatSettlementBreakdownSchema,
  vatSettlementResultSchema,
  euVatVerificationResultSchema,
  vatTransactionWithCalculationSchema,
  vatCorrectionResultSchema,
  carryForwardWithHistorySchema,
  ossTransactionSummarySchema,
  ossDeclarationDataSchema,
} from './vat-calculation.schema';

export type {
  // Enum types
  VatTransactionType,
  VatDirection,
  VatRateCode,
  VatTransactionStatus,
  VatPeriodStatus,
  VatPeriodType,
  CarryForwardStatus,
  GtuCode,
  ProcedureCode,
  RefundOption,

  // Entity types
  VatTransaction,
  VatPeriodSummary,
  VatCarryForward,
  EuVatVerification,

  // Calculation input types
  CalculateVatInput,
  RecordVatTransactionInput,
  ProcessWntInput,
  ProcessWdtInput,
  ProcessImportServicesInput,
  CreateVatCorrectionInput,

  // Settlement input types
  GetVatSettlementInput,
  FinalizeVatSettlementInput,
  ApplyCarryForwardInput,

  // Retrieval input types
  GetVatTransactionsInput,
  GetVatTransactionByIdInput,
  VerifyEuVatIdInput,
  GetCarryForwardsInput,
  GetPeriodSummariesInput,

  // Output types
  VatCalculationResult,
  OutputVatBreakdown,
  InputVatBreakdown,
  VatSettlementBreakdown,
  VatSettlementResult,
  EuVatVerificationResult,
  VatTransactionWithCalculation,
  VatCorrectionResult,
  CarryForwardWithHistory,
  OssTransactionSummary,
  OssDeclarationData,
} from './vat-calculation.schema';

// ===========================================================================
// WHITE LIST VERIFICATION (TAX-013)
// ===========================================================================

export {
  // Helper functions
  validateWhiteListNIP,

  // Enums
  verificationTypeSchema,
  verificationContextTypeSchema,
  nipStatusSchema,
  whiteListRiskLevelSchema,
  whiteListAlertTypeSchema,
  whiteListAlertSeveritySchema,
  whiteListAlertStatusSchema,
  batchJobTypeSchema,
  batchJobStatusSchema,
  paymentAuthorizationStatusSchema,

  // Base validation schemas
  nipSchema as whiteListNipSchema, // Alias to avoid conflict with TAX-001
  polishIBANSchema,

  // Verification request schemas
  verifyNIPRequestSchema,
  verifyIBANRequestSchema,
  batchVerifyRequestSchema,
  paymentVerificationRequestSchema,

  // History and filter schemas
  verificationHistoryFilterSchema,
  getVerificationByIdSchema,

  // Alert schemas (prefixed to avoid conflict with AIM module)
  getAlertsSchema as getWhiteListAlertsSchema,
  createAlertSchema as createWhiteListAlertSchema,
  resolveAlertSchema as resolveWhiteListAlertSchema,
  acknowledgeAlertSchema as acknowledgeWhiteListAlertSchema,
  escalateAlertSchema as escalateWhiteListAlertSchema,

  // Configuration schemas
  alertRecipientSchema,
  whiteListConfigSchema,
  updateWhiteListConfigSchema,

  // Export schemas
  exportHistorySchema,

  // Output schemas
  registeredAccountSchema,
  verificationResultSchema,
  paymentAuthorizationResultSchema,
  batchVerificationSummarySchema,
  batchVerificationResultSchema,

  // Entity schemas
  whiteListVerificationSchema,
  whiteListAlertSchema,
  whiteListBatchJobSchema,

  // Pagination and list schemas
  paginationSchema,
  verificationHistoryResultSchema,
  alertListResultSchema,
  exportResultSchema,

  // Constants
  RISK_THRESHOLDS,
  SPLIT_PAYMENT_PKD_CODES,
  POLISH_BANK_CODES,
} from './white-list.schema';

export type {
  // Enum types
  VerificationType,
  VerificationContextType,
  NIPStatus,
  WhiteListRiskLevel,
  WhiteListAlertType,
  WhiteListAlertSeverity,
  WhiteListAlertStatus,
  BatchJobType,
  BatchJobStatus,
  PaymentAuthorizationStatus,

  // Verification request input types
  VerifyNIPRequestInput,
  VerifyIBANRequestInput,
  BatchVerifyRequestInput,
  PaymentVerificationRequestInput,

  // History and filter input types
  VerificationHistoryFilterInput,
  GetVerificationByIdInput,

  // Alert input types (prefixed to avoid conflict with AIM module)
  GetAlertsInput as GetWhiteListAlertsInput,
  CreateAlertInput as CreateWhiteListAlertInput,
  ResolveAlertInput as ResolveWhiteListAlertInput,
  AcknowledgeAlertInput as AcknowledgeWhiteListAlertInput,
  EscalateAlertInput as EscalateWhiteListAlertInput,

  // Configuration types
  AlertRecipient,
  WhiteListConfig,
  UpdateWhiteListConfigInput,

  // Export input types
  ExportHistoryInput,

  // Output types
  RegisteredAccount,
  VerificationResult,
  PaymentAuthorizationResult,
  BatchVerificationSummary,
  BatchVerificationResult,

  // Entity types
  WhiteListVerification,
  WhiteListAlert,
  WhiteListBatchJob,

  // Pagination and list types
  Pagination,
  VerificationHistoryResult,
  AlertListResult,
  ExportResult,
} from './white-list.schema';

// ===========================================================================
// INCOME TAX DECLARATION (TAX-005)
// ===========================================================================

export {
  // Enums
  incomeTaxTypeSchema,
  declarationTypeSchema,
  citFormTypeSchema,
  pitFormTypeSchema,
  taxCalculationMethodSchema,
  declarationStatusSchema,
  advancePeriodTypeSchema,

  // Entity schemas
  incomeTaxDeclarationSchema,
  taxAdvancePaymentSchema,
  lossCarryForwardSchema,

  // CIT calculation schemas
  calculateCITSchema,
  calculatePITDeclarationSchema,

  // Declaration management schemas
  createDeclarationSchema,
  updateDeclarationSchema,
  calculateDeclarationSchema,
  submitDeclarationSchema,
  createDeclarationCorrectionSchema,
  getDeclarationSchema,
  listDeclarationsSchema,
  deleteDeclarationSchema,

  // Advance payment schemas
  calculateAdvanceSchema,
  recordAdvancePaymentSchema,
  getAdvanceScheduleSchema,

  // Loss carry forward schemas
  getLossCarryForwardSchema,
  applyLossSchema,

  // Output schemas
  citCalculationResultSchema,
  pitCalculationResultSchema,
  declarationSummarySchema,
  advanceScheduleSchema,
  listDeclarationsResultSchema,

  // Constants
  CIT_RATES,
  PIT_RATES,
  LUMP_SUM_RATES,
  SMALL_TAXPAYER_LIMIT,
  TAX_FREE_AMOUNT,
  HEALTH_DEDUCTION_LIMIT,
} from './income-tax-declaration.schema';

export type {
  // Enum types
  IncomeTaxType,
  DeclarationType,
  CITFormType,
  PITFormType,
  TaxCalculationMethod,
  DeclarationStatus,
  AdvancePeriodType,

  // Entity types
  IncomeTaxDeclaration,
  TaxAdvancePayment,
  LossCarryForward,

  // Input types
  CalculateCITInput,
  CalculatePITDeclarationInput,
  CreateDeclarationInput,
  UpdateDeclarationInput,
  CalculateDeclarationInput,
  SubmitDeclarationInput,
  CreateDeclarationCorrectionInput,
  GetDeclarationInput,
  ListDeclarationsInput,
  DeleteDeclarationInput,
  CalculateAdvanceInput,
  RecordAdvancePaymentInput,
  GetAdvanceScheduleInput,
  GetLossCarryForwardInput,
  ApplyLossInput,

  // Output types
  CITCalculationResult,
  PITCalculationResult,
  DeclarationSummary,
  AdvanceSchedule,
  ListDeclarationsResult,
} from './income-tax-declaration.schema';

// ===========================================================================
// ZUS DECLARATION (TAX-006)
// ===========================================================================

export {
  // Enums
  zusFormTypeSchema,
  zusContributorTypeSchema as zusDeclarationContributorTypeSchema, // Alias to avoid conflict with TAX-002
  zusContributionSchemeSchema,
  zusDeclarationStatusSchema,
  zusInsuranceCodeSchema,
  zusBenefitTypeSchema,

  // Constants
  ZUS_RATES_2024,
  ZUS_BASES_2024,

  // Entity schemas
  zusContributionBreakdownSchema,
  zusInsuredPersonSchema,
  zusDeclarationSchema,
  zusPaymentSchema,

  // Calculation schemas
  calculateEmployeeZUSSchema,
  calculateSelfEmployedZUSSchema,

  // Declaration management schemas
  createZUSDeclarationSchema,
  addInsuredPersonSchema,
  updateInsuredPersonSchema,
  removeInsuredPersonSchema,
  calculateDeclarationTotalsSchema,
  validateZUSDeclarationSchema,
  submitZUSDeclarationSchema,
  createZUSCorrectionSchema,
  getZUSDeclarationSchema,
  listZUSDeclarationsSchema,
  deleteZUSDeclarationSchema,

  // Payment schemas
  calculateZUSPaymentSchema,
  recordZUSPaymentSchema,
  getZUSPaymentScheduleSchema,

  // History and reporting schemas
  getContributionHistorySchema,
  generateAnnualReportSchema,

  // Output schemas
  employeeZUSCalculationResultSchema,
  selfEmployedZUSCalculationResultSchema,
  zusValidationResultSchema,
  zusDeclarationSummarySchema,
  listZUSDeclarationsResultSchema,
  zusPaymentScheduleItemSchema,
  zusPaymentScheduleSchema,
  contributionHistoryEntrySchema,
  annualZUSReportSchema,
} from './zus-declaration.schema';

export type {
  // Enum types
  ZUSFormType,
  ZUSContributorType as ZUSDeclarationContributorType,
  ZUSContributionScheme,
  ZUSDeclarationStatus,
  ZUSInsuranceCode,
  ZUSBenefitType,

  // Entity types
  ZUSContributionBreakdown,
  ZUSInsuredPerson,
  ZUSDeclaration,
  ZUSPayment,

  // Calculation input types
  CalculateEmployeeZUSInput,
  CalculateSelfEmployedZUSInput,

  // Declaration management input types
  CreateZUSDeclarationInput,
  AddInsuredPersonInput,
  UpdateInsuredPersonInput,
  RemoveInsuredPersonInput,
  CalculateDeclarationTotalsInput,
  ValidateZUSDeclarationInput,
  SubmitZUSDeclarationInput,
  CreateZUSCorrectionInput,
  GetZUSDeclarationInput,
  ListZUSDeclarationsInput,
  DeleteZUSDeclarationInput,

  // Payment input types
  CalculateZUSPaymentInput,
  RecordZUSPaymentInput,
  GetZUSPaymentScheduleInput,

  // History input types
  GetContributionHistoryInput,
  GenerateAnnualReportInput,

  // Output types
  EmployeeZUSCalculationResult,
  SelfEmployedZUSCalculationResult,
  ZUSValidationResult,
  ZUSDeclarationSummary,
  ListZUSDeclarationsResult,
  ZUSPaymentScheduleItem,
  ZUSPaymentSchedule,
  ContributionHistoryEntry,
  AnnualZUSReport,
} from './zus-declaration.schema';

// ===========================================================================
// JPK REPORTING (TAX-007)
// ===========================================================================

export {
  // Enums
  jpkReportTypeSchema,
  jpkReportStatusSchema,
  jpkSubmissionPurposeSchema,
  gtuCodeSchema as jpkGtuCodeSchema, // Alias to avoid conflict with TAX-004
  procedureCodeSchema as jpkProcedureCodeSchema, // Alias to avoid conflict with TAX-004
  jpkDocumentTypeSchema,
  validationSeveritySchema as jpkValidationSeveritySchema, // Alias to avoid conflict with ACE

  // Entity schemas
  jpkHeaderSchema as jpkV7HeaderSchema, // Alias to avoid conflict with ACE jpk-kr
  jpkSubjectSchema as jpkV7SubjectSchema, // Alias to avoid conflict with ACE jpk-kr
  jpkV7SaleRecordSchema,
  jpkV7PurchaseRecordSchema,
  jpkV7DeclarationSchema,
  jpkReportSchema,
  jpkValidationIssueSchema as jpkV7ValidationIssueSchema, // Alias to avoid conflict

  // Input schemas
  createJPKReportSchema,
  generateJPKXMLSchema,
  addJPKSaleRecordSchema,
  addJPKPurchaseRecordSchema,
  importFromVATTransactionsSchema,
  validateJPKReportSchema,
  signJPKReportSchema,
  submitJPKReportSchema,
  checkJPKStatusSchema,
  downloadUPOSchema,
  createJPKCorrectionSchema,
  getJPKReportSchema,
  listJPKReportsSchema,
  deleteJPKReportSchema,
  downloadJPKXMLSchema,
  updateJPKDeclarationSchema,

  // Output schemas
  jpkValidationResultSchema as jpkV7ValidationResultSchema, // Alias to avoid conflict
  jpkGenerationResultSchema,
  jpkSubmissionResultSchema,
  jpkStatusResultSchema,
  jpkReportSummarySchema,
  listJPKReportsResultSchema,
  importRecordsResultSchema,
  downloadResultSchema as jpkDownloadResultSchema, // Alias to avoid potential conflicts

  // Constants
  JPK_API_ENDPOINTS,
  JPK_SCHEMA_VERSIONS,
  TAX_OFFICE_CODES,
} from './jpk-reporting.schema';

export type {
  // Enum types
  JPKReportType,
  JPKReportStatus,
  JPKSubmissionPurpose,
  GTUCode as JPKGTUCode,
  ProcedureCode as JPKProcedureCode,
  JPKDocumentType,
  ValidationSeverity as JPKValidationSeverity, // Alias to avoid conflict with ACE

  // Entity types
  JPKHeader as JPKV7Header, // Alias to avoid conflict with ACE jpk-kr
  JPKSubject as JPKV7Subject, // Alias to avoid conflict with ACE jpk-kr
  JPKV7SaleRecord,
  JPKV7PurchaseRecord,
  JPKV7Declaration,
  JPKReport,
  JPKValidationIssue as JPKV7ValidationIssue, // Alias to avoid conflict

  // Input types
  CreateJPKReportInput,
  GenerateJPKXMLInput,
  AddJPKSaleRecordInput,
  AddJPKPurchaseRecordInput,
  ImportFromVATTransactionsInput,
  ValidateJPKReportInput,
  SignJPKReportInput,
  SubmitJPKReportInput,
  CheckJPKStatusInput,
  DownloadUPOInput,
  CreateJPKCorrectionInput,
  GetJPKReportInput,
  ListJPKReportsInput,
  DeleteJPKReportInput,
  DownloadJPKXMLInput,
  UpdateJPKDeclarationInput,

  // Output types
  JPKValidationResult as JPKV7ValidationResult, // Alias to avoid conflict
  JPKGenerationResult,
  JPKSubmissionResult,
  JPKStatusResult,
  JPKReportSummary,
  ListJPKReportsResult,
  ImportRecordsResult,
  DownloadResult as JPKDownloadResult, // Alias to avoid potential conflicts
} from './jpk-reporting.schema';
