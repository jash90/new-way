// Auth schemas
export {
  passwordSchema,
  emailSchema,
  registrationInputSchema,
  loginInputSchema,
  mfaVerificationSchema,
  backupCodeVerificationSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  emailVerificationSchema,
  changePasswordSchema,
  sessionRefreshSchema,
  sessionRevokeSchema,
  sessionRevokeAllSchema,
  logoutRequestSchema,
  logoutAllRequestSchema,
} from './schemas/auth.schema';

export type {
  RegistrationInput,
  LoginInput,
  MfaVerificationInput,
  BackupCodeVerificationInput,
  PasswordResetRequestInput,
  PasswordResetInput,
  EmailVerificationInput,
  ChangePasswordInput,
  SessionRefreshInput,
  SessionRevokeInput,
  SessionRevokeAllInput,
  LogoutRequestInput,
  LogoutAllRequestInput,
} from './schemas/auth.schema';

// User schemas
export {
  nipSchema,
  regonSchema,
  phoneSchema,
  postalCodeSchema,
  userProfileSchema,
  userStatusSchema,
} from './schemas/user.schema';

export type { UserProfileInput, UserStatus } from './schemas/user.schema';

// Auth types
export type {
  AuthResult,
  AuthError,
  AuthErrorCode,
  SessionInfo,
  MfaSetupResult,
  DeviceFingerprint,
  RateLimitInfo,
} from './types/auth.types';

// Audit types (from types file - legacy)
export type {
  AuditEventType,
  AuditLogEntry as AuditLogEntryType,
  AuditLogFilter as AuditLogFilterType,
  AuditExportFormat,
} from './types/audit.types';

// RBAC schemas
export {
  roleNameSchema,
  resourceNameSchema,
  actionNameSchema,
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
  revokeRoleSchema,
  updateRolePermissionsSchema,
  checkPermissionSchema,
  bulkCheckPermissionsSchema,
  listRolesQuerySchema,
  roleIdSchema,
  userRoleIdSchema,
  permissionModuleSchema,
} from './schemas/rbac.schema';

export type {
  CreateRoleInput,
  UpdateRoleInput,
  AssignRoleInput,
  RevokeRoleInput,
  UpdateRolePermissionsInput,
  CheckPermissionInput,
  BulkCheckPermissionsInput,
  ListRolesQueryInput,
  RoleIdInput,
  UserRoleIdInput,
  PermissionModuleInput,
} from './schemas/rbac.schema';

// Permission schemas (AIM-008)
export {
  permissionResourceSchema,
  permissionActionSchema,
  createPermissionSchema,
  updatePermissionSchema,
  permissionIdSchema,
  permissionKeySchema,
  listPermissionsQuerySchema,
  permissionTypeSchema,
  permissionConditionTypeSchema,
  permissionConditionSchema,
  assignUserPermissionSchema,
  revokeUserPermissionSchema,
  bulkPermissionAssignmentSchema,
  permissionCheckInputSchema,
  getUserPermissionsSchema,
  getUserEffectivePermissionsSchema,
} from './schemas/permission.schema';

export type {
  CreatePermissionInput,
  UpdatePermissionInput,
  PermissionIdInput,
  PermissionKeyInput,
  ListPermissionsQueryInput,
  PermissionType,
  PermissionConditionType,
  PermissionCondition,
  AssignUserPermissionInput,
  RevokeUserPermissionInput,
  BulkPermissionAssignmentInput,
  PermissionCheckInputSchema,
  GetUserPermissionsInput,
  GetUserEffectivePermissionsInput,
} from './schemas/permission.schema';

// MFA schemas (AIM-009)
export {
  totpCodeSchema,
  backupCodeSchema,
  mfaUserIdSchema,
  mfaSetupInitSchema,
  mfaSetupVerifySchema,
  mfaDisableSchema,
  mfaChallengeSchema,
  mfaTotpVerifySchema,
  mfaBackupCodeVerifySchema,
  mfaRegenerateBackupCodesSchema,
  mfaStatusSchema,
  mfaSetupResultSchema,
  mfaEnableResultSchema,
  mfaChallengeResultSchema,
  mfaVerificationResultSchema,
  backupCodesResultSchema,
} from './schemas/mfa.schema';

export type {
  MfaUserIdInput,
  MfaSetupInitInput,
  MfaSetupVerifyInput,
  MfaDisableInput,
  MfaChallengeInput,
  MfaTotpVerifyInput,
  MfaBackupCodeVerifyInput,
  MfaRegenerateBackupCodesInput,
  MfaStatusOutput,
  MfaSetupResultOutput,
  MfaEnableResultOutput,
  MfaChallengeResultOutput,
  MfaVerificationResultOutput,
  BackupCodesResultOutput,
} from './schemas/mfa.schema';

// Audit schemas (AIM-011)
export {
  auditEventTypeSchema,
  auditExportFormatSchema,
  auditSortOrderSchema,
  auditSortFieldSchema,
  auditLogFilterSchema,
  auditLogPaginationSchema,
  listAuditLogsSchema,
  getAuditLogSchema,
  exportAuditLogsSchema,
  getAuditStatsSchema,
  auditLogEntrySchema,
  paginatedAuditLogsSchema,
  auditStatsByEventTypeSchema,
  auditStatsByPeriodSchema,
  auditStatsResponseSchema,
  auditExportResultSchema,
} from './schemas/audit.schema';

export type {
  AuditEventTypeEnum,
  AuditExportFormatEnum,
  AuditSortOrderEnum,
  AuditSortFieldEnum,
  AuditLogFilter,
  AuditLogPagination,
  ListAuditLogsInput,
  GetAuditLogInput,
  ExportAuditLogsInput,
  GetAuditStatsInput,
  AuditLogEntry,
  PaginatedAuditLogs,
  AuditStatsByEventType,
  AuditStatsByPeriod,
  AuditStatsResponse,
  AuditExportResult,
} from './schemas/audit.schema';

// Backup Codes schemas (AIM-010)
export {
  getBackupCodesStatusSchema,
  backupCodesStatusSchema,
  listUsedBackupCodesSchema,
  usedBackupCodeEntrySchema,
  paginatedUsedBackupCodesSchema,
  backupCodesExportFormatSchema,
  exportBackupCodesSchema,
  exportBackupCodesResultSchema,
  verifyBackupCodeDirectSchema,
  verifyBackupCodeDirectResultSchema,
} from './schemas/backup-codes.schema';

export type {
  GetBackupCodesStatusInput,
  BackupCodesStatus,
  ListUsedBackupCodesInput,
  UsedBackupCodeEntry,
  PaginatedUsedBackupCodes,
  BackupCodesExportFormat,
  ExportBackupCodesInput,
  ExportBackupCodesResult,
  VerifyBackupCodeDirectInput,
  VerifyBackupCodeDirectResult,
} from './schemas/backup-codes.schema';

// Security Events schemas (AIM-012)
export {
  alertSeveritySchema,
  alertStatusSchema,
  securityAlertTypeSchema,
  notificationChannelSchema,
  securityAlertFilterSchema,
  securityAlertPaginationSchema,
  listSecurityAlertsSchema,
  getSecurityAlertSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
  dismissAlertSchema,
  getAlertStatsSchema,
  createNotificationSubscriptionSchema,
  updateNotificationSubscriptionSchema,
  deleteNotificationSubscriptionSchema,
  listNotificationSubscriptionsSchema,
  securityAlertOutputSchema,
  paginatedSecurityAlertsSchema,
  alertStatsByTypeSchema,
  alertStatsBySeveritySchema,
  alertStatsResponseSchema,
  notificationSubscriptionOutputSchema,
  alertUpdateResultSchema,
  securityDashboardSummarySchema,
} from './schemas/security-events.schema';

export type {
  AlertSeverity,
  AlertStatus,
  SecurityAlertType,
  NotificationChannel,
  SecurityAlertFilter,
  SecurityAlertPagination,
  ListSecurityAlertsInput,
  GetSecurityAlertInput,
  AcknowledgeAlertInput,
  ResolveAlertInput,
  DismissAlertInput,
  GetAlertStatsInput,
  CreateNotificationSubscriptionInput,
  UpdateNotificationSubscriptionInput,
  DeleteNotificationSubscriptionInput,
  ListNotificationSubscriptionsInput,
  SecurityAlertOutput,
  PaginatedSecurityAlerts,
  AlertStatsByType,
  AlertStatsBySeverity,
  AlertStatsResponse,
  NotificationSubscriptionOutput,
  AlertUpdateResult,
  SecurityDashboardSummary,
} from './schemas/security-events.schema';

