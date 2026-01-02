/**
 * ACC-013: Balance Sheet Router Tests
 * TDD tests for balance sheet router endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { router } from '../../trpc';
import { balanceSheetRouter } from '../../routers/ace/balance-sheet.router';
import { createCallerFactory } from '../../trpc';

// Mock the BalanceSheetService using prototype pattern
import { BalanceSheetService } from '../../services/ace/balance-sheet.service';

vi.mock('../../services/ace/balance-sheet.service');

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_REPORT_ID = '550e8400-e29b-41d4-a716-446655440002';

const mockContext = {
  prisma: {},
  redis: {},
  auditLogger: { log: vi.fn() },
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
  },
};

// Helper function to create balance sheet line
const createLine = (overrides = {}) => ({
  lineCode: 'A.I',
  lineNamePl: 'Wartości niematerialne i prawne',
  lineNameEn: 'Intangible assets',
  section: 'ASSETS' as const,
  indentLevel: 1,
  currentPeriod: 50000,
  priorPeriod: 45000,
  variance: 5000,
  variancePercent: 11.11,
  isHeader: false,
  isTotal: false,
  accounts: ['020', '021'],
  ...overrides,
});

const testBalanceSheet = {
  organizationId: TEST_ORG_ID,
  organizationName: 'Test Company Sp. z o.o.',
  nip: '1234567890',
  reportDate: new Date('2024-12-31'),
  comparativeDate: new Date('2023-12-31'),

  assets: {
    fixedAssets: {
      intangibleAssets: createLine({ lineCode: 'A.I', currentPeriod: 50000 }),
      tangibleAssets: createLine({ lineCode: 'A.II', currentPeriod: 200000 }),
      longTermReceivables: createLine({ lineCode: 'A.III', currentPeriod: 0 }),
      longTermInvestments: createLine({ lineCode: 'A.IV', currentPeriod: 30000 }),
      longTermPrepayments: createLine({ lineCode: 'A.V', currentPeriod: 5000 }),
      total: createLine({ lineCode: 'A', currentPeriod: 285000, isTotal: true }),
    },
    currentAssets: {
      inventory: createLine({ lineCode: 'B.I', currentPeriod: 100000 }),
      shortTermReceivables: createLine({ lineCode: 'B.II', currentPeriod: 150000 }),
      shortTermInvestments: createLine({ lineCode: 'B.III', currentPeriod: 50000 }),
      cash: createLine({ lineCode: 'B.IV', currentPeriod: 200000 }),
      shortTermPrepayments: createLine({ lineCode: 'B.V', currentPeriod: 15000 }),
      total: createLine({ lineCode: 'B', currentPeriod: 515000, isTotal: true }),
    },
    totalAssets: createLine({ lineCode: 'AKTYWA', currentPeriod: 800000, isTotal: true }),
  },

  equity: {
    shareCapital: createLine({ lineCode: 'A.I', section: 'EQUITY' as const, currentPeriod: 100000 }),
    supplementaryCapital: createLine({ lineCode: 'A.II', section: 'EQUITY' as const, currentPeriod: 150000 }),
    revaluationReserve: createLine({ lineCode: 'A.III', section: 'EQUITY' as const, currentPeriod: 0 }),
    otherReserves: createLine({ lineCode: 'A.IV', section: 'EQUITY' as const, currentPeriod: 50000 }),
    priorYearsProfitLoss: createLine({ lineCode: 'A.V', section: 'EQUITY' as const, currentPeriod: 100000 }),
    currentYearProfitLoss: createLine({ lineCode: 'A.VI', section: 'EQUITY' as const, currentPeriod: 80000 }),
    totalEquity: createLine({ lineCode: 'A', section: 'EQUITY' as const, currentPeriod: 480000, isTotal: true }),
  },

  liabilities: {
    provisions: createLine({ lineCode: 'B.I', section: 'LIABILITIES' as const, currentPeriod: 20000 }),
    longTermLiabilities: createLine({ lineCode: 'B.II', section: 'LIABILITIES' as const, currentPeriod: 100000 }),
    shortTermLiabilities: createLine({ lineCode: 'B.III', section: 'LIABILITIES' as const, currentPeriod: 180000 }),
    accruals: createLine({ lineCode: 'B.IV', section: 'LIABILITIES' as const, currentPeriod: 20000 }),
    totalLiabilities: createLine({ lineCode: 'B', section: 'LIABILITIES' as const, currentPeriod: 320000, isTotal: true }),
  },

  totalEquityAndLiabilities: createLine({
    lineCode: 'PASYWA',
    section: 'LIABILITIES' as const,
    currentPeriod: 800000,
    isTotal: true,
  }),
  isBalanced: true,
  balanceDifference: 0,

  generatedAt: new Date(),
  generatedBy: TEST_USER_ID,
};

const testSavedReport = {
  id: TEST_REPORT_ID,
  organizationId: TEST_ORG_ID,
  reportDate: new Date('2024-12-31'),
  comparativeDate: new Date('2023-12-31'),
  reportName: 'Bilans roczny 2024',
  totalAssets: 800000,
  totalLiabilities: 320000,
  totalEquity: 480000,
  isFinal: false,
  finalizedAt: null,
  finalizedBy: null,
  exportedFormats: [],
  lastExportedAt: null,
  createdAt: new Date(),
  createdBy: {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
  },
};

describe('BalanceSheetRouter', () => {
  const createCaller = createCallerFactory(router({ balanceSheet: balanceSheetRouter }));
  const caller = createCaller(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // BALANCE SHEET GENERATION
  // ===========================================================================

  describe('generate', () => {
    it('should generate a balance sheet as of a date', async () => {
      vi.mocked(BalanceSheetService.prototype.generate).mockResolvedValue(testBalanceSheet);

      const result = await caller.balanceSheet.generate({
        reportDate: new Date('2024-12-31'),
      });

      expect(result).toBeDefined();
      expect(result.isBalanced).toBe(true);
      expect(result.assets.totalAssets.currentPeriod).toBe(800000);
      expect(BalanceSheetService.prototype.generate).toHaveBeenCalled();
    });

    it('should generate with comparative date', async () => {
      vi.mocked(BalanceSheetService.prototype.generate).mockResolvedValue(testBalanceSheet);

      await caller.balanceSheet.generate({
        reportDate: new Date('2024-12-31'),
        comparativeDate: new Date('2023-12-31'),
      });

      expect(BalanceSheetService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          comparativeDate: expect.any(Date),
        })
      );
    });

    it('should generate with draft entries included', async () => {
      vi.mocked(BalanceSheetService.prototype.generate).mockResolvedValue(testBalanceSheet);

      await caller.balanceSheet.generate({
        reportDate: new Date('2024-12-31'),
        includeDrafts: true,
      });

      expect(BalanceSheetService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({ includeDrafts: true })
      );
    });

    it('should generate with zero balances excluded', async () => {
      vi.mocked(BalanceSheetService.prototype.generate).mockResolvedValue(testBalanceSheet);

      await caller.balanceSheet.generate({
        reportDate: new Date('2024-12-31'),
        excludeZeroBalances: true,
      });

      expect(BalanceSheetService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({ excludeZeroBalances: true })
      );
    });

    it('should generate with summary detail level', async () => {
      vi.mocked(BalanceSheetService.prototype.generate).mockResolvedValue(testBalanceSheet);

      await caller.balanceSheet.generate({
        reportDate: new Date('2024-12-31'),
        detailLevel: 'SUMMARY',
      });

      expect(BalanceSheetService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({ detailLevel: 'SUMMARY' })
      );
    });

    it('should generate with full detail level', async () => {
      vi.mocked(BalanceSheetService.prototype.generate).mockResolvedValue(testBalanceSheet);

      await caller.balanceSheet.generate({
        reportDate: new Date('2024-12-31'),
        detailLevel: 'FULL',
      });

      expect(BalanceSheetService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({ detailLevel: 'FULL' })
      );
    });

    it('should detect unbalanced balance sheet', async () => {
      const unbalancedSheet = {
        ...testBalanceSheet,
        isBalanced: false,
        balanceDifference: 1000,
      };
      vi.mocked(BalanceSheetService.prototype.generate).mockResolvedValue(unbalancedSheet);

      const result = await caller.balanceSheet.generate({
        reportDate: new Date('2024-12-31'),
      });

      expect(result.isBalanced).toBe(false);
      expect(result.balanceDifference).toBe(1000);
    });
  });

  // ===========================================================================
  // BALANCE SHEET EXPORT
  // ===========================================================================

  describe('export', () => {
    it('should export balance sheet to Excel', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Bilans_2024-12-31.xlsx',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 15000,
      });

      const result = await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        format: 'EXCEL',
      });

      expect(result.fileName).toContain('.xlsx');
      expect(result.mimeType).toContain('spreadsheetml');
      expect(BalanceSheetService.prototype.export).toHaveBeenCalled();
    });

    it('should export balance sheet to PDF', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Bilans_2024-12-31.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 25000,
      });

      const result = await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        format: 'PDF',
      });

      expect(result.fileName).toContain('.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should export balance sheet to CSV', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Bilans_2024-12-31.csv',
        fileContent: 'base64-encoded-content',
        mimeType: 'text/csv',
        fileSize: 5000,
      });

      const result = await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        format: 'CSV',
      });

      expect(result.fileName).toContain('.csv');
      expect(result.mimeType).toBe('text/csv');
    });

    it('should export balance sheet to XML', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Bilans_2024-12-31.xml',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/xml',
        fileSize: 8000,
      });

      const result = await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        format: 'XML',
      });

      expect(result.fileName).toContain('.xml');
      expect(result.mimeType).toBe('application/xml');
    });

    it('should export with English language', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Balance_Sheet_2024-12-31.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 25000,
      });

      await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        format: 'PDF',
        language: 'EN',
      });

      expect(BalanceSheetService.prototype.export).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'EN' })
      );
    });

    it('should export without notes', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Bilans_2024-12-31.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 20000,
      });

      await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        format: 'PDF',
        includeNotes: false,
      });

      expect(BalanceSheetService.prototype.export).toHaveBeenCalledWith(
        expect.objectContaining({ includeNotes: false })
      );
    });

    it('should export without signatures', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Bilans_2024-12-31.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 22000,
      });

      await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        format: 'PDF',
        includeSignatures: false,
      });

      expect(BalanceSheetService.prototype.export).toHaveBeenCalledWith(
        expect.objectContaining({ includeSignatures: false })
      );
    });

    it('should export with comparative date', async () => {
      vi.mocked(BalanceSheetService.prototype.export).mockResolvedValue({
        fileName: 'Bilans_2024-12-31.xlsx',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 18000,
      });

      await caller.balanceSheet.export({
        reportDate: new Date('2024-12-31'),
        comparativeDate: new Date('2023-12-31'),
        format: 'EXCEL',
      });

      expect(BalanceSheetService.prototype.export).toHaveBeenCalledWith(
        expect.objectContaining({
          comparativeDate: expect.any(Date),
        })
      );
    });
  });

  // ===========================================================================
  // BALANCE SHEET SAVE & RETRIEVE
  // ===========================================================================

  describe('save', () => {
    it('should save a balance sheet report', async () => {
      vi.mocked(BalanceSheetService.prototype.save).mockResolvedValue(testSavedReport);

      const result = await caller.balanceSheet.save({
        reportDate: new Date('2024-12-31'),
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_REPORT_ID);
      expect(result.isFinal).toBe(false);
      expect(BalanceSheetService.prototype.save).toHaveBeenCalled();
    });

    it('should save with custom report name', async () => {
      vi.mocked(BalanceSheetService.prototype.save).mockResolvedValue({
        ...testSavedReport,
        reportName: 'Custom Report Name',
      });

      const result = await caller.balanceSheet.save({
        reportDate: new Date('2024-12-31'),
        reportName: 'Custom Report Name',
      });

      expect(result.reportName).toBe('Custom Report Name');
    });

    it('should save with comparative date', async () => {
      vi.mocked(BalanceSheetService.prototype.save).mockResolvedValue(testSavedReport);

      await caller.balanceSheet.save({
        reportDate: new Date('2024-12-31'),
        comparativeDate: new Date('2023-12-31'),
      });

      expect(BalanceSheetService.prototype.save).toHaveBeenCalledWith(
        expect.objectContaining({
          comparativeDate: expect.any(Date),
        })
      );
    });

    it('should save and mark as final', async () => {
      const finalReport = {
        ...testSavedReport,
        isFinal: true,
        finalizedAt: new Date(),
        finalizedBy: {
          id: TEST_USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      vi.mocked(BalanceSheetService.prototype.save).mockResolvedValue(finalReport);

      const result = await caller.balanceSheet.save({
        reportDate: new Date('2024-12-31'),
        markAsFinal: true,
      });

      expect(result.isFinal).toBe(true);
      expect(result.finalizedAt).toBeDefined();
      expect(result.finalizedBy).toBeDefined();
    });
  });

  describe('get', () => {
    it('should get a saved balance sheet report', async () => {
      const fullReport = {
        ...testSavedReport,
        reportData: testBalanceSheet,
      };
      vi.mocked(BalanceSheetService.prototype.get).mockResolvedValue(fullReport);

      const result = await caller.balanceSheet.get({
        reportId: TEST_REPORT_ID,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_REPORT_ID);
      expect(result.reportData).toBeDefined();
      expect(result.reportData.isBalanced).toBe(true);
      expect(BalanceSheetService.prototype.get).toHaveBeenCalled();
    });

    it('should retrieve report with full balance sheet data', async () => {
      const fullReport = {
        ...testSavedReport,
        reportData: testBalanceSheet,
      };
      vi.mocked(BalanceSheetService.prototype.get).mockResolvedValue(fullReport);

      const result = await caller.balanceSheet.get({
        reportId: TEST_REPORT_ID,
      });

      expect(result.reportData.assets).toBeDefined();
      expect(result.reportData.equity).toBeDefined();
      expect(result.reportData.liabilities).toBeDefined();
    });
  });

  // ===========================================================================
  // BALANCE SHEET LIST
  // ===========================================================================

  describe('list', () => {
    it('should list balance sheet reports with pagination', async () => {
      vi.mocked(BalanceSheetService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 1,
        hasMore: false,
      });

      const result = await caller.balanceSheet.list({
        limit: 20,
        offset: 0,
      });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(BalanceSheetService.prototype.list).toHaveBeenCalled();
    });

    it('should filter by year', async () => {
      vi.mocked(BalanceSheetService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 1,
        hasMore: false,
      });

      await caller.balanceSheet.list({
        year: 2024,
        limit: 20,
        offset: 0,
      });

      expect(BalanceSheetService.prototype.list).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2024 })
      );
    });

    it('should filter by final status', async () => {
      vi.mocked(BalanceSheetService.prototype.list).mockResolvedValue({
        reports: [],
        total: 0,
        hasMore: false,
      });

      await caller.balanceSheet.list({
        isFinal: true,
        limit: 20,
        offset: 0,
      });

      expect(BalanceSheetService.prototype.list).toHaveBeenCalledWith(
        expect.objectContaining({ isFinal: true })
      );
    });

    it('should search by report name', async () => {
      vi.mocked(BalanceSheetService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 1,
        hasMore: false,
      });

      await caller.balanceSheet.list({
        search: 'roczny',
        limit: 20,
        offset: 0,
      });

      expect(BalanceSheetService.prototype.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'roczny' })
      );
    });

    it('should handle pagination correctly', async () => {
      vi.mocked(BalanceSheetService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 25,
        hasMore: true,
      });

      const result = await caller.balanceSheet.list({
        limit: 10,
        offset: 10,
      });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(25);
      expect(BalanceSheetService.prototype.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 10 })
      );
    });
  });

  // ===========================================================================
  // BALANCE SHEET DELETE
  // ===========================================================================

  describe('delete', () => {
    it('should delete a balance sheet report', async () => {
      vi.mocked(BalanceSheetService.prototype.delete).mockResolvedValue({
        success: true,
        reportId: TEST_REPORT_ID,
        reportName: 'Bilans roczny 2024',
      });

      const result = await caller.balanceSheet.delete({
        reportId: TEST_REPORT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBe(TEST_REPORT_ID);
      expect(BalanceSheetService.prototype.delete).toHaveBeenCalled();
    });

    it('should return report name in delete result', async () => {
      vi.mocked(BalanceSheetService.prototype.delete).mockResolvedValue({
        success: true,
        reportId: TEST_REPORT_ID,
        reportName: 'Bilans roczny 2024',
      });

      const result = await caller.balanceSheet.delete({
        reportId: TEST_REPORT_ID,
      });

      expect(result.reportName).toBe('Bilans roczny 2024');
    });
  });
});
