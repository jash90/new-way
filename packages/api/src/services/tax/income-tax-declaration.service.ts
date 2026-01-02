// TAX-005: Income Tax Declaration Service
// Manages CIT (Corporate Income Tax) and PIT (Personal Income Tax) declarations for Polish tax compliance

import { TRPCError } from '@trpc/server';
import Decimal from 'decimal.js';
import type {
  CalculateCITInput,
  CITCalculationResult,
  CalculatePITDeclarationInput,
  PITCalculationResult,
  CreateDeclarationInput,
  UpdateDeclarationInput,
  CalculateDeclarationInput,
  SubmitDeclarationInput,
  CreateDeclarationCorrectionInput,
  GetDeclarationInput,
  ListDeclarationsInput,
  DeleteDeclarationInput,
  CalculateAdvanceInput,
  RecordAdvancePaymentInput,
  GetAdvanceScheduleInput,
  GetLossCarryForwardInput,
  ApplyLossInput,
  IncomeTaxDeclaration,
  TaxAdvancePayment,
  LossCarryForward,
  DeclarationSummary,
  AdvanceSchedule,
  ListDeclarationsResult,
} from '@ksiegowacrm/shared';
import type { PrismaClient } from '@prisma/client';

// ===========================================================================
// CONSTANTS - POLISH TAX RATES 2024
// ===========================================================================

const CIT_RATES = {
  STANDARD: new Decimal('0.19'),
  SMALL_TAXPAYER: new Decimal('0.09'),
  SOLIDARITY_THRESHOLD: new Decimal('1000000'),
  SOLIDARITY_RATE: new Decimal('0.04'),
};

const PIT_RATES = {
  FIRST_BRACKET: new Decimal('0.12'),
  SECOND_BRACKET: new Decimal('0.32'),
  FLAT_RATE: new Decimal('0.19'),
  THRESHOLD: new Decimal('120000'),
  TAX_FREE_AMOUNT: new Decimal('30000'),
  HEALTH_DEDUCTION_FLAT: new Decimal('11600'),
};

// Child relief amounts per child per year
const CHILD_RELIEF = {
  FIRST_CHILD: new Decimal('1112.04'),
  SECOND_CHILD: new Decimal('1112.04'),
  THIRD_CHILD: new Decimal('2000.04'),
  FOURTH_AND_MORE: new Decimal('2700'),
};

// ===========================================================================
// INCOME TAX DECLARATION SERVICE
// ===========================================================================