// Profile schemas (AIM-002)
export {
  onboardingStepSchema,
  profileCompletionStatusSchema,
  accountTypeSchema,
  getProfileSchema,
  personalInfoSchema,
  companyInfoSchema,
  addressInfoSchema,
  preferencesSchema,
  updateProfileSchema,
  completeOnboardingStepSchema,
  gusLookupByNipSchema,
  gusLookupByRegonSchema,
  getOnboardingStatusSchema,
  skipOnboardingStepSchema,
  resetOnboardingSchema,
  profileOutputSchema,
  onboardingStatusOutputSchema,
  gusCompanyDataOutputSchema,
  profileUpdateResultSchema,
  onboardingStepResultSchema,
} from './schemas/profile.schema';

export type {
  OnboardingStep,
  ProfileCompletionStatus,
  AccountType,
  GetProfileInput,
  PersonalInfoInput,
  CompanyInfoInput,
  AddressInfoInput,
  PreferencesInput,
  UpdateProfileInput,
  CompleteOnboardingStepInput,
  GusLookupByNipInput,
  GusLookupByRegonInput,
  GetOnboardingStatusInput,
  SkipOnboardingStepInput,
  ResetOnboardingInput,
  ProfileOutput,
  OnboardingStatusOutput,
  GusCompanyDataOutput,
  ProfileUpdateResult,
  OnboardingStepResult,
} from './schemas/profile.schema';

// CRM Client schemas (CRM-001)
export {
  clientTypeSchema,
  clientStatusSchema,
  createClientSchema,
  createCompanyClientSchema,
  createIndividualClientSchema,
  updateClientSchema,
  getClientSchema,
  listClientsQuerySchema,
  deleteClientSchema,
  restoreClientSchema,
  searchByNipSchema,
  searchByRegonSchema,
  enrichFromGusSchema,
  clientOutputSchema,
  paginatedClientsSchema,
  clientCreateResultSchema,
  clientUpdateResultSchema,
  clientDeleteResultSchema,
  clientRestoreResultSchema,
  gusEnrichResultSchema,
  clientSearchResultSchema,
} from './schemas/client.schema';

export type {
  ClientType,
  ClientStatus,
  CreateClientInput,
  CreateCompanyClientInput,
  CreateIndividualClientInput,
  UpdateClientInput,
  GetClientInput,
  ListClientsQueryInput,
  DeleteClientInput,
  RestoreClientInput,
  SearchByNipInput,
  SearchByRegonInput,
  EnrichFromGusInput,
  ClientOutput,
  PaginatedClients,
  ClientCreateResult,
  ClientUpdateResult,
  ClientDeleteResult,
  ClientRestoreResult,
  GusEnrichResult,
  ClientSearchResult,
} from './schemas/client.schema';

// VAT/VIES schemas (CRM-003)
export {
  euCountryCodeSchema,
  vatStatusSchema,
  vatNumberSchema,
  validateVatSchema,
  validateClientVatSchema,
  getVatStatusSchema,
  refreshVatStatusSchema,
  batchValidateVatSchema,
  viesDataSchema,
  vatValidationResultSchema,
  clientVatStatusSchema,
  batchVatValidationResultSchema,
  vatValidationHistoryEntrySchema,
  isValidVatFormat,
  formatVatNumber,
  parseFullVatNumber,
} from './schemas/vat.schema';

export type {
  EuCountryCode,
  VatStatus,
  ValidateVatInput,
  ValidateClientVatInput,
  GetVatStatusInput,
  RefreshVatStatusInput,
  BatchValidateVatInput,
  ViesData,
  VatValidationResult,
  ClientVatStatus,
  BatchVatValidationResult,
  VatValidationHistoryEntry,
} from './schemas/vat.schema';

// Contact schemas (CRM-004)
export {
  contactTypeSchema,
  contactStatusSchema,
  createContactSchema,
  updateContactSchema,
  getContactSchema,
  listContactsSchema,
  deleteContactSchema,
  restoreContactSchema,
  setPrimaryContactSchema,
  bulkCreateContactsSchema,
  searchContactsSchema,
  contactOutputSchema,
  paginatedContactsSchema,
  contactCreateResultSchema,
  contactUpdateResultSchema,
  contactDeleteResultSchema,
  contactRestoreResultSchema,
  bulkCreateContactsResultSchema,
  contactSearchResultSchema,
  setPrimaryContactResultSchema,
} from './schemas/contact.schema';

export type {
  ContactType,
  ContactStatus,
  CreateContactInput,
  UpdateContactInput,
  GetContactInput,
  ListContactsInput,
  DeleteContactInput,
  RestoreContactInput,
  SetPrimaryContactInput,
  BulkCreateContactsInput,
  SearchContactsInput,
  ContactOutput,
  PaginatedContacts,
  ContactCreateResult,
  ContactUpdateResult,
  ContactDeleteResult,
  ContactRestoreResult,
  BulkCreateContactsResult,
  ContactSearchResult,
  SetPrimaryContactResult,
} from './schemas/contact.schema';

// Timeline schemas (CRM-005)
export {
  timelineEventTypeSchema,
  timelineImportanceSchema,
  createTimelineEventSchema,
  updateTimelineEventSchema,
  getTimelineEventSchema,
  listTimelineEventsSchema,
  deleteTimelineEventSchema,
  bulkCreateTimelineEventsSchema,
  getTimelineStatsSchema,
} from './schemas/timeline.schema';

export type {
  TimelineEventType,
  TimelineImportance,
  CreateTimelineEventInput,
  UpdateTimelineEventInput,
  GetTimelineEventInput,
  ListTimelineEventsInput,
  DeleteTimelineEventInput,
  BulkCreateTimelineEventsInput,
  GetTimelineStatsInput,
  TimelineEventOutput,
  PaginatedTimelineEvents,
  TimelineEventCreateResult,
  TimelineEventUpdateResult,
  TimelineEventDeleteResult,
  BulkCreateTimelineEventsResult,
  TimelineStatsResult,
} from './schemas/timeline.schema';

// Search schemas (CRM-008)
export {
  searchSortFieldSchema,
  searchEntityTypeSchema,
  dateRangePresetSchema,
  advancedSearchInputSchema,
  searchSuggestionInputSchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  deleteSavedSearchSchema,
  listSavedSearchesSchema,
} from './schemas/search.schema';

export type {
  AdvancedSearchInput,
  SearchSuggestionInput,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  DeleteSavedSearchInput,
  ListSavedSearchesInput,
  SearchResultItem,
  SearchFacets,
  AdvancedSearchResult,
  SearchSuggestion,
  SearchSuggestionsResult,
  SavedSearch,
  SavedSearchCreateResult,
  SavedSearchUpdateResult,
  SavedSearchDeleteResult,
  SavedSearchListResult,
} from './schemas/search.schema';

// Risk Assessment schemas (CRM-009)
export {
  riskLevelSchema,
  riskCategorySchema,
  riskFactorTypeSchema,
  assessClientRiskSchema,
  getClientRiskHistorySchema,
  updateRiskConfigSchema,
  bulkAssessRiskSchema,
  getHighRiskClientsSchema,
} from './schemas/risk.schema';

export type {
  RiskLevel,
  RiskCategory,
  RiskFactorType,
  AssessClientRiskInput,
  GetClientRiskHistoryInput,
  UpdateRiskConfigInput,
  BulkAssessRiskInput,
  GetHighRiskClientsInput,
  RiskFactor,
  ClientRiskAssessment,
  RiskAssessmentResult,
  RiskHistoryEntry,
  RiskHistoryResult,
  BulkRiskAssessmentResult,
  HighRiskClientItem,
  HighRiskClientsResult,
  RiskConfig,
  RiskConfigResult,
} from './schemas/risk.schema';

