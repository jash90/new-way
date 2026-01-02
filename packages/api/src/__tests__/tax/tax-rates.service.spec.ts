// TAX-002: Tax Rates Service Tests
// Tests for Polish tax rates management: VAT, CIT, PIT, ZUS, FP, FGSP

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { TaxRatesService } from '../../services/tax/tax-rates.service';

// ===========================================================================
// MOCK DATA
// ===========================================================================

const USER_ID = '11111111-1111-1111-1111-111111111111';
const RATE_ID = '22222222-2222-2222-2222-222222222222';

const mockVATRates = [
  {
    id: '33333333-3333-3333-3333-333333333331',
    taxType: 'VAT',
    rateCode: '23',
    rateName: 'Stawka podstawowa',
    rateValue: 23.0,
    appliesTo: null,
    activityType: null,
    effectiveFrom: new Date('2011-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 41 ust. 1 ustawy o VAT',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '33333333-3333-3333-3333-333333333332',
    taxType: 'VAT',
    rateCode: '8',
    rateName: 'Stawka obniżona',
    rateValue: 8.0,
    appliesTo: null,
    activityType: null,
    effectiveFrom: new Date('2011-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 41 ust. 2 ustawy o VAT',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    taxType: 'VAT',
    rateCode: '5',
    rateName: 'Stawka obniżona',
    rateValue: 5.0,
    appliesTo: null,
    activityType: null,
    effectiveFrom: new Date('2011-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 41 ust. 2a ustawy o VAT',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '33333333-3333-3333-3333-333333333334',
    taxType: 'VAT',
    rateCode: 'ZW',
    rateName: 'Zwolniony',
    rateValue: 0.0,
    appliesTo: null,
    activityType: null,
    effectiveFrom: new Date('2011-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 43 ustawy o VAT',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
];

const mockCITRates = [
  {
    id: '44444444-4444-4444-4444-444444444441',
    taxType: 'CIT',
    rateCode: 'STANDARD',
    rateName: 'Stawka podstawowa CIT',
    rateValue: 19.0,
    appliesTo: null,
    activityType: null,
    effectiveFrom: new Date('2004-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 19 ust. 1 ustawy o CIT',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '44444444-4444-4444-4444-444444444442',
    taxType: 'CIT',
    rateCode: 'SMALL',
    rateName: 'Mały podatnik CIT',
    rateValue: 9.0,
    appliesTo: null,
    activityType: null,
    effectiveFrom: new Date('2019-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 19 ust. 1 pkt 2 ustawy o CIT',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
];

const mockPITRates = [
  {
    id: '55555555-5555-5555-5555-555555555551',
    taxType: 'PIT',
    rateCode: 'FLAT',
    rateName: 'Podatek liniowy',
    rateValue: 19.0,
    appliesTo: null,
    activityType: null,
    effectiveFrom: new Date('2004-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 30c ust. 1 ustawy o PIT',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
];

const mockZUSRates = [
  {
    id: '66666666-6666-6666-6666-666666666661',
    taxType: 'ZUS',
    rateCode: 'EMERY_EE',
    rateName: 'Emerytalne (pracownik)',
    rateValue: 9.76,
    appliesTo: 'employee',
    activityType: null,
    effectiveFrom: new Date('1999-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 22 ust. 1 pkt 1 ustawy o SUS',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '66666666-6666-6666-6666-666666666662',
    taxType: 'ZUS',
    rateCode: 'EMERY_ER',
    rateName: 'Emerytalne (pracodawca)',
    rateValue: 9.76,
    appliesTo: 'employer',
    activityType: null,
    effectiveFrom: new Date('1999-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 22 ust. 1 pkt 1 ustawy o SUS',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '66666666-6666-6666-6666-666666666663',
    taxType: 'ZUS',
    rateCode: 'RENT_EE',
    rateName: 'Rentowe (pracownik)',
    rateValue: 1.5,
    appliesTo: 'employee',
    activityType: null,
    effectiveFrom: new Date('2012-02-01'),
    effectiveTo: null,
    legalBasis: 'Art. 22 ust. 1 pkt 2 ustawy o SUS',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '66666666-6666-6666-6666-666666666664',
    taxType: 'ZUS',
    rateCode: 'RENT_ER',
    rateName: 'Rentowe (pracodawca)',
    rateValue: 6.5,
    appliesTo: 'employer',
    activityType: null,
    effectiveFrom: new Date('2012-02-01'),
    effectiveTo: null,
    legalBasis: 'Art. 22 ust. 1 pkt 2 ustawy o SUS',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '66666666-6666-6666-6666-666666666665',
    taxType: 'ZUS',
    rateCode: 'CHOR_EE',
    rateName: 'Chorobowe (pracownik)',
    rateValue: 2.45,
    appliesTo: 'employee',
    activityType: null,
    effectiveFrom: new Date('1999-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 22 ust. 1 pkt 3 ustawy o SUS',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    taxType: 'ZUS',
    rateCode: 'ZDROW',
    rateName: 'Zdrowotne',
    rateValue: 9.0,
    appliesTo: 'all',
    activityType: null,
    effectiveFrom: new Date('2022-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 79 ust. 1 ustawy o świadczeniach',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: USER_ID,
  },
];

const mockPITThresholds = [
  {
    id: '77777777-7777-7777-7777-777777777771',
    taxType: 'PIT',
    thresholdName: 'Kwota wolna',
    lowerBound: 0,
    upperBound: 30000,
    rate: 0,
    baseAmount: 0,
    effectiveFrom: new Date('2022-07-01'),
    effectiveTo: null,
    legalBasis: 'Art. 27 ust. 1 ustawy o PIT',
    createdAt: new Date(),
  },
  {
    id: '77777777-7777-7777-7777-777777777772',
    taxType: 'PIT',
    thresholdName: 'I próg podatkowy',
    lowerBound: 30000.01,
    upperBound: 120000,
    rate: 12,
    baseAmount: 0,
    effectiveFrom: new Date('2022-07-01'),
    effectiveTo: null,
    legalBasis: 'Art. 27 ust. 1 ustawy o PIT',
    createdAt: new Date(),
  },
  {
    id: '77777777-7777-7777-7777-777777777773',
    taxType: 'PIT',
    thresholdName: 'II próg podatkowy',
    lowerBound: 120000.01,
    upperBound: null,
    rate: 32,
    baseAmount: 10800,
    effectiveFrom: new Date('2009-01-01'),
    effectiveTo: null,
    legalBasis: 'Art. 27 ust. 1 ustawy o PIT',
    createdAt: new Date(),
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
  effectiveFrom: new Date('2024-01-01'),
  effectiveTo: null,
  createdAt: new Date(),
};

// ===========================================================================
// MOCK SERVICE SETUP
// ===========================================================================

const mockTaxRateOps = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

const mockTaxThresholdOps = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

const mockZUSContributionBaseOps = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

const mockTaxRateAuditOps = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

const mockDb = {
  taxRate: mockTaxRateOps,
  taxThreshold: mockTaxThresholdOps,
  zusContributionBase: mockZUSContributionBaseOps,
  taxRateAudit: mockTaxRateAuditOps,
} as unknown as Parameters<typeof TaxRatesService.prototype.getRates>[0] extends { db: infer T } ? T : never;

// ===========================================================================
// TESTS
// ===========================================================================

describe('TaxRatesService', () => {
  let service: TaxRatesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaxRatesService(mockDb as never);
  });

  // =========================================================================
  // RATE RETRIEVAL TESTS
  // =========================================================================

  describe('getRates', () => {
    it('should get all VAT rates', async () => {
      mockTaxRateOps.findMany.mockResolvedValue(mockVATRates);

      const result = await service.getRates({
        taxType: 'VAT',
      });

      expect(result.rates).toHaveLength(4);
      expect(result.totalCount).toBe(4);
      expect(result.rates[0].rateCode).toBe('23');
    });

    it('should filter rates by date', async () => {
      mockTaxRateOps.findMany.mockResolvedValue([mockVATRates[0]]);

      const result = await service.getRates({
        taxType: 'VAT',
        asOfDate: '2020-01-01T00:00:00.000Z',
      });

      expect(mockTaxRateOps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            taxType: 'VAT',
            effectiveFrom: expect.any(Object),
          }),
        })
      );
    });

    it('should include inactive rates when requested', async () => {
      mockTaxRateOps.findMany.mockResolvedValue(mockVATRates);

      await service.getRates({
        taxType: 'VAT',
        includeInactive: true,
      });

      expect(mockTaxRateOps.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it('should get CIT rates', async () => {
      mockTaxRateOps.findMany.mockResolvedValue(mockCITRates);

      const result = await service.getRates({
        taxType: 'CIT',
      });

      expect(result.rates).toHaveLength(2);
      expect(result.rates.find(r => r.rateCode === 'STANDARD')?.rateValue).toBe(19);
      expect(result.rates.find(r => r.rateCode === 'SMALL')?.rateValue).toBe(9);
    });
  });

  describe('getRateByCode', () => {
    it('should get a specific VAT rate', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[0]);

      const result = await service.getRateByCode({
        taxType: 'VAT',
        rateCode: '23',
      });

      expect(result.rateCode).toBe('23');
      expect(result.rateValue).toBe(23);
    });

    it('should throw NOT_FOUND for non-existent rate', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(null);

      await expect(
        service.getRateByCode({
          taxType: 'VAT',
          rateCode: '99',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should respect asOfDate parameter', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[0]);

      await service.getRateByCode({
        taxType: 'VAT',
        rateCode: '23',
        asOfDate: '2015-01-01T00:00:00.000Z',
      });

      expect(mockTaxRateOps.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveFrom: { lte: expect.any(Date) },
          }),
        })
      );
    });
  });

  describe('getThresholds', () => {
    it('should get PIT thresholds', async () => {
      mockTaxThresholdOps.findMany.mockResolvedValue(mockPITThresholds);

      const result = await service.getThresholds({
        taxType: 'PIT',
      });

      expect(result.thresholds).toHaveLength(3);
      expect(result.thresholds[0].thresholdName).toBe('Kwota wolna');
    });

    it('should order thresholds by lower bound', async () => {
      mockTaxThresholdOps.findMany.mockResolvedValue(mockPITThresholds);

      await service.getThresholds({
        taxType: 'PIT',
      });

      expect(mockTaxThresholdOps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { lowerBound: 'asc' },
          ]),
        })
      );
    });
  });

  describe('getZUSBases', () => {
    it('should get ZUS bases for a year', async () => {
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(mockZUSBase);

      const result = await service.getZUSBases({
        year: 2024,
      });

      expect(result.base).not.toBeNull();
      expect(result.base?.minimumWage).toBe(4242);
    });

    it('should return null for non-existent year', async () => {
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(null);

      const result = await service.getZUSBases({
        year: 2050,
      });

      expect(result.base).toBeNull();
    });

    it('should filter by month when provided', async () => {
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(mockZUSBase);

      await service.getZUSBases({
        year: 2024,
        month: 6,
      });

      expect(mockZUSContributionBaseOps.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2024,
          }),
        })
      );
    });
  });

  // =========================================================================
  // VAT CALCULATION TESTS
  // =========================================================================

  describe('calculateVAT', () => {
    it('should calculate 23% VAT correctly', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[0]);

      const result = await service.calculateVAT({
        netAmount: 1000,
        rateCode: '23',
      });

      expect(result.vatAmount).toBe(230);
      expect(result.grossAmount).toBe(1230);
      expect(result.vatRate).toBe(23);
    });

    it('should calculate 8% VAT correctly', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[1]);

      const result = await service.calculateVAT({
        netAmount: 500,
        rateCode: '8',
      });

      expect(result.vatAmount).toBe(40);
      expect(result.grossAmount).toBe(540);
    });

    it('should calculate 5% VAT correctly', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[2]);

      const result = await service.calculateVAT({
        netAmount: 200,
        rateCode: '5',
      });

      expect(result.vatAmount).toBe(10);
      expect(result.grossAmount).toBe(210);
    });

    it('should handle exempt (ZW) rate', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[3]);

      const result = await service.calculateVAT({
        netAmount: 1000,
        rateCode: 'ZW',
      });

      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(1000);
    });

    it('should round VAT to 2 decimal places', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[0]);

      const result = await service.calculateVAT({
        netAmount: 123.45,
        rateCode: '23',
      });

      // 123.45 * 0.23 = 28.3935 → 28.39
      expect(result.vatAmount).toBe(28.39);
    });

    it('should use transaction date for rate lookup', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[0]);

      await service.calculateVAT({
        netAmount: 100,
        rateCode: '23',
        transactionDate: '2023-06-15T00:00:00.000Z',
      });

      expect(mockTaxRateOps.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveFrom: { lte: expect.any(Date) },
          }),
        })
      );
    });
  });

  // =========================================================================
  // PIT CALCULATION TESTS
  // =========================================================================

  describe('calculatePIT', () => {
    describe('flat rate', () => {
      it('should calculate 19% flat PIT correctly', async () => {
        mockTaxRateOps.findFirst.mockResolvedValue(mockPITRates[0]);

        const result = await service.calculatePIT({
          annualIncome: 100000,
          taxOption: 'flat',
          deductions: 0,
          taxYear: 2024,
        });

        expect(result.totalTax).toBe(19000);
        expect(result.effectiveRate).toBeCloseTo(19);
      });

      it('should handle deductions in flat rate', async () => {
        mockTaxRateOps.findFirst.mockResolvedValue(mockPITRates[0]);

        const result = await service.calculatePIT({
          annualIncome: 100000,
          taxOption: 'flat',
          deductions: 10000,
          taxYear: 2024,
        });

        expect(result.taxableIncome).toBe(90000);
        expect(result.totalTax).toBe(17100); // 90000 * 0.19
      });
    });

    describe('progressive rate', () => {
      it('should calculate progressive PIT with tax-free amount', async () => {
        mockTaxThresholdOps.findMany.mockResolvedValue(mockPITThresholds);

        const result = await service.calculatePIT({
          annualIncome: 50000,
          taxOption: 'progressive',
          deductions: 0,
          taxYear: 2024,
        });

        // 0-30000: 0%, 30001-50000: 12%
        // (50000-30000) * 0.12 = 2400
        expect(result.totalTax).toBe(2400);
      });

      it('should calculate PIT in second bracket', async () => {
        mockTaxThresholdOps.findMany.mockResolvedValue(mockPITThresholds);

        const result = await service.calculatePIT({
          annualIncome: 150000,
          taxOption: 'progressive',
          deductions: 0,
          taxYear: 2024,
        });

        // 0-30000: 0 PLN
        // 30001-120000: (89999.99) * 0.12 ≈ 10,800 PLN
        // 120001-150000: (29999.99) * 0.32 ≈ 9,600 PLN
        // Total: ~20,400 PLN
        expect(result.totalTax).toBeCloseTo(20400, 0);
      });

      it('should include multiple brackets in result', async () => {
        mockTaxThresholdOps.findMany.mockResolvedValue(mockPITThresholds);

        const result = await service.calculatePIT({
          annualIncome: 150000,
          taxOption: 'progressive',
          deductions: 0,
          taxYear: 2024,
        });

        expect(result.brackets.length).toBeGreaterThan(1);
      });

      it('should throw NOT_FOUND if no thresholds exist', async () => {
        mockTaxThresholdOps.findMany.mockResolvedValue([]);

        await expect(
          service.calculatePIT({
            annualIncome: 100000,
            taxOption: 'progressive',
            deductions: 0,
            taxYear: 2030,
          })
        ).rejects.toThrow(TRPCError);
      });
    });

    describe('lump sum rate', () => {
      it('should calculate lump sum for IT services (12%)', async () => {
        const result = await service.calculatePIT({
          annualIncome: 100000,
          taxOption: 'lump_sum',
          activityType: 'it_services',
          deductions: 0,
          taxYear: 2024,
        });

        expect(result.totalTax).toBe(12000);
        expect(result.effectiveRate).toBeCloseTo(12);
      });

      it('should calculate lump sum for trade (3%)', async () => {
        const result = await service.calculatePIT({
          annualIncome: 100000,
          taxOption: 'lump_sum',
          activityType: 'trade',
          deductions: 0,
          taxYear: 2024,
        });

        expect(result.totalTax).toBe(3000);
      });

      it('should calculate lump sum for rental income (8.5%)', async () => {
        const result = await service.calculatePIT({
          annualIncome: 100000,
          taxOption: 'lump_sum',
          activityType: 'rental_income',
          deductions: 0,
          taxYear: 2024,
        });

        expect(result.totalTax).toBe(8500);
      });

      it('should throw error if activity type missing for lump sum', async () => {
        await expect(
          service.calculatePIT({
            annualIncome: 100000,
            taxOption: 'lump_sum',
            deductions: 0,
            taxYear: 2024,
          })
        ).rejects.toThrow(TRPCError);
      });
    });

    it('should calculate effective rate correctly', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockPITRates[0]);

      const result = await service.calculatePIT({
        annualIncome: 100000,
        taxOption: 'flat',
        deductions: 20000,
        taxYear: 2024,
      });

      // Tax: 80000 * 0.19 = 15200
      // Effective rate: 15200 / 100000 * 100 = 15.2%
      expect(result.effectiveRate).toBeCloseTo(15.2);
    });
  });

  // =========================================================================
  // ZUS CALCULATION TESTS
  // =========================================================================

  describe('calculateZUS', () => {
    beforeEach(() => {
      mockTaxRateOps.findMany.mockResolvedValue(mockZUSRates);
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(mockZUSBase);
    });

    describe('employee contributions', () => {
      it('should calculate employee ZUS contributions', async () => {
        const result = await service.calculateZUS({
          contributorType: 'employee',
          grossSalary: 10000,
          calculationMonth: 1,
          calculationYear: 2024,
        });

        expect(result.contributions.emerytalne.employee).toBe(976); // 10000 * 0.0976
        expect(result.contributions.rentowe.employee).toBe(150); // 10000 * 0.015
        expect(result.contributions.chorobowe.employee).toBe(245); // 10000 * 0.0245
        expect(result.totalEmployee).toBeGreaterThan(0);
      });

      it('should calculate net salary after ZUS', async () => {
        const result = await service.calculateZUS({
          contributorType: 'employee',
          grossSalary: 10000,
          calculationMonth: 1,
          calculationYear: 2024,
        });

        expect(result.netSalary).toBeDefined();
        expect(result.netSalary!).toBeLessThan(10000);
      });

      it('should throw error if gross salary missing for employee', async () => {
        await expect(
          service.calculateZUS({
            contributorType: 'employee',
            calculationMonth: 1,
            calculationYear: 2024,
          })
        ).rejects.toThrow(TRPCError);
      });
    });

    describe('employer contributions', () => {
      it('should calculate employer ZUS contributions', async () => {
        const result = await service.calculateZUS({
          contributorType: 'employee',
          grossSalary: 10000,
          calculationMonth: 1,
          calculationYear: 2024,
        });

        expect(result.contributions.emerytalne.employer).toBe(976); // 10000 * 0.0976
        expect(result.contributions.rentowe.employer).toBe(650); // 10000 * 0.065
        expect(result.totalEmployer).toBeGreaterThan(0);
      });

      it('should use custom accident rate', async () => {
        const result = await service.calculateZUS({
          contributorType: 'employee',
          grossSalary: 10000,
          accidentRate: 2.0,
          calculationMonth: 1,
          calculationYear: 2024,
        });

        expect(result.contributions.wypadkowe.employer).toBe(200); // 10000 * 0.02
      });
    });

    describe('self-employed contributions', () => {
      it('should calculate standard self-employed ZUS', async () => {
        const result = await service.calculateZUS({
          contributorType: 'self_employed',
          zusType: 'standard',
          declaredBase: 4694.4,
          calculationMonth: 1,
          calculationYear: 2024,
        });

        expect(result.contributionBase).toBe(4694.4);
        expect(result.totalContributions).toBeGreaterThan(1000);
      });

      it('should calculate preferential ZUS', async () => {
        const result = await service.calculateZUS({
          contributorType: 'self_employed',
          zusType: 'preferential',
          calculationMonth: 1,
          calculationYear: 2024,
        });

        // Preferential should use lower base
        expect(result.contributionBase).toBeLessThan(4694.4);
      });
    });

    it('should throw NOT_FOUND if ZUS bases not found', async () => {
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(null);

      await expect(
        service.calculateZUS({
          contributorType: 'employee',
          grossSalary: 10000,
          calculationMonth: 1,
          calculationYear: 2050,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // ADMIN OPERATIONS TESTS
  // =========================================================================

  describe('createRate', () => {
    it('should create a new tax rate', async () => {
      const newRate = {
        ...mockVATRates[0],
        id: RATE_ID,
        rateCode: 'NEW_RATE',
      };
      mockTaxRateOps.create.mockResolvedValue(newRate);
      mockTaxRateAuditOps.create.mockResolvedValue({
        id: '99999999-9999-9999-9999-999999999999',
        rateId: RATE_ID,
        action: 'created',
        newValue: newRate,
        oldValue: null,
        changeReason: null,
        userId: USER_ID,
        createdAt: new Date(),
      });

      const result = await service.createRate(
        {
          taxType: 'VAT',
          rateCode: 'NEW_RATE',
          rateName: 'New Rate',
          rateValue: 15,
          effectiveFrom: '2025-01-01T00:00:00.000Z',
        },
        USER_ID
      );

      expect(result.rate.rateCode).toBe('NEW_RATE');
      expect(result.audit.action).toBe('created');
    });

    it('should create audit entry on rate creation', async () => {
      const newRate = { ...mockVATRates[0], id: RATE_ID };
      mockTaxRateOps.create.mockResolvedValue(newRate);
      mockTaxRateAuditOps.create.mockResolvedValue({
        id: '99999999-9999-9999-9999-999999999999',
        rateId: RATE_ID,
        action: 'created',
        newValue: {},
        oldValue: null,
        changeReason: null,
        userId: USER_ID,
        createdAt: new Date(),
      });

      await service.createRate(
        {
          taxType: 'VAT',
          rateCode: 'TEST',
          rateName: 'Test',
          rateValue: 10,
          effectiveFrom: '2025-01-01T00:00:00.000Z',
        },
        USER_ID
      );

      expect(mockTaxRateAuditOps.create).toHaveBeenCalled();
    });
  });

  describe('updateRate', () => {
    it('should update an existing tax rate', async () => {
      mockTaxRateOps.findUnique.mockResolvedValue(mockVATRates[0]);
      const updatedRate = { ...mockVATRates[0], rateValue: 25 };
      mockTaxRateOps.update.mockResolvedValue(updatedRate);
      mockTaxRateAuditOps.create.mockResolvedValue({
        id: '99999999-9999-9999-9999-999999999999',
        rateId: mockVATRates[0].id,
        action: 'updated',
        oldValue: mockVATRates[0],
        newValue: updatedRate,
        changeReason: 'Rate increase',
        userId: USER_ID,
        createdAt: new Date(),
      });

      const result = await service.updateRate(
        {
          rateId: mockVATRates[0].id,
          rateValue: 25,
          changeReason: 'Rate increase',
        },
        USER_ID
      );

      expect(result.rate.rateValue).toBe(25);
      expect(result.audit.action).toBe('updated');
    });

    it('should throw NOT_FOUND for non-existent rate', async () => {
      mockTaxRateOps.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRate(
          {
            rateId: '00000000-0000-0000-0000-000000000000',
            rateValue: 25,
            changeReason: 'Test',
          },
          USER_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should create audit entry with old and new values', async () => {
      mockTaxRateOps.findUnique.mockResolvedValue(mockVATRates[0]);
      mockTaxRateOps.update.mockResolvedValue({ ...mockVATRates[0], rateValue: 25 });
      mockTaxRateAuditOps.create.mockResolvedValue({
        id: '99999999-9999-9999-9999-999999999999',
        rateId: mockVATRates[0].id,
        action: 'updated',
        oldValue: mockVATRates[0],
        newValue: { ...mockVATRates[0], rateValue: 25 },
        changeReason: 'Test change',
        userId: USER_ID,
        createdAt: new Date(),
      });

      await service.updateRate(
        {
          rateId: mockVATRates[0].id,
          rateValue: 25,
          changeReason: 'Test change',
        },
        USER_ID
      );

      expect(mockTaxRateAuditOps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            changeReason: 'Test change',
          }),
        })
      );
    });
  });

  describe('getRateHistory', () => {
    it('should get rate audit history', async () => {
      const mockHistory = [
        {
          id: '99999999-9999-9999-9999-999999999991',
          rateId: RATE_ID,
          action: 'updated',
          oldValue: { rateValue: 20 },
          newValue: { rateValue: 23 },
          changeReason: 'Rate increase',
          userId: USER_ID,
          createdAt: new Date(),
        },
        {
          id: '99999999-9999-9999-9999-999999999992',
          rateId: RATE_ID,
          action: 'created',
          oldValue: null,
          newValue: { rateValue: 20 },
          changeReason: null,
          userId: USER_ID,
          createdAt: new Date(Date.now() - 86400000),
        },
      ];
      mockTaxRateAuditOps.findMany.mockResolvedValue(mockHistory);
      mockTaxRateAuditOps.count.mockResolvedValue(2);

      const result = await service.getRateHistory({
        rateId: RATE_ID,
        limit: 20,
      });

      expect(result.history).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should support pagination with cursor', async () => {
      mockTaxRateAuditOps.findMany.mockResolvedValue([]);
      mockTaxRateAuditOps.count.mockResolvedValue(0);

      await service.getRateHistory({
        rateId: RATE_ID,
        limit: 10,
        cursor: '99999999-9999-9999-9999-999999999999',
      });

      expect(mockTaxRateAuditOps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { lt: '99999999-9999-9999-9999-999999999999' },
          }),
        })
      );
    });
  });

  // =========================================================================
  // IMPACT ANALYSIS TESTS
  // =========================================================================

  describe('analyzeRateChangeImpact', () => {
    it('should analyze impact of rate change', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[0]);

      const result = await service.analyzeRateChangeImpact({
        taxType: 'VAT',
        rateCode: '23',
        newRateValue: 25,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
      });

      expect(result.currentRate).not.toBeNull();
      expect(result.proposedRate).toBe(25);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle rate increase recommendations', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(mockVATRates[0]);

      const result = await service.analyzeRateChangeImpact({
        taxType: 'VAT',
        rateCode: '23',
        newRateValue: 25,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
      });

      expect(result.recommendations.some(r => r.includes('increase'))).toBe(true);
    });

    it('should handle new rate creation', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(null);

      const result = await service.analyzeRateChangeImpact({
        taxType: 'VAT',
        rateCode: 'NEW',
        newRateValue: 15,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
      });

      expect(result.currentRate).toBeNull();
    });
  });

  // =========================================================================
  // LUMP SUM RATE TESTS
  // =========================================================================

  describe('getLumpSumRate', () => {
    it('should get lump sum rate for IT services', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(null);

      const result = await service.getLumpSumRate({
        activityType: 'it_services',
      });

      expect(result.rate).toBe(12);
      expect(result.rateCode).toBe('RYCZALT_12');
    });

    it('should get lump sum rate for trade', async () => {
      mockTaxRateOps.findFirst.mockResolvedValue(null);

      const result = await service.getLumpSumRate({
        activityType: 'trade',
      });

      expect(result.rate).toBe(3);
    });

    it('should prefer database rate over static config', async () => {
      const dbRate = {
        ...mockPITRates[0],
        rateCode: 'RYCZALT_12',
        rateValue: 15, // Different from static config
      };
      mockTaxRateOps.findFirst.mockResolvedValue(dbRate);

      const result = await service.getLumpSumRate({
        activityType: 'it_services',
      });

      expect(result.rate).toBe(15); // From DB, not static 12%
    });
  });

  // =========================================================================
  // SUMMARY TESTS
  // =========================================================================

  describe('getCurrentRatesSummary', () => {
    it('should get current rates summary', async () => {
      mockTaxRateOps.findMany.mockResolvedValue([
        ...mockVATRates,
        ...mockCITRates,
        ...mockPITRates,
        ...mockZUSRates,
      ]);
      mockTaxThresholdOps.findMany.mockResolvedValue(mockPITThresholds);
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(mockZUSBase);

      const result = await service.getCurrentRatesSummary({});

      expect(result.vatRates.length).toBeGreaterThan(0);
      expect(result.citRates.length).toBeGreaterThan(0);
      expect(result.pitRates.length).toBeGreaterThan(0);
      expect(result.zusRates.length).toBeGreaterThan(0);
      expect(result.pitThresholds.length).toBeGreaterThan(0);
      expect(result.zusBases).not.toBeNull();
    });

    it('should group rates by type', async () => {
      mockTaxRateOps.findMany.mockResolvedValue([
        ...mockVATRates,
        ...mockCITRates,
      ]);
      mockTaxThresholdOps.findMany.mockResolvedValue([]);
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentRatesSummary({});

      expect(result.vatRates.length).toBe(4);
      expect(result.citRates.length).toBe(2);
    });

    it('should handle missing ZUS bases', async () => {
      mockTaxRateOps.findMany.mockResolvedValue([]);
      mockTaxThresholdOps.findMany.mockResolvedValue([]);
      mockZUSContributionBaseOps.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentRatesSummary({});

      expect(result.zusBases).toBeNull();
    });
  });
});
