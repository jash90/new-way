// DOC Module Schema Exports
// Central export point for all document management schemas

// =========================================================================
// DOCUMENT SCHEMAS (DOC-001)
// =========================================================================
export {
  // Enums
  documentStatusSchema,
  type DocumentStatus,
  documentCategorySchema,
  type DocumentCategory,
  documentSourceSchema,
  type DocumentSource,
  processingStatusSchema,
  type ProcessingStatus,
  supportedFileTypeSchema,
  type SupportedFileType,
  documentVisibilitySchema,
  type DocumentVisibility,

  // Entity schemas
  documentSchema,
  type Document,
  documentListItemSchema,
  type DocumentListItem,

  // Input schemas - Create
  createDocumentInputSchema,
  type CreateDocumentInput,

  // Input schemas - Update
  updateDocumentInputSchema,
  type UpdateDocumentInput,

  // Input schemas - Query
  getDocumentInputSchema,
  type GetDocumentInput,
  listDocumentsInputSchema,
  type ListDocumentsInput,
  deleteDocumentInputSchema,
  type DeleteDocumentInput,
  archiveDocumentInputSchema,
  type ArchiveDocumentInput,
  restoreDocumentInputSchema,
  type RestoreDocumentInput,

  // Output schemas
  documentListResponseSchema,
  type DocumentListResponse,
  documentWithVersionsSchema,
  type DocumentWithVersions,
  documentStatsSchema,
  type DocumentStats,
  getDocumentStatsInputSchema,
  type GetDocumentStatsInput,
} from './document.schema';

// =========================================================================
// UPLOAD SCHEMAS (DOC-001)
// =========================================================================
export {
  // Constants
  MAX_FILE_SIZE,
  MAX_BATCH_SIZE,
  ALLOWED_MIME_TYPES,

  // Enums
  uploadStatusSchema,
  type UploadStatus,
  uploadErrorCodeSchema,
  type UploadErrorCode,

  // Input schemas
  fileUploadMetadataSchema,
  type FileUploadMetadata,
  requestUploadUrlInputSchema,
  type RequestUploadUrlInput,
  confirmUploadInputSchema,
  type ConfirmUploadInput,
  cancelUploadInputSchema,
  type CancelUploadInput,
  batchUploadInputSchema,
  type BatchUploadInput,
  getUploadStatusInputSchema,
  type GetUploadStatusInput,
  requestDownloadUrlInputSchema,
  type RequestDownloadUrlInput,

  // Output schemas
  uploadUrlResponseSchema,
  type UploadUrlResponse,
  uploadStatusResponseSchema,
  type UploadStatusResponse,
  uploadConfirmationResponseSchema,
  type UploadConfirmationResponse,
  batchUploadResponseSchema,
  type BatchUploadResponse,
  downloadUrlResponseSchema,
  type DownloadUrlResponse,

  // Validation helpers
  validateFileExtension,
  validateMimeType,
  getFileTypeFromExtension,
  formatFileSize,
} from './upload.schema';

// =========================================================================
// SEARCH SCHEMAS (DOC-005)
// =========================================================================
export {
  // Enums
  searchSortFieldSchema,
  type SearchSortField,
  searchOperatorSchema,
  type SearchOperator,
  matchTypeSchema,
  type MatchType,
  suggestionTypeSchema,
  type SuggestionType,

  // Filter schemas
  textSearchInputSchema,
  type TextSearchInput,
  dateRangeFilterSchema,
  type DateRangeFilter,
  numericRangeFilterSchema,
  type NumericRangeFilter,
  filterConditionSchema,
  type FilterCondition,
  filterGroupSchema,
  type FilterGroup,
  facetRequestSchema,
  type FacetRequest,

  // Input schemas
  documentSearchInputSchema,
  type DocumentSearchInput,
  quickSearchInputSchema,
  type QuickSearchInput,
  similarDocumentsInputSchema,
  type SimilarDocumentsInput,
  searchSuggestionsInputSchema,
  type SearchSuggestionsInput,

  // Output schemas
  searchHighlightSchema,
  type SearchHighlight,
  searchResultItemSchema,
  type SearchResultItem,
  facetValueSchema,
  type FacetValue,
  facetResultSchema,
  type FacetResult,
  documentSearchResponseSchema,
  type DocumentSearchResponse,
  quickSearchResultSchema,
  type QuickSearchResult,
  quickSearchResponseSchema,
  type QuickSearchResponse,
  similarDocumentResultSchema,
  type SimilarDocumentResult,
  similarDocumentsResponseSchema,
  type SimilarDocumentsResponse,
  searchSuggestionSchema,
  type SearchSuggestion,
  searchSuggestionsResponseSchema,
  type SearchSuggestionsResponse,
} from './search.schema';

