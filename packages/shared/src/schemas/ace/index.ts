// ACE (Accounting Engine) Module Schemas

// ===========================================================================
// FISCAL YEAR MANAGEMENT (ACE-008)
// ===========================================================================

export {
  // Status enums
  fiscalYearStatusSchema,
  fiscalPeriodStatusSchema,

  // Fiscal Year schemas
  createFiscalYearSchema,
  getFiscalYearSchema,
  listFiscalYearsSchema,
  updateFiscalYearSchema,
  openFiscalYearSchema,
  closeFiscalYearSchema,
  lockFiscalYearSchema,
  setCurrentFiscalYearSchema,
  deleteFiscalYearSchema,
  getCurrentFiscalYearSchema,
  getFiscalYearStatisticsSchema,

  // Fiscal Period schemas
  listFiscalPeriodsSchema,
  closeFiscalPeriodSchema,
  reopenFiscalPeriodSchema,
} from './fiscal-year.schema';

export type {
  // Status types
  FiscalYearStatus,
  FiscalPeriodStatus,

  // Entity types
  FiscalYear,
  FiscalPeriod,

  // Input types
  CreateFiscalYearInput,
  GetFiscalYearInput,
  ListFiscalYearsInput,
  UpdateFiscalYearInput,
  OpenFiscalYearInput,
  CloseFiscalYearInput,
  LockFiscalYearInput,
  SetCurrentFiscalYearInput,
  DeleteFiscalYearInput,
  GetCurrentFiscalYearInput,
  GetFiscalYearStatisticsInput,
  ListFiscalPeriodsInput,
  CloseFiscalPeriodInput,
  ReopenFiscalPeriodInput,

  // Result types
  ListFiscalYearsResult,
  OpenFiscalYearResult,
  CloseFiscalYearResult,
  LockFiscalYearResult,
  SetCurrentFiscalYearResult,
  DeleteFiscalYearResult,
  ListFiscalPeriodsResult,
  CloseFiscalPeriodResult,
  ReopenFiscalPeriodResult,
  FiscalYearStatistics,
} from './fiscal-year.schema';

// ===========================================================================
// CHART OF ACCOUNTS (ACE-001)
// ===========================================================================

export {
  // Status/Type enums
  chartAccountTypeSchema,
  accountCategorySchema,
  accountNatureSchema,
  accountStatusSchema,
  vatTypeSchema,
  chartOfAccountsTemplateSchema,

  // Account schemas
  createAccountSchema,
  getAccountSchema,
  getAccountByCodeSchema,
  listAccountsSchema,
  updateAccountSchema,
  deleteAccountSchema,
  activateAccountSchema,
  deactivateAccountSchema,
  moveAccountSchema,
  getAccountTreeSchema,
  searchAccountsSchema,
  validateAccountCodeSchema,
  getAccountBalanceSchema,
  batchCreateAccountsSchema,
  importAccountsSchema,
  exportAccountsSchema,
  getAccountStatisticsSchema,

  // Helper functions
  getCategoryFromCode,
  getTypeFromCategory,
  getNatureFromType,
  isValidAccountCode,
  getAccountLevel,
} from './account.schema';

export type {
  // Enum types
  ChartAccountType,
  AccountCategory,
  AccountNature,
  AccountStatus,
  VatType,
  ChartOfAccountsTemplate,

  // Entity types
  Account,
  AccountTreeNode,
  AccountBalance,

  // Input types
  CreateAccountInput,
  GetAccountInput,
  GetAccountByCodeInput,
  ListAccountsInput,
  UpdateAccountInput,
  DeleteAccountInput,
  ActivateAccountInput,
  DeactivateAccountInput,
  MoveAccountInput,
  GetAccountTreeInput,
  SearchAccountsInput,
  ValidateAccountCodeInput,
  GetAccountBalanceInput,
  BatchCreateAccountsInput,
  ImportAccountsInput,
  ExportAccountsInput,
  GetAccountStatisticsInput,

  // Result types
  ListAccountsResult,
  DeleteAccountResult,
  AccountStatusResult,
  MoveAccountResult,
  GetAccountTreeResult,
  SearchAccountsResult,
  ValidateAccountCodeResult,
  BatchCreateAccountsResult,
  ImportAccountsResult,
  ExportAccountsResult,
  AccountStatistics,
} from './account.schema';

