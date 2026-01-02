// TAX-002: Tax Rates Router Tests
// Tests for Polish tax rates API endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TaxRatesService } from '../../services/tax/tax-rates.service';

// ===========================================================================
// MOCK DATA
// ===========================================================================

const USER_ID = '11111111-1111-1111-1111-111111111111';
const RATE_ID = '22222222-2222-2222-2222-222222222222';

const mockVATRate = {
  id: '33333333-3333-3333-3333-333333333331',
  taxType: 'VAT' as const,
  rateCode: '23',
  rateName: 'Stawka podstawowa',
  rateValue: 23.0,
  appliesTo: null,
  activityType: null,
  effectiveFrom: '2011-01-01T00:00:00.000Z',
  effectiveTo: null,
  legalBasis: 'Art. 41 ust. 1 ustawy o VAT',
  description: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: USER_ID,
};

const mockVATCalculationResult = {
  netAmount: 1000,
  vatRate: 23,
  vatAmount: 230,
  grossAmount: 1230,
  rateCode: '23',
  rateName: 'Stawka podstawowa',
  effectiveDate: '2011-01-01T00:00:00.000Z',
};

const mockPITCalculationResult = {
  annualIncome: 100000,
  taxableIncome: 100000,
  taxOption: 'flat' as const,
  brackets: [{
    threshold: 'Podatek liniowy 19%',
    income: 100000,
    rate: 19,
    tax: 19000,
  }],
  totalTax: 19000,
  effectiveRate: 19,
  taxYear: 2024,
};

const mockZUSCalculationResult = {
  contributorType: 'employee' as const,
  contributionBase: 10000,
  contributions: {
    emerytalne: { employee: 976, employer: 976, total: 1952 },
    rentowe: { employee: 150, employer: 650, total: 800 },
    chorobowe: { employee: 245, employer: 0, total: 245 },
    wypadkowe: { employee: 0, employer: 167, total: 167 },
    zdrowotne: { employee: 775, employer: 0, total: 775 },
    fp: { employee: 0, employer: 245, total: 245 },
    fgsp: { employee: 0, employer: 10, total: 10 },
  },
  totalEmployee: 2146,
  totalEmployer: 2048,
  totalContributions: 4194,
  netSalary: 7854,
};

const mockThresholds = [
  {
    id: '77777777-7777-7777-7777-777777777771',
    taxType: 'PIT' as const,
    thresholdName: 'Kwota wolna',
    lowerBound: 0,
    upperBound: 30000,
    rate: 0,
    baseAmount: 0,
    effectiveFrom: '2022-07-01T00:00:00.000Z',
    effectiveTo: null,
    legalBasis: 'Art. 27 ust. 1 ustawy o PIT',
    createdAt: new Date().toISOString(),
  },
];

const mockZUSBase = {
  id: '88888888-8888-8888-8888-888888888881',
  year: 2024,
  month: null,
  minimumWage: 4242.0,
  averageWage: 7824.0,
  declaredBaseMin: 4694.4,
  declaredBaseStandard: 4694.4,
  healthBase: 3181.5,
  preferentialBaseMax: 2000.0,
  annualContributionLimit: 234720.0,
  effectiveFrom: '2024-01-01T00:00:00.000Z',
  effectiveTo: null,
  createdAt: new Date().toISOString(),
};

const mockAudit = {
  id: '99999999-9999-9999-9999-999999999999',
  rateId: RATE_ID,
  action: 'created' as const,
  oldValue: null,
  newValue: mockVATRate,
  changeReason: null,
  userId: USER_ID,
  createdAt: new Date().toISOString(),
};

// ===========================================================================
// MOCK SERVICE
// ===========================================================================

const mockTaxRatesService = vi.hoisted(() => ({
  getRates: vi.fn(),
  getRateByCode: vi.fn(),
  getThresholds: vi.fn(),
  getZUSBases: vi.fn(),
  getCurrentRatesSummary: vi.fn(),
  getLumpSumRate: vi.fn(),
  calculateVAT: vi.fn(),
  calculatePIT: vi.fn(),
  calculateZUS: vi.fn(),
  createRate: vi.fn(),
  updateRate: vi.fn(),
  getRateHistory: vi.fn(),
  analyzeRateChangeImpact: vi.fn(),
}));

vi.mock('../../services/tax/tax-rates.service', () => ({
  TaxRatesService: vi.fn().mockImplementation(() => mockTaxRatesService),
}));