// =========================================================================
// VERSION SCHEMAS (DOC-006)
// =========================================================================
export {
  // Enums
  versionChangeTypeSchema,
  type VersionChangeType,
  versionStatusSchema,
  type VersionStatus,
  comparisonResultTypeSchema,
  type ComparisonResultType,

  // Entity schemas
  documentVersionSchema,
  type DocumentVersion,
  versionListItemSchema,
  type VersionListItem,
  versionChangeRecordSchema,
  type VersionChangeRecord,

  // Input schemas
  createVersionInputSchema,
  type CreateVersionInput,
  getVersionHistoryInputSchema,
  type GetVersionHistoryInput,
  getVersionInputSchema,
  type GetVersionInput,
  compareVersionsInputSchema,
  type CompareVersionsInput,
  restoreVersionInputSchema,
  type RestoreVersionInput,
  deleteVersionInputSchema,
  type DeleteVersionInput,
  mergeVersionsInputSchema,
  type MergeVersionsInput,

  // Output schemas
  versionHistoryResponseSchema,
  type VersionHistoryResponse,
  versionDetailResponseSchema,
  type VersionDetailResponse,
  versionComparisonResultSchema,
  type VersionComparisonResult,
  restoreVersionResponseSchema,
  type RestoreVersionResponse,
  mergeVersionsResponseSchema,
  type MergeVersionsResponse,

  // Retention policy schemas
  versionRetentionPolicySchema,
  type VersionRetentionPolicy,
  createRetentionPolicyInputSchema,
  type CreateRetentionPolicyInput,
  updateRetentionPolicyInputSchema,
  type UpdateRetentionPolicyInput,

  // Version helpers
  isValidVersionNumber,
  formatVersionNumber,
  parseVersionString,
} from './version.schema';

// =========================================================================
// OCR SCHEMAS (DOC-002)
// =========================================================================
export {
  // Enums
  extractionTypeSchema,
  type ExtractionType,
  extractionStatusSchema,
  type ExtractionStatus,
  ocrEngineSchema,
  type OcrEngine,
  ocrLanguageSchema,
  type OcrLanguage,
  ocrPrioritySchema,
  type OcrPriority,

  // Entity schemas
  ocrResultSchema,
  type OcrResult,
  ocrPageResultSchema,
  type OcrPageResult,
  documentExtractionSchema,
  type DocumentExtraction,

  // Input schemas
  requestOcrInputSchema,
  type RequestOcrInput,
  getOcrResultInputSchema,
  type GetOcrResultInput,
  getExtractionHistoryInputSchema,
  type GetExtractionHistoryInput,
  retryExtractionInputSchema,
  type RetryExtractionInput,
  cancelExtractionInputSchema,
  type CancelExtractionInput,
  validateExtractionInputSchema,
  type ValidateExtractionInput,
  batchOcrInputSchema,
  type BatchOcrInput,

  // Output schemas
  ocrProcessingResponseSchema,
  type OcrProcessingResponse,
  ocrResultResponseSchema,
  type OcrResultResponse,
  extractionHistoryResponseSchema,
  type ExtractionHistoryResponse,
  batchOcrResponseSchema,
  type BatchOcrResponse,
  ocrValidationResponseSchema,
  type OcrValidationResponse,

  // Helper functions
  calculateAverageConfidence,
  isConfidenceAcceptable,
  getLanguageName,
  getEngineName,
} from './ocr.schema';