// Bulk Operations schemas (CRM-010)
export {
  bulkOperationTypeSchema,
  bulkOperationStatusSchema,
  bulkArchiveClientsSchema,
  bulkRestoreClientsSchema,
  bulkDeleteClientsSchema,
  clientStatusSchema as bulkClientStatusSchema,
  bulkUpdateStatusSchema,
  bulkTagOperationSchema,
  bulkUpdateTagsSchema,
  bulkAssignOwnerSchema,
  exportFormatSchema,
  bulkExportClientsSchema,
  getBulkOperationStatusSchema,
  listBulkOperationsSchema,
  cancelBulkOperationSchema,
} from './schemas/bulk.schema';

export type {
  BulkOperationType,
  BulkOperationStatus,
  BulkArchiveClientsInput,
  BulkArchiveResult,
  BulkRestoreClientsInput,
  BulkRestoreResult,
  BulkDeleteClientsInput,
  BulkDeleteResult,
  ClientStatus as BulkClientStatus,
  BulkUpdateStatusInput,
  BulkUpdateStatusResult,
  BulkTagOperation,
  BulkUpdateTagsInput,
  BulkUpdateTagsResult,
  BulkAssignOwnerInput,
  BulkAssignOwnerResult,
  ExportFormat,
  BulkExportClientsInput,
  BulkExportResult,
  GetBulkOperationStatusInput,
  BulkOperationProgress,
  ListBulkOperationsInput,
  BulkOperationListItem,
  BulkOperationsListResult,
  CancelBulkOperationInput,
  CancelBulkOperationResult,
} from './schemas/bulk.schema';

// Statistics schemas (CRM-011)
export {
  statisticsPeriodSchema,
  getStatisticsOverviewSchema,
  getClientGrowthSchema,
  getTagStatisticsSchema,
  getRiskDistributionSchema,
  getActivityStatisticsSchema,
  getVatStatisticsSchema,
  getTopClientsSchema,
  getDashboardSummarySchema,
  exportStatisticsSchema,
} from './schemas/statistics.schema';

export type {
  StatisticsPeriod,
  GetStatisticsOverviewInput,
  ClientCountByType,
  ClientCountByStatus,
  StatisticsOverview,
  GetClientGrowthInput,
  GrowthDataPoint,
  ClientGrowthResult,
  GetTagStatisticsInput,
  TagStatistic,
  TagStatisticsResult,
  GetRiskDistributionInput,
  RiskDistributionItem,
  RiskDistributionResult,
  GetActivityStatisticsInput,
  ActivityByType,
  ActivityStatisticsResult,
  GetVatStatisticsInput,
  VatStatusDistribution,
  VatStatisticsResult,
  GetTopClientsInput,
  TopClientItem,
  TopClientsResult,
  GetDashboardSummaryInput,
  DashboardSummary,
  ExportStatisticsInput,
  ExportStatisticsResult,
} from './schemas/statistics.schema';

// Portal Access schemas (CRM-012)
export {
  portalAccessStatusSchema,
  portalPermissionSchema,
  createPortalAccessSchema,
  getPortalAccessSchema,
  listPortalAccessSchema,
  updatePortalAccessSchema,
  revokePortalAccessSchema,
  resendInvitationSchema,
  getClientPortalAccessSchema,
  bulkRevokePortalAccessSchema,
  bulkUpdatePermissionsSchema,
  getPortalStatisticsSchema,
  getPortalActivitySchema,
  validatePortalTokenSchema,
  activatePortalAccessSchema,
} from './schemas/portal.schema';

export type {
  PortalAccessStatus,
  PortalPermission,
  CreatePortalAccessInput,
  PortalAccess,
  GetPortalAccessInput,
  ListPortalAccessInput,
  ListPortalAccessResult,
  UpdatePortalAccessInput,
  RevokePortalAccessInput,
  RevokePortalAccessResult,
  ResendInvitationInput,
  ResendInvitationResult,
  GetClientPortalAccessInput,
  BulkRevokePortalAccessInput,
  BulkRevokeResult,
  BulkUpdatePermissionsInput,
  BulkUpdatePermissionsResult,
  GetPortalStatisticsInput,
  PortalStatistics,
  GetPortalActivityInput,
  PortalActivityItem,
  PortalActivityResult,
  ValidatePortalTokenInput,
  ValidatePortalTokenResult,
  ActivatePortalAccessInput,
  ActivatePortalAccessResult,
} from './schemas/portal.schema';

// Custom Fields schemas (CRM-006)
export {
  customFieldTypeSchema,
  fieldVisibilitySchema,
  entityTypeSchema,
  textFieldConfigSchema,
  numberFieldConfigSchema,
  currencyFieldConfigSchema,
  dateFieldConfigSchema,
  selectOptionSchema,
  selectFieldConfigSchema,
  multiselectFieldConfigSchema,
  emailFieldConfigSchema,
  phoneFieldConfigSchema,
  urlFieldConfigSchema,
  checkboxFieldConfigSchema,
  fieldConfigSchema,
  validationRuleSchema,
  createFieldDefinitionSchema,
  updateFieldDefinitionSchema,
  getFieldDefinitionsSchema,
  archiveFieldDefinitionSchema,
  deleteFieldDefinitionSchema,
  reorderFieldsSchema,
  fieldValueSchema,
  setFieldValueSchema,
  bulkSetEntityValuesSchema,
  bulkSetFieldValueSchema,
  getEntityValuesSchema,
  clearFieldValueSchema,
  getOptionUsageSchema,
  fieldDefinitionOutputSchema,
  fieldValueOutputSchema,
  entityCustomFieldsOutputSchema,
  optionUsageOutputSchema,
  fieldDefinitionCreateResultSchema,
  fieldDefinitionUpdateResultSchema,
  fieldDefinitionArchiveResultSchema,
  fieldDefinitionDeleteResultSchema,
  fieldValueSetResultSchema,
  bulkSetResultSchema,
  reorderFieldsResultSchema,
  fieldDefinitionListResultSchema,
} from './schemas/customFields.schema';

export type {
  CustomFieldType,
  FieldVisibility,
  EntityType,
  SelectOption,
  FieldConfig,
  ValidationRule,
  CreateFieldDefinitionInput,
  UpdateFieldDefinitionInput,
  GetFieldDefinitionsInput,
  ArchiveFieldDefinitionInput,
  DeleteFieldDefinitionInput,
  ReorderFieldsInput,
  FieldValue,
  SetFieldValueInput,
  BulkSetEntityValuesInput,
  BulkSetFieldValueInput,
  GetEntityValuesInput,
  ClearFieldValueInput,
  GetOptionUsageInput,
  FieldDefinitionOutput,
  FieldValueOutput,
  EntityCustomFieldsOutput,
  OptionUsageOutput,
  FieldDefinitionCreateResult,
  FieldDefinitionUpdateResult,
  FieldDefinitionArchiveResult,
  FieldDefinitionDeleteResult,
  FieldValueSetResult,
  BulkSetResult,
  ReorderFieldsResult,
  FieldDefinitionListResult,
} from './schemas/customFields.schema';

// ===========================================================================
// ACE (Accounting Engine) Module
// ===========================================================================

// Fiscal Year schemas (ACE-008)
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
} from './schemas/ace/fiscal-year.schema';

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
} from './schemas/ace/fiscal-year.schema';

// Chart of Accounts schemas (ACE-001)
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
} from './schemas/ace/account.schema';

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
} from './schemas/ace/account.schema';

// ===========================================================================
// ACE MODULE - REMAINING SCHEMAS (ACC-002 to ACC-015)
// ===========================================================================

// Template (ACC-002)
export {
  businessTypeSchema,
  companySizeSchema,
  listTemplatesSchema,
  getTemplateSchema,
  previewTemplateSchema,
  accountModificationSchema,
  applyTemplateSchema,
  getTemplateApplicationsSchema,
  POLISH_STANDARD_COA_FULL,
  POLISH_STANDARD_COA_SIMPLIFIED,
  POLISH_STANDARD_COA_MICRO,
  TEMPLATE_DEFINITIONS,
} from './schemas/ace/template.schema';

export type {
  BusinessType,
  CompanySize,
  AccountTemplate,
  TemplateAccount,
  TemplateApplication,
  TemplateCustomizations,
  AccountModification,
  ListTemplatesInput,
  GetTemplateInput,
  PreviewTemplateInput,
  AccountModificationInput,
  ApplyTemplateInput,
  GetTemplateApplicationsInput,
  ListTemplatesResult,
  PreviewTemplateResult,
  ApplyTemplateResult,
  TemplateApplicationsResult,
} from './schemas/ace/template.schema';