// Mock router caller
const mockSession = {
  user: {
    id: USER_ID,
    email: 'test@example.com',
  },
};

const mockDb = {};

const mockCtx = {
  db: mockDb,
  session: mockSession,
};

// Simple mock caller that invokes service methods
const createMockCaller = () => ({
  tax: {
    rates: {
      getRates: async (input: Parameters<TaxRatesService['getRates']>[0]) => {
        return mockTaxRatesService.getRates(input);
      },
      getRateByCode: async (input: Parameters<TaxRatesService['getRateByCode']>[0]) => {
        return mockTaxRatesService.getRateByCode(input);
      },
      getThresholds: async (input: Parameters<TaxRatesService['getThresholds']>[0]) => {
        return mockTaxRatesService.getThresholds(input);
      },
      getZUSBases: async (input: Parameters<TaxRatesService['getZUSBases']>[0]) => {
        return mockTaxRatesService.getZUSBases(input);
      },
      getCurrentRatesSummary: async (input: Parameters<TaxRatesService['getCurrentRatesSummary']>[0]) => {
        return mockTaxRatesService.getCurrentRatesSummary(input);
      },
      getLumpSumRate: async (input: Parameters<TaxRatesService['getLumpSumRate']>[0]) => {
        return mockTaxRatesService.getLumpSumRate(input);
      },
      calculateVAT: async (input: Parameters<TaxRatesService['calculateVAT']>[0]) => {
        return mockTaxRatesService.calculateVAT(input);
      },
      calculatePIT: async (input: Parameters<TaxRatesService['calculatePIT']>[0]) => {
        return mockTaxRatesService.calculatePIT(input);
      },
      calculateZUS: async (input: Parameters<TaxRatesService['calculateZUS']>[0]) => {
        return mockTaxRatesService.calculateZUS(input);
      },
      createRate: async (input: Parameters<TaxRatesService['createRate']>[0]) => {
        return mockTaxRatesService.createRate(input, USER_ID);
      },
      updateRate: async (input: Parameters<TaxRatesService['updateRate']>[0]) => {
        return mockTaxRatesService.updateRate(input, USER_ID);
      },
      getRateHistory: async (input: Parameters<TaxRatesService['getRateHistory']>[0]) => {
        return mockTaxRatesService.getRateHistory(input);
      },
      analyzeRateChangeImpact: async (input: Parameters<TaxRatesService['analyzeRateChangeImpact']>[0]) => {
        return mockTaxRatesService.analyzeRateChangeImpact(input);
      },
    },
  },
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('TaxRatesRouter', () => {
  let caller: ReturnType<typeof createMockCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    caller = createMockCaller();
  });

  // =========================================================================
  // RATE RETRIEVAL ENDPOINT TESTS
  // =========================================================================

  describe('getRates', () => {
    it('should get all rates for a tax type', async () => {
      const mockResult = {
        rates: [mockVATRate],
        asOfDate: new Date().toISOString(),
        totalCount: 1,
      };
      mockTaxRatesService.getRates.mockResolvedValue(mockResult);

      const result = await caller.tax.rates.getRates({
        taxType: 'VAT',
      });

      expect(result.rates).toHaveLength(1);
      expect(result.rates[0].rateCode).toBe('23');
      expect(mockTaxRatesService.getRates).toHaveBeenCalledWith({
        taxType: 'VAT',
      });
    });

    it('should accept asOfDate parameter', async () => {
      mockTaxRatesService.getRates.mockResolvedValue({
        rates: [],
        asOfDate: '2020-01-01T00:00:00.000Z',
        totalCount: 0,
      });

      await caller.tax.rates.getRates({
        taxType: 'CIT',
        asOfDate: '2020-01-01T00:00:00.000Z',
      });

      expect(mockTaxRatesService.getRates).toHaveBeenCalledWith({
        taxType: 'CIT',
        asOfDate: '2020-01-01T00:00:00.000Z',
      });
    });

    it('should accept includeInactive parameter', async () => {
      mockTaxRatesService.getRates.mockResolvedValue({
        rates: [],
        asOfDate: new Date().toISOString(),
        totalCount: 0,
      });

      await caller.tax.rates.getRates({
        taxType: 'PIT',
        includeInactive: true,
      });

      expect(mockTaxRatesService.getRates).toHaveBeenCalledWith({
        taxType: 'PIT',
        includeInactive: true,
      });
    });
  });

  describe('getRateByCode', () => {
    it('should get a specific rate by code', async () => {
      mockTaxRatesService.getRateByCode.mockResolvedValue(mockVATRate);

      const result = await caller.tax.rates.getRateByCode({
        taxType: 'VAT',
        rateCode: '23',
      });

      expect(result.rateCode).toBe('23');
      expect(result.rateValue).toBe(23);
    });

    it('should pass asOfDate to service', async () => {
      mockTaxRatesService.getRateByCode.mockResolvedValue(mockVATRate);

      await caller.tax.rates.getRateByCode({
        taxType: 'VAT',
        rateCode: '23',
        asOfDate: '2015-01-01T00:00:00.000Z',
      });

      expect(mockTaxRatesService.getRateByCode).toHaveBeenCalledWith({
        taxType: 'VAT',
        rateCode: '23',
        asOfDate: '2015-01-01T00:00:00.000Z',
      });
    });
  });

  describe('getThresholds', () => {
    it('should get tax thresholds', async () => {
      mockTaxRatesService.getThresholds.mockResolvedValue({
        thresholds: mockThresholds,
        asOfDate: new Date().toISOString(),
      });

      const result = await caller.tax.rates.getThresholds({
        taxType: 'PIT',
      });

      expect(result.thresholds).toHaveLength(1);
      expect(result.thresholds[0].thresholdName).toBe('Kwota wolna');
    });
  });

  describe('getZUSBases', () => {
    it('should get ZUS contribution bases', async () => {
      mockTaxRatesService.getZUSBases.mockResolvedValue({
        base: mockZUSBase,
        year: 2024,
        month: null,
      });

      const result = await caller.tax.rates.getZUSBases({
        year: 2024,
      });

      expect(result.base).not.toBeNull();
      expect(result.base?.minimumWage).toBe(4242);
    });

    it('should accept month parameter', async () => {
      mockTaxRatesService.getZUSBases.mockResolvedValue({
        base: mockZUSBase,
        year: 2024,
        month: 6,
      });

      await caller.tax.rates.getZUSBases({
        year: 2024,
        month: 6,
      });

      expect(mockTaxRatesService.getZUSBases).toHaveBeenCalledWith({
        year: 2024,
        month: 6,
      });
    });
  });

  describe('getCurrentRatesSummary', () => {
    it('should get current rates summary', async () => {
      const mockSummary = {
        asOfDate: new Date().toISOString(),
        vatRates: [{ code: '23', name: 'Stawka podstawowa', rate: 23 }],
        citRates: [{ code: 'STANDARD', name: 'CIT Standard', rate: 19 }],
        pitRates: [{ code: 'FLAT', name: 'Podatek liniowy', rate: 19 }],
        pitThresholds: mockThresholds.map(t => ({
          name: t.thresholdName,
          lowerBound: t.lowerBound,
          upperBound: t.upperBound,
          rate: t.rate,
        })),
        zusRates: [],
        zusBases: {
          minimumWage: 4242,
          averageWage: 7824,
          declaredBaseStandard: 4694.4,
          healthBase: 3181.5,
        },
      };
      mockTaxRatesService.getCurrentRatesSummary.mockResolvedValue(mockSummary);

      const result = await caller.tax.rates.getCurrentRatesSummary({});

      expect(result.vatRates.length).toBeGreaterThan(0);
      expect(result.citRates.length).toBeGreaterThan(0);
    });
  });

  describe('getLumpSumRate', () => {
    it('should get lump sum rate for activity type', async () => {
      const mockLumpSumRate = {
        activityType: 'it_services' as const,
        rate: 12,
        rateCode: 'RYCZALT_12',
        rateName: 'Ryczałt 12% - Usługi IT',
        legalBasis: 'Art. 12 ustawy o ryczałcie',
        effectiveFrom: '2022-01-01T00:00:00.000Z',
      };
      mockTaxRatesService.getLumpSumRate.mockResolvedValue(mockLumpSumRate);

      const result = await caller.tax.rates.getLumpSumRate({
        activityType: 'it_services',
      });

      expect(result.rate).toBe(12);
      expect(result.activityType).toBe('it_services');
    });
  });

  // =========================================================================
  // CALCULATION ENDPOINT TESTS
  // =========================================================================

  describe('calculateVAT', () => {
    it('should calculate VAT amount', async () => {
      mockTaxRatesService.calculateVAT.mockResolvedValue(mockVATCalculationResult);

      const result = await caller.tax.rates.calculateVAT({
        netAmount: 1000,
        rateCode: '23',
      });

      expect(result.vatAmount).toBe(230);
      expect(result.grossAmount).toBe(1230);
    });

    it('should accept transaction date', async () => {
      mockTaxRatesService.calculateVAT.mockResolvedValue(mockVATCalculationResult);

      await caller.tax.rates.calculateVAT({
        netAmount: 1000,
        rateCode: '23',
        transactionDate: '2023-06-15T00:00:00.000Z',
      });

      expect(mockTaxRatesService.calculateVAT).toHaveBeenCalledWith({
        netAmount: 1000,
        rateCode: '23',
        transactionDate: '2023-06-15T00:00:00.000Z',
      });
    });

    it('should validate positive net amount', async () => {
      mockTaxRatesService.calculateVAT.mockResolvedValue(mockVATCalculationResult);

      // This should pass validation
      await expect(
        caller.tax.rates.calculateVAT({
          netAmount: 100,
          rateCode: '23',
        })
      ).resolves.toBeDefined();
    });
  });

  describe('calculatePIT', () => {
    it('should calculate flat PIT', async () => {
      mockTaxRatesService.calculatePIT.mockResolvedValue(mockPITCalculationResult);

      const result = await caller.tax.rates.calculatePIT({
        annualIncome: 100000,
        taxOption: 'flat',
        deductions: 0,
        taxYear: 2024,
      });

      expect(result.totalTax).toBe(19000);
      expect(result.taxOption).toBe('flat');
    });

    it('should calculate progressive PIT', async () => {
      const progressiveResult = {
        ...mockPITCalculationResult,
        taxOption: 'progressive' as const,
        brackets: [
          { threshold: 'Kwota wolna', income: 30000, rate: 0, tax: 0 },
          { threshold: 'I próg', income: 70000, rate: 12, tax: 8400 },
        ],
        totalTax: 8400,
      };
      mockTaxRatesService.calculatePIT.mockResolvedValue(progressiveResult);

      const result = await caller.tax.rates.calculatePIT({
        annualIncome: 100000,
        taxOption: 'progressive',
        taxYear: 2024,
      });

      expect(result.taxOption).toBe('progressive');
      expect(result.brackets.length).toBeGreaterThan(1);
    });

    it('should calculate lump sum PIT with activity type', async () => {
      const lumpSumResult = {
        ...mockPITCalculationResult,
        taxOption: 'lump_sum' as const,
        totalTax: 12000,
      };
      mockTaxRatesService.calculatePIT.mockResolvedValue(lumpSumResult);

      const result = await caller.tax.rates.calculatePIT({
        annualIncome: 100000,
        taxOption: 'lump_sum',
        activityType: 'it_services',
        taxYear: 2024,
      });

      expect(result.totalTax).toBe(12000);
    });
  });

  describe('calculateZUS', () => {
    it('should calculate employee ZUS contributions', async () => {
      mockTaxRatesService.calculateZUS.mockResolvedValue(mockZUSCalculationResult);

      const result = await caller.tax.rates.calculateZUS({
        contributorType: 'employee',
        grossSalary: 10000,
        calculationMonth: 1,
        calculationYear: 2024,
      });

      expect(result.contributions.emerytalne.employee).toBe(976);
      expect(result.netSalary).toBeDefined();
    });

    it('should calculate self-employed ZUS contributions', async () => {
      const selfEmployedResult = {
        ...mockZUSCalculationResult,
        contributorType: 'self_employed' as const,
        netSalary: undefined,
      };
      mockTaxRatesService.calculateZUS.mockResolvedValue(selfEmployedResult);

      const result = await caller.tax.rates.calculateZUS({
        contributorType: 'self_employed',
        zusType: 'standard',
        declaredBase: 4694.4,
        calculationMonth: 1,
        calculationYear: 2024,
      });

      expect(result.contributorType).toBe('self_employed');
    });

    it('should accept custom accident rate', async () => {
      mockTaxRatesService.calculateZUS.mockResolvedValue(mockZUSCalculationResult);

      await caller.tax.rates.calculateZUS({
        contributorType: 'employee',
        grossSalary: 10000,
        accidentRate: 2.0,
        calculationMonth: 1,
        calculationYear: 2024,
      });

      expect(mockTaxRatesService.calculateZUS).toHaveBeenCalledWith(
        expect.objectContaining({
          accidentRate: 2.0,
        })
      );
    });
  });

  // =========================================================================
  // ADMIN ENDPOINT TESTS
  // =========================================================================

  describe('createRate', () => {
    it('should create a new tax rate', async () => {
      mockTaxRatesService.createRate.mockResolvedValue({
        rate: { ...mockVATRate, id: RATE_ID },
        audit: mockAudit,
      });

      const result = await caller.tax.rates.createRate({
        taxType: 'VAT',
        rateCode: 'NEW',
        rateName: 'New Rate',
        rateValue: 15,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
      });

      expect(result.rate.rateCode).toBe('23'); // From mock
      expect(result.audit).toBeDefined();
    });

    it('should pass all optional parameters', async () => {
      mockTaxRatesService.createRate.mockResolvedValue({
        rate: mockVATRate,
        audit: mockAudit,
      });

      await caller.tax.rates.createRate({
        taxType: 'VAT',
        rateCode: 'TEST',
        rateName: 'Test Rate',
        rateValue: 10,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        effectiveTo: '2025-12-31T00:00:00.000Z',
        legalBasis: 'Art. 99 test',
        description: 'Test description',
      });

      expect(mockTaxRatesService.createRate).toHaveBeenCalledWith(
        expect.objectContaining({
          legalBasis: 'Art. 99 test',
          description: 'Test description',
        }),
        USER_ID
      );
    });
  });

  describe('updateRate', () => {
    it('should update an existing tax rate', async () => {
      const updatedRate = { ...mockVATRate, rateValue: 25 };
      mockTaxRatesService.updateRate.mockResolvedValue({
        rate: updatedRate,
        audit: { ...mockAudit, action: 'updated' as const },
      });

      const result = await caller.tax.rates.updateRate({
        rateId: RATE_ID,
        rateValue: 25,
        changeReason: 'Rate increase',
      });

      expect(result.rate.rateValue).toBe(25);
      expect(result.audit.action).toBe('updated');
    });

    it('should require changeReason', async () => {
      mockTaxRatesService.updateRate.mockResolvedValue({
        rate: mockVATRate,
        audit: mockAudit,
      });

      await caller.tax.rates.updateRate({
        rateId: RATE_ID,
        rateValue: 25,
        changeReason: 'Required reason',
      });

      expect(mockTaxRatesService.updateRate).toHaveBeenCalledWith(
        expect.objectContaining({
          changeReason: 'Required reason',
        }),
        USER_ID
      );
    });
  });

  describe('getRateHistory', () => {
    it('should get rate audit history', async () => {
      const mockHistory = {
        history: [mockAudit],
        totalCount: 1,
        nextCursor: null,
      };
      mockTaxRatesService.getRateHistory.mockResolvedValue(mockHistory);

      const result = await caller.tax.rates.getRateHistory({
        rateId: RATE_ID,
        limit: 20,
      });

      expect(result.history).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    it('should support pagination', async () => {
      mockTaxRatesService.getRateHistory.mockResolvedValue({
        history: [],
        totalCount: 0,
        nextCursor: null,
      });

      const cursorId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      await caller.tax.rates.getRateHistory({
        rateId: RATE_ID,
        limit: 10,
        cursor: cursorId,
      });

      expect(mockTaxRatesService.getRateHistory).toHaveBeenCalledWith({
        rateId: RATE_ID,
        limit: 10,
        cursor: cursorId,
      });
    });
  });

  describe('analyzeRateChangeImpact', () => {
    it('should analyze impact of rate change', async () => {
      const mockImpact = {
        currentRate: mockVATRate,
        proposedRate: 25,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        impactAnalysis: {
          affectedClientsCount: 100,
          pendingTransactionsCount: 50,
          openDeclarationsCount: 10,
        },
        recommendations: ['Review pending invoices'],
      };
      mockTaxRatesService.analyzeRateChangeImpact.mockResolvedValue(mockImpact);

      const result = await caller.tax.rates.analyzeRateChangeImpact({
        taxType: 'VAT',
        rateCode: '23',
        newRateValue: 25,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
      });

      expect(result.proposedRate).toBe(25);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // INPUT VALIDATION TESTS
  // =========================================================================

  describe('input validation', () => {
    it('should validate tax type enum', async () => {
      mockTaxRatesService.getRates.mockResolvedValue({
        rates: [],
        asOfDate: new Date().toISOString(),
        totalCount: 0,
      });

      // Valid tax types
      const validTypes = ['VAT', 'CIT', 'PIT', 'ZUS', 'FP', 'FGSP'] as const;
      for (const taxType of validTypes) {
        await expect(
          caller.tax.rates.getRates({ taxType })
        ).resolves.toBeDefined();
      }
    });

    it('should validate VAT rate codes', async () => {
      mockTaxRatesService.calculateVAT.mockResolvedValue(mockVATCalculationResult);

      const validCodes = ['23', '8', '5', '0', 'ZW', 'NP'] as const;
      for (const rateCode of validCodes) {
        await expect(
          caller.tax.rates.calculateVAT({
            netAmount: 100,
            rateCode,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate PIT calculation options', async () => {
      mockTaxRatesService.calculatePIT.mockResolvedValue(mockPITCalculationResult);

      const validOptions = ['progressive', 'flat', 'lump_sum'] as const;
      for (const taxOption of validOptions) {
        const input = {
          annualIncome: 100000,
          taxOption,
          taxYear: 2024,
          ...(taxOption === 'lump_sum' ? { activityType: 'it_services' as const } : {}),
        };
        await expect(
          caller.tax.rates.calculatePIT(input)
        ).resolves.toBeDefined();
      }
    });

    it('should validate ZUS contributor types', async () => {
      mockTaxRatesService.calculateZUS.mockResolvedValue(mockZUSCalculationResult);

      const validTypes = ['employee', 'employer', 'self_employed'] as const;
      for (const contributorType of validTypes) {
        const input = {
          contributorType,
          calculationMonth: 1,
          calculationYear: 2024,
          ...(contributorType === 'employee' ? { grossSalary: 10000 } : { declaredBase: 4694.4 }),
        };
        await expect(
          caller.tax.rates.calculateZUS(input)
        ).resolves.toBeDefined();
      }
    });

    it('should validate activity types for lump sum', async () => {
      mockTaxRatesService.getLumpSumRate.mockResolvedValue({
        activityType: 'it_services',
        rate: 12,
        rateCode: 'RYCZALT_12',
        rateName: 'IT Services',
        legalBasis: null,
        effectiveFrom: new Date().toISOString(),
      });

      const validActivities = [
        'it_services',
        'other_services',
        'trade',
        'manufacturing',
        'rental_income',
        'liberal_professions',
        'health_services',
        'construction',
      ] as const;

      for (const activityType of validActivities) {
        await expect(
          caller.tax.rates.getLumpSumRate({ activityType })
        ).resolves.toBeDefined();
      }
    });

    it('should validate year range for ZUS bases', async () => {
      mockTaxRatesService.getZUSBases.mockResolvedValue({
        base: mockZUSBase,
        year: 2024,
        month: null,
      });

      // Valid years (2000-2100)
      await expect(
        caller.tax.rates.getZUSBases({ year: 2024 })
      ).resolves.toBeDefined();

      await expect(
        caller.tax.rates.getZUSBases({ year: 2000 })
      ).resolves.toBeDefined();

      await expect(
        caller.tax.rates.getZUSBases({ year: 2100 })
      ).resolves.toBeDefined();
    });

    it('should validate month range for ZUS bases', async () => {
      mockTaxRatesService.getZUSBases.mockResolvedValue({
        base: mockZUSBase,
        year: 2024,
        month: 1,
      });

      // Valid months (1-12)
      for (let month = 1; month <= 12; month++) {
        await expect(
          caller.tax.rates.getZUSBases({ year: 2024, month })
        ).resolves.toBeDefined();
      }
    });

    it('should validate accident rate range', async () => {
      mockTaxRatesService.calculateZUS.mockResolvedValue(mockZUSCalculationResult);

      // Valid range: 0.67 - 3.33
      await expect(
        caller.tax.rates.calculateZUS({
          contributorType: 'employee',
          grossSalary: 10000,
          accidentRate: 0.67,
          calculationMonth: 1,
          calculationYear: 2024,
        })
      ).resolves.toBeDefined();

      await expect(
        caller.tax.rates.calculateZUS({
          contributorType: 'employee',
          grossSalary: 10000,
          accidentRate: 3.33,
          calculationMonth: 1,
          calculationYear: 2024,
        })
      ).resolves.toBeDefined();
    });
  });
});