// =========================================================================
// AI EXTRACTION SCHEMAS (DOC-003)
// =========================================================================
export {
  // Enums
  aiModelSchema,
  type AiModel,
  extractionTemplateTypeSchema,
  type ExtractionTemplateType,
  extractionFieldTypeSchema,
  type ExtractionFieldType,
  extractionJobStatusSchema,
  type ExtractionJobStatus,
  extractionPrioritySchema,
  type ExtractionPriority,

  // Field definition schemas
  extractionFieldDefSchema,
  type ExtractionFieldDef,
  extractedFieldSchema,
  type ExtractedField,

  // Template schemas
  extractionTemplateSchema,
  type ExtractionTemplate,

  // Extraction data schemas
  invoiceExtractionDataSchema,
  type InvoiceExtractionData,
  receiptExtractionDataSchema,
  type ReceiptExtractionData,
  bankStatementExtractionDataSchema,
  type BankStatementExtractionData,
  extractionResultSchema,
  type ExtractionResult,

  // Input schemas
  requestExtractionInputSchema,
  type RequestExtractionInput,
  getExtractionResultInputSchema,
  type GetExtractionResultInput,
  listExtractionsInputSchema,
  type ListExtractionsInput,
  updateExtractionInputSchema,
  type UpdateExtractionInput,
  reExtractInputSchema,
  type ReExtractInput,
  batchExtractionInputSchema,
  type BatchExtractionInput,

  // Template management input schemas
  createExtractionTemplateInputSchema,
  type CreateExtractionTemplateInput,
  updateExtractionTemplateInputSchema,
  type UpdateExtractionTemplateInput,
  getExtractionTemplateInputSchema,
  type GetExtractionTemplateInput,
  listExtractionTemplatesInputSchema,
  type ListExtractionTemplatesInput,
  deleteExtractionTemplateInputSchema,
  type DeleteExtractionTemplateInput,

  // Output schemas
  extractionJobResponseSchema,
  type ExtractionJobResponse,
  extractionResultResponseSchema,
  type ExtractionResultResponse,
  extractionListResponseSchema,
  type ExtractionListResponse,
  batchExtractionResponseSchema,
  type BatchExtractionResponse,
  templateListResponseSchema,
  type TemplateListResponse,
  updateExtractionResponseSchema,
  type UpdateExtractionResponse,

  // Helper functions
  calculateOverallConfidence,
  requiresManualReview,
  getAiModelName,
  getTemplateTypeName,
  validateNip,
  validateRegon,
  validateIban,
} from './extraction.schema';

// =========================================================================
// CLASSIFICATION SCHEMAS (DOC-004)
// =========================================================================
export {
  // Enums
  classificationMethodSchema,
  type ClassificationMethod,
  classificationStatusSchema,
  type ClassificationStatus,
  classificationPrioritySchema,
  type ClassificationPriority,
  documentSubTypeSchema,
  type DocumentSubType,

  // Entity schemas
  classificationPredictionSchema,
  type ClassificationPrediction,
  classificationResultSchema,
  type ClassificationResult,
  classificationRuleSchema,
  type ClassificationRule,

  // Input schemas
  requestClassificationInputSchema,
  type RequestClassificationInput,
  getClassificationResultInputSchema,
  type GetClassificationResultInput,
  getDocumentClassificationInputSchema,
  type GetDocumentClassificationInput,
  overrideClassificationInputSchema,
  type OverrideClassificationInput,
  batchClassificationInputSchema,
  type BatchClassificationInput,
  listClassificationsInputSchema,
  type ListClassificationsInput,

  // Rule management input schemas
  createClassificationRuleInputSchema,
  type CreateClassificationRuleInput,
  updateClassificationRuleInputSchema,
  type UpdateClassificationRuleInput,
  deleteClassificationRuleInputSchema,
  type DeleteClassificationRuleInput,
  listClassificationRulesInputSchema,
  type ListClassificationRulesInput,

  // Output schemas
  classificationJobResponseSchema,
  type ClassificationJobResponse,
  classificationResultResponseSchema,
  type ClassificationResultResponse,
  classificationListResponseSchema,
  type ClassificationListResponse,
  batchClassificationResponseSchema,
  type BatchClassificationResponse,
  overrideClassificationResponseSchema,
  type OverrideClassificationResponse,
  classificationRuleListResponseSchema,
  type ClassificationRuleListResponse,

  // Helper functions
  getCategoryDisplayName,
  getSubTypeDisplayName,
  isClassificationConfidenceAcceptable,
  getConfidenceLevel,
} from './classification.schema';
