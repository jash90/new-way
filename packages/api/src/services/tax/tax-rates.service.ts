// TAX-002: Tax Rates and Rules Management Service
// Manages Polish tax rates for VAT, CIT, PIT, ZUS, FP, FGSP

import { TRPCError } from '@trpc/server';
import Decimal from 'decimal.js';
import type {
  TaxType,
  TaxRate,
  TaxThreshold,
  ZUSContributionBase,
  TaxRateAudit,
  GetRatesInput,
  GetRateByCodeInput,
  GetRatesResult,
  GetThresholdsInput,
  GetThresholdsResult,
  GetZUSBasesInput,
  GetZUSBasesResult,
  CalculateVATInput,
  CalculateVATResult,
  CalculatePITInput,
  CalculatePITResult,
  CalculateZUSInput,
  CalculateZUSResult,
  UpdateTaxRateInput,
  UpdateTaxRateResult,
  CreateTaxRateInput,
  CreateTaxRateResult,
  GetRateHistoryInput,
  GetRateHistoryResult,
  AnalyzeRateChangeImpactInput,
  AnalyzeRateChangeImpactResult,
  GetLumpSumRateInput,
  GetLumpSumRateResult,
  GetCurrentRatesSummaryInput,
  GetCurrentRatesSummaryResult,
  ActivityType,
  PITBracketResult,
} from '@ksiegowacrm/shared';
import type { PrismaClient } from '@prisma/client';

/**
 * TaxRatesService (TAX-002)
 * Manages Polish tax rates for VAT, CIT, PIT, ZUS, FP, FGSP
 *
 * TODO: This service requires the following Prisma schema additions:
 * - TaxRate model for tax rate definitions
 * - TaxThreshold model for progressive tax thresholds
 * - ZUSContributionBase model for ZUS contribution bases
 * - TaxRateAudit model for rate change history
 *
 * Calculation methods use default rates. DB-dependent methods throw NotImplementedError.
 */

class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model which is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

// ===========================================================================
// CONSTANTS - POLISH TAX RATES (Default seed data)
// ===========================================================================

const LUMP_SUM_RATES: Record<ActivityType, { rate: number; rateCode: string; rateName: string }> = {
  it_services: { rate: 12, rateCode: 'RYCZALT_12', rateName: 'Ryczałt 12% - Usługi IT' },
  other_services: { rate: 8.5, rateCode: 'RYCZALT_8_5', rateName: 'Ryczałt 8,5% - Usługi' },
  trade: { rate: 3, rateCode: 'RYCZALT_3', rateName: 'Ryczałt 3% - Handel' },
  manufacturing: { rate: 5.5, rateCode: 'RYCZALT_5_5', rateName: 'Ryczałt 5,5% - Produkcja' },
  rental_income: { rate: 8.5, rateCode: 'RYCZALT_8_5', rateName: 'Ryczałt 8,5% - Najem' },
  liberal_professions: { rate: 17, rateCode: 'RYCZALT_17', rateName: 'Ryczałt 17% - Wolne zawody' },
  health_services: { rate: 14, rateCode: 'RYCZALT_14', rateName: 'Ryczałt 14% - Usługi zdrowotne' },
  construction: { rate: 5.5, rateCode: 'RYCZALT_5_5', rateName: 'Ryczałt 5,5% - Budownictwo' },
};

// Default tax rates - Polish tax rates 2024/2025
type DefaultRate = {
  id: string;
  taxType: string;
  rateCode: string;
  rateName: string;
  rateValue: number;
  appliesTo: string | null;
  activityType: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  legalBasis: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
};