// ===========================================================================
// CHART OF ACCOUNTS TEMPLATES (ACC-002)
// ===========================================================================

export {
  // Enums
  businessTypeSchema,
  companySizeSchema,

  // Input schemas
  listTemplatesSchema,
  getTemplateSchema,
  previewTemplateSchema,
  accountModificationSchema,
  applyTemplateSchema,
  getTemplateApplicationsSchema,

  // Template data
  POLISH_STANDARD_COA_FULL,
  POLISH_STANDARD_COA_SIMPLIFIED,
  POLISH_STANDARD_COA_MICRO,
  TEMPLATE_DEFINITIONS,
} from './template.schema';

export type {
  // Enum types
  BusinessType,
  CompanySize,

  // Entity types
  AccountTemplate,
  TemplateAccount,
  TemplateApplication,
  TemplateCustomizations,
  AccountModification,

  // Input types
  ListTemplatesInput,
  GetTemplateInput,
  PreviewTemplateInput,
  AccountModificationInput,
  ApplyTemplateInput,
  GetTemplateApplicationsInput,

  // Result types
  ListTemplatesResult,
  PreviewTemplateResult,
  ApplyTemplateResult,
  TemplateApplicationsResult,
} from './template.schema';

// ===========================================================================
// ACCOUNT HIERARCHY AND GROUPING (ACC-003)
// ===========================================================================

export {
  // Enums
  reportSectionSchema,

  // Entity schemas
  accountGroupSchema,
  accountGroupMemberSchema,
  accountTreeNodeSchema as hierarchyAccountTreeNodeSchema,
  groupTreeNodeSchema,

  // Account tree schemas
  getAccountTreeSchema as hierarchyGetAccountTreeSchema,
  getAccountChildrenSchema,
  getAccountAncestorsSchema,
  getAccountDescendantsSchema,
  getAggregatedBalanceSchema,

  // Account group schemas
  createAccountGroupSchema,
  getAccountGroupSchema,
  listAccountGroupsSchema,
  updateAccountGroupSchema,
  deleteAccountGroupSchema,
  moveAccountGroupSchema,
  getGroupTreeSchema,

  // Group member schemas
  addAccountsToGroupSchema,
  removeAccountsFromGroupSchema,
  getGroupAccountsSchema,
  setGroupAccountsSchema,
  reorderGroupAccountsSchema,

  // Group balance schemas
  getGroupBalanceSchema,
} from './hierarchy.schema';

export type {
  // Enum types
  ReportSection,

  // Entity types
  AccountGroup,
  AccountGroupMember,
  AccountTreeNode as HierarchyAccountTreeNode,
  GroupTreeNode,

  // Account tree input types
  GetAccountTreeInput as HierarchyGetAccountTreeInput,
  GetAccountChildrenInput,
  GetAccountAncestorsInput,
  GetAccountDescendantsInput,
  GetAggregatedBalanceInput,

  // Account group input types
  CreateAccountGroupInput,
  GetAccountGroupInput,
  ListAccountGroupsInput,
  UpdateAccountGroupInput,
  DeleteAccountGroupInput,
  MoveAccountGroupInput,
  GetGroupTreeInput,

  // Group member input types
  AddAccountsToGroupInput,
  RemoveAccountsFromGroupInput,
  GetGroupAccountsInput,
  SetGroupAccountsInput,
  ReorderGroupAccountsInput,

  // Group balance input types
  GetGroupBalanceInput,

  // Result types
  GetAccountTreeResult as HierarchyGetAccountTreeResult,
  GetAccountChildrenResult,
  GetAccountAncestorsResult,
  GetAggregatedBalanceResult,
  ListAccountGroupsResult,
  GetGroupTreeResult,
  AddAccountsToGroupResult,
  RemoveAccountsFromGroupResult,
  GetGroupAccountsResult,
  GetGroupBalanceResult,
  DeleteAccountGroupResult,
  MoveAccountGroupResult,
} from './hierarchy.schema';

// ===========================================================================
// OPENING BALANCES (ACC-005)
// ===========================================================================