// Hierarchy (ACC-003)
export {
  reportSectionSchema,
  accountGroupSchema,
  accountGroupMemberSchema,
  accountTreeNodeSchema as hierarchyAccountTreeNodeSchema,
  groupTreeNodeSchema,
  getAccountTreeSchema as getHierarchyAccountTreeSchema,
  getAccountChildrenSchema,
  getAccountAncestorsSchema,
  getAccountDescendantsSchema,
  getAggregatedBalanceSchema,
  createAccountGroupSchema,
  getAccountGroupSchema,
  listAccountGroupsSchema,
  updateAccountGroupSchema,
  deleteAccountGroupSchema,
  moveAccountGroupSchema,
  getGroupTreeSchema,
  addAccountsToGroupSchema,
  removeAccountsFromGroupSchema,
  getGroupAccountsSchema,
  setGroupAccountsSchema,
  reorderGroupAccountsSchema,
  getGroupBalanceSchema,
} from './schemas/ace/hierarchy.schema';

export type {
  ReportSection,
  AccountGroup,
  AccountGroupMember,
  AccountTreeNode as HierarchyAccountTreeNode,
  GroupTreeNode,
  GetAccountTreeInput as GetHierarchyAccountTreeInput,
  GetAccountChildrenInput,
  GetAccountAncestorsInput,
  GetAccountDescendantsInput,
  GetAggregatedBalanceInput,
  CreateAccountGroupInput,
  GetAccountGroupInput,
  ListAccountGroupsInput,
  UpdateAccountGroupInput,
  DeleteAccountGroupInput,
  MoveAccountGroupInput,
  GetGroupTreeInput,
  AddAccountsToGroupInput,
  RemoveAccountsFromGroupInput,
  GetGroupAccountsInput,
  SetGroupAccountsInput,
  ReorderGroupAccountsInput,
  GetGroupBalanceInput,
  GetAccountTreeResult as GetHierarchyAccountTreeResult,
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
} from './schemas/ace/hierarchy.schema';

// Opening Balance (ACC-005)
export {
  openingBalanceStatusSchema,
  importSourceSchema,
  openingBalanceBatchSchema,
  openingBalanceItemSchema,
  openingBalanceItemWithAccountSchema,
  createOpeningBalanceBatchSchema,
  getOpeningBalanceBatchSchema,
  listOpeningBalanceBatchesSchema,
  deleteOpeningBalanceBatchSchema,
  openingBalanceItemInputSchema,
  addOpeningBalanceItemsSchema,
  updateOpeningBalanceItemSchema,
  removeOpeningBalanceItemsSchema,
  getOpeningBalanceItemsSchema,
  validateOpeningBalanceBatchSchema,
  validationResultSchema,
  postOpeningBalancesSchema,
  postResultSchema,
  columnMappingSchema,
  importOpeningBalancesSchema,
  importPreviewSchema,
  importResultSchema,
  getOpeningBalanceSummarySchema,
  openingBalanceSummarySchema,
  createBatchResultSchema,
  getBatchResultSchema,
  listBatchesResultSchema,
  addItemsResultSchema,
  removeItemsResultSchema,
  deleteBatchResultSchema,
} from './schemas/ace/opening-balance.schema';

export type {
  OpeningBalanceStatus,
  ImportSource,
  OpeningBalanceBatch,
  OpeningBalanceItem,
  OpeningBalanceItemWithAccount,
  CreateOpeningBalanceBatchInput,
  GetOpeningBalanceBatchInput,
  ListOpeningBalanceBatchesInput,
  DeleteOpeningBalanceBatchInput,
  OpeningBalanceItemInput,
  AddOpeningBalanceItemsInput,
  UpdateOpeningBalanceItemInput,
  RemoveOpeningBalanceItemsInput,
  GetOpeningBalanceItemsInput,
  ValidateOpeningBalanceBatchInput,
  ValidationResult,
  PostOpeningBalancesInput,
  PostResult,
  ColumnMapping,
  ImportOpeningBalancesInput,
  ImportPreview,
  ImportResult,
  GetOpeningBalanceSummaryInput,
  OpeningBalanceSummary,
  CreateBatchResult,
  GetBatchResult,
  ListBatchesResult,
  AddItemsResult,
  RemoveItemsResult,
  DeleteBatchResult,
} from './schemas/ace/opening-balance.schema';

// Journal Entry (ACC-006)
export {
  journalEntryTypeSchema,
  journalEntryStatusSchema,
  ENTRY_TYPE_PREFIXES,
  journalLineInputSchema,
  journalLineSchema,
  journalEntrySchema,
  journalEntryWithLinesSchema,
  createJournalEntrySchema,
  createJournalEntryResultSchema,
  getJournalEntrySchema,
  updateJournalEntrySchema,
  updateJournalEntryResultSchema,
  deleteJournalEntrySchema,
  deleteJournalEntryResultSchema,
  postJournalEntrySchema,
  postJournalEntryResultSchema,
  queryJournalEntriesSchema,
  queryJournalEntriesResultSchema,
  getJournalEntryStatsSchema,
  journalEntryStatsSchema,
  validateJournalEntrySchema,
  journalEntryValidationResultSchema,
  copyJournalEntrySchema,
  getNextEntryNumberSchema,
  nextEntryNumberResultSchema,
  attachDocumentSchema,
  detachDocumentSchema,
  bulkPostEntriesSchema,
  bulkPostEntriesResultSchema,
  bulkDeleteEntriesSchema,
  bulkDeleteEntriesResultSchema,
} from './schemas/ace/journal-entry.schema';

export type {
  JournalEntryType,
  JournalEntryStatus,
  JournalLineInput,
  JournalLine,
  JournalEntry,
  JournalEntryWithLines,
  CreateJournalEntryInput,
  CreateJournalEntryResult,
  GetJournalEntryInput,
  UpdateJournalEntryInput,
  UpdateJournalEntryResult,
  DeleteJournalEntryInput,
  DeleteJournalEntryResult,
  PostJournalEntryInput,
  PostJournalEntryResult,
  QueryJournalEntriesInput,
  QueryJournalEntriesResult,
  GetJournalEntryStatsInput,
  JournalEntryStats,
  ValidateJournalEntryInput,
  JournalEntryValidationResult,
  CopyJournalEntryInput,
  GetNextEntryNumberInput,
  NextEntryNumberResult,
  AttachDocumentInput,
  DetachDocumentInput,
  BulkPostEntriesInput,
  BulkPostEntriesResult,
  BulkDeleteEntriesInput,
  BulkDeleteEntriesResult,
} from './schemas/ace/journal-entry.schema';

// Validation (ACC-007)
export {
  validationSeveritySchema,
  validationRuleTypeSchema,
  validationRuleSchema as aceValidationRuleSchema,
  createValidationRuleSchema,
  updateValidationRuleSchema,
  getValidationRuleSchema,
  listValidationRulesSchema,
  listValidationRulesResultSchema,
  deleteValidationRuleSchema,
  toggleValidationRuleSchema,
  validationResultItemSchema,
  balanceInfoSchema,
  validationSummarySchema,
  validationResponseSchema,
  validationEntryLineSchema,
  validationEntryDataSchema,
  validateEntryInputSchema,
  balanceCheckLineSchema,
  checkBalanceInputSchema,
  checkBalanceResultSchema,
  validationResultRecordSchema,
  getValidationHistorySchema,
  getValidationHistoryResultSchema,
  CORE_VALIDATION_RULES,
  DEFAULT_BUSINESS_RULES,
} from './schemas/ace/validation.schema';

export type {
  ValidationSeverity,
  ValidationRuleType,
  ValidationRule as ACEValidationRule,
  CreateValidationRuleInput,
  UpdateValidationRuleInput,
  GetValidationRuleInput,
  ListValidationRulesInput,
  ListValidationRulesResult,
  DeleteValidationRuleInput,
  ToggleValidationRuleInput,
  ValidationResultItem,
  BalanceInfo,
  ValidationSummary,
  ValidationResponse,
  ValidationEntryLine,
  ValidationEntryData,
  ValidateEntryInput,
  BalanceCheckLine,
  CheckBalanceInput,
  CheckBalanceResult,
  ValidationResultRecord,
  GetValidationHistoryInput,
  GetValidationHistoryResult,
} from './schemas/ace/validation.schema';

