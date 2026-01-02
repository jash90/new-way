/**
 * ACC-015: JPK-KR Export Router Tests
 * TDD tests for JPK_KR export router endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { router } from '../../trpc';
import { jpkKrRouter } from '../../routers/ace/jpk-kr.router';
import { createCallerFactory } from '../../trpc';

// ===========================================================================
// MOCKS - Use vi.hoisted() to create stable mock references
// ===========================================================================

const mocks = vi.hoisted(() => ({
  preValidate: vi.fn(),
  generate: vi.fn(),
  validateSchema: vi.fn(),
  download: vi.fn(),
  getLog: vi.fn(),
  listLogs: vi.fn(),
  getAccountMappings: vi.fn(),
  updateAccountMapping: vi.fn(),
  markSubmitted: vi.fn(),
}));

vi.mock('../../services/ace/jpk-kr.service', () => ({
  JpkKrService: vi.fn().mockImplementation(() => mocks),
}));

import { JpkKrService } from '../../services/ace/jpk-kr.service';

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_JPK_LOG_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440003';

const mockContext = {
  prisma: {},
  redis: {},
  auditLogger: { log: vi.fn() },
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
  },
};

// Test data for pre-validation result
const testPreValidationResult = {
  isValid: true,
  canGenerate: true,
  results: [
    {
      step: 1,
      type: 'ORGANIZATION_DATA',
      passed: true,
      severity: 'INFO' as const,
      message: 'Organization data is complete and valid',
    },
    {
      step: 2,
      type: 'ACCOUNT_MAPPINGS',
      passed: true,
      severity: 'INFO' as const,
      message: 'All accounts are properly mapped',
    },
    {
      step: 3,
      type: 'ENTRY_NUMBERING',
      passed: true,
      severity: 'INFO' as const,
      message: 'Journal entry numbering is sequential',
    },
    {
      step: 4,
      type: 'DRAFT_ENTRIES',
      passed: true,
      severity: 'INFO' as const,
      message: 'No draft entries in the period',
    },
    {
      step: 5,
      type: 'TRIAL_BALANCE',
      passed: true,
      severity: 'INFO' as const,
      message: 'Trial balance is correct',
    },
  ],
  summary: {
    totalChecks: 5,
    passed: 5,
    warnings: 0,
    errors: 0,
  },
};

// Test data for generation result
const testGenerationResult = {
  id: TEST_JPK_LOG_ID,
  fileName: 'JPK_KR_1234567890_2024-01-01_2024-01-31.xml',
  status: 'GENERATED' as const,
  isValid: true,
  statistics: {
    entryCount: 10,
    lineCount: 25,
    accountCount: 20,
    fileSizeBytes: 15000,
  },
  validationErrors: [],
};

// Test data for JPK log
const testJpkLog = {
  id: TEST_JPK_LOG_ID,
  organizationId: TEST_ORG_ID,
  jpkType: 'JPK_KR' as const,
  fileName: 'JPK_KR_1234567890_2024-01-01_2024-01-31.xml',
  generationNumber: 1,
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
  fiscalYear: 2024,
  submissionType: 'ORIGINAL' as const,
  correctionNumber: 0,
  fileSizeBytes: 15000,
  fileHash: 'abc123def456789',
  filePath: '/storage/jpk/test.xml',
  entryCount: 10,
  lineCount: 25,
  accountCount: 20,
  isValid: true,
  validationErrors: [],
  schemaVersion: '1-0',
  status: 'VALID' as const,
  generatedAt: new Date(),
  generatedBy: TEST_USER_ID,
  generatedByUser: {
    id: TEST_USER_ID,
    name: 'Jan Kowalski',
    email: 'jan@example.com',
  },
  submittedAt: null,
  submittedBy: null,
  submittedByUser: null,
  submissionReference: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test data for account mapping
const testAccountMapping = {
  id: 'mapping-1',
  organizationId: TEST_ORG_ID,
  accountId: TEST_ACCOUNT_ID,
  accountCode: '010',
  accountName: 'Środki trwałe',
  jpkAccountType: 'Aktywne' as const,
  jpkCategoryCode: 'A.II',
  jpkTeamCode: '0',
  isConfigured: true,
  configurationNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('JpkKrRouter', () => {
  const createCaller = createCallerFactory(router({ jpkKr: jpkKrRouter }));
  const caller = createCaller(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // PRE-VALIDATION
  // ===========================================================================

  describe('preValidate', () => {
    it('should validate data before JPK generation', async () => {
      mocks.preValidate.mockResolvedValue(testPreValidationResult);

      const result = await caller.jpkKr.preValidate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.canGenerate).toBe(true);
      expect(mocks.preValidate).toHaveBeenCalled();
    });

    it('should return validation results with summary', async () => {
      mocks.preValidate.mockResolvedValue(testPreValidationResult);

      const result = await caller.jpkKr.preValidate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(result.results).toHaveLength(5);
      expect(result.summary.totalChecks).toBe(5);
      expect(result.summary.passed).toBe(5);
      expect(result.summary.errors).toBe(0);
    });

    it('should detect validation failures', async () => {
      const failedValidation = {
        ...testPreValidationResult,
        isValid: false,
        canGenerate: false,
        results: [
          {
            step: 1,
            type: 'ORGANIZATION_DATA',
            passed: false,
            severity: 'ERROR' as const,
            message: 'Invalid NIP format',
          },
        ],
        summary: {
          totalChecks: 1,
          passed: 0,
          warnings: 0,
          errors: 1,
        },
      };
      mocks.preValidate.mockResolvedValue(failedValidation);

      const result = await caller.jpkKr.preValidate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(result.isValid).toBe(false);
      expect(result.canGenerate).toBe(false);
      expect(result.summary.errors).toBe(1);
    });

    it('should include warnings in validation', async () => {
      const warningValidation = {
        ...testPreValidationResult,
        results: [
          ...testPreValidationResult.results,
          {
            step: 6,
            type: 'ACCOUNT_MAPPINGS',
            passed: true,
            severity: 'WARNING' as const,
            message: '2 accounts are not mapped for JPK export',
          },
        ],
        summary: {
          ...testPreValidationResult.summary,
          totalChecks: 6,
          warnings: 1,
        },
      };
      mocks.preValidate.mockResolvedValue(warningValidation);

      const result = await caller.jpkKr.preValidate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(result.summary.warnings).toBe(1);
    });
  });

  // ===========================================================================
  // GENERATE JPK_KR
  // ===========================================================================

  describe('generate', () => {
    it('should generate a JPK_KR file', async () => {
      mocks.generate.mockResolvedValue(testGenerationResult);

      const result = await caller.jpkKr.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_JPK_LOG_ID);
      expect(result.fileName).toMatch(/JPK_KR.*\.xml/);
      expect(result.status).toBe('GENERATED');
      expect(mocks.generate).toHaveBeenCalled();
    });

    it('should generate with submission type', async () => {
      mocks.generate.mockResolvedValue(testGenerationResult);

      await caller.jpkKr.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        submissionType: 'CORRECTION',
        correctionNumber: 1,
      });

      expect(mocks.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionType: 'CORRECTION',
          correctionNumber: 1,
        })
      );
    });

    it('should generate with draft entries included', async () => {
      mocks.generate.mockResolvedValue(testGenerationResult);

      await caller.jpkKr.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        includeDraftEntries: true,
      });

      expect(mocks.generate).toHaveBeenCalledWith(
        expect.objectContaining({ includeDraftEntries: true })
      );
    });

    it('should return generation statistics', async () => {
      mocks.generate.mockResolvedValue(testGenerationResult);

      const result = await caller.jpkKr.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(result.statistics.entryCount).toBe(10);
      expect(result.statistics.lineCount).toBe(25);
      expect(result.statistics.accountCount).toBe(20);
      expect(result.statistics.fileSizeBytes).toBeGreaterThan(0);
    });

    it('should validate generated file', async () => {
      mocks.generate.mockResolvedValue(testGenerationResult);

      const result = await caller.jpkKr.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
    });
  });

  // ===========================================================================
  // VALIDATE SCHEMA
  // ===========================================================================

  describe('validateSchema', () => {
    it('should validate JPK against XSD schema', async () => {
      mocks.validateSchema.mockResolvedValue({
        isValid: true,
        errors: [],
        validatedAt: new Date(),
      });

      const result = await caller.jpkKr.validateSchema({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mocks.validateSchema).toHaveBeenCalled();
    });

    it('should return validation errors', async () => {
      mocks.validateSchema.mockResolvedValue({
        isValid: false,
        errors: ['Element Naglowek is missing required child element'],
        validatedAt: new Date(),
      });

      const result = await caller.jpkKr.validateSchema({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return validation timestamp', async () => {
      const validatedAt = new Date();
      mocks.validateSchema.mockResolvedValue({
        isValid: true,
        errors: [],
        validatedAt,
      });

      const result = await caller.jpkKr.validateSchema({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result.validatedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // DOWNLOAD
  // ===========================================================================

  describe('download', () => {
    it('should download JPK file', async () => {
      mocks.download.mockResolvedValue({
        fileName: 'JPK_KR_1234567890_2024-01.xml',
        contentType: 'application/xml',
        data: 'base64-encoded-content',
        fileSize: 15000,
        hash: 'abc123',
      });

      const result = await caller.jpkKr.download({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result).toBeDefined();
      expect(result.fileName).toMatch(/JPK_KR.*\.xml/);
      expect(result.contentType).toBe('application/xml');
      expect(mocks.download).toHaveBeenCalled();
    });

    it('should return base64 encoded content', async () => {
      mocks.download.mockResolvedValue({
        fileName: 'JPK_KR_1234567890_2024-01.xml',
        contentType: 'application/xml',
        data: 'base64-encoded-content',
        fileSize: 15000,
        hash: 'abc123',
      });

      const result = await caller.jpkKr.download({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(typeof result.data).toBe('string');
    });

    it('should return file size and hash', async () => {
      mocks.download.mockResolvedValue({
        fileName: 'JPK_KR_1234567890_2024-01.xml',
        contentType: 'application/xml',
        data: 'base64-encoded-content',
        fileSize: 15000,
        hash: 'abc123def456',
      });

      const result = await caller.jpkKr.download({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result.fileSize).toBe(15000);
      expect(result.hash).toBe('abc123def456');
    });
  });

  // ===========================================================================
  // GET LOG
  // ===========================================================================

  describe('getLog', () => {
    it('should get JPK log details', async () => {
      mocks.getLog.mockResolvedValue(testJpkLog);

      const result = await caller.jpkKr.getLog({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_JPK_LOG_ID);
      expect(result.jpkType).toBe('JPK_KR');
      expect(mocks.getLog).toHaveBeenCalled();
    });

    it('should include user information', async () => {
      mocks.getLog.mockResolvedValue(testJpkLog);

      const result = await caller.jpkKr.getLog({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result.generatedByUser).toBeDefined();
      expect(result.generatedByUser?.name).toBe('Jan Kowalski');
    });

    it('should return complete log data', async () => {
      mocks.getLog.mockResolvedValue(testJpkLog);

      const result = await caller.jpkKr.getLog({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result.periodStart).toBeDefined();
      expect(result.periodEnd).toBeDefined();
      expect(result.status).toBe('VALID');
      expect(result.entryCount).toBe(10);
      expect(result.lineCount).toBe(25);
    });
  });

  // ===========================================================================
  // LIST LOGS
  // ===========================================================================

  describe('listLogs', () => {
    it('should list JPK logs with pagination', async () => {
      mocks.listLogs.mockResolvedValue({
        logs: [testJpkLog],
        total: 1,
        hasMore: false,
      });

      const result = await caller.jpkKr.listLogs({
        limit: 20,
        offset: 0,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mocks.listLogs).toHaveBeenCalled();
    });

    it('should filter by fiscal year', async () => {
      mocks.listLogs.mockResolvedValue({
        logs: [testJpkLog],
        total: 1,
        hasMore: false,
      });

      await caller.jpkKr.listLogs({
        fiscalYear: 2024,
        limit: 20,
        offset: 0,
      });

      expect(mocks.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({ fiscalYear: 2024 })
      );
    });

    it('should filter by status', async () => {
      mocks.listLogs.mockResolvedValue({
        logs: [],
        total: 0,
        hasMore: false,
      });

      await caller.jpkKr.listLogs({
        status: 'SUBMITTED',
        limit: 20,
        offset: 0,
      });

      expect(mocks.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUBMITTED' })
      );
    });

    it('should filter by JPK type', async () => {
      mocks.listLogs.mockResolvedValue({
        logs: [testJpkLog],
        total: 1,
        hasMore: false,
      });

      await caller.jpkKr.listLogs({
        jpkType: 'JPK_KR',
        limit: 20,
        offset: 0,
      });

      expect(mocks.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({ jpkType: 'JPK_KR' })
      );
    });

    it('should handle pagination correctly', async () => {
      mocks.listLogs.mockResolvedValue({
        logs: [testJpkLog],
        total: 25,
        hasMore: true,
      });

      const result = await caller.jpkKr.listLogs({
        limit: 10,
        offset: 10,
      });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(25);
      expect(mocks.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 10 })
      );
    });
  });

  // ===========================================================================
  // ACCOUNT MAPPINGS
  // ===========================================================================

  describe('getAccountMappings', () => {
    it('should list all account mappings', async () => {
      mocks.getAccountMappings.mockResolvedValue({
        mappings: [testAccountMapping],
        total: 1,
        unmappedCount: 0,
      });

      const result = await caller.jpkKr.getAccountMappings({});

      expect(result.mappings).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mocks.getAccountMappings).toHaveBeenCalled();
    });

    it('should include unmapped count', async () => {
      mocks.getAccountMappings.mockResolvedValue({
        mappings: [testAccountMapping],
        total: 1,
        unmappedCount: 3,
      });

      const result = await caller.jpkKr.getAccountMappings({});

      expect(result.unmappedCount).toBe(3);
    });
  });

  describe('updateAccountMapping', () => {
    it('should update account mapping', async () => {
      mocks.updateAccountMapping.mockResolvedValue({
        success: true,
        mapping: testAccountMapping,
      });

      const result = await caller.jpkKr.updateAccountMapping({
        accountId: TEST_ACCOUNT_ID,
        jpkAccountType: 'Aktywne',
        jpkTeamCode: '0',
      });

      expect(result.success).toBe(true);
      expect(result.mapping).toBeDefined();
      expect(mocks.updateAccountMapping).toHaveBeenCalled();
    });

    it('should accept optional category code', async () => {
      mocks.updateAccountMapping.mockResolvedValue({
        success: true,
        mapping: testAccountMapping,
      });

      await caller.jpkKr.updateAccountMapping({
        accountId: TEST_ACCOUNT_ID,
        jpkAccountType: 'Aktywne',
        jpkTeamCode: '0',
        jpkCategoryCode: 'A.II',
      });

      expect(mocks.updateAccountMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          jpkCategoryCode: 'A.II',
        })
      );
    });
  });

  // ===========================================================================
  // MARK SUBMITTED
  // ===========================================================================

  describe('markSubmitted', () => {
    it('should mark JPK as submitted', async () => {
      mocks.markSubmitted.mockResolvedValue({
        success: true,
        jpkLogId: TEST_JPK_LOG_ID,
        submittedAt: new Date(),
        submissionReference: null,
      });

      const result = await caller.jpkKr.markSubmitted({
        jpkLogId: TEST_JPK_LOG_ID,
      });

      expect(result.success).toBe(true);
      expect(result.jpkLogId).toBe(TEST_JPK_LOG_ID);
      expect(result.submittedAt).toBeDefined();
      expect(mocks.markSubmitted).toHaveBeenCalled();
    });

    it('should accept submission reference', async () => {
      mocks.markSubmitted.mockResolvedValue({
        success: true,
        jpkLogId: TEST_JPK_LOG_ID,
        submittedAt: new Date(),
        submissionReference: 'REF-123-ABC',
      });

      const result = await caller.jpkKr.markSubmitted({
        jpkLogId: TEST_JPK_LOG_ID,
        submissionReference: 'REF-123-ABC',
      });

      expect(result.submissionReference).toBe('REF-123-ABC');
      expect(mocks.markSubmitted).toHaveBeenCalledWith(
        expect.objectContaining({
          submissionReference: 'REF-123-ABC',
        })
      );
    });
  });
});