export {
  // Enums
  openingBalanceStatusSchema,
  importSourceSchema,

  // Entity schemas
  openingBalanceBatchSchema,
  openingBalanceItemSchema,
  openingBalanceItemWithAccountSchema,

  // Batch operation schemas
  createOpeningBalanceBatchSchema,
  getOpeningBalanceBatchSchema,
  listOpeningBalanceBatchesSchema,
  deleteOpeningBalanceBatchSchema,

  // Item operation schemas
  openingBalanceItemInputSchema,
  addOpeningBalanceItemsSchema,
  updateOpeningBalanceItemSchema,
  removeOpeningBalanceItemsSchema,
  getOpeningBalanceItemsSchema,

  // Validation & posting schemas
  validateOpeningBalanceBatchSchema,
  validationResultSchema,
  postOpeningBalancesSchema,
  postResultSchema,

  // Import schemas
  columnMappingSchema,
  importOpeningBalancesSchema,
  importPreviewSchema,
  importResultSchema,

  // Summary schemas
  getOpeningBalanceSummarySchema,
  openingBalanceSummarySchema,

  // Result schemas
  createBatchResultSchema,
  getBatchResultSchema,
  listBatchesResultSchema,
  addItemsResultSchema,
  removeItemsResultSchema,
  deleteBatchResultSchema,
} from './opening-balance.schema';

export type {
  // Enum types
  OpeningBalanceStatus,
  ImportSource,

  // Entity types
  OpeningBalanceBatch,
  OpeningBalanceItem,
  OpeningBalanceItemWithAccount,

  // Batch input types
  CreateOpeningBalanceBatchInput,
  GetOpeningBalanceBatchInput,
  ListOpeningBalanceBatchesInput,
  DeleteOpeningBalanceBatchInput,

  // Item input types
  OpeningBalanceItemInput,
  AddOpeningBalanceItemsInput,
  UpdateOpeningBalanceItemInput,
  RemoveOpeningBalanceItemsInput,
  GetOpeningBalanceItemsInput,

  // Validation & posting types
  ValidateOpeningBalanceBatchInput,
  ValidationResult,
  PostOpeningBalancesInput,
  PostResult,

  // Import types
  ColumnMapping,
  ImportOpeningBalancesInput,
  ImportPreview,
  ImportResult,

  // Summary types
  GetOpeningBalanceSummaryInput,
  OpeningBalanceSummary,

  // Result types
  CreateBatchResult,
  GetBatchResult,
  ListBatchesResult,
  AddItemsResult,
  RemoveItemsResult,
  DeleteBatchResult,
} from './opening-balance.schema';

// ===========================================================================
// JOURNAL ENTRIES (ACC-006)
// ===========================================================================

export {
  // Enums
  journalEntryTypeSchema,
  journalEntryStatusSchema,
  ENTRY_TYPE_PREFIXES,

  // Line schemas
  journalLineInputSchema,
  journalLineSchema,

  // Entry entity schemas
  journalEntrySchema,
  journalEntryWithLinesSchema,

  // Create entry schemas
  createJournalEntrySchema,
  createJournalEntryResultSchema,

  // Get entry schemas
  getJournalEntrySchema,

  // Update entry schemas
  updateJournalEntrySchema,
  updateJournalEntryResultSchema,

  // Delete entry schemas
  deleteJournalEntrySchema,
  deleteJournalEntryResultSchema,

  // Post entry schemas
  postJournalEntrySchema,
  postJournalEntryResultSchema,

  // Query entries schemas
  queryJournalEntriesSchema,
  queryJournalEntriesResultSchema,

  // Statistics schemas
  getJournalEntryStatsSchema,
  journalEntryStatsSchema,

  // Validation schemas
  validateJournalEntrySchema,
  journalEntryValidationResultSchema,

  // Copy entry schemas
  copyJournalEntrySchema,

  // Entry number schemas
  getNextEntryNumberSchema,
  nextEntryNumberResultSchema,

  // Attachment schemas
  attachDocumentSchema,
  detachDocumentSchema,

  // Bulk operation schemas
  bulkPostEntriesSchema,
  bulkPostEntriesResultSchema,
  bulkDeleteEntriesSchema,
  bulkDeleteEntriesResultSchema,

  // Helper functions
  getEntryPrefix,
  formatEntryNumber,
  parseEntryNumber,
  calculateEntryTotals,
} from './journal-entry.schema';