// General Ledger (ACC-008)
export {
  normalBalanceSchema,
  exportFormatSchema as glExportFormatSchema,
  ledgerOrderBySchema,
  getAccountLedgerSchema,
  getFullGLReportSchema,
  exportGLSchema,
  getAccountBalanceSchema as getGLAccountBalanceSchema,
  getAccountBalancesSchema,
  recalculateBalanceSchema,
  postToGLSchema,
  batchRecalculateBalancesSchema,
  generalLedgerRecordSchema,
  accountBalanceRecordSchema,
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
  exportResultSchema as glExportResultSchema,
  recalculateBalanceResultSchema,
  postToGLResultSchema,
  batchRecalculateResultSchema,
} from './schemas/ace/general-ledger.schema';

export type {
  NormalBalance,
  ExportFormat as GLExportFormat,
  LedgerOrderBy,
  GetAccountLedgerInput,
  GetFullGLReportInput,
  ExportGLInput,
  GetAccountBalanceInput as GetGLAccountBalanceInput,
  GetAccountBalancesInput,
  RecalculateBalanceInput,
  PostToGLInput,
  BatchRecalculateBalancesInput,
  GeneralLedgerRecord,
  AccountBalanceRecord,
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
  ExportResult as GLExportResult,
  RecalculateBalanceResult,
  PostToGLResult,
  BatchRecalculateResult,
} from './schemas/ace/general-ledger.schema';

// Entry Template (ACC-009)
export {
  templateStatusSchema,
  amountTypeSchema,
  variableTypeSchema,
  templateEntryTypeSchema,
  templateLineInputSchema,
  templateVariableInputSchema,
  createEntryTemplateSchema,
  createTemplateFromEntrySchema,
  updateEntryTemplateSchema,
  getEntryTemplateSchema,
  archiveEntryTemplateSchema,
  restoreEntryTemplateSchema,
  deleteEntryTemplateSchema,
  generateEntryFromTemplateSchema,
  batchGenerateEntriesSchema,
  listEntryTemplatesSchema,
  toggleTemplateFavoriteSchema,
  getTemplateVersionsSchema,
  createTemplateCategorySchema,
  updateTemplateCategorySchema,
  deleteTemplateCategorySchema,
  templateCategorySchema,
  templateLineSchema,
  templateVariableSchema,
  entryTemplateSchema,
  entryTemplateWithDetailsSchema,
  templateVersionSchema,
  listEntryTemplatesResultSchema,
  archiveEntryTemplateResultSchema,
  restoreEntryTemplateResultSchema,
  deleteEntryTemplateResultSchema,
  toggleFavoriteResultSchema,
  batchGenerateResultSchema,
  listTemplateCategoriesResultSchema,
  getTemplateVersionsResultSchema,
} from './schemas/ace/entry-template.schema';

export type {
  TemplateStatus,
  AmountType,
  VariableType,
  TemplateEntryType,
  TemplateLineInput,
  TemplateVariableInput,
  CreateEntryTemplateInput,
  CreateTemplateFromEntryInput,
  UpdateEntryTemplateInput,
  GetEntryTemplateInput,
  ArchiveEntryTemplateInput,
  RestoreEntryTemplateInput,
  DeleteEntryTemplateInput,
  GenerateEntryFromTemplateInput,
  BatchGenerateEntriesInput,
  ListEntryTemplatesInput,
  ToggleTemplateFavoriteInput,
  GetTemplateVersionsInput,
  CreateTemplateCategoryInput,
  UpdateTemplateCategoryInput,
  DeleteTemplateCategoryInput,
  TemplateCategory,
  TemplateLine,
  TemplateVariable,
  EntryTemplate,
  EntryTemplateWithDetails,
  TemplateVersion,
  ListEntryTemplatesResult,
  ArchiveEntryTemplateResult,
  RestoreEntryTemplateResult,
  DeleteEntryTemplateResult,
  ToggleFavoriteResult,
  BatchGenerateResult,
  ListTemplateCategoriesResult,
  GetTemplateVersionsResult,
} from './schemas/ace/entry-template.schema';

// Recurring Entry (ACC-010)
export {
  frequencySchema,
  scheduleStatusSchema,
  endOfMonthHandlingSchema,
  weekendAdjustmentSchema,
  executionTypeSchema,
  executionStatusSchema,
  createRecurringScheduleSchema,
  updateRecurringScheduleSchema,
  getRecurringScheduleSchema,
  pauseRecurringScheduleSchema,
  resumeRecurringScheduleSchema,
  deleteRecurringScheduleSchema,
  manualGenerateSchema,
  batchGenerateMissedSchema,
  listRecurringSchedulesSchema,
  previewUpcomingSchema,
  getExecutionHistorySchema,
  addHolidaySchema,
  deleteHolidaySchema,
  listHolidaysSchema,
  processDueSchedulesSchema,
  recurringScheduleSchema,
  scheduleExecutionSchema,
  holidaySchema,
  recurringScheduleWithTemplateSchema,
  executionWithEntrySchema,
  listRecurringSchedulesResultSchema,
  resumeScheduleResultSchema,
  batchGenerateMissedResultSchema,
  upcomingEntrySchema,
  previewUpcomingResultSchema,
  processDueSchedulesResultSchema,
  deleteRecurringScheduleResultSchema,
} from './schemas/ace/recurring-entry.schema';

export type {
  Frequency,
  ScheduleStatus,
  EndOfMonthHandling,
  WeekendAdjustment,
  ExecutionType,
  ExecutionStatus,
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
  RecurringSchedule,
  ScheduleExecution,
  Holiday,
  RecurringScheduleWithTemplate,
  ExecutionWithEntry,
  ListRecurringSchedulesResult,
  ResumeScheduleResult,
  BatchGenerateMissedResult,
  UpcomingEntry,
  PreviewUpcomingResult,
  ProcessDueSchedulesResult,
  DeleteRecurringScheduleResult,
} from './schemas/ace/recurring-entry.schema';

// Entry Reversal (ACC-011)
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
} from './schemas/ace/entry-reversal.schema';

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
} from './schemas/ace/entry-reversal.schema';

// Trial Balance (ACC-012)
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
} from './schemas/ace/trial-balance.schema';

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
} from './schemas/ace/trial-balance.schema';

// Balance Sheet (ACC-013)
export {
  balanceSheetSectionSchema,
  detailLevelSchema,
  bsExportFormatSchema,
  reportLanguageSchema,
  generateBalanceSheetSchema,
  exportBalanceSheetSchema,
  saveBalanceSheetSchema,
  getBalanceSheetSchema,
  listBalanceSheetSchema,
  deleteBalanceSheetSchema,
  balanceSheetLineSchema,
  fixedAssetsSectionSchema,
  currentAssetsSectionSchema,
  assetsSectionSchema,
  equitySectionSchema,
  liabilitiesSectionSchema,
  balanceSheetSchema,
  savedBalanceSheetReportSchema,
  balanceSheetResultSchema,
  exportBalanceSheetResultSchema,
  saveBalanceSheetResultSchema,
  getBalanceSheetResultSchema,
  listBalanceSheetResultSchema,
  deleteBalanceSheetResultSchema,
} from './schemas/ace/balance-sheet.schema';

export type {
  BalanceSheetSection,
  DetailLevel,
  BSExportFormat,
  ReportLanguage,
  GenerateBalanceSheetInput,
  ExportBalanceSheetInput,
  SaveBalanceSheetInput,
  GetBalanceSheetInput,
  ListBalanceSheetInput,
  DeleteBalanceSheetInput,
  BalanceSheetLine,
  FixedAssetsSection,
  CurrentAssetsSection,
  AssetsSection,
  EquitySection,
  LiabilitiesSection,
  BalanceSheet,
  SavedBalanceSheetReport,
  BalanceSheetResult,
  ExportBalanceSheetResult,
  SaveBalanceSheetResult,
  GetBalanceSheetResult,
  ListBalanceSheetResult,
  DeleteBalanceSheetResult,
} from './schemas/ace/balance-sheet.schema';

