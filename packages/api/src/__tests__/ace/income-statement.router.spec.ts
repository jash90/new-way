/**
 * ACC-014: Income Statement (Rachunek Zysków i Strat) Router Tests
 * TDD tests for income statement router endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { router } from '../../trpc';
import { incomeStatementRouter } from '../../routers/ace/income-statement.router';
import { createCallerFactory } from '../../trpc';

// Mock the IncomeStatementService
import { IncomeStatementService } from '../../services/ace/income-statement.service';

vi.mock('../../services/ace/income-statement.service');

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

// Helper function to create income statement line
const createLine = (overrides = {}) => ({
  lineCode: 'A.I',
  lineNamePl: 'Przychody netto ze sprzedaży produktów',
  lineNameEn: 'Net sales revenue from products',
  indentLevel: 1,
  currentAmount: 500000,
  priorAmount: 450000,
  variance: 50000,
  variancePercent: 11.11,
  isHeader: false,
  isSubtotal: false,
  isTotal: false,
  accounts: ['700', '701'],
  ...overrides,
});

// Helper function to create a section
const createRevenueSection = () => ({
  salesProducts: createLine({ lineCode: 'A.I', currentAmount: 500000 }),
  changeInInventory: createLine({ lineCode: 'A.II', currentAmount: 10000 }),
  manufacturingForOwnUse: createLine({ lineCode: 'A.III', currentAmount: 5000 }),
  salesGoodsAndMaterials: createLine({ lineCode: 'A.IV', currentAmount: 335000 }),
  total: createLine({ lineCode: 'A', currentAmount: 850000, isTotal: true }),
});

const createOperatingCostsSection = () => ({
  depreciation: createLine({ lineCode: 'B.I', currentAmount: 50000 }),
  materialsAndEnergy: createLine({ lineCode: 'B.II', currentAmount: 200000 }),
  externalServices: createLine({ lineCode: 'B.III', currentAmount: 100000 }),
  taxesAndFees: createLine({ lineCode: 'B.IV', currentAmount: 15000 }),
  salaries: createLine({ lineCode: 'B.V', currentAmount: 180000 }),
  socialInsurance: createLine({ lineCode: 'B.VI', currentAmount: 35000 }),
  otherOperatingCosts: createLine({ lineCode: 'B.VII', currentAmount: 20000 }),
  costOfGoodsSold: createLine({ lineCode: 'B.VIII', currentAmount: 30000 }),
  total: createLine({ lineCode: 'B', currentAmount: 630000, isTotal: true }),
});

const createOtherOperatingRevenueSection = () => ({
  gainOnDisposal: createLine({ lineCode: 'D.I', currentAmount: 5000 }),
  subsidies: createLine({ lineCode: 'D.II', currentAmount: 10000 }),
  revaluationOfAssets: createLine({ lineCode: 'D.III', currentAmount: 0 }),
  other: createLine({ lineCode: 'D.IV', currentAmount: 7000 }),
  total: createLine({ lineCode: 'D', currentAmount: 22000, isTotal: true }),
});

const createOtherOperatingCostsSection = () => ({
  lossOnDisposal: createLine({ lineCode: 'E.I', currentAmount: 0 }),
  revaluationOfAssets: createLine({ lineCode: 'E.II', currentAmount: 0 }),
  other: createLine({ lineCode: 'E.III', currentAmount: 0 }),
  total: createLine({ lineCode: 'E', currentAmount: 0, isTotal: true }),
});

const createFinancialRevenueSection = () => ({
  dividendsAndProfitSharing: createLine({ lineCode: 'G.I', currentAmount: 0 }),
  interestIncome: createLine({ lineCode: 'G.II', currentAmount: 3000 }),
  gainOnDisposal: createLine({ lineCode: 'G.III', currentAmount: 0 }),
  revaluationOfInvestments: createLine({ lineCode: 'G.IV', currentAmount: 0 }),
  other: createLine({ lineCode: 'G.V', currentAmount: 0 }),
  total: createLine({ lineCode: 'G', currentAmount: 3000, isTotal: true }),
});

const createFinancialCostsSection = () => ({
  interestExpense: createLine({ lineCode: 'H.I', currentAmount: 10000 }),
  lossOnDisposal: createLine({ lineCode: 'H.II', currentAmount: 0 }),
  revaluationOfInvestments: createLine({ lineCode: 'H.III', currentAmount: 0 }),
  other: createLine({ lineCode: 'H.IV', currentAmount: 0 }),
  total: createLine({ lineCode: 'H', currentAmount: 10000, isTotal: true }),
});

const testIncomeStatement = {
  organizationId: TEST_ORG_ID,
  organizationName: 'Test Company Sp. z o.o.',
  nip: '1234567890',
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-12-31'),
  fiscalYear: 2024,
  statementVariant: 'COMPARATIVE' as const,
  comparisonEnabled: true,
  comparisonPeriodStart: new Date('2023-01-01'),
  comparisonPeriodEnd: new Date('2023-12-31'),

  // Sections
  revenueSection: createRevenueSection(),
  operatingCostsSection: createOperatingCostsSection(),
  salesProfit: createLine({ lineCode: 'C', currentAmount: 220000, isTotal: true }),
  otherOperatingRevenue: createOtherOperatingRevenueSection(),
  otherOperatingCosts: createOtherOperatingCostsSection(),
  operatingProfit: createLine({ lineCode: 'F', currentAmount: 242000, isTotal: true }),
  financialRevenue: createFinancialRevenueSection(),
  financialCosts: createFinancialCostsSection(),
  grossProfit: createLine({ lineCode: 'I', currentAmount: 235000, isTotal: true }),
  incomeTax: createLine({ lineCode: 'J', currentAmount: 44650 }),
  otherDeductions: createLine({ lineCode: 'K', currentAmount: 0 }),
  netProfit: createLine({ lineCode: 'L', currentAmount: 190350, isTotal: true }),

  // Totals
  totals: {
    totalRevenue: 875000,
    totalCosts: 640000,
    operatingProfit: 242000,
    grossProfit: 235000,
    netProfit: 190350,
    prevTotalRevenue: 800000,
    prevTotalCosts: 580000,
    prevNetProfit: 170000,
  },

  status: 'DRAFT' as const,
  isPreliminary: false,
  generatedAt: new Date(),
  generatedBy: TEST_USER_ID,
};

const testSavedReport = {
  id: TEST_REPORT_ID,
  organizationId: TEST_ORG_ID,
  reportNumber: 'RZiS-2024-001',
  reportName: 'Rachunek Zysków i Strat 2024',
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-12-31'),
  fiscalYear: 2024,
  statementVariant: 'COMPARATIVE' as const,
  comparisonEnabled: true,
  comparisonPeriodStart: new Date('2023-01-01'),
  comparisonPeriodEnd: new Date('2023-12-31'),
  totalRevenue: 875000,
  totalCosts: 640000,
  operatingProfit: 242000,
  grossProfit: 235000,
  netProfit: 190350,
  status: 'DRAFT' as const,
  isPreliminary: false,
  approvedAt: null,
  approvedBy: null,
  exportedFormats: [],
  lastExportedAt: null,
  createdAt: new Date(),
  createdBy: {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
  },
};

describe('IncomeStatementRouter', () => {
  const createCaller = createCallerFactory(router({ incomeStatement: incomeStatementRouter }));
  const caller = createCaller(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // INCOME STATEMENT GENERATION
  // ===========================================================================

  describe('generate', () => {
    it('should generate an income statement for a period', async () => {
      vi.mocked(IncomeStatementService.prototype.generate).mockResolvedValue(testIncomeStatement);

      const result = await caller.incomeStatement.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      expect(result).toBeDefined();
      expect(result.netProfit.currentAmount).toBe(190350);
      expect(result.totals.netProfit).toBe(190350);
      expect(vi.mocked(IncomeStatementService.prototype.generate)).toHaveBeenCalled();
    });

    it('should generate with comparison period', async () => {
      vi.mocked(IncomeStatementService.prototype.generate).mockResolvedValue(testIncomeStatement);

      await caller.incomeStatement.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        comparisonEnabled: true,
        comparisonPeriodStart: new Date('2023-01-01'),
        comparisonPeriodEnd: new Date('2023-12-31'),
      });

      expect(vi.mocked(IncomeStatementService.prototype.generate)).toHaveBeenCalledWith(
        expect.objectContaining({
          comparisonEnabled: true,
          comparisonPeriodStart: expect.any(Date),
          comparisonPeriodEnd: expect.any(Date),
        })
      );
    });

    it('should generate with draft entries included', async () => {
      vi.mocked(IncomeStatementService.prototype.generate).mockResolvedValue(testIncomeStatement);

      await caller.incomeStatement.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        includeDrafts: true,
      });

      expect(vi.mocked(IncomeStatementService.prototype.generate)).toHaveBeenCalledWith(
        expect.objectContaining({ includeDrafts: true })
      );
    });

    it('should generate with COST_BY_FUNCTION variant', async () => {
      vi.mocked(IncomeStatementService.prototype.generate).mockResolvedValue({
        ...testIncomeStatement,
        statementVariant: 'COST_BY_FUNCTION',
      });

      await caller.incomeStatement.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statementVariant: 'COST_BY_FUNCTION',
      });

      expect(vi.mocked(IncomeStatementService.prototype.generate)).toHaveBeenCalledWith(
        expect.objectContaining({ statementVariant: 'COST_BY_FUNCTION' })
      );
    });

    it('should generate with custom report name', async () => {
      vi.mocked(IncomeStatementService.prototype.generate).mockResolvedValue(testIncomeStatement);

      await caller.incomeStatement.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        reportName: 'Custom Income Statement',
      });

      expect(vi.mocked(IncomeStatementService.prototype.generate)).toHaveBeenCalledWith(
        expect.objectContaining({ reportName: 'Custom Income Statement' })
      );
    });

    it('should calculate all profit levels correctly', async () => {
      vi.mocked(IncomeStatementService.prototype.generate).mockResolvedValue(testIncomeStatement);

      const result = await caller.incomeStatement.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // C = A - B = 850000 - 630000 = 220000
      expect(result.salesProfit.currentAmount).toBe(220000);
      // F = C + D - E = 220000 + 22000 - 0 = 242000
      expect(result.operatingProfit.currentAmount).toBe(242000);
      // I = F + G - H = 242000 + 3000 - 10000 = 235000
      expect(result.grossProfit.currentAmount).toBe(235000);
      // L = I - J - K = 235000 - 44650 - 0 = 190350
      expect(result.netProfit.currentAmount).toBe(190350);
    });
  });

  // ===========================================================================
  // INCOME STATEMENT EXPORT
  // ===========================================================================

  describe('export', () => {
    it('should export income statement to Excel', async () => {
      vi.mocked(IncomeStatementService.prototype.export).mockResolvedValue({
        fileName: 'RZiS_2024.xlsx',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 15000,
      });

      const result = await caller.incomeStatement.export({
        reportId: TEST_REPORT_ID,
        format: 'EXCEL',
      });

      expect(result.fileName).toContain('.xlsx');
      expect(result.mimeType).toContain('spreadsheetml');
      expect(vi.mocked(IncomeStatementService.prototype.export)).toHaveBeenCalled();
    });

    it('should export income statement to PDF', async () => {
      vi.mocked(IncomeStatementService.prototype.export).mockResolvedValue({
        fileName: 'RZiS_2024.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 25000,
      });

      const result = await caller.incomeStatement.export({
        reportId: TEST_REPORT_ID,
        format: 'PDF',
      });

      expect(result.fileName).toContain('.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should export income statement to CSV', async () => {
      vi.mocked(IncomeStatementService.prototype.export).mockResolvedValue({
        fileName: 'RZiS_2024.csv',
        fileContent: 'base64-encoded-content',
        mimeType: 'text/csv',
        fileSize: 5000,
      });

      const result = await caller.incomeStatement.export({
        reportId: TEST_REPORT_ID,
        format: 'CSV',
      });

      expect(result.fileName).toContain('.csv');
      expect(result.mimeType).toBe('text/csv');
    });

    it('should export income statement to XML', async () => {
      vi.mocked(IncomeStatementService.prototype.export).mockResolvedValue({
        fileName: 'RZiS_2024.xml',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/xml',
        fileSize: 8000,
      });

      const result = await caller.incomeStatement.export({
        reportId: TEST_REPORT_ID,
        format: 'XML',
      });

      expect(result.fileName).toContain('.xml');
      expect(result.mimeType).toBe('application/xml');
    });

    it('should export with English language', async () => {
      vi.mocked(IncomeStatementService.prototype.export).mockResolvedValue({
        fileName: 'Income_Statement_2024.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 25000,
      });

      await caller.incomeStatement.export({
        reportId: TEST_REPORT_ID,
        format: 'PDF',
        language: 'EN',
      });

      expect(vi.mocked(IncomeStatementService.prototype.export)).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'EN' })
      );
    });

    it('should export without company header', async () => {
      vi.mocked(IncomeStatementService.prototype.export).mockResolvedValue({
        fileName: 'RZiS_2024.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 22000,
      });

      await caller.incomeStatement.export({
        reportId: TEST_REPORT_ID,
        format: 'PDF',
        includeCompanyHeader: false,
      });

      expect(vi.mocked(IncomeStatementService.prototype.export)).toHaveBeenCalledWith(
        expect.objectContaining({ includeCompanyHeader: false })
      );
    });

    it('should export without signatures', async () => {
      vi.mocked(IncomeStatementService.prototype.export).mockResolvedValue({
        fileName: 'RZiS_2024.pdf',
        fileContent: 'base64-encoded-content',
        mimeType: 'application/pdf',
        fileSize: 20000,
      });

      await caller.incomeStatement.export({
        reportId: TEST_REPORT_ID,
        format: 'PDF',
        includeSignatures: false,
      });

      expect(vi.mocked(IncomeStatementService.prototype.export)).toHaveBeenCalledWith(
        expect.objectContaining({ includeSignatures: false })
      );
    });
  });

  // ===========================================================================
  // INCOME STATEMENT SAVE & RETRIEVE
  // ===========================================================================

  describe('save', () => {
    it('should save an income statement report', async () => {
      vi.mocked(IncomeStatementService.prototype.save).mockResolvedValue(testSavedReport);

      const result = await caller.incomeStatement.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_REPORT_ID);
      expect(result.status).toBe('DRAFT');
      expect(vi.mocked(IncomeStatementService.prototype.save)).toHaveBeenCalled();
    });

    it('should save with custom report name', async () => {
      vi.mocked(IncomeStatementService.prototype.save).mockResolvedValue({
        ...testSavedReport,
        reportName: 'Custom Report Name',
      });

      const result = await caller.incomeStatement.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        reportName: 'Custom Report Name',
      });

      expect(result.reportName).toBe('Custom Report Name');
    });

    it('should save with comparison period', async () => {
      vi.mocked(IncomeStatementService.prototype.save).mockResolvedValue(testSavedReport);

      await caller.incomeStatement.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        comparisonPeriodStart: new Date('2023-01-01'),
        comparisonPeriodEnd: new Date('2023-12-31'),
      });

      expect(vi.mocked(IncomeStatementService.prototype.save)).toHaveBeenCalledWith(
        expect.objectContaining({
          comparisonPeriodStart: expect.any(Date),
          comparisonPeriodEnd: expect.any(Date),
        })
      );
    });

    it('should save and mark as final', async () => {
      const finalReport = {
        ...testSavedReport,
        status: 'FINAL' as const,
      };
      vi.mocked(IncomeStatementService.prototype.save).mockResolvedValue(finalReport);

      const result = await caller.incomeStatement.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        markAsFinal: true,
      });

      expect(result.status).toBe('FINAL');
    });

    it('should save with statement variant', async () => {
      vi.mocked(IncomeStatementService.prototype.save).mockResolvedValue({
        ...testSavedReport,
        statementVariant: 'COST_BY_FUNCTION',
      });

      await caller.incomeStatement.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statementVariant: 'COST_BY_FUNCTION',
      });

      expect(vi.mocked(IncomeStatementService.prototype.save)).toHaveBeenCalledWith(
        expect.objectContaining({ statementVariant: 'COST_BY_FUNCTION' })
      );
    });
  });

  describe('get', () => {
    it('should get a saved income statement report', async () => {
      const fullReport = {
        ...testSavedReport,
        reportData: testIncomeStatement,
      };
      vi.mocked(IncomeStatementService.prototype.get).mockResolvedValue(fullReport);

      const result = await caller.incomeStatement.get({
        reportId: TEST_REPORT_ID,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_REPORT_ID);
      expect(result.reportData).toBeDefined();
      expect(result.reportData.netProfit.currentAmount).toBe(190350);
      expect(vi.mocked(IncomeStatementService.prototype.get)).toHaveBeenCalled();
    });

    it('should retrieve report with full income statement data', async () => {
      const fullReport = {
        ...testSavedReport,
        reportData: testIncomeStatement,
      };
      vi.mocked(IncomeStatementService.prototype.get).mockResolvedValue(fullReport);

      const result = await caller.incomeStatement.get({
        reportId: TEST_REPORT_ID,
      });

      expect(result.reportData.revenueSection).toBeDefined();
      expect(result.reportData.operatingCostsSection).toBeDefined();
      expect(result.reportData.financialRevenue).toBeDefined();
      expect(result.reportData.financialCosts).toBeDefined();
    });
  });

  // ===========================================================================
  // INCOME STATEMENT LIST
  // ===========================================================================

  describe('list', () => {
    it('should list income statement reports with pagination', async () => {
      vi.mocked(IncomeStatementService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 1,
        hasMore: false,
      });

      const result = await caller.incomeStatement.list({
        limit: 20,
        offset: 0,
      });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(vi.mocked(IncomeStatementService.prototype.list)).toHaveBeenCalled();
    });

    it('should filter by fiscal year', async () => {
      vi.mocked(IncomeStatementService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 1,
        hasMore: false,
      });

      await caller.incomeStatement.list({
        fiscalYear: 2024,
        limit: 20,
        offset: 0,
      });

      expect(vi.mocked(IncomeStatementService.prototype.list)).toHaveBeenCalledWith(
        expect.objectContaining({ fiscalYear: 2024 })
      );
    });

    it('should filter by status', async () => {
      vi.mocked(IncomeStatementService.prototype.list).mockResolvedValue({
        reports: [],
        total: 0,
        hasMore: false,
      });

      await caller.incomeStatement.list({
        status: 'FINAL',
        limit: 20,
        offset: 0,
      });

      expect(vi.mocked(IncomeStatementService.prototype.list)).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FINAL' })
      );
    });

    it('should filter by statement variant', async () => {
      vi.mocked(IncomeStatementService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 1,
        hasMore: false,
      });

      await caller.incomeStatement.list({
        statementVariant: 'COMPARATIVE',
        limit: 20,
        offset: 0,
      });

      expect(vi.mocked(IncomeStatementService.prototype.list)).toHaveBeenCalledWith(
        expect.objectContaining({ statementVariant: 'COMPARATIVE' })
      );
    });

    it('should search by report name', async () => {
      vi.mocked(IncomeStatementService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 1,
        hasMore: false,
      });

      await caller.incomeStatement.list({
        search: 'Zysków',
        limit: 20,
        offset: 0,
      });

      expect(vi.mocked(IncomeStatementService.prototype.list)).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Zysków' })
      );
    });

    it('should handle pagination correctly', async () => {
      vi.mocked(IncomeStatementService.prototype.list).mockResolvedValue({
        reports: [testSavedReport],
        total: 25,
        hasMore: true,
      });

      const result = await caller.incomeStatement.list({
        limit: 10,
        offset: 10,
      });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(25);
      expect(vi.mocked(IncomeStatementService.prototype.list)).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 10 })
      );
    });
  });

  // ===========================================================================
  // INCOME STATEMENT DELETE
  // ===========================================================================

  describe('delete', () => {
    it('should delete an income statement report', async () => {
      vi.mocked(IncomeStatementService.prototype.delete).mockResolvedValue({
        success: true,
        reportId: TEST_REPORT_ID,
        reportName: 'Rachunek Zysków i Strat 2024',
      });

      const result = await caller.incomeStatement.delete({
        reportId: TEST_REPORT_ID,
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBe(TEST_REPORT_ID);
      expect(vi.mocked(IncomeStatementService.prototype.delete)).toHaveBeenCalled();
    });

    it('should return report name in delete result', async () => {
      vi.mocked(IncomeStatementService.prototype.delete).mockResolvedValue({
        success: true,
        reportId: TEST_REPORT_ID,
        reportName: 'Rachunek Zysków i Strat 2024',
      });

      const result = await caller.incomeStatement.delete({
        reportId: TEST_REPORT_ID,
      });

      expect(result.reportName).toBe('Rachunek Zysków i Strat 2024');
    });
  });

  // ===========================================================================
  // INCOME STATEMENT APPROVE
  // ===========================================================================

  describe('approve', () => {
    it('should approve an income statement report', async () => {
      const approvedReport = {
        ...testSavedReport,
        status: 'APPROVED' as const,
        approvedAt: new Date(),
        approvedBy: {
          id: TEST_USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      vi.mocked(IncomeStatementService.prototype.approve).mockResolvedValue(approvedReport);

      const result = await caller.incomeStatement.approve({
        reportId: TEST_REPORT_ID,
      });

      expect(result.status).toBe('APPROVED');
      expect(result.approvedAt).toBeDefined();
      expect(result.approvedBy).toBeDefined();
      expect(vi.mocked(IncomeStatementService.prototype.approve)).toHaveBeenCalled();
    });

    it('should track who approved the report', async () => {
      const approvedReport = {
        ...testSavedReport,
        status: 'APPROVED' as const,
        approvedAt: new Date(),
        approvedBy: {
          id: TEST_USER_ID,
          name: 'Approver Name',
          email: 'approver@example.com',
        },
      };
      vi.mocked(IncomeStatementService.prototype.approve).mockResolvedValue(approvedReport);

      const result = await caller.incomeStatement.approve({
        reportId: TEST_REPORT_ID,
      });

      expect(result.approvedBy?.id).toBe(TEST_USER_ID);
      expect(result.approvedBy?.name).toBe('Approver Name');
    });
  });
});