export type {
  // Enum types
  JournalEntryType,
  JournalEntryStatus,

  // Line types
  JournalLineInput,
  JournalLine,

  // Entry types
  JournalEntry,
  JournalEntryWithLines,

  // Input types
  CreateJournalEntryInput,
  GetJournalEntryInput,
  UpdateJournalEntryInput,
  DeleteJournalEntryInput,
  PostJournalEntryInput,
  QueryJournalEntriesInput,
  GetJournalEntryStatsInput,
  ValidateJournalEntryInput,
  CopyJournalEntryInput,
  GetNextEntryNumberInput,
  AttachDocumentInput,
  DetachDocumentInput,
  BulkPostEntriesInput,
  BulkDeleteEntriesInput,

  // Result types
  CreateJournalEntryResult,
  UpdateJournalEntryResult,
  DeleteJournalEntryResult,
  PostJournalEntryResult,
  QueryJournalEntriesResult,
  JournalEntryStats,
  JournalEntryValidationResult,
  NextEntryNumberResult,
  BulkPostEntriesResult,
  BulkDeleteEntriesResult,
} from './journal-entry.schema';

// ===========================================================================
// ENTRY VALIDATION AND BALANCING (ACC-007)
// ===========================================================================

export {
  // Enums
  validationSeveritySchema,
  validationRuleTypeSchema,

  // Validation rule schemas
  validationRuleSchema,
  createValidationRuleSchema,
  updateValidationRuleSchema,
  getValidationRuleSchema,
  listValidationRulesSchema,
  listValidationRulesResultSchema,
  deleteValidationRuleSchema,
  toggleValidationRuleSchema,

  // Validation result schemas
  validationResultItemSchema,
  balanceInfoSchema,
  validationSummarySchema,
  validationResponseSchema,

  // Validate entry schemas
  validationEntryLineSchema,
  validationEntryDataSchema,
  validateEntryInputSchema,

  // Quick balance check schemas
  balanceCheckLineSchema,
  checkBalanceInputSchema,
  checkBalanceResultSchema,

  // Validation history schemas
  validationResultRecordSchema,
  getValidationHistorySchema,
  getValidationHistoryResultSchema,

  // Constants
  CORE_VALIDATION_RULES,
  DEFAULT_BUSINESS_RULES,
} from './validation.schema';

export type {
  // Enum types
  ValidationSeverity,
  ValidationRuleType,

  // Validation rule types
  ValidationRule,
  CreateValidationRuleInput,
  UpdateValidationRuleInput,
  GetValidationRuleInput,
  ListValidationRulesInput,
  ListValidationRulesResult,
  DeleteValidationRuleInput,
  ToggleValidationRuleInput,

  // Validation result types
  ValidationResultItem,
  BalanceInfo,
  ValidationSummary,
  ValidationResponse,

  // Validate entry types
  ValidationEntryLine,
  ValidationEntryData,
  ValidateEntryInput,

  // Quick balance check types
  BalanceCheckLine,
  CheckBalanceInput,
  CheckBalanceResult,

  // Validation history types
  ValidationResultRecord,
  GetValidationHistoryInput,
  GetValidationHistoryResult,
} from './validation.schema';

// ===========================================================================
// GENERAL LEDGER (ACC-008)
// ===========================================================================

export {
  // Enums
  normalBalanceSchema,
  exportFormatSchema as glExportFormatSchema,
  ledgerOrderBySchema,

  // Input schemas
  getAccountLedgerSchema,
  getFullGLReportSchema,
  exportGLSchema,
  getAccountBalanceSchema as glGetAccountBalanceSchema,
  getAccountBalancesSchema,
  recalculateBalanceSchema,
  postToGLSchema,
  batchRecalculateBalancesSchema,

  // Entity schemas
  generalLedgerRecordSchema,
  accountBalanceRecordSchema,

  // Response schemas
  ledgerEntrySchema,
  ledgerAccountInfoSchema,
  ledgerPeriodInfoSchema,
  ledgerTotalsSchema,
  paginationInfoSchema,
  accountLedgerSchema,
  glAccountSummarySchema,
  glReportTotalsSchema,
  fullGLReportSchema,
  accountBalanceResponseSchema,
  accountBalancesResponseSchema,
  exportResultSchema,
  recalculateBalanceResultSchema,
  postToGLResultSchema,
  batchRecalculateResultSchema,
} from './general-ledger.schema';