// Income Statement (ACC-014)
export {
  statementVariantSchema,
  isReportStatusSchema,
  isExportFormatSchema,
  isReportLanguageSchema,
  generateIncomeStatementSchema,
  exportIncomeStatementSchema,
  saveIncomeStatementSchema,
  getIncomeStatementSchema,
  listIncomeStatementsSchema,
  deleteIncomeStatementSchema,
  approveIncomeStatementSchema,
  incomeStatementLineSchema,
  revenueSectionSchema,
  operatingCostsSectionSchema,
  otherOperatingRevenueSectionSchema,
  otherOperatingCostsSectionSchema,
  financialRevenueSectionSchema,
  financialCostsSectionSchema,
  incomeStatementSchema,
  savedIncomeStatementReportSchema,
  incomeStatementResultSchema,
  exportIncomeStatementResultSchema,
  saveIncomeStatementResultSchema,
  getIncomeStatementResultSchema,
  listIncomeStatementsResultSchema,
  deleteIncomeStatementResultSchema,
  approveIncomeStatementResultSchema,
} from './schemas/ace/income-statement.schema';

export type {
  StatementVariant,
  ISReportStatus,
  ISExportFormat,
  ISReportLanguage,
  GenerateIncomeStatementInput,
  ExportIncomeStatementInput,
  SaveIncomeStatementInput,
  GetIncomeStatementInput,
  ListIncomeStatementsInput,
  DeleteIncomeStatementInput,
  ApproveIncomeStatementInput,
  IncomeStatementLine,
  RevenueSection,
  OperatingCostsSection,
  OtherOperatingRevenueSection,
  OtherOperatingCostsSection,
  FinancialRevenueSection,
  FinancialCostsSection,
  IncomeStatement,
  SavedIncomeStatementReport,
  IncomeStatementResult,
  ExportIncomeStatementResult,
  SaveIncomeStatementResult,
  GetIncomeStatementResult,
  ListIncomeStatementsResult,
  DeleteIncomeStatementResult,
  ApproveIncomeStatementResult,
} from './schemas/ace/income-statement.schema';

// JPK-KR Export (ACC-015)
export {
  jpkTypeSchema,
  jpkSubmissionTypeSchema,
  jpkStatusSchema,
  jpkValidationSeveritySchema,
  jpkAccountTypeSchema,
  generateJpkKrSchema,
  preValidateJpkKrSchema,
  validateJpkSchema,
  downloadJpkSchema,
  getJpkLogSchema,
  listJpkLogsSchema,
  updateAccountMappingSchema,
  markJpkSubmittedSchema,
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
  generateJpkKrResultSchema,
  preValidateJpkKrResultSchema,
  validateJpkResultSchema,
  downloadJpkResultSchema,
  getJpkLogResultSchema,
  listJpkLogsResultSchema,
  getAccountMappingsResultSchema,
  updateAccountMappingResultSchema,
  markJpkSubmittedResultSchema,
} from './schemas/ace/jpk-kr.schema';

export type {
  JpkType,
  JpkSubmissionType,
  JpkStatus,
  JpkValidationSeverity,
  JpkAccountType,
  GenerateJpkKrInput,
  PreValidateJpkKrInput,
  ValidateJpkInput,
  DownloadJpkInput,
  GetJpkLogInput,
  ListJpkLogsInput,
  UpdateAccountMappingInput,
  MarkJpkSubmittedInput,
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
  GenerateJpkKrResult,
  PreValidateJpkKrResult,
  ValidateJpkResult,
  DownloadJpkResult,
  GetJpkLogResult,
  ListJpkLogsResult,
  GetAccountMappingsResult,
  UpdateAccountMappingResult,
  MarkJpkSubmittedResult,
} from './schemas/ace/jpk-kr.schema';

// Tagging schemas (CRM-007)
export {
  selectionModeSchema,
  tagOperationSchema,
  tagLogicSchema,
  createTagCategorySchema,
  updateTagCategorySchema,
  getTagCategoriesSchema,
  deleteTagCategorySchema,
  createTagSchema,
  updateTagSchema,
  getTagsSchema,
  getTagByIdSchema,
  deleteTagSchema,
  archiveTagSchema,
  restoreTagSchema,
  assignTagsSchema,
  removeTagsSchema,
  getClientTagsSchema,
  replaceClientTagsSchema,
  bulkTagOperationSchema as taggingBulkTagOperationSchema,
  tagFilterSchema,
  getTagStatisticsSchema as getTaggingStatisticsSchema,
} from './schemas/tagging.schema';

export type {
  SelectionMode,
  TagOperation,
  TagLogic,
  CreateTagCategoryInput,
  UpdateTagCategoryInput,
  GetTagCategoriesInput,
  DeleteTagCategoryInput,
  CreateTagInput,
  UpdateTagInput,
  GetTagsInput,
  GetTagByIdInput,
  DeleteTagInput,
  ArchiveTagInput,
  RestoreTagInput,
  AssignTagsInput,
  RemoveTagsInput,
  GetClientTagsInput,
  ReplaceClientTagsInput,
  BulkTagOperationInput,
  TagFilterInput,
  GetTagStatisticsInput as GetTaggingModuleStatisticsInput,
  Tag,
  TagCategory,
  ClientTag,
  TagAssignmentResult,
  BulkTagResult,
  TagStatistics,
  TagCategoryStatistics,
  TagsOverviewStatistics,
} from './schemas/tagging.schema';

// ===========================================================================
// TAX (Tax Compliance) Module
// ===========================================================================

// Client Tax Configuration (TAX-001)
export {
  // Enums
  vatStatusSchema as taxVatStatusSchema,
  vatPeriodSchema as taxVatPeriodSchema,
  incomeTaxFormSchema,
  pitTaxOptionSchema,
  zusTypeSchema,
  submissionMethodSchema as taxSubmissionMethodSchema,
  authorizationScopeSchema,
  auditActionSchema as taxAuditActionSchema,
  nipSchema as taxNipSchema,

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
} from './schemas/tax/tax-configuration.schema';

export type {
  // Enum types
  VATStatus as TaxVATStatus,
  VATPeriod as TaxVATPeriod,
  IncomeTaxForm,
  PITTaxOption,
  ZUSType,
  SubmissionMethod as TaxSubmissionMethod,
  AuthorizationScope,
  AuditAction as TaxAuditAction,

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
} from './schemas/tax/tax-configuration.schema';

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
} from './schemas/tax/tax-rates.schema';

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
} from './schemas/tax/tax-rates.schema';

// ===========================================================================
// TAX DEADLINE MANAGEMENT (TAX-003)
// ===========================================================================

export {
  // Enums
  deadlineTaxTypeSchema,
  deadlineStatusSchema,
  reminderLevelSchema,
  // notificationChannelSchema - already exported from security-alerts module (line 244)
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
} from './schemas/tax/tax-deadlines.schema';

export type {
  // Enum types
  DeadlineTaxType,
  DeadlineStatus,
  ReminderLevel,
  // NotificationChannel - already exported from security-alerts module (line 271)
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
} from './schemas/tax/tax-deadlines.schema';

// ===========================================================================
// VAT CALCULATION ENGINE (TAX-004)
// ===========================================================================

export {
  // Enums
  vatTransactionTypeSchema,
  vatDirectionSchema,
  vatRateCodeSchema as vatRateCodeSchema004, // Alias to avoid conflict with TAX-002 vatRateCodeSchema
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
} from './schemas/tax/vat-calculation.schema';

export type {
  // Enum types
  VatTransactionType,
  VatDirection,
  VatRateCode as VatRateCode004, // Alias to avoid conflict with TAX-002 VATRateCode
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
} from './schemas/tax/vat-calculation.schema';

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

  // CIT Calculation schemas
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
} from './schemas/tax/income-tax-declaration.schema';

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

  // CIT Calculation input types
  CalculateCITInput,
  CalculatePITDeclarationInput,

  // Declaration management input types
  CreateDeclarationInput,
  UpdateDeclarationInput,
  CalculateDeclarationInput,
  SubmitDeclarationInput,
  CreateDeclarationCorrectionInput,
  GetDeclarationInput,
  ListDeclarationsInput,
  DeleteDeclarationInput,

  // Advance payment input types
  CalculateAdvanceInput,
  RecordAdvancePaymentInput,
  GetAdvanceScheduleInput,

  // Loss carry forward input types
  GetLossCarryForwardInput,
  ApplyLossInput,

  // Output types
  CITCalculationResult,
  PITCalculationResult,
  DeclarationSummary,
  AdvanceSchedule,
  ListDeclarationsResult,
} from './schemas/tax/income-tax-declaration.schema';

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
  polishIBANSchema,

  // Verification request schemas
  verifyNIPRequestSchema,
  verifyIBANRequestSchema,
  batchVerifyRequestSchema,
  paymentVerificationRequestSchema,

  // History and filter schemas
  verificationHistoryFilterSchema,
  getVerificationByIdSchema,

  // Alert schemas
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
} from './schemas/tax/white-list.schema';

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

  // Alert input types
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
} from './schemas/tax/white-list.schema';