const DEFAULT_RATES: DefaultRate[] = [
  // VAT rates
  { id: 'vat-23', taxType: 'VAT', rateCode: 'STANDARD', rateName: 'VAT 23%', rateValue: 23, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2011-01-01'), effectiveTo: null, legalBasis: 'Art. 41 ust. 1 ustawy o VAT', description: 'Podstawowa stawka VAT', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'vat-8', taxType: 'VAT', rateCode: 'REDUCED', rateName: 'VAT 8%', rateValue: 8, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2011-01-01'), effectiveTo: null, legalBasis: 'Art. 41 ust. 2 ustawy o VAT', description: 'Obniżona stawka VAT', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'vat-5', taxType: 'VAT', rateCode: 'SUPER_REDUCED', rateName: 'VAT 5%', rateValue: 5, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2011-01-01'), effectiveTo: null, legalBasis: 'Art. 41 ust. 2a ustawy o VAT', description: 'Najniższa stawka VAT', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'vat-0', taxType: 'VAT', rateCode: 'ZERO', rateName: 'VAT 0%', rateValue: 0, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2011-01-01'), effectiveTo: null, legalBasis: 'Art. 41 ust. 4-11 ustawy o VAT', description: 'Stawka zerowa VAT', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'vat-zw', taxType: 'VAT', rateCode: 'EXEMPT', rateName: 'VAT zwolniony', rateValue: 0, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2011-01-01'), effectiveTo: null, legalBasis: 'Art. 43 ustawy o VAT', description: 'Zwolnienie z VAT', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  // PIT rates
  { id: 'pit-12', taxType: 'PIT', rateCode: 'FIRST_BRACKET', rateName: 'PIT 12%', rateValue: 12, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2022-07-01'), effectiveTo: null, legalBasis: 'Art. 27 ust. 1 ustawy o PIT', description: 'Pierwszy próg podatkowy', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'pit-32', taxType: 'PIT', rateCode: 'SECOND_BRACKET', rateName: 'PIT 32%', rateValue: 32, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2022-07-01'), effectiveTo: null, legalBasis: 'Art. 27 ust. 1 ustawy o PIT', description: 'Drugi próg podatkowy', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'pit-flat', taxType: 'PIT', rateCode: 'FLAT', rateName: 'PIT 19% (liniowy)', rateValue: 19, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2004-01-01'), effectiveTo: null, legalBasis: 'Art. 30c ustawy o PIT', description: 'Podatek liniowy', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  // CIT rates
  { id: 'cit-19', taxType: 'CIT', rateCode: 'STANDARD', rateName: 'CIT 19%', rateValue: 19, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2004-01-01'), effectiveTo: null, legalBasis: 'Art. 19 ust. 1 ustawy o CIT', description: 'Podstawowa stawka CIT', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'cit-9', taxType: 'CIT', rateCode: 'REDUCED', rateName: 'CIT 9%', rateValue: 9, appliesTo: 'all', activityType: null, effectiveFrom: new Date('2019-01-01'), effectiveTo: null, legalBasis: 'Art. 19 ust. 1 pkt 2 ustawy o CIT', description: 'Obniżona stawka CIT (mali podatnicy)', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  // ZUS rates
  { id: 'zus-emery-ee', taxType: 'ZUS', rateCode: 'EMERY_EE', rateName: 'Emerytalne (pracownik)', rateValue: 9.76, appliesTo: 'employee', activityType: null, effectiveFrom: new Date('1999-01-01'), effectiveTo: null, legalBasis: 'Art. 22 ustawy o sus', description: 'Składka emerytalna', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'zus-emery-er', taxType: 'ZUS', rateCode: 'EMERY_ER', rateName: 'Emerytalne (pracodawca)', rateValue: 9.76, appliesTo: 'employer', activityType: null, effectiveFrom: new Date('1999-01-01'), effectiveTo: null, legalBasis: 'Art. 22 ustawy o sus', description: 'Składka emerytalna', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'zus-rent-ee', taxType: 'ZUS', rateCode: 'RENT_EE', rateName: 'Rentowe (pracownik)', rateValue: 1.5, appliesTo: 'employee', activityType: null, effectiveFrom: new Date('2012-02-01'), effectiveTo: null, legalBasis: 'Art. 22 ustawy o sus', description: 'Składka rentowa', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'zus-rent-er', taxType: 'ZUS', rateCode: 'RENT_ER', rateName: 'Rentowe (pracodawca)', rateValue: 6.5, appliesTo: 'employer', activityType: null, effectiveFrom: new Date('2012-02-01'), effectiveTo: null, legalBasis: 'Art. 22 ustawy o sus', description: 'Składka rentowa', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'zus-chor-ee', taxType: 'ZUS', rateCode: 'CHOR_EE', rateName: 'Chorobowe (pracownik)', rateValue: 2.45, appliesTo: 'employee', activityType: null, effectiveFrom: new Date('1999-01-01'), effectiveTo: null, legalBasis: 'Art. 22 ustawy o sus', description: 'Składka chorobowa', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'zus-zdrow', taxType: 'ZUS', rateCode: 'ZDROW', rateName: 'Zdrowotne', rateValue: 9, appliesTo: 'employee', activityType: null, effectiveFrom: new Date('2022-01-01'), effectiveTo: null, legalBasis: 'Art. 79 ustawy o świadczeniach', description: 'Składka zdrowotna', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'zus-fp', taxType: 'FP', rateCode: 'FP', rateName: 'Fundusz Pracy', rateValue: 2.45, appliesTo: 'employer', activityType: null, effectiveFrom: new Date('1999-01-01'), effectiveTo: null, legalBasis: 'Art. 104 ustawy o promocji zatrudnienia', description: 'Składka na Fundusz Pracy', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
  { id: 'zus-fgsp', taxType: 'FGSP', rateCode: 'FGSP', rateName: 'FGŚP', rateValue: 0.1, appliesTo: 'employer', activityType: null, effectiveFrom: new Date('2006-01-01'), effectiveTo: null, legalBasis: 'Ustawa o FGŚP', description: 'Fundusz Gwarantowanych Świadczeń Pracowniczych', isActive: true, createdAt: new Date(), updatedAt: new Date(), createdBy: null },
];

// Default PIT thresholds (2024/2025)
type DefaultThreshold = {
  id: string;
  taxType: string;
  thresholdName: string;
  lowerBound: number | null;
  upperBound: number | null;
  rate: number;
  baseAmount: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  legalBasis: string | null;
  createdAt: Date;
};

const DEFAULT_THRESHOLDS: DefaultThreshold[] = [
  { id: 'pit-t1', taxType: 'PIT', thresholdName: 'I próg podatkowy', lowerBound: 0, upperBound: 120000, rate: 12, baseAmount: null, effectiveFrom: new Date('2022-07-01'), effectiveTo: null, legalBasis: 'Art. 27 ustawy o PIT', createdAt: new Date() },
  { id: 'pit-t2', taxType: 'PIT', thresholdName: 'II próg podatkowy', lowerBound: 120000, upperBound: null, rate: 32, baseAmount: 10800, effectiveFrom: new Date('2022-07-01'), effectiveTo: null, legalBasis: 'Art. 27 ustawy o PIT', createdAt: new Date() },
];

// Default ZUS contribution bases (2024)
type DefaultZUSBase = {
  id: string;
  year: number;
  month: number | null;
  minimumWage: number;
  averageWage: number | null;
  declaredBaseMin: number | null;
  declaredBaseStandard: number | null;
  healthBase: number | null;
  preferentialBaseMax: number | null;
  annualContributionLimit: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
};

const DEFAULT_ZUS_BASES: DefaultZUSBase[] = [
  { id: 'zus-2024', year: 2024, month: null, minimumWage: 4242, averageWage: 7824.19, declaredBaseMin: 1272.60, declaredBaseStandard: 4694.40, healthBase: 4694.40, preferentialBaseMax: 1272.60, annualContributionLimit: 234720, effectiveFrom: new Date('2024-01-01'), effectiveTo: new Date('2024-12-31'), createdAt: new Date() },
  { id: 'zus-2025', year: 2025, month: null, minimumWage: 4666, averageWage: 8579.49, declaredBaseMin: 1399.80, declaredBaseStandard: 5156.70, healthBase: 5156.70, preferentialBaseMax: 1399.80, annualContributionLimit: 257520, effectiveFrom: new Date('2025-01-01'), effectiveTo: null, createdAt: new Date() },
];

// ===========================================================================
// TAX RATES SERVICE
// ===========================================================================

export class TaxRatesService {
  constructor(private readonly db: PrismaClient) {
    // Suppress unused warnings - reserved for future Prisma implementation
    void this.db;
  }

  // =========================================================================
  // RATE RETRIEVAL METHODS
  // =========================================================================

  /**
   * Get all rates for a specific tax type
   * Uses default rates until TaxRate Prisma model is implemented
   */
  async getRates(input: GetRatesInput): Promise<GetRatesResult> {
    const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

    // Filter default rates by tax type and date
    let rates = DEFAULT_RATES.filter(r =>
      r.taxType === input.taxType &&
      r.effectiveFrom <= asOfDate
    );

    if (!input.includeInactive) {
      rates = rates.filter(r =>
        r.isActive &&
        (r.effectiveTo === null || r.effectiveTo >= asOfDate)
      );
    }

    // Sort by rateCode asc, effectiveFrom desc
    rates.sort((a, b) => {
      const codeCompare = a.rateCode.localeCompare(b.rateCode);
      if (codeCompare !== 0) return codeCompare;
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    });

    return {
      rates: this.mapTaxRates(rates),
      asOfDate: asOfDate.toISOString(),
      totalCount: rates.length,
    };
  }

  /**
   * Get a specific rate by type and code
   * Uses default rates until TaxRate Prisma model is implemented
   */
  async getRateByCode(input: GetRateByCodeInput): Promise<TaxRate> {
    const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

    // Find matching rate from defaults
    const matchingRates = DEFAULT_RATES.filter(r =>
      r.taxType === input.taxType &&
      r.rateCode === input.rateCode &&
      r.effectiveFrom <= asOfDate &&
      r.isActive &&
      (r.effectiveTo === null || r.effectiveTo >= asOfDate)
    ).sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

    const rate = matchingRates[0];

    if (!rate) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Tax rate ${input.taxType}/${input.rateCode} not found for date ${asOfDate.toISOString()}`,
      });
    }

    return this.mapTaxRate(rate);
  }

  /**
   * Get tax thresholds for progressive scales
   * Uses default thresholds until TaxThreshold Prisma model is implemented
   */
  async getThresholds(input: GetThresholdsInput): Promise<GetThresholdsResult> {
    const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

    // Filter default thresholds by tax type and date
    const thresholds = DEFAULT_THRESHOLDS.filter(t =>
      t.taxType === input.taxType &&
      t.effectiveFrom <= asOfDate &&
      (t.effectiveTo === null || t.effectiveTo >= asOfDate)
    ).sort((a, b) => (a.lowerBound ?? 0) - (b.lowerBound ?? 0));

    return {
      thresholds: this.mapTaxThresholds(thresholds),
      asOfDate: asOfDate.toISOString(),
    };
  }

  /**
   * Get ZUS contribution bases for a period
   * Uses default bases until ZUSContributionBase Prisma model is implemented
   */
  async getZUSBases(input: GetZUSBasesInput): Promise<GetZUSBasesResult> {
    // Find matching base from defaults
    const matchingBases = DEFAULT_ZUS_BASES.filter(b =>
      b.year === input.year &&
      (b.month === input.month || b.month === null)
    ).sort((a, b) => (b.month ?? 0) - (a.month ?? 0));

    const base = matchingBases[0];

    return {
      base: base ? this.mapZUSBase(base) : null,
      year: input.year,
      month: input.month ?? null,
    };
  }

  // =========================================================================
  // VAT CALCULATION METHODS
  // =========================================================================

  /**
   * Calculate VAT amount for a transaction
   */
  async calculateVAT(input: CalculateVATInput): Promise<CalculateVATResult> {
    const rate = await this.getRateByCode({
      taxType: 'VAT',
      rateCode: input.rateCode,
      asOfDate: input.transactionDate,
    });

    const netAmount = new Decimal(input.netAmount);
    const vatRate = new Decimal(rate.rateValue).div(100);
    const vatAmount = netAmount.mul(vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grossAmount = netAmount.plus(vatAmount);

    return {
      netAmount: netAmount.toNumber(),
      vatRate: rate.rateValue,
      vatAmount: vatAmount.toNumber(),
      grossAmount: grossAmount.toNumber(),
      rateCode: rate.rateCode,
      rateName: rate.rateName,
      effectiveDate: rate.effectiveFrom,
    };
  }

  // =========================================================================
  // PIT CALCULATION METHODS
  // =========================================================================

  /**
   * Calculate PIT (Personal Income Tax)
   */
  async calculatePIT(input: CalculatePITInput): Promise<CalculatePITResult> {
    const taxableIncome = new Decimal(input.annualIncome).minus(input.deductions);

    if (input.taxOption === 'flat') {
      return this.calculateFlatPIT(input, taxableIncome);
    } else if (input.taxOption === 'lump_sum') {
      return this.calculateLumpSumPIT(input, taxableIncome);
    } else {
      return this.calculateProgressivePIT(input, taxableIncome);
    }
  }

  /**
   * Calculate flat PIT (19% - podatek liniowy)
   */
  private async calculateFlatPIT(
    input: CalculatePITInput,
    taxableIncome: Decimal
  ): Promise<CalculatePITResult> {
    const flatRate = await this.db.taxRate.findFirst({
      where: { taxType: 'PIT', rateCode: 'FLAT', isActive: true },
    });

    if (!flatRate) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Flat PIT rate not found',
      });
    }

    const rate = new Decimal(flatRate.rateValue).div(100);
    const tax = taxableIncome.mul(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

    return {
      annualIncome: input.annualIncome,
      taxableIncome: taxableIncome.toNumber(),
      taxOption: 'flat',
      brackets: [{
        threshold: 'Podatek liniowy 19%',
        income: taxableIncome.toNumber(),
        rate: flatRate.rateValue,
        tax: tax.toNumber(),
      }],
      totalTax: tax.toNumber(),
      effectiveRate: input.annualIncome > 0
        ? tax.div(input.annualIncome).mul(100).toDecimalPlaces(2).toNumber()
        : 0,
      taxYear: input.taxYear,
    };
  }

  /**
   * Calculate lump sum PIT (ryczałt)
   */
  private async calculateLumpSumPIT(
    input: CalculatePITInput,
    _taxableIncome: Decimal
  ): Promise<CalculatePITResult> {
    if (!input.activityType) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Activity type is required for lump sum taxation',
      });
    }

    const lumpSumConfig = LUMP_SUM_RATES[input.activityType];
    if (!lumpSumConfig) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown activity type: ${input.activityType}`,
      });
    }

    const rate = new Decimal(lumpSumConfig.rate).div(100);
    // Lump sum is calculated on revenue, not income (no deductions typically)
    const taxBase = new Decimal(input.annualIncome);
    const tax = taxBase.mul(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

    return {
      annualIncome: input.annualIncome,
      taxableIncome: taxBase.toNumber(), // For lump sum, it's the full revenue
      taxOption: 'lump_sum',
      brackets: [{
        threshold: lumpSumConfig.rateName,
        income: taxBase.toNumber(),
        rate: lumpSumConfig.rate,
        tax: tax.toNumber(),
      }],
      totalTax: tax.toNumber(),
      effectiveRate: input.annualIncome > 0
        ? tax.div(input.annualIncome).mul(100).toDecimalPlaces(2).toNumber()
        : 0,
      taxYear: input.taxYear,
    };
  }

  /**
   * Calculate progressive PIT (skala podatkowa)
   */
  private async calculateProgressivePIT(
    input: CalculatePITInput,
    taxableIncome: Decimal
  ): Promise<CalculatePITResult> {
    const thresholds = await this.db.taxThreshold.findMany({
      where: {
        taxType: 'PIT',
        effectiveFrom: { lte: new Date(input.taxYear, 0, 1) },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date(input.taxYear, 11, 31) } },
        ],
      },
      orderBy: { lowerBound: 'asc' },
    });

    if (thresholds.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `PIT thresholds not found for tax year ${input.taxYear}`,
      });
    }

    let remainingIncome = taxableIncome;
    let totalTax = new Decimal(0);
    const brackets: PITBracketResult[] = [];

    for (const threshold of thresholds) {
      if (remainingIncome.lte(0)) break;

      const lower = new Decimal(threshold.lowerBound ?? 0);
      const upper = threshold.upperBound ? new Decimal(threshold.upperBound) : null;
      const rate = new Decimal(threshold.rate).div(100);

      let bracketIncome: Decimal;
      if (upper) {
        const bracketSize = upper.minus(lower);
        bracketIncome = Decimal.min(remainingIncome, bracketSize);
      } else {
        bracketIncome = remainingIncome;
      }

      const bracketTax = bracketIncome.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      if (bracketIncome.gt(0)) {
        brackets.push({
          threshold: threshold.thresholdName,
          income: bracketIncome.toNumber(),
          rate: threshold.rate,
          tax: bracketTax.toNumber(),
        });

        totalTax = totalTax.plus(bracketTax);
      }

      remainingIncome = remainingIncome.minus(bracketIncome);
    }

    return {
      annualIncome: input.annualIncome,
      taxableIncome: taxableIncome.toNumber(),
      taxOption: 'progressive',
      brackets,
      totalTax: totalTax.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      effectiveRate: input.annualIncome > 0
        ? totalTax.div(input.annualIncome).mul(100).toDecimalPlaces(2).toNumber()
        : 0,
      taxYear: input.taxYear,
    };
  }

  // =========================================================================
  // ZUS CALCULATION METHODS
  // =========================================================================

  /**
   * Calculate ZUS contributions
   */
  async calculateZUS(input: CalculateZUSInput): Promise<CalculateZUSResult> {
    // Get ZUS rates
    const rates = await this.db.taxRate.findMany({
      where: {
        taxType: { in: ['ZUS', 'FP', 'FGSP'] },
        isActive: true,
        effectiveFrom: { lte: new Date(input.calculationYear, input.calculationMonth - 1, 1) },
      },
    });

    // Get ZUS bases
    const base = await this.db.zusContributionBase.findFirst({
      where: {
        year: input.calculationYear,
        OR: [
          { month: input.calculationMonth },
          { month: null },
        ],
      },
      orderBy: { month: 'desc' },
    });

    if (!base) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `ZUS bases not found for ${input.calculationYear}/${input.calculationMonth}`,
      });
    }

    // Determine contribution base
    let contributionBase: Decimal;
    if (input.contributorType === 'employee') {
      if (!input.grossSalary) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Gross salary is required for employee contributions',
        });
      }
      contributionBase = new Decimal(input.grossSalary);
    } else if (input.zusType === 'preferential') {
      contributionBase = new Decimal(base.preferentialBaseMax ?? base.declaredBaseMin ?? 0);
    } else if (input.zusType === 'ulga_na_start') {
      // Ulga na start - only health insurance
      contributionBase = new Decimal(0);
    } else {
      contributionBase = new Decimal(input.declaredBase ?? base.declaredBaseStandard ?? 0);
    }

    // Helper to get rate value
    const getRateValue = (code: string): Decimal => {
      const rate = rates.find(r => r.rateCode === code);
      return new Decimal(rate?.rateValue ?? 0).div(100);
    };

    const accidentRate = new Decimal(input.accidentRate ?? 1.67).div(100);

    // Calculate each contribution
    const emerytalne = {
      employee: contributionBase.mul(getRateValue('EMERY_EE')).toDecimalPlaces(2),
      employer: contributionBase.mul(getRateValue('EMERY_ER')).toDecimalPlaces(2),
    };

    const rentowe = {
      employee: contributionBase.mul(getRateValue('RENT_EE')).toDecimalPlaces(2),
      employer: contributionBase.mul(getRateValue('RENT_ER')).toDecimalPlaces(2),
    };

    const chorobowe = {
      employee: contributionBase.mul(getRateValue('CHOR_EE')).toDecimalPlaces(2),
      employer: new Decimal(0),
    };

    const wypadkowe = {
      employee: new Decimal(0),
      employer: contributionBase.mul(accidentRate).toDecimalPlaces(2),
    };

    // Health insurance base calculation
    let healthBase: Decimal;
    if (input.contributorType === 'self_employed') {
      healthBase = new Decimal(base.healthBase ?? 0);
    } else {
      healthBase = contributionBase
        .minus(emerytalne.employee)
        .minus(rentowe.employee)
        .minus(chorobowe.employee);
    }

    const zdrowotne = {
      employee: healthBase.mul(getRateValue('ZDROW')).toDecimalPlaces(2),
      employer: new Decimal(0),
    };

    const fp = {
      employee: new Decimal(0),
      employer: contributionBase.mul(getRateValue('FP')).toDecimalPlaces(2),
    };

    const fgsp = {
      employee: new Decimal(0),
      employer: contributionBase.mul(getRateValue('FGSP')).toDecimalPlaces(2),
    };

    const totalEmployee = emerytalne.employee
      .plus(rentowe.employee)
      .plus(chorobowe.employee)
      .plus(zdrowotne.employee);

    const totalEmployer = emerytalne.employer
      .plus(rentowe.employer)
      .plus(wypadkowe.employer)
      .plus(fp.employer)
      .plus(fgsp.employer);

    return {
      contributorType: input.contributorType,
      contributionBase: contributionBase.toNumber(),
      contributions: {
        emerytalne: {
          employee: emerytalne.employee.toNumber(),
          employer: emerytalne.employer.toNumber(),
          total: emerytalne.employee.plus(emerytalne.employer).toNumber(),
        },
        rentowe: {
          employee: rentowe.employee.toNumber(),
          employer: rentowe.employer.toNumber(),
          total: rentowe.employee.plus(rentowe.employer).toNumber(),
        },
        chorobowe: {
          employee: chorobowe.employee.toNumber(),
          employer: chorobowe.employer.toNumber(),
          total: chorobowe.employee.toNumber(),
        },
        wypadkowe: {
          employee: wypadkowe.employee.toNumber(),
          employer: wypadkowe.employer.toNumber(),
          total: wypadkowe.employer.toNumber(),
        },
        zdrowotne: {
          employee: zdrowotne.employee.toNumber(),
          employer: zdrowotne.employer.toNumber(),
          total: zdrowotne.employee.toNumber(),
        },
        fp: {
          employee: fp.employee.toNumber(),
          employer: fp.employer.toNumber(),
          total: fp.employer.toNumber(),
        },
        fgsp: {
          employee: fgsp.employee.toNumber(),
          employer: fgsp.employer.toNumber(),
          total: fgsp.employer.toNumber(),
        },
      },
      totalEmployee: totalEmployee.toNumber(),
      totalEmployer: totalEmployer.toNumber(),
      totalContributions: totalEmployee.plus(totalEmployer).toNumber(),
      netSalary: input.grossSalary
        ? new Decimal(input.grossSalary).minus(totalEmployee).toNumber()
        : undefined,
    };
  }

  // =========================================================================
  // ADMIN METHODS
  // =========================================================================

  /**
   * Create a new tax rate (admin only)
   */
  async createRate(input: CreateTaxRateInput, userId: string): Promise<CreateTaxRateResult> {
    const now = new Date();

    const rate = await this.db.taxRate.create({
      data: {
        taxType: input.taxType,
        rateCode: input.rateCode,
        rateName: input.rateName,
        rateValue: input.rateValue,
        appliesTo: input.appliesTo,
        activityType: input.activityType,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        legalBasis: input.legalBasis,
        description: input.description,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
    });

    const audit = await this.db.taxRateAudit.create({
      data: {
        rateId: rate.id,
        action: 'created',
        newValue: input as unknown as Record<string, unknown>,
        userId,
        createdAt: now,
      },
    });

    return {
      rate: this.mapTaxRate(rate),
      audit: this.mapTaxRateAudit(audit),
    };
  }

  /**
   * Update an existing tax rate (admin only)
   */
  async updateRate(input: UpdateTaxRateInput, userId: string): Promise<UpdateTaxRateResult> {
    const existing = await this.db.taxRate.findUnique({
      where: { id: input.rateId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Tax rate ${input.rateId} not found`,
      });
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (input.rateValue !== undefined) updateData.rateValue = input.rateValue;
    if (input.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(input.effectiveFrom);
    if (input.effectiveTo !== undefined) updateData.effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (input.legalBasis !== undefined) updateData.legalBasis = input.legalBasis;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const rate = await this.db.taxRate.update({
      where: { id: input.rateId },
      data: updateData,
    });

    const audit = await this.db.taxRateAudit.create({
      data: {
        rateId: rate.id,
        action: 'updated',
        oldValue: this.mapTaxRate(existing) as unknown as Record<string, unknown>,
        newValue: this.mapTaxRate(rate) as unknown as Record<string, unknown>,
        changeReason: input.changeReason,
        userId,
        createdAt: now,
      },
    });

    return {
      rate: this.mapTaxRate(rate),
      audit: this.mapTaxRateAudit(audit),
    };
  }

  /**
   * Get audit history for a tax rate
   */
  async getRateHistory(input: GetRateHistoryInput): Promise<GetRateHistoryResult> {
    const whereClause: Record<string, unknown> = {
      rateId: input.rateId,
    };

    if (input.cursor) {
      whereClause.id = { lt: input.cursor };
    }

    const [history, totalCount] = await Promise.all([
      this.db.taxRateAudit.findMany({
        where: whereClause,
        take: input.limit + 1,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.taxRateAudit.count({ where: { rateId: input.rateId } }),
    ]);

    const hasMore = history.length > input.limit;
    const results = hasMore ? history.slice(0, -1) : history;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    return {
      history: results.map(h => this.mapTaxRateAudit(h)),
      totalCount,
      nextCursor,
    };
  }

  // =========================================================================
  // IMPACT ANALYSIS
  // =========================================================================

  /**
   * Analyze impact of a rate change
   */
  async analyzeRateChangeImpact(input: AnalyzeRateChangeImpactInput): Promise<AnalyzeRateChangeImpactResult> {
    // Get current rate
    let currentRate: TaxRate | null = null;
    try {
      currentRate = await this.getRateByCode({
        taxType: input.taxType,
        rateCode: input.rateCode,
      });
    } catch {
      // Rate doesn't exist yet
    }

    // Count affected entities (this would be more complex in real implementation)
    const effectiveFrom = new Date(input.effectiveFrom);

    // For now, return placeholder impact analysis
    // In a real implementation, this would query related modules
    const impactAnalysis = {
      affectedClientsCount: 0,
      pendingTransactionsCount: 0,
      openDeclarationsCount: 0,
    };

    const recommendations: string[] = [];

    if (currentRate) {
      const diff = input.newRateValue - currentRate.rateValue;
      if (diff > 0) {
        recommendations.push(`Rate increase of ${diff}% - notify affected clients`);
      } else if (diff < 0) {
        recommendations.push(`Rate decrease of ${Math.abs(diff)}% - review pending transactions`);
      }
    }

    if (effectiveFrom < new Date()) {
      recommendations.push('Effective date is in the past - consider using a future date');
    }

    recommendations.push('Review all pending invoices before rate change');
    recommendations.push('Update accounting templates to reflect new rate');

    return {
      currentRate,
      proposedRate: input.newRateValue,
      effectiveFrom: input.effectiveFrom,
      impactAnalysis,
      recommendations,
    };
  }

  // =========================================================================
  // LUMP SUM RATE LOOKUP
  // =========================================================================

  /**
   * Get lump sum rate for an activity type
   */
  async getLumpSumRate(input: GetLumpSumRateInput): Promise<GetLumpSumRateResult> {
    const config = LUMP_SUM_RATES[input.activityType];
    if (!config) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Lump sum rate for activity type ${input.activityType} not found`,
      });
    }

    // Try to get from database first
    const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();
    const dbRate = await this.db.taxRate.findFirst({
      where: {
        taxType: 'PIT',
        rateCode: config.rateCode,
        effectiveFrom: { lte: asOfDate },
        isActive: true,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: asOfDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (dbRate) {
      return {
        activityType: input.activityType,
        rate: dbRate.rateValue,
        rateCode: dbRate.rateCode,
        rateName: dbRate.rateName,
        legalBasis: dbRate.legalBasis,
        effectiveFrom: dbRate.effectiveFrom.toISOString(),
      };
    }

    // Fallback to static config
    return {
      activityType: input.activityType,
      rate: config.rate,
      rateCode: config.rateCode,
      rateName: config.rateName,
      legalBasis: 'Art. 12 ustawy o zryczałtowanym podatku dochodowym',
      effectiveFrom: new Date(2022, 0, 1).toISOString(),
    };
  }

  // =========================================================================
  // SUMMARY METHODS
  // =========================================================================

  /**
   * Get current rates summary for dashboard
   */
  async getCurrentRatesSummary(input: GetCurrentRatesSummaryInput): Promise<GetCurrentRatesSummaryResult> {
    const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();
    const year = asOfDate.getFullYear();
    const month = asOfDate.getMonth() + 1;

    // Get all active rates
    const rates = await this.db.taxRate.findMany({
      where: {
        effectiveFrom: { lte: asOfDate },
        isActive: true,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: asOfDate } },
        ],
      },
      orderBy: [
        { taxType: 'asc' },
        { rateCode: 'asc' },
      ],
    });

    // Get PIT thresholds
    const thresholds = await this.db.taxThreshold.findMany({
      where: {
        taxType: 'PIT',
        effectiveFrom: { lte: asOfDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: asOfDate } },
        ],
      },
      orderBy: { lowerBound: 'asc' },
    });

    // Get ZUS bases
    const zusBases = await this.db.zusContributionBase.findFirst({
      where: {
        year,
        OR: [
          { month },
          { month: null },
        ],
      },
      orderBy: { month: 'desc' },
    });

    // Group rates by type
    const vatRates = rates
      .filter(r => r.taxType === 'VAT')
      .map(r => ({
        code: r.rateCode,
        name: r.rateName,
        rate: r.rateValue,
      }));

    const citRates = rates
      .filter(r => r.taxType === 'CIT')
      .map(r => ({
        code: r.rateCode,
        name: r.rateName,
        rate: r.rateValue,
      }));

    const pitRates = rates
      .filter(r => r.taxType === 'PIT')
      .map(r => ({
        code: r.rateCode,
        name: r.rateName,
        rate: r.rateValue,
      }));

    const zusRates = rates
      .filter(r => r.taxType === 'ZUS' || r.taxType === 'FP' || r.taxType === 'FGSP')
      .map(r => ({
        code: r.rateCode,
        name: r.rateName,
        employeeRate: r.appliesTo === 'employee' || r.appliesTo === 'all' ? r.rateValue : null,
        employerRate: r.appliesTo === 'employer' || r.appliesTo === 'all' ? r.rateValue : null,
      }));

    const pitThresholds = thresholds.map(t => ({
      name: t.thresholdName,
      lowerBound: t.lowerBound,
      upperBound: t.upperBound,
      rate: t.rate,
    }));

    return {
      asOfDate: asOfDate.toISOString(),
      vatRates,
      citRates,
      pitRates,
      pitThresholds,
      zusRates,
      zusBases: zusBases ? {
        minimumWage: zusBases.minimumWage,
        averageWage: zusBases.averageWage,
        declaredBaseStandard: zusBases.declaredBaseStandard,
        healthBase: zusBases.healthBase,
      } : null,
    };
  }

  // =========================================================================
  // MAPPING HELPERS
  // =========================================================================

  private mapTaxRate(rate: {
    id: string;
    taxType: string;
    rateCode: string;
    rateName: string;
    rateValue: number;
    appliesTo: string | null;
    activityType: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    legalBasis: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
  }): TaxRate {
    return {
      id: rate.id,
      taxType: rate.taxType as TaxType,
      rateCode: rate.rateCode,
      rateName: rate.rateName,
      rateValue: rate.rateValue,
      appliesTo: rate.appliesTo,
      activityType: rate.activityType as ActivityType | null,
      effectiveFrom: rate.effectiveFrom.toISOString(),
      effectiveTo: rate.effectiveTo?.toISOString() ?? null,
      legalBasis: rate.legalBasis,
      description: rate.description,
      isActive: rate.isActive,
      createdAt: rate.createdAt.toISOString(),
      updatedAt: rate.updatedAt.toISOString(),
      createdBy: rate.createdBy,
    };
  }

  private mapTaxRates(rates: Array<{
    id: string;
    taxType: string;
    rateCode: string;
    rateName: string;
    rateValue: number;
    appliesTo: string | null;
    activityType: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    legalBasis: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
  }>): TaxRate[] {
    return rates.map(rate => this.mapTaxRate(rate));
  }

  private mapTaxThreshold(threshold: {
    id: string;
    taxType: string;
    thresholdName: string;
    lowerBound: number | null;
    upperBound: number | null;
    rate: number;
    baseAmount: number | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    legalBasis: string | null;
    createdAt: Date;
  }): TaxThreshold {
    return {
      id: threshold.id,
      taxType: threshold.taxType as TaxType,
      thresholdName: threshold.thresholdName,
      lowerBound: threshold.lowerBound,
      upperBound: threshold.upperBound,
      rate: threshold.rate,
      baseAmount: threshold.baseAmount,
      effectiveFrom: threshold.effectiveFrom.toISOString(),
      effectiveTo: threshold.effectiveTo?.toISOString() ?? null,
      legalBasis: threshold.legalBasis,
      createdAt: threshold.createdAt.toISOString(),
    };
  }

  private mapTaxThresholds(thresholds: Array<{
    id: string;
    taxType: string;
    thresholdName: string;
    lowerBound: number | null;
    upperBound: number | null;
    rate: number;
    baseAmount: number | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    legalBasis: string | null;
    createdAt: Date;
  }>): TaxThreshold[] {
    return thresholds.map(t => this.mapTaxThreshold(t));
  }

  private mapZUSBase(base: {
    id: string;
    year: number;
    month: number | null;
    minimumWage: number;
    averageWage: number | null;
    declaredBaseMin: number | null;
    declaredBaseStandard: number | null;
    healthBase: number | null;
    preferentialBaseMax: number | null;
    annualContributionLimit: number | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
  }): ZUSContributionBase {
    return {
      id: base.id,
      year: base.year,
      month: base.month,
      minimumWage: base.minimumWage,
      averageWage: base.averageWage,
      declaredBaseMin: base.declaredBaseMin,
      declaredBaseStandard: base.declaredBaseStandard,
      healthBase: base.healthBase,
      preferentialBaseMax: base.preferentialBaseMax,
      annualContributionLimit: base.annualContributionLimit,
      effectiveFrom: base.effectiveFrom.toISOString(),
      effectiveTo: base.effectiveTo?.toISOString() ?? null,
      createdAt: base.createdAt.toISOString(),
    };
  }

  private mapTaxRateAudit(audit: {
    id: string;
    rateId: string;
    action: string;
    oldValue: unknown;
    newValue: unknown;
    changeReason: string | null;
    userId: string;
    createdAt: Date;
  }): TaxRateAudit {
    return {
      id: audit.id,
      rateId: audit.rateId,
      action: audit.action as 'created' | 'updated' | 'deactivated',
      oldValue: audit.oldValue as Record<string, unknown> | null,
      newValue: audit.newValue as Record<string, unknown> | null,
      changeReason: audit.changeReason,
      userId: audit.userId,
      createdAt: audit.createdAt.toISOString(),
    };
  }
}