export type {
  // Enum types
  NormalBalance,
  ExportFormat as GLExportFormat,
  LedgerOrderBy,

  // Input types
  GetAccountLedgerInput,
  GetFullGLReportInput,
  ExportGLInput,
  GetAccountBalanceInput as GLGetAccountBalanceInput,
  GetAccountBalancesInput,
  RecalculateBalanceInput,
  PostToGLInput,
  BatchRecalculateBalancesInput,

  // Entity types
  GeneralLedgerRecord,
  AccountBalanceRecord,

  // Response types
  LedgerEntry,
  LedgerAccountInfo,
  LedgerPeriodInfo,
  LedgerTotals,
  PaginationInfo,
  AccountLedger,
  GLAccountSummary,
  GLReportTotals,
  FullGLReport,
  AccountBalanceResponse,
  AccountBalancesResponse,
  ExportResult,
  RecalculateBalanceResult,
  PostToGLResult,
  BatchRecalculateResult,
} from './general-ledger.schema';

// ===========================================================================
// JOURNAL ENTRY TEMPLATES (ACC-009)
// ===========================================================================

export {
  // Enums
  templateStatusSchema,
  amountTypeSchema,
  variableTypeSchema,
  templateEntryTypeSchema,

  // Template line schemas
  templateLineInputSchema,
  templateLineSchema,

  // Template variable schemas
  templateVariableInputSchema,
  templateVariableSchema,

  // Template CRUD schemas
  createEntryTemplateSchema,
  createTemplateFromEntrySchema,
  updateEntryTemplateSchema,
  getEntryTemplateSchema,
  archiveEntryTemplateSchema,
  restoreEntryTemplateSchema,
  deleteEntryTemplateSchema,

  // Template generation schemas
  generateEntryFromTemplateSchema,
  batchGenerateEntriesSchema,

  // Template list and search schemas
  listEntryTemplatesSchema,
  toggleTemplateFavoriteSchema,
  getTemplateVersionsSchema,

  // Template category schemas
  createTemplateCategorySchema,
  updateTemplateCategorySchema,
  deleteTemplateCategorySchema,

  // Entity schemas
  templateCategorySchema,
  entryTemplateSchema,
  entryTemplateWithDetailsSchema,
  templateVersionSchema,

  // Result schemas
  listEntryTemplatesResultSchema,
  archiveEntryTemplateResultSchema,
  restoreEntryTemplateResultSchema,
  deleteEntryTemplateResultSchema,
  toggleFavoriteResultSchema,
  batchGenerateResultSchema,
  listTemplateCategoriesResultSchema,
  getTemplateVersionsResultSchema,
} from './entry-template.schema';

export type {
  // Enum types
  TemplateStatus,
  AmountType,
  VariableType,
  TemplateEntryType,

  // Template line types
  TemplateLineInput,
  TemplateLine,

  // Template variable types
  TemplateVariableInput,
  TemplateVariable,

  // Template input types
  CreateEntryTemplateInput,
  CreateTemplateFromEntryInput,
  UpdateEntryTemplateInput,
  GetEntryTemplateInput,
  ArchiveEntryTemplateInput,
  RestoreEntryTemplateInput,
  DeleteEntryTemplateInput,

  // Template generation types
  GenerateEntryFromTemplateInput,
  BatchGenerateEntriesInput,

  // Template list types
  ListEntryTemplatesInput,
  ToggleTemplateFavoriteInput,
  GetTemplateVersionsInput,

  // Template category types
  CreateTemplateCategoryInput,
  UpdateTemplateCategoryInput,
  DeleteTemplateCategoryInput,

  // Entity types
  TemplateCategory,
  EntryTemplate,
  EntryTemplateWithDetails,
  TemplateVersion,

  // Result types
  ListEntryTemplatesResult,
  ArchiveEntryTemplateResult,
  RestoreEntryTemplateResult,
  DeleteEntryTemplateResult,
  ToggleFavoriteResult,
  BatchGenerateResult,
  ListTemplateCategoriesResult,
  GetTemplateVersionsResult,
} from './entry-template.schema';

// ===========================================================================
// RECURRING ENTRIES (ACC-010)
// ===========================================================================