// ===========================================================================
// ZUS DECLARATION (TAX-006)
// ===========================================================================

export {
  // Enums
  zusFormTypeSchema,
  // zusContributorTypeSchema already exported from tax-rates.schema.ts
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
} from './schemas/tax/zus-declaration.schema';

export type {
  // Enum types
  ZUSFormType,
  // ZUSContributorType already exported from tax-rates.schema.ts
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
} from './schemas/tax/zus-declaration.schema';

// ===========================================================================
// JPK REPORTING MODULE (TAX-007)
// ===========================================================================
// JPK (Jednolity Plik Kontrolny - Standard Audit File) for Polish tax compliance
// Supports: JPK_V7M, JPK_V7K, JPK_FA, JPK_KR, JPK_WB, JPK_MAG, JPK_PKPIR, JPK_EWP

export {
  // Enums
  jpkReportTypeSchema,
  jpkReportStatusSchema,
  jpkSubmissionPurposeSchema,
  jpkGtuCodeSchema,
  jpkProcedureCodeSchema,
  jpkDocumentTypeSchema,
  // Note: jpkValidationSeveritySchema omitted - already exported from ACE module

  // Entity schemas
  jpkV7HeaderSchema,
  jpkV7SubjectSchema,
  jpkV7SaleRecordSchema,
  jpkV7PurchaseRecordSchema,
  jpkV7DeclarationSchema,
  jpkReportSchema,
  jpkV7ValidationIssueSchema,

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
  jpkV7ValidationResultSchema,
  jpkGenerationResultSchema,
  jpkSubmissionResultSchema,
  jpkStatusResultSchema,
  jpkReportSummarySchema,
  listJPKReportsResultSchema,
  importRecordsResultSchema,
  jpkDownloadResultSchema,

  // Constants
  JPK_API_ENDPOINTS,
  JPK_SCHEMA_VERSIONS,
  TAX_OFFICE_CODES,
} from './schemas/tax';

export type {
  // Enum types
  JPKReportType,
  JPKReportStatus,
  JPKSubmissionPurpose,
  JPKGTUCode,
  JPKProcedureCode,
  JPKDocumentType,
  // Note: JPKValidationSeverity omitted - similar to ValidationSeverity from ACE module

  // Entity types
  JPKV7Header,
  JPKV7Subject,
  JPKV7SaleRecord,
  JPKV7PurchaseRecord,
  JPKV7Declaration,
  JPKReport,
  JPKV7ValidationIssue,

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
  JPKV7ValidationResult,
  JPKGenerationResult,
  JPKSubmissionResult,
  JPKStatusResult,
  JPKReportSummary,
  ListJPKReportsResult,
  ImportRecordsResult,
  JPKDownloadResult,
} from './schemas/tax';

// ===========================================================================
// DOC (Document Management) Module
// ===========================================================================

// Document schemas (DOC-001)
export {
  // Enums
  documentStatusSchema,
  documentCategorySchema,
  documentSourceSchema,
  processingStatusSchema,
  supportedFileTypeSchema,
  documentVisibilitySchema,

  // Entity schemas
  documentSchema,
  documentListItemSchema,

  // Input schemas - Create
  createDocumentInputSchema,

  // Input schemas - Update
  updateDocumentInputSchema,

  // Input schemas - Query
  getDocumentInputSchema,
  listDocumentsInputSchema,
  deleteDocumentInputSchema,
  archiveDocumentInputSchema,
  restoreDocumentInputSchema,

  // Output schemas
  documentListResponseSchema,
  documentWithVersionsSchema,
  documentStatsSchema,
  getDocumentStatsInputSchema,
} from './schemas/doc';

export type {
  DocumentStatus,
  DocumentCategory,
  DocumentSource,
  ProcessingStatus,
  SupportedFileType,
  DocumentVisibility,
  Document,
  DocumentListItem,
  CreateDocumentInput,
  UpdateDocumentInput,
  GetDocumentInput,
  ListDocumentsInput,
  DeleteDocumentInput,
  ArchiveDocumentInput,
  RestoreDocumentInput,
  DocumentListResponse,
  DocumentWithVersions,
  DocumentStats,
  GetDocumentStatsInput,
} from './schemas/doc';

// Upload schemas (DOC-001)
export {
  // Constants
  MAX_FILE_SIZE,
  MAX_BATCH_SIZE,
  ALLOWED_MIME_TYPES,

  // Enums
  uploadStatusSchema,
  uploadErrorCodeSchema,

  // Input schemas
  fileUploadMetadataSchema,
  requestUploadUrlInputSchema,
  confirmUploadInputSchema,
  cancelUploadInputSchema,
  batchUploadInputSchema,
  getUploadStatusInputSchema,
  requestDownloadUrlInputSchema,

  // Output schemas
  uploadUrlResponseSchema,
  uploadStatusResponseSchema,
  uploadConfirmationResponseSchema,
  batchUploadResponseSchema,
  downloadUrlResponseSchema,

  // Validation helpers
  validateFileExtension,
  validateMimeType,
  getFileTypeFromExtension,
  formatFileSize,
} from './schemas/doc';

export type {
  UploadStatus,
  UploadErrorCode,
  FileUploadMetadata,
  RequestUploadUrlInput,
  ConfirmUploadInput,
  CancelUploadInput,
  BatchUploadInput,
  GetUploadStatusInput,
  RequestDownloadUrlInput,
  UploadUrlResponse,
  UploadStatusResponse,
  UploadConfirmationResponse,
  BatchUploadResponse,
  DownloadUrlResponse,
} from './schemas/doc';

// Search schemas (DOC-005)
export {
  // Enums - renamed to avoid conflict with CRM search schemas
  searchSortFieldSchema as docSearchSortFieldSchema,
  searchOperatorSchema as docSearchOperatorSchema,
  matchTypeSchema as docMatchTypeSchema,
  suggestionTypeSchema as docSuggestionTypeSchema,

  // Filter schemas
  textSearchInputSchema as docTextSearchInputSchema,
  dateRangeFilterSchema as docDateRangeFilterSchema,
  numericRangeFilterSchema as docNumericRangeFilterSchema,
  filterConditionSchema as docFilterConditionSchema,
  filterGroupSchema as docFilterGroupSchema,
  facetRequestSchema as docFacetRequestSchema,

  // Input schemas
  documentSearchInputSchema,
  quickSearchInputSchema as docQuickSearchInputSchema,
  similarDocumentsInputSchema,
  searchSuggestionsInputSchema as docSearchSuggestionsInputSchema,

  // Output schemas
  searchHighlightSchema as docSearchHighlightSchema,
  searchResultItemSchema as docSearchResultItemSchema,
  facetValueSchema as docFacetValueSchema,
  facetResultSchema as docFacetResultSchema,
  documentSearchResponseSchema,
  quickSearchResultSchema as docQuickSearchResultSchema,
  quickSearchResponseSchema as docQuickSearchResponseSchema,
  similarDocumentResultSchema,
  similarDocumentsResponseSchema,
  searchSuggestionSchema as docSearchSuggestionSchema,
  searchSuggestionsResponseSchema as docSearchSuggestionsResponseSchema,
} from './schemas/doc';

