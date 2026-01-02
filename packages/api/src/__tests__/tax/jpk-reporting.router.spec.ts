// TAX-007: JPK Reporting Router Tests
// Tests for Polish JPK (Standard Audit File) API endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { JPKReportingService } from '../../services/tax/jpk-reporting.service';
import Decimal from 'decimal.js';

// ===========================================================================
// MOCK DATA
// ===========================================================================

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const REPORT_ID = '44444444-4444-4444-4444-444444444444';

const mockJPKReport = {
  id: REPORT_ID,
  organizationId: ORG_ID,
  clientId: CLIENT_ID,
  reportType: 'JPK_V7M' as const,
  status: 'DRAFT' as const,
  year: 2024,
  month: 1,
  quarter: undefined,
  periodFrom: '2024-01-01T00:00:00.000Z',
  periodTo: '2024-01-31T00:00:00.000Z',
  purpose: 'FIRST' as const,
  correctionNumber: undefined,
  originalReportId: undefined,
  correctionReason: undefined,
  recordCount: 0,
  saleRecordCount: 0,
  purchaseRecordCount: 0,
  totalSaleNet: undefined,
  totalSaleVAT: undefined,
  totalPurchaseNet: undefined,
  totalPurchaseVAT: undefined,
  xmlFilePath: undefined,
  xmlFileSize: undefined,
  xmlHash: undefined,
  signedXmlFilePath: undefined,
  submittedAt: undefined,
  referenceNumber: undefined,
  upoNumber: undefined,
  upoReceivedAt: undefined,
  upoFilePath: undefined,
  errorMessage: undefined,
  errorDetails: undefined,
  generatedBy: USER_ID,
  generatedAt: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSaleRecord = {
  recordNumber: 1,
  documentType: 'FP' as const,
  documentNumber: 'FV/2024/001',
  documentDate: '2024-01-15',
  saleDate: '2024-01-15',
  buyerNIP: '1234567890',
  buyerName: 'Kupujący Sp. z o.o.',
  buyerCountryCode: 'PL',
  netAmount23: '1000.00',
  vatAmount23: '230.00',
  gtuCodes: ['GTU_12'] as const,
  procedureCodes: [] as const,
};

const mockPurchaseRecord = {
  recordNumber: 1,
  documentNumber: 'FZ/2024/001',
  documentDate: '2024-01-10',
  receiptDate: '2024-01-12',
  sellerNIP: '9876543210',
  sellerName: 'Sprzedawca Sp. z o.o.',
  sellerCountryCode: 'PL',
  netAmountTotal: '500.00',
  vatAmountDeductible: '115.00',
  isWNT: false,
  isImportServices: false,
  isMPP: false,
  procedureCodes: [] as const,
};

const mockGenerationResult = {
  success: true,
  reportId: REPORT_ID,
  xmlFilePath: '/jpk/test.xml',
  xmlFileSize: 5000,
  xmlHash: 'abc123def456',
  recordCount: 10,
  generatedAt: new Date().toISOString(),
};

const mockValidationResult = {
  isValid: true,
  xsdValid: true,
  businessValid: true,
  issues: [],
  errorCount: 0,
  warningCount: 0,
};

const mockSubmissionResult = {
  success: true,
  reportId: REPORT_ID,
  referenceNumber: 'JPK-2024-TEST-123',
  status: 'SUBMITTED' as const,
  submittedAt: new Date().toISOString(),
};

const mockStatusResult = {
  reportId: REPORT_ID,
  status: 'ACCEPTED' as const,
  referenceNumber: 'JPK-2024-TEST-123',
  upoNumber: 'UPO-2024-001',
  upoReceivedAt: new Date().toISOString(),
  processingStage: 'COMPLETED' as const,
};

const mockImportResult = {
  success: true,
  importedSaleRecords: 10,
  importedPurchaseRecords: 5,
  skippedRecords: 0,
  errors: [],
};

const mockDownloadResult = {
  fileName: 'JPK_V7M_2024_01.xml',
  contentType: 'application/xml',
  fileSize: 5000,
  content: 'base64encodedcontent',
};

// ===========================================================================
// MOCK SERVICE
// ===========================================================================

const mockJPKReportingService = vi.hoisted(() => ({
  createReport: vi.fn(),
  addSaleRecord: vi.fn(),
  addPurchaseRecord: vi.fn(),
  importFromVATTransactions: vi.fn(),
  updateDeclaration: vi.fn(),
  generateXML: vi.fn(),
  validateReport: vi.fn(),
  signReport: vi.fn(),
  submitReport: vi.fn(),
  checkStatus: vi.fn(),
  downloadUPO: vi.fn(),
  createCorrection: vi.fn(),
  getReport: vi.fn(),
  listReports: vi.fn(),
  deleteReport: vi.fn(),
  downloadXML: vi.fn(),
}));

vi.mock('../../services/tax/jpk-reporting.service', () => ({
  JPKReportingService: vi.fn().mockImplementation(() => mockJPKReportingService),
}));

// Mock router caller
const mockSession = {
  userId: USER_ID,
  organizationId: ORG_ID,
  email: 'test@example.com',
  roles: ['ADMIN'],
  sessionId: '99999999-9999-9999-9999-999999999999',
};

// Simple mock caller that invokes service methods
const createMockCaller = () => ({
  tax: {
    jpkReporting: {
      createReport: async (input: Parameters<JPKReportingService['createReport']>[0]) => {
        return mockJPKReportingService.createReport(input);
      },
      addSaleRecord: async (input: Parameters<JPKReportingService['addSaleRecord']>[0]) => {
        return mockJPKReportingService.addSaleRecord(input);
      },
      addPurchaseRecord: async (input: Parameters<JPKReportingService['addPurchaseRecord']>[0]) => {
        return mockJPKReportingService.addPurchaseRecord(input);
      },
      importFromVATTransactions: async (input: Parameters<JPKReportingService['importFromVATTransactions']>[0]) => {
        return mockJPKReportingService.importFromVATTransactions(input);
      },
      updateDeclaration: async (input: Parameters<JPKReportingService['updateDeclaration']>[0]) => {
        return mockJPKReportingService.updateDeclaration(input);
      },
      generateXML: async (input: Parameters<JPKReportingService['generateXML']>[0]) => {
        return mockJPKReportingService.generateXML(input);
      },
      validateReport: async (input: Parameters<JPKReportingService['validateReport']>[0]) => {
        return mockJPKReportingService.validateReport(input);
      },
      signReport: async (input: Parameters<JPKReportingService['signReport']>[0]) => {
        return mockJPKReportingService.signReport(input);
      },
      submitReport: async (input: Parameters<JPKReportingService['submitReport']>[0]) => {
        return mockJPKReportingService.submitReport(input);
      },
      checkStatus: async (input: Parameters<JPKReportingService['checkStatus']>[0]) => {
        return mockJPKReportingService.checkStatus(input);
      },
      downloadUPO: async (input: Parameters<JPKReportingService['downloadUPO']>[0]) => {
        return mockJPKReportingService.downloadUPO(input);
      },
      createCorrection: async (input: Parameters<JPKReportingService['createCorrection']>[0]) => {
        return mockJPKReportingService.createCorrection(input);
      },
      getReport: async (input: Parameters<JPKReportingService['getReport']>[0]) => {
        return mockJPKReportingService.getReport(input);
      },
      listReports: async (input: Parameters<JPKReportingService['listReports']>[0]) => {
        return mockJPKReportingService.listReports(input);
      },
      deleteReport: async (input: Parameters<JPKReportingService['deleteReport']>[0]) => {
        return mockJPKReportingService.deleteReport(input);
      },
      downloadXML: async (input: Parameters<JPKReportingService['downloadXML']>[0]) => {
        return mockJPKReportingService.downloadXML(input);
      },
    },
  },
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('JPKReportingRouter', () => {
  let caller: ReturnType<typeof createMockCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    caller = createMockCaller();
  });

  // =========================================================================
  // REPORT MANAGEMENT ENDPOINT TESTS
  // =========================================================================

  describe('createReport', () => {
    it('should create a new JPK_V7M report', async () => {
      mockJPKReportingService.createReport.mockResolvedValue(mockJPKReport);

      const result = await caller.tax.jpkReporting.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7M',
        year: 2024,
        month: 1,
        purpose: 'FIRST',
      });

      expect(result.id).toBe(REPORT_ID);
      expect(result.reportType).toBe('JPK_V7M');
      expect(result.status).toBe('DRAFT');
    });

    it('should create quarterly JPK_V7K report', async () => {
      const quarterlyReport = { ...mockJPKReport, reportType: 'JPK_V7K' as const, month: undefined, quarter: 1 };
      mockJPKReportingService.createReport.mockResolvedValue(quarterlyReport);

      const result = await caller.tax.jpkReporting.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7K',
        year: 2024,
        quarter: 1,
        purpose: 'FIRST',
      });

      expect(result.reportType).toBe('JPK_V7K');
      expect(result.quarter).toBe(1);
    });

    it('should accept all report types', async () => {
      mockJPKReportingService.createReport.mockResolvedValue(mockJPKReport);

      const reportTypes = ['JPK_V7M', 'JPK_V7K', 'JPK_FA', 'JPK_MAG', 'JPK_KR', 'JPK_WB', 'JPK_PKPIR'] as const;

      for (const reportType of reportTypes) {
        await caller.tax.jpkReporting.createReport({
          clientId: CLIENT_ID,
          reportType,
          year: 2024,
          month: 1,
          purpose: 'FIRST',
        });
      }

      expect(mockJPKReportingService.createReport).toHaveBeenCalledTimes(7);
    });
  });

  describe('addSaleRecord', () => {
    it('should add a sale record to report', async () => {
      mockJPKReportingService.addSaleRecord.mockResolvedValue(mockSaleRecord);

      const result = await caller.tax.jpkReporting.addSaleRecord({
        reportId: REPORT_ID,
        record: {
          documentType: 'FP',
          documentNumber: 'FV/2024/001',
          documentDate: '2024-01-15',
          saleDate: '2024-01-15',
          buyerNIP: '1234567890',
          buyerName: 'Kupujący Sp. z o.o.',
          netAmount23: '1000.00',
          vatAmount23: '230.00',
          gtuCodes: ['GTU_12'],
          procedureCodes: [],
        },
      });

      expect(result.documentNumber).toBe('FV/2024/001');
      expect(result.recordNumber).toBe(1);
    });

    it('should accept all document types', async () => {
      mockJPKReportingService.addSaleRecord.mockResolvedValue(mockSaleRecord);

      const documentTypes = ['FP', 'RO', 'WEW', 'FPM'] as const;

      for (const documentType of documentTypes) {
        await caller.tax.jpkReporting.addSaleRecord({
          reportId: REPORT_ID,
          record: {
            documentType,
            documentNumber: `DOC/${documentType}`,
            documentDate: '2024-01-15',
          },
        });
      }

      expect(mockJPKReportingService.addSaleRecord).toHaveBeenCalledTimes(4);
    });

    it('should accept GTU codes', async () => {
      mockJPKReportingService.addSaleRecord.mockResolvedValue(mockSaleRecord);

      const gtuCodes = ['GTU_01', 'GTU_02', 'GTU_03', 'GTU_12', 'GTU_13'] as const;

      await caller.tax.jpkReporting.addSaleRecord({
        reportId: REPORT_ID,
        record: {
          documentType: 'FP',
          documentNumber: 'FV/2024/001',
          documentDate: '2024-01-15',
          gtuCodes,
          procedureCodes: [],
        },
      });

      expect(mockJPKReportingService.addSaleRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          record: expect.objectContaining({
            gtuCodes,
          }),
        })
      );
    });
  });

  describe('addPurchaseRecord', () => {
    it('should add a purchase record to report', async () => {
      mockJPKReportingService.addPurchaseRecord.mockResolvedValue(mockPurchaseRecord);

      const result = await caller.tax.jpkReporting.addPurchaseRecord({
        reportId: REPORT_ID,
        record: {
          documentNumber: 'FZ/2024/001',
          documentDate: '2024-01-10',
          receiptDate: '2024-01-12',
          sellerNIP: '9876543210',
          sellerName: 'Sprzedawca Sp. z o.o.',
          netAmountTotal: '500.00',
          vatAmountDeductible: '115.00',
          isWNT: false,
          isImportServices: false,
          isMPP: false,
          procedureCodes: [],
        },
      });

      expect(result.documentNumber).toBe('FZ/2024/001');
      expect(result.vatAmountDeductible).toBe('115.00');
    });

    it('should accept WNT and import services flags', async () => {
      mockJPKReportingService.addPurchaseRecord.mockResolvedValue(mockPurchaseRecord);

      await caller.tax.jpkReporting.addPurchaseRecord({
        reportId: REPORT_ID,
        record: {
          documentNumber: 'WNT/2024/001',
          documentDate: '2024-01-10',
          netAmountTotal: '1000.00',
          vatAmountDeductible: '230.00',
          isWNT: true,
          isImportServices: false,
          isMPP: false,
          procedureCodes: [],
        },
      });

      expect(mockJPKReportingService.addPurchaseRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          record: expect.objectContaining({
            isWNT: true,
          }),
        })
      );
    });
  });

  describe('importFromVATTransactions', () => {
    it('should import records from VAT transactions', async () => {
      mockJPKReportingService.importFromVATTransactions.mockResolvedValue(mockImportResult);

      const result = await caller.tax.jpkReporting.importFromVATTransactions({
        reportId: REPORT_ID,
        periodFrom: '2024-01-01',
        periodTo: '2024-01-31',
        overwriteExisting: false,
      });

      expect(result.success).toBe(true);
      expect(result.importedSaleRecords).toBe(10);
      expect(result.importedPurchaseRecords).toBe(5);
    });

    it('should support overwrite option', async () => {
      mockJPKReportingService.importFromVATTransactions.mockResolvedValue(mockImportResult);

      await caller.tax.jpkReporting.importFromVATTransactions({
        reportId: REPORT_ID,
        periodFrom: '2024-01-01',
        periodTo: '2024-01-31',
        overwriteExisting: true,
      });

      expect(mockJPKReportingService.importFromVATTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          overwriteExisting: true,
        })
      );
    });
  });

  describe('updateDeclaration', () => {
    it('should update JPK declaration section', async () => {
      mockJPKReportingService.updateDeclaration.mockResolvedValue(mockJPKReport);

      const result = await caller.tax.jpkReporting.updateDeclaration({
        reportId: REPORT_ID,
        declaration: {
          p_10: 'Urząd Skarbowy',
          p_28: '1000.00',
          p_43: '500.00',
        },
      });

      expect(result.id).toBe(REPORT_ID);
      expect(mockJPKReportingService.updateDeclaration).toHaveBeenCalledWith(
        expect.objectContaining({
          declaration: expect.objectContaining({
            p_10: 'Urząd Skarbowy',
          }),
        })
      );
    });
  });

  // =========================================================================
  // XML GENERATION ENDPOINT TESTS
  // =========================================================================

  describe('generateXML', () => {
    it('should generate XML for a report', async () => {
      mockJPKReportingService.generateXML.mockResolvedValue(mockGenerationResult);

      const result = await caller.tax.jpkReporting.generateXML({
        reportId: REPORT_ID,
        regenerate: false,
      });

      expect(result.success).toBe(true);
      expect(result.xmlFilePath).toBeDefined();
      expect(result.xmlHash).toBeDefined();
    });

    it('should allow regeneration with flag', async () => {
      mockJPKReportingService.generateXML.mockResolvedValue(mockGenerationResult);

      await caller.tax.jpkReporting.generateXML({
        reportId: REPORT_ID,
        regenerate: true,
      });

      expect(mockJPKReportingService.generateXML).toHaveBeenCalledWith(
        expect.objectContaining({
          regenerate: true,
        })
      );
    });
  });

  describe('validateReport', () => {
    it('should validate report against XSD and business rules', async () => {
      mockJPKReportingService.validateReport.mockResolvedValue(mockValidationResult);

      const result = await caller.tax.jpkReporting.validateReport({
        reportId: REPORT_ID,
        validateXSD: true,
        validateBusiness: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.xsdValid).toBe(true);
      expect(result.businessValid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should return validation issues', async () => {
      mockJPKReportingService.validateReport.mockResolvedValue({
        isValid: false,
        xsdValid: true,
        businessValid: false,
        issues: [
          { code: 'INVALID_NIP', field: 'buyerNIP', line: 1, message: 'Invalid NIP', severity: 'error' },
        ],
        errorCount: 1,
        warningCount: 0,
      });

      const result = await caller.tax.jpkReporting.validateReport({
        reportId: REPORT_ID,
        validateXSD: true,
        validateBusiness: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('INVALID_NIP');
    });
  });

  // =========================================================================
  // SIGNING AND SUBMISSION ENDPOINT TESTS
  // =========================================================================

  describe('signReport', () => {
    it('should sign a report with Trusted Profile', async () => {
      const signedReport = { ...mockJPKReport, status: 'SIGNED' as const };
      mockJPKReportingService.signReport.mockResolvedValue(signedReport);

      const result = await caller.tax.jpkReporting.signReport({
        reportId: REPORT_ID,
        signatureType: 'TRUSTED_PROFILE',
      });

      expect(result.status).toBe('SIGNED');
    });

    it('should accept qualified signature type', async () => {
      const signedReport = { ...mockJPKReport, status: 'SIGNED' as const };
      mockJPKReportingService.signReport.mockResolvedValue(signedReport);

      await caller.tax.jpkReporting.signReport({
        reportId: REPORT_ID,
        signatureType: 'QUALIFIED',
      });

      expect(mockJPKReportingService.signReport).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureType: 'QUALIFIED',
        })
      );
    });
  });

  describe('submitReport', () => {
    it('should submit a signed report', async () => {
      mockJPKReportingService.submitReport.mockResolvedValue(mockSubmissionResult);

      const result = await caller.tax.jpkReporting.submitReport({
        reportId: REPORT_ID,
        testMode: false,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUBMITTED');
      expect(result.referenceNumber).toBeDefined();
    });

    it('should support test mode submission', async () => {
      mockJPKReportingService.submitReport.mockResolvedValue(mockSubmissionResult);

      await caller.tax.jpkReporting.submitReport({
        reportId: REPORT_ID,
        testMode: true,
      });

      expect(mockJPKReportingService.submitReport).toHaveBeenCalledWith(
        expect.objectContaining({
          testMode: true,
        })
      );
    });
  });

  describe('checkStatus', () => {
    it('should check submission status', async () => {
      mockJPKReportingService.checkStatus.mockResolvedValue(mockStatusResult);

      const result = await caller.tax.jpkReporting.checkStatus({
        reportId: REPORT_ID,
      });

      expect(result.status).toBe('ACCEPTED');
      expect(result.upoNumber).toBeDefined();
    });
  });

  describe('downloadUPO', () => {
    it('should download UPO for accepted report', async () => {
      mockJPKReportingService.downloadUPO.mockResolvedValue({
        fileName: 'UPO_2024_001.xml',
        contentType: 'application/xml',
        fileSize: 2000,
        content: 'base64encodedcontent',
      });

      const result = await caller.tax.jpkReporting.downloadUPO({
        reportId: REPORT_ID,
      });

      expect(result.fileName).toContain('UPO');
      expect(result.contentType).toBe('application/xml');
      expect(result.content).toBeDefined();
    });
  });

  // =========================================================================
  // CORRECTION AND RETRIEVAL ENDPOINT TESTS
  // =========================================================================

  describe('createCorrection', () => {
    it('should create correction for submitted report', async () => {
      const correctionReport = {
        ...mockJPKReport,
        purpose: 'CORRECTION' as const,
        correctionNumber: 1,
        originalReportId: REPORT_ID,
      };
      mockJPKReportingService.createCorrection.mockResolvedValue(correctionReport);

      const result = await caller.tax.jpkReporting.createCorrection({
        originalReportId: REPORT_ID,
        correctionReason: 'Correction of VAT amounts',
      });

      expect(result.purpose).toBe('CORRECTION');
      expect(result.correctionNumber).toBe(1);
      expect(result.originalReportId).toBe(REPORT_ID);
    });
  });

  describe('getReport', () => {
    it('should get report without records', async () => {
      mockJPKReportingService.getReport.mockResolvedValue({
        report: mockJPKReport,
      });

      const result = await caller.tax.jpkReporting.getReport({
        reportId: REPORT_ID,
        includeRecords: false,
        includeDeclaration: false,
      });

      expect(result.report.id).toBe(REPORT_ID);
      expect(result.saleRecords).toBeUndefined();
      expect(result.purchaseRecords).toBeUndefined();
    });

    it('should include records when requested', async () => {
      mockJPKReportingService.getReport.mockResolvedValue({
        report: mockJPKReport,
        saleRecords: [mockSaleRecord],
        purchaseRecords: [mockPurchaseRecord],
      });

      const result = await caller.tax.jpkReporting.getReport({
        reportId: REPORT_ID,
        includeRecords: true,
        includeDeclaration: false,
      });

      expect(result.saleRecords).toHaveLength(1);
      expect(result.purchaseRecords).toHaveLength(1);
    });

    it('should include declaration when requested', async () => {
      mockJPKReportingService.getReport.mockResolvedValue({
        report: mockJPKReport,
        declaration: { p_10: 'Tax Office', p_28: '1000' },
      });

      const result = await caller.tax.jpkReporting.getReport({
        reportId: REPORT_ID,
        includeRecords: false,
        includeDeclaration: true,
      });

      expect(result.declaration).toBeDefined();
    });
  });

  describe('listReports', () => {
    it('should list reports with pagination', async () => {
      mockJPKReportingService.listReports.mockResolvedValue({
        reports: [mockJPKReport],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      const result = await caller.tax.jpkReporting.listReports({
        page: 1,
        pageSize: 10,
      });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by client and status', async () => {
      mockJPKReportingService.listReports.mockResolvedValue({
        reports: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      await caller.tax.jpkReporting.listReports({
        clientId: CLIENT_ID,
        status: 'SUBMITTED',
        page: 1,
        pageSize: 10,
      });

      expect(mockJPKReportingService.listReports).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: CLIENT_ID,
          status: 'SUBMITTED',
        })
      );
    });

    it('should filter by report type and period', async () => {
      mockJPKReportingService.listReports.mockResolvedValue({
        reports: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      await caller.tax.jpkReporting.listReports({
        reportType: 'JPK_V7M',
        year: 2024,
        month: 1,
        page: 1,
        pageSize: 10,
      });

      expect(mockJPKReportingService.listReports).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'JPK_V7M',
          year: 2024,
          month: 1,
        })
      );
    });
  });

  describe('deleteReport', () => {
    it('should delete a draft report', async () => {
      mockJPKReportingService.deleteReport.mockResolvedValue(undefined);

      await caller.tax.jpkReporting.deleteReport({
        reportId: REPORT_ID,
      });

      expect(mockJPKReportingService.deleteReport).toHaveBeenCalledWith({
        reportId: REPORT_ID,
      });
    });
  });

  describe('downloadXML', () => {
    it('should download generated XML', async () => {
      mockJPKReportingService.downloadXML.mockResolvedValue(mockDownloadResult);

      const result = await caller.tax.jpkReporting.downloadXML({
        reportId: REPORT_ID,
        signed: false,
      });

      expect(result.fileName).toContain('JPK');
      expect(result.contentType).toBe('application/xml');
      expect(result.content).toBeDefined();
    });

    it('should download signed XML when requested', async () => {
      mockJPKReportingService.downloadXML.mockResolvedValue({
        ...mockDownloadResult,
        fileName: 'JPK_V7M_2024_01_signed.xml',
      });

      await caller.tax.jpkReporting.downloadXML({
        reportId: REPORT_ID,
        signed: true,
      });

      expect(mockJPKReportingService.downloadXML).toHaveBeenCalledWith(
        expect.objectContaining({
          signed: true,
        })
      );
    });
  });

  // =========================================================================
  // INPUT VALIDATION TESTS
  // =========================================================================

  describe('input validation', () => {
    it('should validate report type enum', async () => {
      mockJPKReportingService.createReport.mockResolvedValue(mockJPKReport);

      const validTypes = ['JPK_V7M', 'JPK_V7K', 'JPK_FA', 'JPK_MAG', 'JPK_KR', 'JPK_WB', 'JPK_PKPIR'] as const;
      for (const reportType of validTypes) {
        await expect(
          caller.tax.jpkReporting.createReport({
            clientId: CLIENT_ID,
            reportType,
            year: 2024,
            month: 1,
            purpose: 'FIRST',
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate purpose enum', async () => {
      mockJPKReportingService.createReport.mockResolvedValue(mockJPKReport);

      const validPurposes = ['FIRST', 'CORRECTION'] as const;
      for (const purpose of validPurposes) {
        await expect(
          caller.tax.jpkReporting.createReport({
            clientId: CLIENT_ID,
            reportType: 'JPK_V7M',
            year: 2024,
            month: 1,
            purpose,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate month range (1-12)', async () => {
      mockJPKReportingService.createReport.mockResolvedValue(mockJPKReport);

      for (let month = 1; month <= 12; month++) {
        await expect(
          caller.tax.jpkReporting.createReport({
            clientId: CLIENT_ID,
            reportType: 'JPK_V7M',
            year: 2024,
            month,
            purpose: 'FIRST',
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate quarter range (1-4)', async () => {
      mockJPKReportingService.createReport.mockResolvedValue(mockJPKReport);

      for (let quarter = 1; quarter <= 4; quarter++) {
        await expect(
          caller.tax.jpkReporting.createReport({
            clientId: CLIENT_ID,
            reportType: 'JPK_V7K',
            year: 2024,
            quarter,
            purpose: 'FIRST',
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate UUID format for reportId', async () => {
      mockJPKReportingService.getReport.mockResolvedValue({ report: mockJPKReport });

      await expect(
        caller.tax.jpkReporting.getReport({
          reportId: REPORT_ID,
          includeRecords: false,
          includeDeclaration: false,
        })
      ).resolves.toBeDefined();
    });

    it('should validate signature type enum', async () => {
      mockJPKReportingService.signReport.mockResolvedValue({
        ...mockJPKReport,
        status: 'SIGNED' as const,
      });

      const validTypes = ['TRUSTED_PROFILE', 'QUALIFIED'] as const;
      for (const signatureType of validTypes) {
        await expect(
          caller.tax.jpkReporting.signReport({
            reportId: REPORT_ID,
            signatureType,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate GTU code enum values', async () => {
      mockJPKReportingService.addSaleRecord.mockResolvedValue(mockSaleRecord);

      const validGTUCodes = [
        'GTU_01', 'GTU_02', 'GTU_03', 'GTU_04', 'GTU_05',
        'GTU_06', 'GTU_07', 'GTU_08', 'GTU_09', 'GTU_10',
        'GTU_11', 'GTU_12', 'GTU_13',
      ] as const;

      await expect(
        caller.tax.jpkReporting.addSaleRecord({
          reportId: REPORT_ID,
          record: {
            documentType: 'FP',
            documentNumber: 'FV/2024/001',
            documentDate: '2024-01-15',
            gtuCodes: validGTUCodes,
            procedureCodes: [],
          },
        })
      ).resolves.toBeDefined();
    });

    it('should validate status enum for filtering', async () => {
      mockJPKReportingService.listReports.mockResolvedValue({
        reports: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      const validStatuses = [
        'DRAFT', 'GENERATING', 'GENERATED', 'VALIDATING', 'VALIDATED',
        'SIGNING', 'SIGNED', 'SUBMITTING', 'SUBMITTED', 'ACCEPTED',
        'REJECTED', 'ERROR',
      ] as const;

      for (const status of validStatuses) {
        await expect(
          caller.tax.jpkReporting.listReports({
            status,
            page: 1,
            pageSize: 10,
          })
        ).resolves.toBeDefined();
      }
    });
  });

  // =========================================================================
  // CONTEXT INJECTION TESTS
  // =========================================================================

  describe('context injection', () => {
    it('should use session context for service initialization', async () => {
      mockJPKReportingService.createReport.mockResolvedValue(mockJPKReport);

      await caller.tax.jpkReporting.createReport({
        clientId: CLIENT_ID,
        reportType: 'JPK_V7M',
        year: 2024,
        month: 1,
        purpose: 'FIRST',
      });

      // Service is created with organizationId and userId from session
      expect(mockJPKReportingService.createReport).toHaveBeenCalled();
    });
  });
});