export {
  // Enums
  frequencySchema,
  scheduleStatusSchema,
  endOfMonthHandlingSchema,
  weekendAdjustmentSchema,
  executionTypeSchema,
  executionStatusSchema,

  // Create/update schedule schemas
  createRecurringScheduleSchema,
  updateRecurringScheduleSchema,
  getRecurringScheduleSchema,
  pauseRecurringScheduleSchema,
  resumeRecurringScheduleSchema,
  deleteRecurringScheduleSchema,

  // Generation schemas
  manualGenerateSchema,
  batchGenerateMissedSchema,

  // List and preview schemas
  listRecurringSchedulesSchema,
  previewUpcomingSchema,
  getExecutionHistorySchema,

  // Holiday management schemas
  addHolidaySchema,
  deleteHolidaySchema,
  listHolidaysSchema,

  // Scheduler schemas
  processDueSchedulesSchema,

  // Entity schemas
  recurringScheduleSchema,
  scheduleExecutionSchema,
  holidaySchema,
  recurringScheduleWithTemplateSchema,
  executionWithEntrySchema,

  // Result schemas
  listRecurringSchedulesResultSchema,
  resumeScheduleResultSchema,
  batchGenerateMissedResultSchema,
  upcomingEntrySchema,
  previewUpcomingResultSchema,
  processDueSchedulesResultSchema,
  deleteRecurringScheduleResultSchema,
} from './recurring-entry.schema';

export type {
  // Enum types
  Frequency,
  ScheduleStatus,
  EndOfMonthHandling,
  WeekendAdjustment,
  ExecutionType,
  ExecutionStatus,

  // Input types
  CreateRecurringScheduleInput,
  UpdateRecurringScheduleInput,
  GetRecurringScheduleInput,
  PauseRecurringScheduleInput,
  ResumeRecurringScheduleInput,
  DeleteRecurringScheduleInput,
  ManualGenerateInput,
  BatchGenerateMissedInput,
  ListRecurringSchedulesInput,
  PreviewUpcomingInput,
  GetExecutionHistoryInput,
  AddHolidayInput,
  DeleteHolidayInput,
  ListHolidaysInput,
  ProcessDueSchedulesInput,

  // Entity types
  RecurringSchedule,
  ScheduleExecution,
  Holiday,
  RecurringScheduleWithTemplate,
  ExecutionWithEntry,

  // Result types
  ListRecurringSchedulesResult,
  ResumeScheduleResult,
  BatchGenerateMissedResult,
  UpcomingEntry,
  PreviewUpcomingResult,
  ProcessDueSchedulesResult,
  DeleteRecurringScheduleResult,
} from './recurring-entry.schema';

// ===========================================================================
// ENTRY REVERSAL (ACC-011)
// ===========================================================================

export {
  // Enums
  reversalTypeSchema,

  // Input schemas
  reverseEntrySchema,
  scheduleAutoReversalSchema,
  cancelAutoReversalSchema,
  correctionLineSchema,
  createCorrectionSchema,
  listReversalsSchema,
  getReversalDetailsSchema,
  listPendingAutoReversalsSchema,
  processAutoReversalsSchema,

  // Entity schemas
  reversalLinkSchema,
  pendingAutoReversalSchema,

  // Result schemas
  reverseEntryResultSchema,
  scheduleAutoReversalResultSchema,
  cancelAutoReversalResultSchema,
  createCorrectionResultSchema,
  listReversalsResultSchema,
  listPendingAutoReversalsResultSchema,
  autoReversalProcessResultSchema,
  processAutoReversalsResultSchema,
  reversalDetailsSchema,
} from './entry-reversal.schema';

export type {
  // Enum types
  ReversalType,

  // Input types
  ReverseEntryInput,
  ScheduleAutoReversalInput,
  CancelAutoReversalInput,
  CorrectionLine,
  CreateCorrectionInput,
  ListReversalsInput,
  GetReversalDetailsInput,
  ListPendingAutoReversalsInput,
  ProcessAutoReversalsInput,

  // Entity types
  ReversalLink,
  PendingAutoReversal,

  // Result types
  ReverseEntryResult,
  ScheduleAutoReversalResult,
  CancelAutoReversalResult,
  CreateCorrectionResult,
  ListReversalsResult,
  ListPendingAutoReversalsResult,
  AutoReversalProcessResult,
  ProcessAutoReversalsResult,
  ReversalDetails,
} from './entry-reversal.schema';

// ===========================================================================
// TRIAL BALANCE (ACC-012)
// ===========================================================================