export type {
  SearchSortField as DocSearchSortField,
  SearchOperator as DocSearchOperator,
  MatchType as DocMatchType,
  SuggestionType as DocSuggestionType,
  TextSearchInput as DocTextSearchInput,
  DateRangeFilter as DocDateRangeFilter,
  NumericRangeFilter as DocNumericRangeFilter,
  FilterCondition as DocFilterCondition,
  FilterGroup as DocFilterGroup,
  FacetRequest as DocFacetRequest,
  DocumentSearchInput,
  QuickSearchInput as DocQuickSearchInput,
  SimilarDocumentsInput,
  SearchSuggestionsInput as DocSearchSuggestionsInput,
  SearchHighlight as DocSearchHighlight,
  SearchResultItem as DocSearchResultItem,
  FacetValue as DocFacetValue,
  FacetResult as DocFacetResult,
  DocumentSearchResponse,
  QuickSearchResult as DocQuickSearchResult,
  QuickSearchResponse as DocQuickSearchResponse,
  SimilarDocumentResult,
  SimilarDocumentsResponse,
  SearchSuggestion as DocSearchSuggestion,
  SearchSuggestionsResponse as DocSearchSuggestionsResponse,
} from './schemas/doc';

// Version schemas (DOC-006)
export {
  // Enums
  versionChangeTypeSchema,
  versionStatusSchema,
  comparisonResultTypeSchema,

  // Entity schemas
  documentVersionSchema,
  versionListItemSchema,
  versionChangeRecordSchema,

  // Input schemas
  createVersionInputSchema,
  getVersionHistoryInputSchema,
  getVersionInputSchema,
  compareVersionsInputSchema,
  restoreVersionInputSchema as restoreVersionInputSchemaDoc,
  deleteVersionInputSchema,
  mergeVersionsInputSchema,

  // Output schemas
  versionHistoryResponseSchema,
  versionDetailResponseSchema,
  versionComparisonResultSchema,
  restoreVersionResponseSchema,
  mergeVersionsResponseSchema,

  // Retention policy schemas
  versionRetentionPolicySchema,
  createRetentionPolicyInputSchema,
  updateRetentionPolicyInputSchema,

  // Version helpers
  isValidVersionNumber,
  formatVersionNumber,
  parseVersionString,
} from './schemas/doc';

export type {
  VersionChangeType,
  VersionStatus,
  ComparisonResultType,
  DocumentVersion,
  VersionListItem,
  VersionChangeRecord,
  CreateVersionInput,
  GetVersionHistoryInput,
  GetVersionInput,
  CompareVersionsInput,
  RestoreVersionInput as RestoreVersionInputDoc,
  DeleteVersionInput,
  MergeVersionsInput,
  VersionHistoryResponse,
  VersionDetailResponse,
  VersionComparisonResult,
  RestoreVersionResponse,
  MergeVersionsResponse,
  VersionRetentionPolicy,
  CreateRetentionPolicyInput,
  UpdateRetentionPolicyInput,
} from './schemas/doc';

// DOC-002: OCR Processing Schemas
export {
  // Enums
  extractionTypeSchema,
  extractionStatusSchema,
  ocrEngineSchema,
  ocrLanguageSchema,
  ocrPrioritySchema,

  // Entity schemas
  ocrResultSchema,
  ocrPageResultSchema,
  documentExtractionSchema,

  // Input schemas
  requestOcrInputSchema,
  getOcrResultInputSchema,
  getExtractionHistoryInputSchema,
  retryExtractionInputSchema,
  cancelExtractionInputSchema,
  validateExtractionInputSchema,
  batchOcrInputSchema,

  // Output schemas
  ocrProcessingResponseSchema,
  ocrResultResponseSchema,
  extractionHistoryResponseSchema,
  batchOcrResponseSchema,
  ocrValidationResponseSchema,

  // Helper functions
  calculateAverageConfidence,
  isConfidenceAcceptable,
  getLanguageName,
  getEngineName,
} from './schemas/doc';

export type {
  ExtractionType,
  ExtractionStatus,
  OcrEngine,
  OcrLanguage,
  OcrPriority,
  OcrResult,
  OcrPageResult,
  DocumentExtraction,
  RequestOcrInput,
  GetOcrResultInput,
  GetExtractionHistoryInput,
  RetryExtractionInput,
  CancelExtractionInput,
  ValidateExtractionInput,
  BatchOcrInput,
  OcrProcessingResponse,
  OcrResultResponse,
  ExtractionHistoryResponse,
  BatchOcrResponse,
  OcrValidationResponse,
} from './schemas/doc';

// DOC-003: AI Extraction Schemas
export {
  // Enums
  aiModelSchema,
  extractionTemplateTypeSchema,
  extractionFieldTypeSchema,
  extractionJobStatusSchema,
  extractionPrioritySchema,

  // Field definition schemas
  extractionFieldDefSchema,
  extractedFieldSchema,

  // Template schemas
  extractionTemplateSchema,

  // Extraction data schemas
  invoiceExtractionDataSchema,
  receiptExtractionDataSchema,
  bankStatementExtractionDataSchema,
  extractionResultSchema,

  // Input schemas
  requestExtractionInputSchema,
  getExtractionResultInputSchema,
  listExtractionsInputSchema,
  updateExtractionInputSchema,
  reExtractInputSchema,
  batchExtractionInputSchema,

  // Template management input schemas
  createExtractionTemplateInputSchema,
  updateExtractionTemplateInputSchema,
  getExtractionTemplateInputSchema,
  listExtractionTemplatesInputSchema,
  deleteExtractionTemplateInputSchema,

  // Output schemas
  extractionJobResponseSchema,
  extractionResultResponseSchema,
  extractionListResponseSchema,
  batchExtractionResponseSchema,
  templateListResponseSchema,
  updateExtractionResponseSchema,

  // Helper functions
  calculateOverallConfidence,
  requiresManualReview,
  getAiModelName,
  getTemplateTypeName,
  validateNip,
  validateRegon,
  validateIban,
} from './schemas/doc';

export type {
  AiModel,
  ExtractionTemplateType,
  ExtractionFieldType,
  ExtractionJobStatus,
  ExtractionPriority,
  ExtractionFieldDef,
  ExtractedField,
  ExtractionTemplate,
  InvoiceExtractionData,
  ReceiptExtractionData,
  BankStatementExtractionData,
  ExtractionResult,
  RequestExtractionInput,
  GetExtractionResultInput,
  ListExtractionsInput,
  UpdateExtractionInput,
  ReExtractInput,
  BatchExtractionInput,
  CreateExtractionTemplateInput,
  UpdateExtractionTemplateInput,
  GetExtractionTemplateInput,
  ListExtractionTemplatesInput,
  DeleteExtractionTemplateInput,
  ExtractionJobResponse,
  ExtractionResultResponse,
  ExtractionListResponse,
  BatchExtractionResponse,
  TemplateListResponse,
  UpdateExtractionResponse,
} from './schemas/doc';

// DOC-004: Classification Schemas
export {
  // Enums
  classificationMethodSchema,
  ClassificationMethod,
  classificationStatusSchema,
  ClassificationStatus,
  classificationPrioritySchema,
  ClassificationPriority,
  documentSubTypeSchema,
  DocumentSubType,

  // Entity schemas
  classificationPredictionSchema,
  ClassificationPrediction,
  classificationResultSchema,
  ClassificationResult,
  classificationRuleSchema,
  ClassificationRule,

  // Input schemas
  requestClassificationInputSchema,
  RequestClassificationInput,
  getClassificationResultInputSchema,
  GetClassificationResultInput,
  getDocumentClassificationInputSchema,
  GetDocumentClassificationInput,
  overrideClassificationInputSchema,
  OverrideClassificationInput,
  batchClassificationInputSchema,
  BatchClassificationInput,
  listClassificationsInputSchema,
  ListClassificationsInput,

  // Rule management input schemas
  createClassificationRuleInputSchema,
  CreateClassificationRuleInput,
  updateClassificationRuleInputSchema,
  UpdateClassificationRuleInput,
  deleteClassificationRuleInputSchema,
  DeleteClassificationRuleInput,
  listClassificationRulesInputSchema,
  ListClassificationRulesInput,

  // Output schemas
  classificationJobResponseSchema,
  ClassificationJobResponse,
  classificationResultResponseSchema,
  ClassificationResultResponse,
  classificationListResponseSchema,
  ClassificationListResponse,
  batchClassificationResponseSchema,
  BatchClassificationResponse,
  overrideClassificationResponseSchema,
  OverrideClassificationResponse,
  classificationRuleListResponseSchema,
  ClassificationRuleListResponse,

  // Helper functions
  getCategoryDisplayName,
  getSubTypeDisplayName,
  isClassificationConfidenceAcceptable,
  getConfidenceLevel,
} from './schemas/doc';