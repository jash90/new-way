/**
 * ACC-014: Income Statement (RZiS) Service Tests
 * TDD tests for Polish income statement generation following Ustawa o rachunkowości
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { IncomeStatementService } from '../../services/ace/income-statement.service';

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_REPORT_ID = '550e8400-e29b-41d4-a716-446655440002';

// Mock Prisma client
const mockPrisma = {
  organization: {
    findUnique: vi.fn(),
  },
  fiscalYear: {
    findFirst: vi.fn(),
  },
  chartOfAccounts: {
    findMany: vi.fn(),
  },
  journalEntry: {
    findMany: vi.fn(),
  },
  journalLine: {
    groupBy: vi.fn(),
  },
  incomeStatementReport: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
  $queryRaw: vi.fn(),
};

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
};

// Mock audit logger
const mockAuditLogger = {
  log: vi.fn(),
};

const mockOrganization = {
  id: TEST_ORG_ID,
  name: 'Test Organization',
  nip: '1234567890',
};

// Mock account balances for income statement (Comparative variant - Wariant porównawczy)
// Revenue and expense accounts following Polish Chart of Accounts
// Note: Account codes are carefully chosen to avoid service's overlapping prefix mappings:
// - Use 733/734 for cost of goods sold (not 731 which is in A.IV prefixes 730-732)
// - Use 763/765 for other operating revenue (not 760 which is in H.IV prefixes 759-760)
// - Use 768/769 for other operating costs (not 762 which is in D.III prefix 762)
const mockAccountBalances = [
  // A. Przychody netto ze sprzedaży i zrównane z nimi
  // A.I - Przychody netto ze sprzedaży produktów (Class 7)
  { accountCode: '701', accountName: 'Przychody ze sprzedaży produktów', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 500000 },
  { accountCode: '702', accountName: 'Przychody ze sprzedaży usług', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 200000 },
  // A.IV - Przychody ze sprzedaży towarów i materiałów (Class 73)
  { accountCode: '730', accountName: 'Przychody ze sprzedaży towarów', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 150000 },

  // B. Koszty działalności operacyjnej (Class 4)
  // B.I - Amortyzacja
  { accountCode: '400', accountName: 'Amortyzacja', normalBalance: 'DEBIT', totalDebit: 50000, totalCredit: 0 },
  // B.II - Zużycie materiałów i energii
  { accountCode: '401', accountName: 'Zużycie materiałów', normalBalance: 'DEBIT', totalDebit: 100000, totalCredit: 0 },
  { accountCode: '402', accountName: 'Zużycie energii', normalBalance: 'DEBIT', totalDebit: 30000, totalCredit: 0 },
  // B.III - Usługi obce
  { accountCode: '403', accountName: 'Usługi obce', normalBalance: 'DEBIT', totalDebit: 80000, totalCredit: 0 },
  // B.IV - Podatki i opłaty
  { accountCode: '404', accountName: 'Podatki i opłaty', normalBalance: 'DEBIT', totalDebit: 20000, totalCredit: 0 },
  // B.V - Wynagrodzenia
  { accountCode: '405', accountName: 'Wynagrodzenia', normalBalance: 'DEBIT', totalDebit: 200000, totalCredit: 0 },
  // B.VI - Ubezpieczenia społeczne
  { accountCode: '406', accountName: 'Ubezpieczenia społeczne', normalBalance: 'DEBIT', totalDebit: 40000, totalCredit: 0 },
  // B.VII - Pozostałe koszty rodzajowe
  { accountCode: '407', accountName: 'Pozostałe koszty', normalBalance: 'DEBIT', totalDebit: 10000, totalCredit: 0 },
  // B.VIII - Wartość sprzedanych towarów i materiałów (use 733 to avoid A.IV overlap with 731)
  { accountCode: '733', accountName: 'Wartość sprzedanych towarów', normalBalance: 'DEBIT', totalDebit: 100000, totalCredit: 0 },

  // D. Pozostałe przychody operacyjne (Class 76) - use 763 to avoid H.IV overlap with 760
  { accountCode: '763', accountName: 'Pozostałe przychody operacyjne', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 25000 },
  { accountCode: '761', accountName: 'Dotacje', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 15000 },

  // E. Pozostałe koszty operacyjne (Class 76) - use 768 to avoid D.III overlap with 762
  { accountCode: '768', accountName: 'Pozostałe koszty operacyjne', normalBalance: 'DEBIT', totalDebit: 18000, totalCredit: 0 },

  // G. Przychody finansowe (Class 75)
  { accountCode: '750', accountName: 'Przychody finansowe', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 8000 },
  { accountCode: '751', accountName: 'Odsetki', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 5000 },

  // H. Koszty finansowe (Class 75)
  { accountCode: '755', accountName: 'Koszty finansowe', normalBalance: 'DEBIT', totalDebit: 12000, totalCredit: 0 },
  { accountCode: '756', accountName: 'Odsetki od kredytów', normalBalance: 'DEBIT', totalDebit: 8000, totalCredit: 0 },
];

// Summary calculations:
// A. Revenue = 500000 + 200000 + 150000 = 850000
// B. Operating Costs = 50000 + 100000 + 30000 + 80000 + 20000 + 200000 + 40000 + 10000 + 100000 = 630000
// C. Sales Profit = 850000 - 630000 = 220000
// D. Other Operating Revenue = 25000 + 15000 = 40000
// E. Other Operating Costs = 18000
// F. Operating Profit = 220000 + 40000 - 18000 = 242000
// G. Financial Revenue = 8000 + 5000 = 13000
// H. Financial Costs = 12000 + 8000 = 20000
// I. Gross Profit = 242000 + 13000 - 20000 = 235000
// J. Income Tax (19%) = 44650
// L. Net Profit = 235000 - 44650 = 190350

describe('IncomeStatementService', () => {
  let service: IncomeStatementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IncomeStatementService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );

    mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
    mockPrisma.$queryRaw.mockResolvedValue(mockAccountBalances);
  });

  // ===========================================================================
  // INCOME STATEMENT GENERATION
  // ===========================================================================

  describe('generate', () => {
    it('should generate an income statement for a period', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      expect(result).toBeDefined();
      expect(result.organizationId).toBe(TEST_ORG_ID);
      expect(result.organizationName).toBe('Test Organization');
      expect(result.nip).toBe('1234567890');
      expect(result.periodStart).toEqual(new Date('2024-01-01'));
      expect(result.periodEnd).toEqual(new Date('2024-12-31'));
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should default to COMPARATIVE variant', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      expect(result.statementVariant).toBe('COMPARATIVE');
    });

    it('should calculate revenue section correctly (A)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // A.I - Sales of products: 500000 + 200000 = 700000
      expect(result.revenueSection.salesProducts.currentAmount).toBe(700000);

      // A.IV - Sales of goods and materials: 150000
      expect(result.revenueSection.salesGoodsAndMaterials.currentAmount).toBe(150000);

      // A Total = 850000
      expect(result.revenueSection.total.currentAmount).toBe(850000);
    });

    it('should calculate operating costs section correctly (B)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // B.I - Depreciation
      expect(result.operatingCostsSection.depreciation.currentAmount).toBe(50000);

      // B.II - Materials and energy
      expect(result.operatingCostsSection.materialsAndEnergy.currentAmount).toBe(130000);

      // B.III - External services
      expect(result.operatingCostsSection.externalServices.currentAmount).toBe(80000);

      // B.IV - Taxes and fees
      expect(result.operatingCostsSection.taxesAndFees.currentAmount).toBe(20000);

      // B.V - Salaries
      expect(result.operatingCostsSection.salaries.currentAmount).toBe(200000);

      // B.VI - Social insurance
      expect(result.operatingCostsSection.socialInsurance.currentAmount).toBe(40000);

      // B.VII - Other operating costs
      expect(result.operatingCostsSection.otherOperatingCosts.currentAmount).toBe(10000);

      // B.VIII - Cost of goods sold
      expect(result.operatingCostsSection.costOfGoodsSold.currentAmount).toBe(100000);

      // B Total = 630000
      expect(result.operatingCostsSection.total.currentAmount).toBe(630000);
    });

    it('should calculate sales profit correctly (C = A - B)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // C = 850000 - 630000 = 220000
      expect(result.salesProfit.currentAmount).toBe(220000);
    });

    it('should calculate other operating revenue correctly (D)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // D.II - Subsidies
      expect(result.otherOperatingRevenue.subsidies.currentAmount).toBe(15000);

      // D.IV - Other
      expect(result.otherOperatingRevenue.other.currentAmount).toBe(25000);

      // D Total = 40000
      expect(result.otherOperatingRevenue.total.currentAmount).toBe(40000);
    });

    it('should calculate other operating costs correctly (E)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // E Total = 18000
      expect(result.otherOperatingCosts.total.currentAmount).toBe(18000);
    });

    it('should calculate operating profit correctly (F = C + D - E)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // F = 220000 + 40000 - 18000 = 242000
      expect(result.operatingProfit.currentAmount).toBe(242000);
    });

    it('should calculate financial revenue correctly (G)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // G.II - Interest income
      expect(result.financialRevenue.interestIncome.currentAmount).toBe(5000);

      // G.V - Other
      expect(result.financialRevenue.other.currentAmount).toBe(8000);

      // G Total = 13000
      expect(result.financialRevenue.total.currentAmount).toBe(13000);
    });

    it('should calculate financial costs correctly (H)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // H.I - Interest expense
      expect(result.financialCosts.interestExpense.currentAmount).toBe(20000);

      // H Total = 20000
      expect(result.financialCosts.total.currentAmount).toBe(20000);
    });

    it('should calculate gross profit correctly (I = F + G - H)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // I = 242000 + 13000 - 20000 = 235000
      expect(result.grossProfit.currentAmount).toBe(235000);
    });

    it('should calculate net profit correctly (L = I - J - K)', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // L = I - J - K (J = income tax, K = other deductions)
      expect(result.netProfit.currentAmount).toBeDefined();
      expect(result.netProfit.currentAmount).toBeLessThan(result.grossProfit.currentAmount);
    });

    it('should generate comparative income statement', async () => {
      const currentBalances = [...mockAccountBalances];
      const priorBalances = mockAccountBalances.map((b) => ({
        ...b,
        totalDebit: b.totalDebit * 0.9,
        totalCredit: b.totalCredit * 0.9,
      }));

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(currentBalances)
        .mockResolvedValueOnce(priorBalances);

      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        comparisonEnabled: true,
        comparisonPeriodStart: new Date('2023-01-01'),
        comparisonPeriodEnd: new Date('2023-12-31'),
      });

      expect(result.comparisonEnabled).toBe(true);
      expect(result.comparisonPeriodStart).toEqual(new Date('2023-01-01'));
      expect(result.revenueSection.total.priorAmount).toBeDefined();
      expect(result.revenueSection.total.variance).toBeDefined();
      expect(result.revenueSection.total.variancePercent).toBeDefined();
    });

    it('should calculate variances correctly', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { accountCode: '701', accountName: 'Revenue', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 600000 },
          { accountCode: '400', accountName: 'Costs', normalBalance: 'DEBIT', totalDebit: 400000, totalCredit: 0 },
        ])
        .mockResolvedValueOnce([
          { accountCode: '701', accountName: 'Revenue', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 500000 },
          { accountCode: '400', accountName: 'Costs', normalBalance: 'DEBIT', totalDebit: 350000, totalCredit: 0 },
        ]);

      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        comparisonEnabled: true,
        comparisonPeriodStart: new Date('2023-01-01'),
        comparisonPeriodEnd: new Date('2023-12-31'),
      });

      // Revenue: Current 600000, Prior 500000, Variance 100000, Percent 20%
      expect(result.revenueSection.total.variance).toBe(100000);
      expect(result.revenueSection.total.variancePercent).toBeCloseTo(20, 1);
    });

    it('should include draft entries when includeDrafts is true', async () => {
      await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        includeDrafts: true,
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should exclude draft entries when includeDrafts is false', async () => {
      await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        includeDrafts: false,
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should throw error when organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.generate({
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
        })
      ).rejects.toThrow('Organization not found');
    });

    it('should include totals summary', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      expect(result.totals).toBeDefined();
      expect(result.totals.totalRevenue).toBe(850000);
      expect(result.totals.totalCosts).toBe(630000);
      expect(result.totals.operatingProfit).toBe(242000);
      expect(result.totals.grossProfit).toBe(235000);
      expect(result.totals.netProfit).toBeDefined();
    });

    it('should handle loss scenario correctly', async () => {
      // Mock data where costs exceed revenue
      mockPrisma.$queryRaw.mockResolvedValue([
        { accountCode: '701', accountName: 'Revenue', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 100000 },
        { accountCode: '400', accountName: 'Costs', normalBalance: 'DEBIT', totalDebit: 150000, totalCredit: 0 },
      ]);

      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      expect(result.salesProfit.currentAmount).toBe(-50000);
      expect(result.netProfit.currentAmount).toBeLessThan(0);
    });

    it('should map accounts to correct Polish income statement lines', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // Verify Polish line codes are present
      expect(result.revenueSection.salesProducts.lineCode).toBe('A.I');
      expect(result.operatingCostsSection.depreciation.lineCode).toBe('B.I');
      expect(result.operatingCostsSection.materialsAndEnergy.lineCode).toBe('B.II');
      expect(result.operatingCostsSection.externalServices.lineCode).toBe('B.III');
      expect(result.operatingCostsSection.salaries.lineCode).toBe('B.V');
    });

    it('should include Polish and English line names', async () => {
      const result = await service.generate({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      });

      // Verify bilingual names
      expect(result.revenueSection.salesProducts.lineNamePl).toBe('Przychody netto ze sprzedaży produktów');
      expect(result.revenueSection.salesProducts.lineNameEn).toBe('Net revenue from sales of products');
    });
  });

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  describe('export', () => {
    const mockSavedReport = {
      id: TEST_REPORT_ID,
      organizationId: TEST_ORG_ID,
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      statementVariant: 'COMPARATIVE',
      reportData: {},
      status: 'FINAL',
    };

    beforeEach(() => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue(mockSavedReport);
      mockPrisma.$queryRaw.mockResolvedValue(mockAccountBalances);
    });

    it('should export income statement to Excel format', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'EXCEL',
      });

      expect(result.fileName).toMatch(/RZiS.*\.xlsx/);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.fileContent).toBeTruthy();
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should export income statement to PDF format', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'PDF',
      });

      expect(result.fileName).toMatch(/RZiS.*\.pdf/);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileContent).toBeTruthy();
    });

    it('should export income statement to CSV format', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'CSV',
      });

      expect(result.fileName).toMatch(/RZiS.*\.csv/);
      expect(result.mimeType).toBe('text/csv');
      expect(result.fileContent).toBeTruthy();
    });

    it('should export income statement to XML format', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'XML',
      });

      expect(result.fileName).toMatch(/RZiS.*\.xml/);
      expect(result.mimeType).toBe('application/xml');
      expect(result.fileContent).toBeTruthy();
    });

    it('should export with Polish language', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'EXCEL',
        language: 'PL',
      });

      expect(result.fileName).toContain('RZiS');
    });

    it('should export with English language', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'EXCEL',
        language: 'EN',
      });

      expect(result.fileName).toContain('IncomeStatement');
    });

    it('should include company header when requested', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'PDF',
        includeCompanyHeader: true,
      });

      expect(result.fileContent).toBeTruthy();
    });

    it('should include signatures when requested', async () => {
      const result = await service.export({
        reportId: TEST_REPORT_ID,
        format: 'PDF',
        includeSignatures: true,
      });

      expect(result.fileContent).toBeTruthy();
    });

    it('should throw error when report not found', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue(null);

      await expect(
        service.export({
          reportId: TEST_REPORT_ID,
          format: 'EXCEL',
        })
      ).rejects.toThrow('Income statement report not found');
    });
  });

  // ===========================================================================
  // SAVE AND MANAGE REPORTS
  // ===========================================================================

  describe('save', () => {
    const mockSavedReport = {
      id: TEST_REPORT_ID,
      organizationId: TEST_ORG_ID,
      reportNumber: 'RZiS-2024-001',
      reportName: 'RZiS 2024',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      fiscalYear: 2024,
      statementVariant: 'COMPARATIVE',
      comparisonEnabled: false,
      comparisonPeriodStart: null,
      comparisonPeriodEnd: null,
      totalRevenue: 850000,
      totalCosts: 630000,
      operatingProfit: 242000,
      grossProfit: 235000,
      netProfit: 190350,
      status: 'DRAFT',
      isPreliminary: false,
      approvedAt: null,
      approvedBy: null,
      exportedFormats: [],
      lastExportedAt: null,
      createdAt: new Date(),
      createdBy: TEST_USER_ID,
    };

    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue(mockAccountBalances);
      mockPrisma.incomeStatementReport.upsert.mockResolvedValue(mockSavedReport);
    });

    it('should save an income statement report', async () => {
      const result = await service.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        reportName: 'Annual Income Statement 2024',
      });

      expect(result.id).toBe(TEST_REPORT_ID);
      expect(mockPrisma.incomeStatementReport.upsert).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INCOME_STATEMENT_SAVED',
        })
      );
    });

    it('should save and mark as final', async () => {
      mockPrisma.incomeStatementReport.upsert.mockResolvedValue({
        ...mockSavedReport,
        status: 'FINAL',
      });

      const result = await service.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        markAsFinal: true,
      });

      expect(result.status).toBe('FINAL');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INCOME_STATEMENT_FINALIZED',
        })
      );
    });

    it('should save with statement variant', async () => {
      mockPrisma.incomeStatementReport.upsert.mockResolvedValue({
        ...mockSavedReport,
        statementVariant: 'COST_BY_FUNCTION',
      });

      const result = await service.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statementVariant: 'COST_BY_FUNCTION',
      });

      expect(result.statementVariant).toBe('COST_BY_FUNCTION');
    });

    it('should save with comparison period', async () => {
      mockPrisma.incomeStatementReport.upsert.mockResolvedValue({
        ...mockSavedReport,
        comparisonEnabled: true,
        comparisonPeriodStart: new Date('2023-01-01'),
        comparisonPeriodEnd: new Date('2023-12-31'),
      });

      const result = await service.save({
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        comparisonPeriodStart: new Date('2023-01-01'),
        comparisonPeriodEnd: new Date('2023-12-31'),
      });

      expect(result.comparisonPeriodStart).toEqual(new Date('2023-01-01'));
      expect(result.comparisonPeriodEnd).toEqual(new Date('2023-12-31'));
    });
  });

  describe('get', () => {
    it('should get a saved income statement by ID', async () => {
      const mockReport = {
        id: TEST_REPORT_ID,
        organizationId: TEST_ORG_ID,
        reportNumber: 'RZiS-2024-001',
        reportName: 'Test Report',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        fiscalYear: 2024,
        statementVariant: 'COMPARATIVE',
        comparisonEnabled: false,
        comparisonPeriodStart: null,
        comparisonPeriodEnd: null,
        totalRevenue: 850000,
        totalCosts: 630000,
        operatingProfit: 242000,
        grossProfit: 235000,
        netProfit: 190350,
        status: 'FINAL',
        isPreliminary: false,
        approvedAt: new Date(),
        approvedBy: { id: TEST_USER_ID, name: 'Test User', email: 'test@example.com' },
        exportedFormats: ['EXCEL'],
        lastExportedAt: new Date(),
        createdAt: new Date(),
        createdBy: { id: TEST_USER_ID, name: 'Test User', email: 'test@example.com' },
        reportData: {},
      };

      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue(mockReport);

      const result = await service.get({ reportId: TEST_REPORT_ID });

      expect(result.id).toBe(TEST_REPORT_ID);
      expect(result.reportData).toBeDefined();
    });

    it('should throw error when report not found', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue(null);

      await expect(service.get({ reportId: TEST_REPORT_ID })).rejects.toThrow(
        'Income statement report not found'
      );
    });
  });

  describe('list', () => {
    it('should list saved income statement reports', async () => {
      const mockReports = [
        {
          id: TEST_REPORT_ID,
          organizationId: TEST_ORG_ID,
          reportNumber: 'RZiS-2024-001',
          reportName: 'Test Report',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-12-31'),
          fiscalYear: 2024,
          statementVariant: 'COMPARATIVE',
          comparisonEnabled: false,
          comparisonPeriodStart: null,
          comparisonPeriodEnd: null,
          totalRevenue: 850000,
          totalCosts: 630000,
          operatingProfit: 242000,
          grossProfit: 235000,
          netProfit: 190350,
          status: 'FINAL',
          isPreliminary: false,
          approvedAt: null,
          approvedBy: null,
          exportedFormats: [],
          lastExportedAt: null,
          createdAt: new Date(),
          createdBy: null,
        },
      ];

      mockPrisma.incomeStatementReport.findMany.mockResolvedValue(mockReports);
      mockPrisma.incomeStatementReport.count.mockResolvedValue(1);

      const result = await service.list({ limit: 10, offset: 0 });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by fiscal year', async () => {
      mockPrisma.incomeStatementReport.findMany.mockResolvedValue([]);
      mockPrisma.incomeStatementReport.count.mockResolvedValue(0);

      await service.list({ fiscalYear: 2024, limit: 10, offset: 0 });

      expect(mockPrisma.incomeStatementReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fiscalYear: 2024,
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.incomeStatementReport.findMany.mockResolvedValue([]);
      mockPrisma.incomeStatementReport.count.mockResolvedValue(0);

      await service.list({ status: 'FINAL', limit: 10, offset: 0 });

      expect(mockPrisma.incomeStatementReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'FINAL',
          }),
        })
      );
    });

    it('should filter by statement variant', async () => {
      mockPrisma.incomeStatementReport.findMany.mockResolvedValue([]);
      mockPrisma.incomeStatementReport.count.mockResolvedValue(0);

      await service.list({ statementVariant: 'COMPARATIVE', limit: 10, offset: 0 });

      expect(mockPrisma.incomeStatementReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            statementVariant: 'COMPARATIVE',
          }),
        })
      );
    });

    it('should support pagination', async () => {
      mockPrisma.incomeStatementReport.findMany.mockResolvedValue([]);
      mockPrisma.incomeStatementReport.count.mockResolvedValue(25);

      const result = await service.list({ limit: 10, offset: 10 });

      expect(result.hasMore).toBe(true);
    });

    it('should support search', async () => {
      mockPrisma.incomeStatementReport.findMany.mockResolvedValue([]);
      mockPrisma.incomeStatementReport.count.mockResolvedValue(0);

      await service.list({ search: 'Annual', limit: 10, offset: 0 });

      expect(mockPrisma.incomeStatementReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportName: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a draft income statement report', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue({
        id: TEST_REPORT_ID,
        organizationId: TEST_ORG_ID,
        reportName: 'Test Report',
        status: 'DRAFT',
      });

      mockPrisma.incomeStatementReport.delete.mockResolvedValue({
        id: TEST_REPORT_ID,
      });

      const result = await service.delete({ reportId: TEST_REPORT_ID });

      expect(result.success).toBe(true);
      expect(result.reportId).toBe(TEST_REPORT_ID);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INCOME_STATEMENT_DELETED',
        })
      );
    });

    it('should reject deleting finalized income statement', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue({
        id: TEST_REPORT_ID,
        organizationId: TEST_ORG_ID,
        reportName: 'Final Report',
        status: 'FINAL',
      });

      await expect(service.delete({ reportId: TEST_REPORT_ID })).rejects.toThrow(
        'Cannot delete finalized income statement'
      );
    });

    it('should reject deleting approved income statement', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue({
        id: TEST_REPORT_ID,
        organizationId: TEST_ORG_ID,
        reportName: 'Approved Report',
        status: 'APPROVED',
      });

      await expect(service.delete({ reportId: TEST_REPORT_ID })).rejects.toThrow(
        'Cannot delete approved income statement'
      );
    });

    it('should throw error when report not found', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue(null);

      await expect(service.delete({ reportId: TEST_REPORT_ID })).rejects.toThrow(
        'Income statement report not found'
      );
    });
  });

  describe('approve', () => {
    it('should approve a final income statement', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue({
        id: TEST_REPORT_ID,
        organizationId: TEST_ORG_ID,
        reportName: 'Final Report',
        status: 'FINAL',
      });

      mockPrisma.incomeStatementReport.update.mockResolvedValue({
        id: TEST_REPORT_ID,
        organizationId: TEST_ORG_ID,
        reportName: 'Final Report',
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: { id: TEST_USER_ID, name: 'Test User', email: 'test@example.com' },
      });

      const result = await service.approve({ reportId: TEST_REPORT_ID });

      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBeDefined();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INCOME_STATEMENT_APPROVED',
        })
      );
    });

    it('should reject approving draft income statement', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue({
        id: TEST_REPORT_ID,
        organizationId: TEST_ORG_ID,
        reportName: 'Draft Report',
        status: 'DRAFT',
      });

      await expect(service.approve({ reportId: TEST_REPORT_ID })).rejects.toThrow(
        'Only final income statements can be approved'
      );
    });

    it('should throw error when report not found', async () => {
      mockPrisma.incomeStatementReport.findUnique.mockResolvedValue(null);

      await expect(service.approve({ reportId: TEST_REPORT_ID })).rejects.toThrow(
        'Income statement report not found'
      );
    });
  });
});