export {
  // Enums
  groupBySchema,
  wtbStatusSchema,
  adjustmentTypeSchema,
  exportFormatSchema as tbExportFormatSchema,
  pageOrientationSchema,

  // Input schemas
  generateTrialBalanceSchema,
  comparativeTrialBalanceSchema,
  createWorkingTBSchema,
  getWorkingTBSchema,
  listWorkingTBSchema,
  addAdjustmentColumnSchema,
  recordAdjustmentSchema,
  lockWTBSchema,
  deleteWTBSchema,
  exportTrialBalanceSchema,

  // Entity schemas
  trialBalanceLineSchema,
  trialBalanceTotalsSchema,
  comparativeLineSchema,
  wtbLineSchema,
  adjustmentColumnSchema,
  workingTrialBalanceSchema,

  // Result schemas
  trialBalanceResultSchema,
  comparativeTrialBalanceResultSchema,
  createWorkingTBResultSchema,
  getWorkingTBResultSchema,
  listWorkingTBResultSchema,
  addAdjustmentColumnResultSchema,
  recordAdjustmentResultSchema,
  lockWTBResultSchema,
  deleteWTBResultSchema,
  exportTrialBalanceResultSchema,
} from './trial-balance.schema';

export type {
  // Enum types
  GroupBy,
  WTBStatus,
  AdjustmentType,
  ExportFormat as TBExportFormat,
  PageOrientation,

  // Input types
  GenerateTrialBalanceInput,
  ComparativeTrialBalanceInput,
  CreateWorkingTBInput,
  GetWorkingTBInput,
  ListWorkingTBInput,
  AddAdjustmentColumnInput,
  RecordAdjustmentInput,
  LockWTBInput,
  DeleteWTBInput,
  ExportTrialBalanceInput,

  // Entity types
  TrialBalanceLine,
  TrialBalanceTotals,
  ComparativeLine,
  WTBLine,
  AdjustmentColumn,
  WorkingTrialBalance,

  // Result types
  TrialBalanceResult,
  ComparativeTrialBalanceResult,
  CreateWorkingTBResult,
  GetWorkingTBResult,
  ListWorkingTBResult,
  AddAdjustmentColumnResult,
  RecordAdjustmentResult,
  LockWTBResult,
  DeleteWTBResult,
  ExportTrialBalanceResult,
} from './trial-balance.schema';

// ===========================================================================
// BALANCE SHEET (ACC-013)
// ===========================================================================

export {
  // Enums
  balanceSheetSectionSchema,
  detailLevelSchema,
  bsExportFormatSchema,
  reportLanguageSchema,

  // Input schemas
  generateBalanceSheetSchema,
  exportBalanceSheetSchema,
  saveBalanceSheetSchema,
  getBalanceSheetSchema,
  listBalanceSheetSchema,
  deleteBalanceSheetSchema,

  // Entity schemas
  balanceSheetLineSchema,
  fixedAssetsSectionSchema,
  currentAssetsSectionSchema,
  assetsSectionSchema,
  equitySectionSchema,
  liabilitiesSectionSchema,
  balanceSheetSchema,
  savedBalanceSheetReportSchema,

  // Result schemas
  balanceSheetResultSchema,
  exportBalanceSheetResultSchema,
  saveBalanceSheetResultSchema,
  getBalanceSheetResultSchema,
  listBalanceSheetResultSchema,
  deleteBalanceSheetResultSchema,
} from './balance-sheet.schema';

export type {
  // Enum types
  BalanceSheetSection,
  DetailLevel,
  BSExportFormat,
  ReportLanguage,

  // Input types
  GenerateBalanceSheetInput,
  ExportBalanceSheetInput,
  SaveBalanceSheetInput,
  GetBalanceSheetInput,
  ListBalanceSheetInput,
  DeleteBalanceSheetInput,

  // Entity types
  BalanceSheetLine,
  FixedAssetsSection,
  CurrentAssetsSection,
  AssetsSection,
  EquitySection,
  LiabilitiesSection,
  BalanceSheet,
  SavedBalanceSheetReport,

  // Result types
  BalanceSheetResult,
  ExportBalanceSheetResult,
  SaveBalanceSheetResult,
  GetBalanceSheetResult,
  ListBalanceSheetResult,
  DeleteBalanceSheetResult,
} from './balance-sheet.schema';

// ===========================================================================
// INCOME STATEMENT (ACC-014)
// ===========================================================================