export class IncomeTaxDeclarationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly organizationId: string,
    private readonly userId: string,
  ) {}

  // =========================================================================
  // CIT CALCULATIONS
  // =========================================================================

  /**
   * Calculate CIT (Corporate Income Tax)
   * Implements Polish CIT calculation rules
   */
  async calculateCIT(input: CalculateCITInput): Promise<CITCalculationResult> {
    const revenue = new Decimal(input.revenue);
    const costs = new Decimal(input.costs);
    const nonDeductibleCosts = new Decimal(input.nonDeductibleCosts || '0');
    const taxExemptRevenue = new Decimal(input.taxExemptRevenue || '0');

    // Calculate taxable income
    const deductibleCosts = costs.minus(nonDeductibleCosts);
    const taxableRevenue = revenue.minus(taxExemptRevenue);
    let taxableIncome = taxableRevenue.minus(deductibleCosts);
    let taxLoss = new Decimal('0');

    if (taxableIncome.isNegative()) {
      taxLoss = taxableIncome.abs();
      taxableIncome = new Decimal('0');
    }

    // Apply loss carry forward if requested
    let appliedLossCarryForward = new Decimal('0');
    if (input.applyLossCarryForward && taxableIncome.isPositive()) {
      const availableLoss = await this.getAvailableLossForCIT(input.clientId, input.taxYear);
      // Can deduct up to 50% of income per year, max 5 years
      const maxDeduction = taxableIncome.mul('0.5');
      appliedLossCarryForward = Decimal.min(availableLoss, maxDeduction);
    }

    const incomeAfterLoss = taxableIncome.minus(appliedLossCarryForward);

    // Determine tax rate
    let taxRate: Decimal;
    let isSmallTaxpayer = false;
    let isEstonianCIT = input.useEstonianCIT;

    if (input.useEstonianCIT) {
      // Estonian CIT - tax only on distribution
      taxRate = new Decimal('0');
    } else if (input.useSmallTaxpayerRate) {
      taxRate = CIT_RATES.SMALL_TAXPAYER;
      isSmallTaxpayer = true;
    } else {
      taxRate = CIT_RATES.STANDARD;
    }

    // Calculate base tax
    let taxDue = incomeAfterLoss.mul(taxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Calculate solidarity surcharge if applicable (income > 1M PLN)
    let solidaritySurcharge: Decimal | null = null;
    if (incomeAfterLoss.gt(CIT_RATES.SOLIDARITY_THRESHOLD)) {
      const surchargeBase = incomeAfterLoss.minus(CIT_RATES.SOLIDARITY_THRESHOLD);
      solidaritySurcharge = surchargeBase.mul(CIT_RATES.SOLIDARITY_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    const totalTax = solidaritySurcharge
      ? taxDue.plus(solidaritySurcharge)
      : taxDue;

    // Calculate effective rate
    const effectiveRate = incomeAfterLoss.isZero()
      ? new Decimal('0')
      : totalTax.div(incomeAfterLoss).mul(100).toDecimalPlaces(2);

    return {
      revenue: revenue.toString(),
      deductibleCosts: deductibleCosts.toString(),
      nonDeductibleCosts: nonDeductibleCosts.toString(),
      taxExemptRevenue: taxExemptRevenue.toString(),
      taxableIncome: taxableIncome.toString(),
      taxLoss: taxLoss.toString(),
      appliedLossCarryForward: appliedLossCarryForward.toString(),
      incomeAfterLoss: incomeAfterLoss.toString(),
      taxRate: taxRate.mul(100).toString(),
      taxDue: taxDue.toString(),
      isSmallTaxpayer,
      isEstonianCIT,
      effectiveRate: effectiveRate.toString(),
      solidaritySurcharge: solidaritySurcharge?.toString() ?? null,
      totalTax: totalTax.toString(),
    };
  }

  // =========================================================================
  // PIT CALCULATIONS
  // =========================================================================

  /**
   * Calculate PIT (Personal Income Tax)
   * Implements Polish PIT calculation rules for progressive, flat, and lump sum taxation
   */
  async calculatePIT(input: CalculatePITDeclarationInput): Promise<PITCalculationResult> {
    const revenue = new Decimal(input.revenue);
    const costs = new Decimal(input.costs);
    const zusContributions = new Decimal(input.zusContributions || '0');
    const healthInsurance = new Decimal(input.healthInsurance || '0');

    // Calculate income
    const income = revenue.minus(costs);

    // ZUS is deductible from income
    let taxBase = income.minus(zusContributions);
    if (taxBase.isNegative()) {
      taxBase = new Decimal('0');
    }

    // Apply loss carry forward
    let appliedLossCarryForward = new Decimal('0');
    if (input.applyLossCarryForward && taxBase.isPositive()) {
      const availableLoss = await this.getAvailableLossForPIT(input.clientId, input.taxYear);
      const maxDeduction = taxBase.mul('0.5');
      appliedLossCarryForward = Decimal.min(availableLoss, maxDeduction);
    }

    let taxBaseAfterLoss = taxBase.minus(appliedLossCarryForward);

    let taxDue: Decimal;
    let taxBrackets: { bracket: string; rate: string; amount: string; tax: string }[] | null = null;

    if (input.taxMethod === 'lump_sum') {
      // Lump sum taxation - tax on revenue
      const lumpSumRate = this.getLumpSumRate(input.lumpSumRateCode || 'OTHER_SERVICES');
      taxDue = revenue.mul(lumpSumRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      taxBrackets = null;
    } else if (input.taxMethod === 'flat') {
      // Flat 19% rate
      taxDue = taxBaseAfterLoss.mul(PIT_RATES.FLAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      taxBrackets = [{
        bracket: 'Flat rate',
        rate: '19%',
        amount: taxBaseAfterLoss.toString(),
        tax: taxDue.toString(),
      }];
    } else {
      // Progressive scale (12% / 32%)
      const { tax, brackets } = this.calculateProgressivePIT(taxBaseAfterLoss, input.jointFiling, input.spouseIncome);
      taxDue = tax;
      taxBrackets = brackets;
    }

    // Calculate child relief
    let childRelief = new Decimal('0');
    if (input.childReliefCount && input.childReliefCount > 0 && input.taxMethod === 'progressive') {
      childRelief = this.calculateChildRelief(input.childReliefCount);
    }

    // Other reliefs (simplified)
    const otherReliefs = new Decimal('0');

    // Apply reliefs
    let taxAfterReliefs = taxDue.minus(childRelief).minus(otherReliefs);
    if (taxAfterReliefs.isNegative()) {
      taxAfterReliefs = new Decimal('0');
    }

    // Health insurance deduction from tax (for flat rate)
    let healthDeductionFromTax = new Decimal('0');
    if (input.taxMethod === 'flat') {
      healthDeductionFromTax = Decimal.min(healthInsurance, PIT_RATES.HEALTH_DEDUCTION_FLAT);
      taxAfterReliefs = taxAfterReliefs.minus(healthDeductionFromTax);
      if (taxAfterReliefs.isNegative()) {
        taxAfterReliefs = new Decimal('0');
      }
    }

    const finalTax = taxAfterReliefs.toDecimalPlaces(0, Decimal.ROUND_HALF_UP); // Rounded to full PLN

    // Calculate effective rate
    const effectiveRate = income.isZero()
      ? new Decimal('0')
      : finalTax.div(income).mul(100).toDecimalPlaces(2);

    return {
      revenue: revenue.toString(),
      costs: costs.toString(),
      income: income.toString(),
      zusDeduction: zusContributions.toString(),
      healthDeduction: healthInsurance.toString(),
      taxBase: taxBase.toString(),
      appliedLossCarryForward: appliedLossCarryForward.toString(),
      taxBaseAfterLoss: taxBaseAfterLoss.toString(),
      taxMethod: input.taxMethod,
      taxRate: input.taxMethod === 'flat' ? '19' : (input.taxMethod === 'lump_sum' ? this.getLumpSumRate(input.lumpSumRateCode || 'OTHER_SERVICES').mul(100).toString() : '12/32'),
      taxBrackets,
      taxDue: taxDue.toString(),
      childRelief: childRelief.toString(),
      otherReliefs: otherReliefs.toString(),
      taxAfterReliefs: taxAfterReliefs.toString(),
      healthDeductionFromTax: healthDeductionFromTax.toString(),
      finalTax: finalTax.toString(),
      effectiveRate: effectiveRate.toString(),
    };
  }

  /**
   * Calculate progressive PIT with brackets
   */
  private calculateProgressivePIT(
    taxBase: Decimal,
    jointFiling?: boolean,
    spouseIncome?: string,
  ): { tax: Decimal; brackets: { bracket: string; rate: string; amount: string; tax: string }[] } {
    let adjustedBase = taxBase;
    let threshold = PIT_RATES.THRESHOLD;

    // Joint filing doubles the threshold
    if (jointFiling && spouseIncome) {
      const combinedIncome = taxBase.plus(new Decimal(spouseIncome));
      adjustedBase = combinedIncome.div(2);
    }

    // Apply tax-free amount
    adjustedBase = adjustedBase.minus(PIT_RATES.TAX_FREE_AMOUNT);
    if (adjustedBase.isNegative()) {
      adjustedBase = new Decimal('0');
    }

    const brackets: { bracket: string; rate: string; amount: string; tax: string }[] = [];

    if (adjustedBase.lte(threshold)) {
      // All income in first bracket
      const tax = adjustedBase.mul(PIT_RATES.FIRST_BRACKET).toDecimalPlaces(2);
      brackets.push({
        bracket: `0 - ${threshold.toString()} PLN`,
        rate: '12%',
        amount: adjustedBase.toString(),
        tax: tax.toString(),
      });
      return { tax, brackets };
    } else {
      // Split between brackets
      const firstBracketAmount = threshold;
      const secondBracketAmount = adjustedBase.minus(threshold);

      const firstBracketTax = firstBracketAmount.mul(PIT_RATES.FIRST_BRACKET).toDecimalPlaces(2);
      const secondBracketTax = secondBracketAmount.mul(PIT_RATES.SECOND_BRACKET).toDecimalPlaces(2);

      brackets.push({
        bracket: `0 - ${threshold.toString()} PLN`,
        rate: '12%',
        amount: firstBracketAmount.toString(),
        tax: firstBracketTax.toString(),
      });
      brackets.push({
        bracket: `Above ${threshold.toString()} PLN`,
        rate: '32%',
        amount: secondBracketAmount.toString(),
        tax: secondBracketTax.toString(),
      });

      const totalTax = firstBracketTax.plus(secondBracketTax);

      // Apply joint filing adjustment
      if (jointFiling) {
        return { tax: totalTax.mul(2), brackets };
      }

      return { tax: totalTax, brackets };
    }
  }

  /**
   * Calculate child relief
   */
  private calculateChildRelief(childCount: number): Decimal {
    let relief = new Decimal('0');

    for (let i = 1; i <= childCount; i++) {
      if (i === 1) {
        relief = relief.plus(CHILD_RELIEF.FIRST_CHILD);
      } else if (i === 2) {
        relief = relief.plus(CHILD_RELIEF.SECOND_CHILD);
      } else if (i === 3) {
        relief = relief.plus(CHILD_RELIEF.THIRD_CHILD);
      } else {
        relief = relief.plus(CHILD_RELIEF.FOURTH_AND_MORE);
      }
    }

    return relief;
  }

  /**
   * Get lump sum rate by code
   */
  private getLumpSumRate(code: string): Decimal {
    const rates: Record<string, Decimal> = {
      IT_SERVICES: new Decimal('0.12'),
      PROFESSIONAL: new Decimal('0.15'),
      TRADE: new Decimal('0.055'),
      MANUFACTURING: new Decimal('0.055'),
      RENTAL: new Decimal('0.085'),
      OTHER_SERVICES: new Decimal('0.085'),
    };

    return rates[code] || new Decimal('0.085');
  }

  // =========================================================================
  // DECLARATION MANAGEMENT
  // =========================================================================

  /**
   * Create new tax declaration
   */
  async createDeclaration(input: CreateDeclarationInput): Promise<IncomeTaxDeclaration> {
    const declaration = await this.db.incomeTaxDeclaration.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        taxType: input.taxType,
        declarationType: input.declarationType,
        formType: input.formType,
        taxYear: input.taxYear,
        periodMonth: input.periodMonth ?? null,
        periodQuarter: input.periodQuarter ?? null,
        totalRevenue: '0',
        totalCosts: '0',
        taxableIncome: '0',
        taxLoss: '0',
        calculationMethod: input.taxType === 'CIT' ? 'CIT_STANDARD' : 'PROGRESSIVE',
        taxRate: '0',
        taxDue: '0',
        taxPaid: '0',
        taxToPay: '0',
        taxToRefund: '0',
        status: 'DRAFT',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.mapDeclaration(declaration);
  }

  /**
   * Update declaration
   */
  async updateDeclaration(input: UpdateDeclarationInput): Promise<IncomeTaxDeclaration> {
    const existing = await this.db.incomeTaxDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    if (['SUBMITTED', 'ACCEPTED'].includes(existing.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot update submitted or accepted declaration',
      });
    }

    const declaration = await this.db.incomeTaxDeclaration.update({
      where: { id: input.declarationId },
      data: {
        totalRevenue: input.totalRevenue ?? existing.totalRevenue,
        totalCosts: input.totalCosts ?? existing.totalCosts,
        deductions: input.deductions ?? existing.deductions,
        allowances: input.allowances ?? existing.allowances,
        status: input.status ?? existing.status,
        updatedAt: new Date(),
      },
    });

    return this.mapDeclaration(declaration);
  }

  /**
   * Calculate declaration taxes
   */
  async calculateDeclaration(input: CalculateDeclarationInput): Promise<DeclarationSummary> {
    const declaration = await this.db.incomeTaxDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    let calculation: CITCalculationResult | PITCalculationResult;

    if (declaration.taxType === 'CIT') {
      calculation = await this.calculateCIT({
        clientId: declaration.clientId,
        taxYear: declaration.taxYear,
        periodMonth: declaration.periodMonth ?? undefined,
        revenue: declaration.totalRevenue,
        costs: declaration.totalCosts,
        useSmallTaxpayerRate: declaration.calculationMethod === 'CIT_SMALL',
        useEstonianCIT: declaration.calculationMethod === 'CIT_ESTONIAN',
        applyLossCarryForward: true,
      });
    } else {
      calculation = await this.calculatePIT({
        clientId: declaration.clientId,
        taxYear: declaration.taxYear,
        periodMonth: declaration.periodMonth ?? undefined,
        revenue: declaration.totalRevenue,
        costs: declaration.totalCosts,
        taxMethod: this.mapCalculationMethodToPITMethod(declaration.calculationMethod),
        applyLossCarryForward: true,
        jointFiling: false,
        childReliefCount: 0,
      });
    }

    // Update declaration with calculated values
    const taxDue = 'totalTax' in calculation ? calculation.totalTax : calculation.finalTax;
    const taxableIncome = 'incomeAfterLoss' in calculation ? calculation.incomeAfterLoss : calculation.taxBaseAfterLoss;

    await this.db.incomeTaxDeclaration.update({
      where: { id: input.declarationId },
      data: {
        taxableIncome,
        taxDue,
        taxRate: calculation.taxRate,
        taxLoss: 'taxLoss' in calculation ? calculation.taxLoss : '0',
        lossCarryForward: 'appliedLossCarryForward' in calculation ? calculation.appliedLossCarryForward : null,
        status: 'CALCULATED',
        calculatedAt: new Date(),
        calculatedBy: this.userId,
        updatedAt: new Date(),
      },
    });

    const updatedDeclaration = await this.db.incomeTaxDeclaration.findUnique({
      where: { id: input.declarationId },
    });

    const advancePayments = await this.db.taxAdvancePayment.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: declaration.clientId,
        taxType: declaration.taxType,
        taxYear: declaration.taxYear,
      },
    });

    const lossRecords = await this.db.lossCarryForward.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: declaration.clientId,
        taxType: declaration.taxType,
        remainingAmount: { not: '0' },
        expiryYear: { gte: declaration.taxYear },
      },
    });

    return {
      declaration: this.mapDeclaration(updatedDeclaration!),
      calculation,
      advancePayments: advancePayments.map(this.mapAdvancePayment),
      availableLossCarryForward: lossRecords.map(this.mapLossCarryForward),
    };
  }

  /**
   * Submit declaration to tax authority
   */
  async submitDeclaration(input: SubmitDeclarationInput): Promise<IncomeTaxDeclaration> {
    const declaration = await this.db.incomeTaxDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    if (!['CALCULATED', 'APPROVED'].includes(declaration.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Declaration must be calculated or approved before submission',
      });
    }

    // Generate submission reference (mock for e-Deklaracje)
    const submissionReference = `ED-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const updated = await this.db.incomeTaxDeclaration.update({
      where: { id: input.declarationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: this.userId,
        submissionReference,
        updatedAt: new Date(),
      },
    });

    return this.mapDeclaration(updated);
  }

  /**
   * Create correction for existing declaration
   */
  async createCorrection(input: CreateDeclarationCorrectionInput): Promise<IncomeTaxDeclaration> {
    const original = await this.db.incomeTaxDeclaration.findFirst({
      where: {
        id: input.originalDeclarationId,
        organizationId: this.organizationId,
      },
    });

    if (!original) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Original declaration not found',
      });
    }

    if (!['SUBMITTED', 'ACCEPTED'].includes(original.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Can only create correction for submitted or accepted declarations',
      });
    }

    // Mark original as corrected
    await this.db.incomeTaxDeclaration.update({
      where: { id: input.originalDeclarationId },
      data: {
        status: 'CORRECTED',
        updatedAt: new Date(),
      },
    });

    // Calculate next correction number
    const correctionCount = await this.db.incomeTaxDeclaration.count({
      where: {
        correctsDeclarationId: input.originalDeclarationId,
      },
    });

    // Create correction declaration
    const correction = await this.db.incomeTaxDeclaration.create({
      data: {
        organizationId: this.organizationId,
        clientId: original.clientId,
        taxType: original.taxType,
        declarationType: 'CORRECTION',
        formType: original.formType,
        taxYear: original.taxYear,
        periodMonth: original.periodMonth,
        periodQuarter: original.periodQuarter,
        totalRevenue: original.totalRevenue,
        totalCosts: original.totalCosts,
        taxableIncome: original.taxableIncome,
        taxLoss: original.taxLoss,
        calculationMethod: original.calculationMethod,
        taxRate: original.taxRate,
        taxDue: original.taxDue,
        taxPaid: original.taxPaid,
        taxToPay: original.taxToPay,
        taxToRefund: original.taxToRefund,
        deductions: original.deductions,
        allowances: original.allowances,
        lossCarryForward: original.lossCarryForward,
        status: 'DRAFT',
        correctsDeclarationId: input.originalDeclarationId,
        correctionReason: input.correctionReason,
        correctionNumber: correctionCount + 1,
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.mapDeclaration(correction);
  }

  /**
   * Get declaration by ID
   */
  async getDeclaration(input: GetDeclarationInput): Promise<DeclarationSummary> {
    const declaration = await this.db.incomeTaxDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    const advancePayments = await this.db.taxAdvancePayment.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: declaration.clientId,
        taxType: declaration.taxType,
        taxYear: declaration.taxYear,
      },
    });

    const lossRecords = await this.db.lossCarryForward.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: declaration.clientId,
        taxType: declaration.taxType,
        remainingAmount: { not: '0' },
        expiryYear: { gte: declaration.taxYear },
      },
    });

    return {
      declaration: this.mapDeclaration(declaration),
      calculation: null, // Would need to recalculate or store
      advancePayments: advancePayments.map(this.mapAdvancePayment),
      availableLossCarryForward: lossRecords.map(this.mapLossCarryForward),
    };
  }

  /**
   * List declarations with filters
   */
  async listDeclarations(input: ListDeclarationsInput): Promise<ListDeclarationsResult> {
    const where: any = {
      organizationId: this.organizationId,
    };

    if (input.clientId) where.clientId = input.clientId;
    if (input.taxType) where.taxType = input.taxType;
    if (input.taxYear) where.taxYear = input.taxYear;
    if (input.status) where.status = input.status;

    const [declarations, total] = await Promise.all([
      this.db.incomeTaxDeclaration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: input.offset,
      }),
      this.db.incomeTaxDeclaration.count({ where }),
    ]);

    return {
      declarations: declarations.map(this.mapDeclaration),
      total,
      limit: input.limit,
      offset: input.offset,
    };
  }

  /**
   * Delete declaration
   */
  async deleteDeclaration(input: DeleteDeclarationInput): Promise<{ success: boolean }> {
    const declaration = await this.db.incomeTaxDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    if (['SUBMITTED', 'ACCEPTED'].includes(declaration.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot delete submitted or accepted declaration',
      });
    }

    await this.db.incomeTaxDeclaration.delete({
      where: { id: input.declarationId },
    });

    return { success: true };
  }

  // =========================================================================
  // ADVANCE PAYMENTS
  // =========================================================================

  /**
   * Calculate advance payment
   */
  async calculateAdvance(input: CalculateAdvanceInput): Promise<TaxAdvancePayment> {
    // Get client tax configuration
    const clientConfig = await this.db.taxConfiguration.findFirst({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
      },
    });

    const cumulativeRevenue = new Decimal(input.cumulativeRevenue);
    const cumulativeCosts = new Decimal(input.cumulativeCosts);
    const cumulativeIncome = cumulativeRevenue.minus(cumulativeCosts);

    // Calculate cumulative tax due
    let taxDue: Decimal;
    if (input.taxType === 'CIT') {
      const rate = clientConfig?.isSmallTaxpayer ? CIT_RATES.SMALL_TAXPAYER : CIT_RATES.STANDARD;
      taxDue = cumulativeIncome.isPositive()
        ? cumulativeIncome.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal('0');
    } else {
      // PIT - simplified calculation
      taxDue = cumulativeIncome.isPositive()
        ? cumulativeIncome.mul(PIT_RATES.FLAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal('0');
    }

    // Get previous advances for this year
    const previousAdvances = await this.db.taxAdvancePayment.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        taxType: input.taxType,
        taxYear: input.taxYear,
        periodNumber: { lt: input.periodNumber },
      },
    });

    const previousTotal = previousAdvances.reduce(
      (sum: Decimal, adv: { currentAdvance: string }) => sum.plus(new Decimal(adv.currentAdvance)),
      new Decimal('0'),
    );

    // Current advance is difference
    let currentAdvance = taxDue.minus(previousTotal);
    if (currentAdvance.isNegative()) {
      currentAdvance = new Decimal('0');
    }

    // Calculate due date (20th of following month for monthly, 20th of month after quarter for quarterly)
    const dueDate = this.calculateAdvanceDueDate(input.taxYear, input.periodType, input.periodNumber);

    // Check if advance already exists
    let advance = await this.db.taxAdvancePayment.findFirst({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        taxType: input.taxType,
        taxYear: input.taxYear,
        periodNumber: input.periodNumber,
      },
    });

    if (advance) {
      // Update existing
      advance = await this.db.taxAdvancePayment.update({
        where: { id: advance.id },
        data: {
          cumulativeRevenue: cumulativeRevenue.toString(),
          cumulativeCosts: cumulativeCosts.toString(),
          cumulativeIncome: cumulativeIncome.toString(),
          taxDue: taxDue.toString(),
          previousAdvances: previousTotal.toString(),
          currentAdvance: currentAdvance.toString(),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new
      advance = await this.db.taxAdvancePayment.create({
        data: {
          organizationId: this.organizationId,
          clientId: input.clientId,
          taxType: input.taxType,
          taxYear: input.taxYear,
          periodType: input.periodType,
          periodNumber: input.periodNumber,
          cumulativeRevenue: cumulativeRevenue.toString(),
          cumulativeCosts: cumulativeCosts.toString(),
          cumulativeIncome: cumulativeIncome.toString(),
          taxDue: taxDue.toString(),
          previousAdvances: previousTotal.toString(),
          currentAdvance: currentAdvance.toString(),
          dueDate,
          isPaid: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return this.mapAdvancePayment(advance);
  }

  /**
   * Record advance payment
   */
  async recordAdvancePayment(input: RecordAdvancePaymentInput): Promise<TaxAdvancePayment> {
    const advance = await this.db.taxAdvancePayment.findFirst({
      where: {
        id: input.advanceId,
        organizationId: this.organizationId,
      },
    });

    if (!advance) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Advance payment not found',
      });
    }

    const updated = await this.db.taxAdvancePayment.update({
      where: { id: input.advanceId },
      data: {
        paidAmount: input.paidAmount,
        paidDate: new Date(input.paidDate),
        isPaid: true,
        updatedAt: new Date(),
      },
    });

    return this.mapAdvancePayment(updated);
  }

  /**
   * Get advance payment schedule
   */
  async getAdvanceSchedule(input: GetAdvanceScheduleInput): Promise<AdvanceSchedule> {
    const advances = await this.db.taxAdvancePayment.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        taxType: input.taxType,
        taxYear: input.taxYear,
      },
      orderBy: { periodNumber: 'asc' },
    });

    const totalDue = advances.reduce(
      (sum: Decimal, adv: { currentAdvance: string }) => sum.plus(new Decimal(adv.currentAdvance)),
      new Decimal('0'),
    );

    const totalPaid = advances.reduce(
      (sum: Decimal, adv: { paidAmount: string | null }) => sum.plus(new Decimal(adv.paidAmount || '0')),
      new Decimal('0'),
    );

    const totalRemaining = totalDue.minus(totalPaid);

    // Determine period type from first advance or default to monthly
    const periodType = advances.length > 0 ? advances[0].periodType : 'MONTHLY';

    return {
      clientId: input.clientId,
      taxType: input.taxType,
      taxYear: input.taxYear,
      periodType: periodType as any,
      advances: advances.map(this.mapAdvancePayment),
      totalDue: totalDue.toString(),
      totalPaid: totalPaid.toString(),
      totalRemaining: totalRemaining.toString(),
    };
  }

  // =========================================================================
  // LOSS CARRY FORWARD
  // =========================================================================

  /**
   * Get available loss carry forward
   */
  async getLossCarryForward(input: GetLossCarryForwardInput): Promise<LossCarryForward[]> {
    const losses = await this.db.lossCarryForward.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        taxType: input.taxType,
        remainingAmount: { not: '0' },
      },
      orderBy: { lossYear: 'asc' },
    });

    return losses.map(this.mapLossCarryForward);
  }

  /**
   * Apply loss carry forward to declaration
   */
  async applyLoss(input: ApplyLossInput): Promise<LossCarryForward> {
    const lossRecord = await this.db.lossCarryForward.findFirst({
      where: {
        id: input.lossRecordId,
        organizationId: this.organizationId,
      },
    });

    if (!lossRecord) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Loss record not found',
      });
    }

    const remaining = new Decimal(lossRecord.remainingAmount);
    const applyAmount = new Decimal(input.amount);

    if (applyAmount.gt(remaining)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot apply more than remaining loss amount',
      });
    }

    // Get declaration year
    const declaration = await this.db.incomeTaxDeclaration.findUnique({
      where: { id: input.declarationId },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    // Update usage history
    const usageHistory = (lossRecord.usageHistory as any[]) || [];
    usageHistory.push({
      usedInYear: declaration.taxYear,
      amount: input.amount,
      declarationId: input.declarationId,
    });

    const newUsedAmount = new Decimal(lossRecord.usedAmount).plus(applyAmount);
    const newRemainingAmount = remaining.minus(applyAmount);

    const updated = await this.db.lossCarryForward.update({
      where: { id: input.lossRecordId },
      data: {
        usedAmount: newUsedAmount.toString(),
        remainingAmount: newRemainingAmount.toString(),
        usageHistory,
        updatedAt: new Date(),
      },
    });

    return this.mapLossCarryForward(updated);
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private async getAvailableLossForCIT(clientId: string, taxYear: number): Promise<Decimal> {
    const losses = await this.db.lossCarryForward.findMany({
      where: {
        organizationId: this.organizationId,
        clientId,
        taxType: 'CIT',
        remainingAmount: { not: '0' },
        expiryYear: { gte: taxYear },
      },
    });

    return losses.reduce(
      (sum: Decimal, loss: { remainingAmount: string }) => sum.plus(new Decimal(loss.remainingAmount)),
      new Decimal('0'),
    );
  }

  private async getAvailableLossForPIT(clientId: string, taxYear: number): Promise<Decimal> {
    const losses = await this.db.lossCarryForward.findMany({
      where: {
        organizationId: this.organizationId,
        clientId,
        taxType: 'PIT',
        remainingAmount: { not: '0' },
        expiryYear: { gte: taxYear },
      },
    });

    return losses.reduce(
      (sum: Decimal, loss: { remainingAmount: string }) => sum.plus(new Decimal(loss.remainingAmount)),
      new Decimal('0'),
    );
  }

  private calculateAdvanceDueDate(year: number, periodType: string, periodNumber: number): Date {
    if (periodType === 'QUARTERLY') {
      // Due on 20th of month after quarter ends
      const quarterEndMonth = periodNumber * 3;
      const dueMonth = quarterEndMonth + 1;
      const dueYear = dueMonth > 12 ? year + 1 : year;
      const adjustedMonth = dueMonth > 12 ? dueMonth - 12 : dueMonth;
      return new Date(dueYear, adjustedMonth - 1, 20);
    } else {
      // Due on 20th of following month
      const dueMonth = periodNumber + 1;
      const dueYear = dueMonth > 12 ? year + 1 : year;
      const adjustedMonth = dueMonth > 12 ? dueMonth - 12 : dueMonth;
      return new Date(dueYear, adjustedMonth - 1, 20);
    }
  }

  private mapCalculationMethodToPITMethod(method: string): 'progressive' | 'flat' | 'lump_sum' {
    switch (method) {
      case 'FLAT_19':
        return 'flat';
      case 'LUMP_SUM':
        return 'lump_sum';
      default:
        return 'progressive';
    }
  }

  private mapDeclaration(dec: any): IncomeTaxDeclaration {
    return {
      id: dec.id,
      organizationId: dec.organizationId,
      clientId: dec.clientId,
      taxType: dec.taxType,
      declarationType: dec.declarationType,
      formType: dec.formType,
      taxYear: dec.taxYear,
      periodMonth: dec.periodMonth,
      periodQuarter: dec.periodQuarter,
      totalRevenue: dec.totalRevenue,
      totalCosts: dec.totalCosts,
      taxableIncome: dec.taxableIncome,
      taxLoss: dec.taxLoss,
      calculationMethod: dec.calculationMethod,
      taxRate: dec.taxRate,
      taxDue: dec.taxDue,
      taxPaid: dec.taxPaid,
      taxToPay: dec.taxToPay,
      taxToRefund: dec.taxToRefund,
      deductions: dec.deductions,
      allowances: dec.allowances,
      lossCarryForward: dec.lossCarryForward,
      status: dec.status,
      calculatedAt: dec.calculatedAt,
      calculatedBy: dec.calculatedBy,
      submittedAt: dec.submittedAt,
      submittedBy: dec.submittedBy,
      submissionReference: dec.submissionReference,
      upoReference: dec.upoReference,
      correctsDeclarationId: dec.correctsDeclarationId,
      correctionReason: dec.correctionReason,
      correctionNumber: dec.correctionNumber,
      createdAt: dec.createdAt,
      createdBy: dec.createdBy,
      updatedAt: dec.updatedAt,
    };
  }

  private mapAdvancePayment(adv: any): TaxAdvancePayment {
    return {
      id: adv.id,
      organizationId: adv.organizationId,
      clientId: adv.clientId,
      taxType: adv.taxType,
      taxYear: adv.taxYear,
      periodType: adv.periodType,
      periodNumber: adv.periodNumber,
      cumulativeRevenue: adv.cumulativeRevenue,
      cumulativeCosts: adv.cumulativeCosts,
      cumulativeIncome: adv.cumulativeIncome,
      taxDue: adv.taxDue,
      previousAdvances: adv.previousAdvances,
      currentAdvance: adv.currentAdvance,
      dueDate: adv.dueDate,
      paidAmount: adv.paidAmount,
      paidDate: adv.paidDate,
      isPaid: adv.isPaid,
      declarationId: adv.declarationId,
      createdAt: adv.createdAt,
      updatedAt: adv.updatedAt,
    };
  }

  private mapLossCarryForward(loss: any): LossCarryForward {
    return {
      id: loss.id,
      organizationId: loss.organizationId,
      clientId: loss.clientId,
      taxType: loss.taxType,
      lossYear: loss.lossYear,
      originalAmount: loss.originalAmount,
      usedAmount: loss.usedAmount,
      remainingAmount: loss.remainingAmount,
      expiryYear: loss.expiryYear,
      usageHistory: loss.usageHistory || [],
      createdAt: loss.createdAt,
      updatedAt: loss.updatedAt,
    };
  }
}