export {
  // Enums
  statementVariantSchema,
  isReportStatusSchema,
  isExportFormatSchema,
  isReportLanguageSchema,

  // Input schemas
  generateIncomeStatementSchema,
  exportIncomeStatementSchema,
  saveIncomeStatementSchema,
  getIncomeStatementSchema,
  listIncomeStatementsSchema,
  deleteIncomeStatementSchema,
  approveIncomeStatementSchema,

  // Entity schemas
  incomeStatementLineSchema,
  revenueSectionSchema,
  operatingCostsSectionSchema,
  otherOperatingRevenueSectionSchema,
  otherOperatingCostsSectionSchema,
  financialRevenueSectionSchema,
  financialCostsSectionSchema,
  incomeStatementSchema,
  savedIncomeStatementReportSchema,

  // Result schemas
  incomeStatementResultSchema,
  exportIncomeStatementResultSchema,
  saveIncomeStatementResultSchema,
  getIncomeStatementResultSchema,
  listIncomeStatementsResultSchema,
  deleteIncomeStatementResultSchema,
  approveIncomeStatementResultSchema,
} from './income-statement.schema';

export type {
  // Enum types
  StatementVariant,
  ISReportStatus,
  ISExportFormat,
  ISReportLanguage,

  // Input types
  GenerateIncomeStatementInput,
  ExportIncomeStatementInput,
  SaveIncomeStatementInput,
  GetIncomeStatementInput,
  ListIncomeStatementsInput,
  DeleteIncomeStatementInput,
  ApproveIncomeStatementInput,

  // Entity types
  IncomeStatementLine,
  RevenueSection,
  OperatingCostsSection,
  OtherOperatingRevenueSection,
  OtherOperatingCostsSection,
  FinancialRevenueSection,
  FinancialCostsSection,
  IncomeStatement,
  SavedIncomeStatementReport,

  // Result types
  IncomeStatementResult,
  ExportIncomeStatementResult,
  SaveIncomeStatementResult,
  GetIncomeStatementResult,
  ListIncomeStatementsResult,
  DeleteIncomeStatementResult,
  ApproveIncomeStatementResult,
} from './income-statement.schema';

// ===========================================================================
// JPK-KR EXPORT (ACC-015)
// ===========================================================================

export {
  // Enums
  jpkTypeSchema,
  jpkSubmissionTypeSchema,
  jpkStatusSchema,
  jpkValidationSeveritySchema,
  jpkAccountTypeSchema,

  // Input schemas
  generateJpkKrSchema,
  preValidateJpkKrSchema,
  validateJpkSchema,
  downloadJpkSchema,
  getJpkLogSchema,
  listJpkLogsSchema,
  updateAccountMappingSchema,
  markJpkSubmittedSchema,

  // Entity schemas
  jpkHeaderSchema,
  jpkSubjectSchema,
  jpkAccountSchema,
  jpkJournalEntrySchema,
  jpkLedgerPostingSchema,
  jpkValidationResultSchema,
  jpkPreValidationReportSchema,
  jpkGenerationLogSchema,
  jpkAccountMappingSchema,
  jpkKrDataSchema,

  // Result schemas
  generateJpkKrResultSchema,
  preValidateJpkKrResultSchema,
  validateJpkResultSchema,
  downloadJpkResultSchema,
  getJpkLogResultSchema,
  listJpkLogsResultSchema,
  getAccountMappingsResultSchema,
  updateAccountMappingResultSchema,
  markJpkSubmittedResultSchema,
} from './jpk-kr.schema';

export type {
  // Enum types
  JpkType,
  JpkSubmissionType,
  JpkStatus,
  JpkValidationSeverity,
  JpkAccountType,

  // Input types
  GenerateJpkKrInput,
  PreValidateJpkKrInput,
  ValidateJpkInput,
  DownloadJpkInput,
  GetJpkLogInput,
  ListJpkLogsInput,
  UpdateAccountMappingInput,
  MarkJpkSubmittedInput,

  // Entity types
  JpkHeader,
  JpkSubject,
  JpkAccount,
  JpkJournalEntry,
  JpkLedgerPosting,
  JpkValidationResult,
  JpkPreValidationReport,
  JpkGenerationLog,
  JpkAccountMapping,
  JpkKrData,

  // Result types
  GenerateJpkKrResult,
  PreValidateJpkKrResult,
  ValidateJpkResult,
  DownloadJpkResult,
  GetJpkLogResult,
  ListJpkLogsResult,
  GetAccountMappingsResult,
  UpdateAccountMappingResult,
  MarkJpkSubmittedResult,
} from './jpk-kr.schema';
