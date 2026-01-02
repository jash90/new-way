// TAX-004: VAT Calculation Engine Service
// Manages Polish VAT calculations, EU transactions, corrections, and settlements

import { TRPCError } from '@trpc/server';
import Decimal from 'decimal.js';
import type {
  CalculateVatInput,
  VatCalculationResult,
  RecordVatTransactionInput,
  VatTransaction,
  ProcessWntInput,
  ProcessWdtInput,
  ProcessImportServicesInput,
  CreateVatCorrectionInput,
  VatCorrectionResult,
  GetVatSettlementInput,
  VatSettlementResult,
  FinalizeVatSettlementInput,
  ApplyCarryForwardInput,
  GetVatTransactionsInput,
  GetVatTransactionByIdInput,
  VerifyEuVatIdInput,
  EuVatVerificationResult,
  GetCarryForwardsInput,
  CarryForwardWithHistory,
  GetPeriodSummariesInput,
  VatPeriodSummary,
  OutputVatBreakdown,
  InputVatBreakdown,
  VatSettlementBreakdown,
  VatRateCode,
} from '@ksiegowacrm/shared';
import type { PrismaClient } from '@prisma/client';

// ===========================================================================
// CONSTANTS - POLISH VAT RATES
// ===========================================================================

const VAT_RATES: Record<VatRateCode, Decimal> = {
  STANDARD: new Decimal('23'),
  REDUCED_8: new Decimal('8'),
  REDUCED_5: new Decimal('5'),
  ZERO: new Decimal('0'),
  EXEMPT: new Decimal('0'),
  REVERSE_CHARGE: new Decimal('0'),
};

const _VAT_RATE_LABELS: Record<VatRateCode, string> = {
  STANDARD: '23%',
  REDUCED_8: '8%',
  REDUCED_5: '5%',
  ZERO: '0%',
  EXEMPT: 'zw',
  REVERSE_CHARGE: 'np',
};

// VIES API URL for EU VAT ID verification
const _VIES_WSDL_URL = 'https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl';

// ===========================================================================
// VAT CALCULATION SERVICE
// ===========================================================================

export class VatCalculationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly organizationId: string,
    private readonly userId: string,
  ) {}

  // =========================================================================
  // CALCULATION METHODS
  // =========================================================================

  /**
   * Calculate VAT from net or gross amount
   * ADR-004: Uses Decimal.js for financial precision
   */
  async calculateVat(input: CalculateVatInput): Promise<VatCalculationResult> {
    const vatRate = VAT_RATES[input.vatRateCode];
    if (vatRate === undefined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid VAT rate code: ${input.vatRateCode}`,
      });
    }

    const exchangeRate = new Decimal(input.exchangeRate || '1.000000');
    const vatRateFraction = vatRate.div(100);

    let netAmount: Decimal;
    let vatAmount: Decimal;
    let grossAmount: Decimal;

    if (input.netAmount) {
      netAmount = new Decimal(input.netAmount);
      vatAmount = netAmount.mul(vatRateFraction).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      grossAmount = netAmount.plus(vatAmount);
    } else if (input.grossAmount) {
      grossAmount = new Decimal(input.grossAmount);
      // Net = Gross / (1 + VAT rate)
      netAmount = grossAmount.div(new Decimal(1).plus(vatRateFraction)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      vatAmount = grossAmount.minus(netAmount);
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Either netAmount or grossAmount must be provided',
      });
    }

    // Convert to PLN if foreign currency
    const netAmountPln = netAmount.mul(exchangeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const vatAmountPln = vatAmount.mul(exchangeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grossAmountPln = grossAmount.mul(exchangeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      netAmount: netAmount.toString(),
      vatRate: vatRate.toString(),
      vatRateCode: input.vatRateCode,
      vatAmount: vatAmount.toString(),
      grossAmount: grossAmount.toString(),
      netAmountPln: netAmountPln.toString(),
      vatAmountPln: vatAmountPln.toString(),
      grossAmountPln: grossAmountPln.toString(),
      exchangeRate: exchangeRate.toString(),
      currency: input.currency,
    };
  }

  /**
   * Record a VAT transaction
   */
  async recordTransaction(input: RecordVatTransactionInput): Promise<VatTransaction> {
    // Calculate VAT amounts
    const calculation = await this.calculateVat({
      netAmount: input.netAmount,
      vatRateCode: input.vatRateCode,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      transactionDate: input.transactionDate,
    });

    // Determine VAT direction based on transaction type
    const vatDirection = this.getVatDirection(input.transactionType);

    // Check if EU transaction
    const isEuTransaction = ['WNT', 'WDT', 'OSS_SALE'].includes(input.transactionType);

    const transaction = await this.db.vatTransaction.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        documentId: input.documentId,
        transactionType: input.transactionType,
        vatDirection,
        netAmount: calculation.netAmount,
        vatRateCode: input.vatRateCode,
        vatRateValue: calculation.vatRate,
        vatAmount: calculation.vatAmount,
        grossAmount: calculation.grossAmount,
        currency: input.currency,
        exchangeRate: calculation.exchangeRate,
        netAmountPln: calculation.netAmountPln,
        vatAmountPln: calculation.vatAmountPln,
        grossAmountPln: calculation.grossAmountPln,
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.transactionDate,
        counterpartyName: input.counterpartyName,
        counterpartyNip: input.counterpartyNip,
        counterpartyVatId: input.counterpartyVatId,
        isEuTransaction,
        gtuCodes: input.gtuCodes,
        procedureCodes: input.procedureCodes,
        splitPaymentRequired: input.splitPaymentRequired ?? false,
        status: 'ACTIVE',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.mapTransaction(transaction);
  }

  /**
   * Process WNT (Intra-Community Acquisition)
   * Creates both input and output VAT entries (neutral for VAT settlement)
   */
  async processWnt(input: ProcessWntInput): Promise<{ inputTransaction: VatTransaction; outputTransaction: VatTransaction }> {
    // Verify EU VAT ID first
    const verification = await this.verifyEuVatId({ vatId: input.supplierVatId });
    if (!verification.isValid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid EU VAT ID: ${input.supplierVatId}`,
      });
    }

    // Calculate VAT at standard Polish rate
    const calculation = await this.calculateVat({
      netAmount: input.netAmount,
      vatRateCode: 'STANDARD',
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      transactionDate: input.transactionDate,
    });

    // Create output VAT transaction (VAT należny)
    const outputTransaction = await this.db.vatTransaction.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        transactionType: 'WNT',
        vatDirection: 'OUTPUT',
        netAmount: calculation.netAmount,
        vatRateCode: 'STANDARD',
        vatRateValue: calculation.vatRate,
        vatAmount: calculation.vatAmount,
        grossAmount: calculation.grossAmount,
        currency: input.currency,
        exchangeRate: calculation.exchangeRate,
        netAmountPln: calculation.netAmountPln,
        vatAmountPln: calculation.vatAmountPln,
        grossAmountPln: calculation.grossAmountPln,
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.transactionDate,
        counterpartyName: input.supplierName,
        counterpartyVatId: input.supplierVatId,
        counterpartyCountry: input.supplierVatId.substring(0, 2),
        isEuTransaction: true,
        euVatIdVerified: true,
        euVatIdVerificationDate: new Date(),
        status: 'ACTIVE',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create input VAT transaction (VAT naliczony) - deductible
    const inputTransaction = await this.db.vatTransaction.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        transactionType: 'WNT',
        vatDirection: 'INPUT',
        netAmount: calculation.netAmount,
        vatRateCode: 'STANDARD',
        vatRateValue: calculation.vatRate,
        vatAmount: calculation.vatAmount,
        grossAmount: calculation.grossAmount,
        currency: input.currency,
        exchangeRate: calculation.exchangeRate,
        netAmountPln: calculation.netAmountPln,
        vatAmountPln: calculation.vatAmountPln,
        grossAmountPln: calculation.grossAmountPln,
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.transactionDate,
        counterpartyName: input.supplierName,
        counterpartyVatId: input.supplierVatId,
        counterpartyCountry: input.supplierVatId.substring(0, 2),
        isEuTransaction: true,
        euVatIdVerified: true,
        euVatIdVerificationDate: new Date(),
        status: 'ACTIVE',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      inputTransaction: this.mapTransaction(inputTransaction),
      outputTransaction: this.mapTransaction(outputTransaction),
    };
  }

  /**
   * Process WDT (Intra-Community Supply)
   * Creates output transaction with 0% VAT rate
   */
  async processWdt(input: ProcessWdtInput): Promise<VatTransaction> {
    // Verify EU VAT ID first
    const verification = await this.verifyEuVatId({ vatId: input.customerVatId });
    if (!verification.isValid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid EU VAT ID: ${input.customerVatId}`,
      });
    }

    const transaction = await this.db.vatTransaction.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        transactionType: 'WDT',
        vatDirection: 'OUTPUT',
        netAmount: input.netAmount,
        vatRateCode: 'ZERO',
        vatRateValue: '0',
        vatAmount: '0.00',
        grossAmount: input.netAmount,
        currency: input.currency,
        exchangeRate: '1.000000',
        netAmountPln: input.netAmount,
        vatAmountPln: '0.00',
        grossAmountPln: input.netAmount,
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.transactionDate,
        counterpartyName: input.customerName,
        counterpartyVatId: input.customerVatId,
        counterpartyCountry: input.customerVatId.substring(0, 2),
        destinationCountry: input.customerVatId.substring(0, 2),
        isEuTransaction: true,
        euVatIdVerified: true,
        euVatIdVerificationDate: new Date(),
        status: 'ACTIVE',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.mapTransaction(transaction);
  }

  /**
   * Process import of services (reverse charge)
   */
  async processImportServices(input: ProcessImportServicesInput): Promise<{ inputTransaction: VatTransaction; outputTransaction: VatTransaction }> {
    const calculation = await this.calculateVat({
      netAmount: input.netAmount,
      vatRateCode: 'STANDARD',
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      transactionDate: input.transactionDate,
    });

    // Create output VAT transaction (VAT należny)
    const outputTransaction = await this.db.vatTransaction.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'OUTPUT',
        netAmount: calculation.netAmount,
        vatRateCode: 'REVERSE_CHARGE',
        vatRateValue: calculation.vatRate,
        vatAmount: calculation.vatAmount,
        grossAmount: calculation.grossAmount,
        currency: input.currency,
        exchangeRate: calculation.exchangeRate,
        netAmountPln: calculation.netAmountPln,
        vatAmountPln: calculation.vatAmountPln,
        grossAmountPln: calculation.grossAmountPln,
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.transactionDate,
        counterpartyName: input.supplierName,
        counterpartyCountry: input.supplierCountry,
        isEuTransaction: false,
        procedureCodes: ['TP'], // Transaction with related party (if applicable)
        status: 'ACTIVE',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create input VAT transaction if deductible
    const inputTransaction = await this.db.vatTransaction.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'INPUT',
        netAmount: calculation.netAmount,
        vatRateCode: 'REVERSE_CHARGE',
        vatRateValue: calculation.vatRate,
        vatAmount: input.isDeductible ? calculation.vatAmount : '0.00',
        grossAmount: calculation.grossAmount,
        currency: input.currency,
        exchangeRate: calculation.exchangeRate,
        netAmountPln: calculation.netAmountPln,
        vatAmountPln: input.isDeductible ? calculation.vatAmountPln : '0.00',
        grossAmountPln: calculation.grossAmountPln,
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.transactionDate,
        counterpartyName: input.supplierName,
        counterpartyCountry: input.supplierCountry,
        isEuTransaction: false,
        status: 'ACTIVE',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      inputTransaction: this.mapTransaction(inputTransaction),
      outputTransaction: this.mapTransaction(outputTransaction),
    };
  }

  /**
   * Create VAT correction
   */
  async createCorrection(input: CreateVatCorrectionInput): Promise<VatCorrectionResult> {
    // Get original transaction
    const original = await this.db.vatTransaction.findUnique({
      where: { id: input.originalTransactionId },
    });

    if (!original) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Transaction ${input.originalTransactionId} not found`,
      });
    }

    // Calculate VAT amount difference
    const netDifference = new Decimal(input.netAmountDifference);
    const vatRate = VAT_RATES[original.vatRateCode as VatRateCode] || new Decimal('23');
    const vatDifference = netDifference.mul(vatRate.div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grossDifference = netDifference.plus(vatDifference);

    // Create correction transaction
    const correction = await this.db.vatTransaction.create({
      data: {
        organizationId: this.organizationId,
        clientId: original.clientId,
        transactionType: 'CORRECTION',
        vatDirection: original.vatDirection,
        netAmount: netDifference.toString(),
        vatRateCode: original.vatRateCode,
        vatRateValue: original.vatRateValue,
        vatAmount: vatDifference.toString(),
        grossAmount: grossDifference.toString(),
        currency: original.currency,
        exchangeRate: original.exchangeRate,
        netAmountPln: netDifference.toString(),
        vatAmountPln: vatDifference.toString(),
        grossAmountPln: grossDifference.toString(),
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.correctionDate,
        isCorrection: true,
        correctsTransactionId: original.id,
        correctionReason: input.reason,
        status: 'ACTIVE',
        createdBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Mark original as corrected
    await this.db.vatTransaction.update({
      where: { id: original.id },
      data: { status: 'CORRECTED', updatedAt: new Date() },
    });

    return {
      correctionId: correction.id,
      originalTransactionId: original.id,
      netAmountDifference: netDifference.toString(),
      vatAmountDifference: vatDifference.toString(),
      grossAmountDifference: grossDifference.toString(),
      reason: input.reason,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
    };
  }

  // =========================================================================
  // SETTLEMENT METHODS
  // =========================================================================

  /**
   * Get VAT settlement for a period
   */
  async getSettlement(input: GetVatSettlementInput): Promise<VatSettlementResult> {
    // Get all transactions for the period
    const transactions = await this.db.vatTransaction.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        taxPeriodYear: input.year,
        taxPeriodMonth: input.month,
        status: { in: ['ACTIVE', 'CORRECTED'] },
      },
    });

    // Calculate output VAT breakdown
    const outputVat = this.calculateOutputVatBreakdown(transactions);

    // Calculate input VAT breakdown
    const inputVat = this.calculateInputVatBreakdown(transactions);

    // Calculate settlement (now async to fetch carry forward from previous periods)
    const settlement = await this.calculateSettlement(outputVat, inputVat, input.clientId, input.year, input.month);

    // Get existing period summary if any
    const existingSummary = await this.db.vatPeriodSummary.findFirst({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        year: input.year,
        month: input.month,
      },
    });

    // Check accelerated refund eligibility if there's a refund available
    let refundOptions: Array<{ option: string; timeline: string; available: boolean }> | undefined;
    if (settlement.finalVatRefund !== '0.00') {
      const acceleratedEligible = await this.checkAcceleratedRefundEligibility(input.clientId);
      refundOptions = [
        { option: 'BANK_TRANSFER', timeline: '60 dni', available: true },
        { option: 'OFFSET_NEXT_PERIOD', timeline: 'natychmiast', available: true },
        { option: 'ACCELERATED_25D', timeline: '25 dni', available: acceleratedEligible },
        { option: 'ACCELERATED_40D', timeline: '40 dni', available: true },
      ];
    }

    return {
      period: {
        year: input.year,
        month: input.month,
        periodType: 'MONTHLY',
      },
      outputVat,
      inputVat,
      settlement,
      transactionCount: transactions.length,
      status: existingSummary?.status || 'DRAFT',
      refundOptions,
    };
  }

  /**
   * Finalize VAT settlement
   */
  async finalizeSettlement(input: FinalizeVatSettlementInput): Promise<VatPeriodSummary> {
    const settlement = await this.getSettlement({
      clientId: input.clientId,
      year: input.year,
      month: input.month,
    });

    // Create or update period summary
    const summary = await this.db.vatPeriodSummary.upsert({
      where: {
        organizationId_clientId_year_month: {
          organizationId: this.organizationId,
          clientId: input.clientId,
          year: input.year,
          month: input.month,
        },
      },
      create: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        year: input.year,
        month: input.month,
        periodType: 'MONTHLY',
        outputVat23: settlement.outputVat.rate23,
        outputVat8: settlement.outputVat.rate8,
        outputVat5: settlement.outputVat.rate5,
        outputVat0: settlement.outputVat.rate0,
        outputVatWdt: settlement.outputVat.wdt,
        outputVatExport: settlement.outputVat.exports,
        outputVatReverseCharge: settlement.outputVat.reverseCharge,
        outputVatTotal: settlement.outputVat.total,
        inputVatDeductible: settlement.inputVat.deductible,
        inputVatNonDeductible: settlement.inputVat.nonDeductible,
        inputVatFixedAssets: settlement.inputVat.fixedAssets,
        inputVatWnt: settlement.inputVat.wnt,
        inputVatImport: settlement.inputVat.imports,
        inputVatTotal: settlement.inputVat.total,
        vatDue: settlement.settlement.vatDue,
        vatRefund: settlement.settlement.vatRefund,
        carryForwardFromPrevious: settlement.settlement.carryForwardFromPrevious,
        carryForwardToNext: settlement.settlement.carryForwardToNext,
        finalVatDue: settlement.settlement.finalVatDue,
        finalVatRefund: settlement.settlement.finalVatRefund,
        refundOption: input.refundOption,
        status: 'CALCULATED',
        calculatedAt: new Date(),
        calculatedBy: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        outputVat23: settlement.outputVat.rate23,
        outputVat8: settlement.outputVat.rate8,
        outputVat5: settlement.outputVat.rate5,
        outputVat0: settlement.outputVat.rate0,
        outputVatWdt: settlement.outputVat.wdt,
        outputVatExport: settlement.outputVat.exports,
        outputVatReverseCharge: settlement.outputVat.reverseCharge,
        outputVatTotal: settlement.outputVat.total,
        inputVatDeductible: settlement.inputVat.deductible,
        inputVatNonDeductible: settlement.inputVat.nonDeductible,
        inputVatFixedAssets: settlement.inputVat.fixedAssets,
        inputVatWnt: settlement.inputVat.wnt,
        inputVatImport: settlement.inputVat.imports,
        inputVatTotal: settlement.inputVat.total,
        vatDue: settlement.settlement.vatDue,
        vatRefund: settlement.settlement.vatRefund,
        carryForwardFromPrevious: settlement.settlement.carryForwardFromPrevious,
        carryForwardToNext: settlement.settlement.carryForwardToNext,
        finalVatDue: settlement.settlement.finalVatDue,
        finalVatRefund: settlement.settlement.finalVatRefund,
        refundOption: input.refundOption,
        status: 'CALCULATED',
        calculatedAt: new Date(),
        calculatedBy: this.userId,
        updatedAt: new Date(),
      },
    });

    // Create carry forward record if applicable
    if (input.refundOption === 'OFFSET_NEXT_PERIOD' && new Decimal(settlement.settlement.finalVatRefund).gt(0)) {
      await this.db.vatCarryForward.create({
        data: {
          organizationId: this.organizationId,
          clientId: input.clientId,
          sourceYear: input.year,
          sourceMonth: input.month,
          sourceSummaryId: summary.id,
          originalAmount: settlement.settlement.finalVatRefund,
          remainingAmount: settlement.settlement.finalVatRefund,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return this.mapPeriodSummary(summary);
  }

  /**
   * Apply carry forward to a period
   */
  async applyCarryForward(input: ApplyCarryForwardInput): Promise<CarryForwardWithHistory> {
    const carryForward = await this.db.vatCarryForward.findUnique({
      where: { id: input.carryForwardId },
    });

    if (!carryForward) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Carry forward ${input.carryForwardId} not found`,
      });
    }

    const remainingAmount = new Decimal(carryForward.remainingAmount);
    const amountToApply = new Decimal(input.amountToApply);

    if (amountToApply.gt(remainingAmount)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot apply ${amountToApply} - only ${remainingAmount} remaining`,
      });
    }

    const newRemaining = remainingAmount.minus(amountToApply);
    const newStatus = newRemaining.isZero() ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED';

    // Update carry forward
    await this.db.vatCarryForward.update({
      where: { id: input.carryForwardId },
      data: {
        remainingAmount: newRemaining.toString(),
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    // Create application record
    await this.db.vatCarryForwardApplication.create({
      data: {
        carryForwardId: input.carryForwardId,
        targetYear: input.targetYear,
        targetMonth: input.targetMonth,
        amountApplied: amountToApply.toString(),
        appliedAt: new Date(),
      },
    });

    // Return updated carry forward with history
    return this.getCarryForwardWithHistory(input.carryForwardId);
  }

  // =========================================================================
  // RETRIEVAL METHODS
  // =========================================================================

  /**
   * Get VAT transactions for a period
   */
  async getTransactions(input: GetVatTransactionsInput): Promise<VatTransaction[]> {
    const whereClause: Record<string, unknown> = {
      organizationId: this.organizationId,
      clientId: input.clientId,
      taxPeriodYear: input.year,
      taxPeriodMonth: input.month,
    };

    if (input.transactionType) {
      whereClause.transactionType = input.transactionType;
    }

    if (input.vatDirection) {
      whereClause.vatDirection = input.vatDirection;
    }

    if (input.status) {
      whereClause.status = input.status;
    }

    const transactions = await this.db.vatTransaction.findMany({
      where: whereClause,
      orderBy: { transactionDate: 'desc' },
    });

    return transactions.map(t => this.mapTransaction(t));
  }

  /**
   * Get VAT transaction by ID
   */
  async getTransactionById(input: GetVatTransactionByIdInput): Promise<VatTransaction> {
    const transaction = await this.db.vatTransaction.findUnique({
      where: { id: input.transactionId },
    });

    if (!transaction) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Transaction ${input.transactionId} not found`,
      });
    }

    return this.mapTransaction(transaction);
  }

  /**
   * Verify EU VAT ID via VIES
   */
  async verifyEuVatId(input: VerifyEuVatIdInput): Promise<EuVatVerificationResult> {
    // Check cache first
    if (!input.forceRefresh) {
      const cached = await this.db.euVatVerification.findFirst({
        where: {
          vatId: input.vatId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { verifiedAt: 'desc' },
      });

      if (cached) {
        return {
          vatId: cached.vatId,
          countryCode: cached.countryCode,
          isValid: cached.isValid,
          companyName: cached.companyName,
          companyAddress: cached.companyAddress,
          verifiedAt: cached.verifiedAt,
          expiresAt: cached.expiresAt,
          cached: true,
        };
      }
    }

    // Extract country code from VAT ID (first 2 characters)
    const countryCode = input.vatId.substring(0, 2).toUpperCase();
    const vatNumber = input.vatId.substring(2);

    // In production, call VIES API
    // For now, simulate verification
    const isValid = this.simulateViesVerification(countryCode, vatNumber);

    // Cache the result
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Cache for 7 days

    const verification = await this.db.euVatVerification.create({
      data: {
        vatId: input.vatId,
        countryCode,
        isValid,
        companyName: isValid ? `Company for ${input.vatId}` : null,
        companyAddress: isValid ? 'Address from VIES' : null,
        verifiedAt: new Date(),
        expiresAt,
      },
    });

    return {
      vatId: verification.vatId,
      countryCode: verification.countryCode,
      isValid: verification.isValid,
      companyName: verification.companyName,
      companyAddress: verification.companyAddress,
      verifiedAt: verification.verifiedAt,
      expiresAt: verification.expiresAt,
      cached: false,
    };
  }

  /**
   * Get carry forwards for a client
   */
  async getCarryForwards(input: GetCarryForwardsInput): Promise<CarryForwardWithHistory[]> {
    const whereClause: Record<string, unknown> = {
      organizationId: this.organizationId,
      clientId: input.clientId,
    };

    if (input.status) {
      whereClause.status = input.status;
    }

    const carryForwards = await this.db.vatCarryForward.findMany({
      where: whereClause,
      include: {
        applications: true,
      },
      orderBy: [
        { sourceYear: 'desc' },
        { sourceMonth: 'desc' },
      ],
    });

    return carryForwards.map(cf => ({
      id: cf.id,
      organizationId: cf.organizationId,
      clientId: cf.clientId,
      sourceYear: cf.sourceYear,
      sourceMonth: cf.sourceMonth,
      sourceSummaryId: cf.sourceSummaryId,
      originalAmount: cf.originalAmount,
      remainingAmount: cf.remainingAmount,
      status: cf.status as 'ACTIVE' | 'PARTIALLY_APPLIED' | 'FULLY_APPLIED' | 'REFUNDED' | 'EXPIRED',
      createdAt: cf.createdAt,
      updatedAt: cf.updatedAt,
      applications: cf.applications.map(a => ({
        id: a.id,
        targetYear: a.targetYear,
        targetMonth: a.targetMonth,
        amountApplied: a.amountApplied,
        appliedAt: a.appliedAt,
      })),
    }));
  }

  /**
   * Get period summaries
   */
  async getPeriodSummaries(input: GetPeriodSummariesInput): Promise<VatPeriodSummary[]> {
    const summaries = await this.db.vatPeriodSummary.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        OR: [
          {
            year: { gt: input.startYear },
          },
          {
            year: input.startYear,
            month: { gte: input.startMonth },
          },
        ],
        AND: [
          {
            OR: [
              { year: { lt: input.endYear } },
              {
                year: input.endYear,
                month: { lte: input.endMonth },
              },
            ],
          },
        ],
      },
      orderBy: [
        { year: 'asc' },
        { month: 'asc' },
      ],
    });

    return summaries.map(s => this.mapPeriodSummary(s));
  }

  // =========================================================================
  // PRIVATE HELPER METHODS
  // =========================================================================

  private getVatDirection(transactionType: string): 'INPUT' | 'OUTPUT' | 'BOTH' {
    const inputTypes = ['DOMESTIC_PURCHASE', 'IMPORT_GOODS', 'IMPORT_SERVICES'];
    const outputTypes = ['DOMESTIC_SALE', 'WDT', 'EXPORT', 'OSS_SALE'];
    const bothTypes = ['WNT', 'REVERSE_CHARGE'];

    if (inputTypes.includes(transactionType)) return 'INPUT';
    if (outputTypes.includes(transactionType)) return 'OUTPUT';
    if (bothTypes.includes(transactionType)) return 'BOTH';
    return 'OUTPUT';
  }

  private calculateOutputVatBreakdown(transactions: Array<{ vatDirection: string; vatRateCode: string; vatAmountPln: string; netAmountPln: string; transactionType: string }>): OutputVatBreakdown {
    const outputTransactions = transactions.filter(t => t.vatDirection === 'OUTPUT' || t.vatDirection === 'BOTH');

    const rate23 = this.sumByRate(outputTransactions, 'STANDARD');
    const rate8 = this.sumByRate(outputTransactions, 'REDUCED_8');
    const rate5 = this.sumByRate(outputTransactions, 'REDUCED_5');
    const rate0 = this.sumByRate(outputTransactions, 'ZERO');
    const wdt = this.sumByType(outputTransactions, 'WDT');
    const exports = this.sumByType(outputTransactions, 'EXPORT');
    const reverseCharge = this.sumByRate(outputTransactions, 'REVERSE_CHARGE');

    const total = new Decimal(rate23)
      .plus(rate8)
      .plus(rate5)
      .plus(reverseCharge);

    return {
      rate23,
      rate8,
      rate5,
      rate0,
      wdt,
      exports,
      reverseCharge,
      total: total.toString(),
    };
  }

  private calculateInputVatBreakdown(transactions: Array<{ vatDirection: string; vatRateCode: string; vatAmountPln: string; transactionType: string }>): InputVatBreakdown {
    const inputTransactions = transactions.filter(t => t.vatDirection === 'INPUT' || t.vatDirection === 'BOTH');

    const deductible = inputTransactions
      .filter(t => !['WNT', 'IMPORT_GOODS', 'IMPORT_SERVICES'].includes(t.transactionType))
      .reduce((sum, t) => sum.plus(t.vatAmountPln), new Decimal(0))
      .toString();

    const wnt = this.sumByTypeVat(inputTransactions, 'WNT');
    const imports = new Decimal(this.sumByTypeVat(inputTransactions, 'IMPORT_GOODS'))
      .plus(this.sumByTypeVat(inputTransactions, 'IMPORT_SERVICES'))
      .toString();

    const total = new Decimal(deductible)
      .plus(wnt)
      .plus(imports);

    return {
      deductible,
      nonDeductible: '0.00',
      fixedAssets: '0.00',
      wnt,
      imports,
      total: total.toString(),
    };
  }

  private async calculateSettlement(
    outputVat: OutputVatBreakdown,
    inputVat: InputVatBreakdown,
    clientId: string,
    year: number,
    month: number,
  ): Promise<VatSettlementBreakdown> {
    const outputTotal = new Decimal(outputVat.total);
    const inputTotal = new Decimal(inputVat.total);
    const difference = outputTotal.minus(inputTotal);

    // Get carry forward from previous period - find active/partially applied carry forwards
    // that have remaining amounts to apply to this period
    const activeCarryForwards = await this.db.vatCarryForward.findMany({
      where: {
        organizationId: this.organizationId,
        clientId,
        status: { in: ['ACTIVE', 'PARTIALLY_APPLIED'] },
        OR: [
          // Previous year, any month
          { sourceYear: { lt: year } },
          // Same year, previous months
          { sourceYear: year, sourceMonth: { lt: month } },
        ],
      },
      orderBy: [
        { sourceYear: 'asc' },
        { sourceMonth: 'asc' },
      ],
    }) || [];

    // Sum up all remaining amounts from previous periods
    const carryForwardFromPrevious = (activeCarryForwards || []).reduce(
      (sum, cf) => sum.plus(new Decimal(cf.remainingAmount)),
      new Decimal(0),
    );

    const adjustedDifference = difference.minus(carryForwardFromPrevious);

    let vatDue = new Decimal(0);
    let vatRefund = new Decimal(0);
    let carryForwardToNext = new Decimal(0);

    if (adjustedDifference.gt(0)) {
      vatDue = adjustedDifference;
    } else if (adjustedDifference.lt(0)) {
      vatRefund = adjustedDifference.abs();
    }

    return {
      vatDue: vatDue.toString(),
      vatRefund: vatRefund.toString(),
      carryForwardFromPrevious: carryForwardFromPrevious.toString(),
      carryForwardToNext: carryForwardToNext.toString(),
      finalVatDue: vatDue.toString(),
      finalVatRefund: vatRefund.toString(),
    };
  }

  private sumByRate(transactions: Array<{ vatRateCode: string; vatAmountPln: string }>, rateCode: string): string {
    return transactions
      .filter(t => t.vatRateCode === rateCode)
      .reduce((sum, t) => sum.plus(t.vatAmountPln), new Decimal(0))
      .toDecimalPlaces(2)
      .toString();
  }

  private sumByType(transactions: Array<{ transactionType: string; netAmountPln: string }>, type: string): string {
    return transactions
      .filter(t => t.transactionType === type)
      .reduce((sum, t) => sum.plus(t.netAmountPln), new Decimal(0))
      .toDecimalPlaces(2)
      .toString();
  }

  private sumByTypeVat(transactions: Array<{ transactionType: string; vatAmountPln: string }>, type: string): string {
    return transactions
      .filter(t => t.transactionType === type)
      .reduce((sum, t) => sum.plus(t.vatAmountPln), new Decimal(0))
      .toDecimalPlaces(2)
      .toString();
  }

  private async checkAcceleratedRefundEligibility(clientId: string): Promise<boolean> {
    // Requirements for accelerated VAT refund (25 days instead of 60):
    // 1. Good tax history - no late VAT submissions in last 12 months
    // 2. No tax arrears - all previous VAT obligations settled
    // 3. Registered on white list - active VAT payer status

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Check 1: No late submissions in last 12 months
    const lateSubmissions = await this.db.vatPeriodSummary.count({
      where: {
        organizationId: this.organizationId,
        clientId,
        submittedAt: { gte: twelveMonthsAgo },
        status: { in: ['SUBMITTED_LATE', 'OVERDUE'] },
      },
    });

    if (lateSubmissions > 0) {
      return false;
    }

    // Check 2: No outstanding VAT dues (arrears)
    const unpaidDues = await this.db.vatPeriodSummary.findFirst({
      where: {
        organizationId: this.organizationId,
        clientId,
        vatDue: { gt: '0' },
        status: { notIn: ['PAID', 'FINALIZED'] },
      },
    });

    if (unpaidDues) {
      return false;
    }

    // Check 3: Verify white list registration (active VAT payer)
    const recentVerification = await this.db.whiteListVerification.findFirst({
      where: {
        organizationId: this.organizationId,
        clientId,
        status: 'ACTIVE',
        verifiedAt: { gte: twelveMonthsAgo },
      },
      orderBy: { verifiedAt: 'desc' },
    });

    if (!recentVerification) {
      return false;
    }

    return true;
  }

  private simulateViesVerification(countryCode: string, _vatNumber: string): boolean {
    // EU country codes
    const euCountries = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
    return euCountries.includes(countryCode);
  }

  private async getCarryForwardWithHistory(carryForwardId: string): Promise<CarryForwardWithHistory> {
    const carryForward = await this.db.vatCarryForward.findUnique({
      where: { id: carryForwardId },
      include: {
        applications: true,
      },
    });

    if (!carryForward) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Carry forward ${carryForwardId} not found`,
      });
    }

    return {
      id: carryForward.id,
      organizationId: carryForward.organizationId,
      clientId: carryForward.clientId,
      sourceYear: carryForward.sourceYear,
      sourceMonth: carryForward.sourceMonth,
      sourceSummaryId: carryForward.sourceSummaryId,
      originalAmount: carryForward.originalAmount,
      remainingAmount: carryForward.remainingAmount,
      status: carryForward.status as 'ACTIVE' | 'PARTIALLY_APPLIED' | 'FULLY_APPLIED' | 'REFUNDED' | 'EXPIRED',
      createdAt: carryForward.createdAt,
      updatedAt: carryForward.updatedAt,
      applications: carryForward.applications.map(a => ({
        id: a.id,
        targetYear: a.targetYear,
        targetMonth: a.targetMonth,
        amountApplied: a.amountApplied,
        appliedAt: a.appliedAt,
      })),
    };
  }

  private mapTransaction(transaction: Record<string, unknown>): VatTransaction {
    return {
      id: transaction.id as string,
      organizationId: transaction.organizationId as string,
      clientId: transaction.clientId as string,
      documentId: transaction.documentId as string | null,
      journalEntryId: transaction.journalEntryId as string | null,
      transactionType: transaction.transactionType as VatTransaction['transactionType'],
      vatDirection: transaction.vatDirection as VatTransaction['vatDirection'],
      netAmount: transaction.netAmount as string,
      vatRateCode: transaction.vatRateCode as VatTransaction['vatRateCode'],
      vatRateValue: transaction.vatRateValue as string,
      vatAmount: transaction.vatAmount as string,
      grossAmount: transaction.grossAmount as string,
      currency: transaction.currency as string,
      exchangeRate: transaction.exchangeRate as string,
      netAmountPln: transaction.netAmountPln as string,
      vatAmountPln: transaction.vatAmountPln as string,
      grossAmountPln: transaction.grossAmountPln as string,
      taxPeriodYear: transaction.taxPeriodYear as number,
      taxPeriodMonth: transaction.taxPeriodMonth as number,
      transactionDate: transaction.transactionDate as Date,
      counterpartyName: transaction.counterpartyName as string | null,
      counterpartyNip: transaction.counterpartyNip as string | null,
      counterpartyCountry: transaction.counterpartyCountry as string | null,
      counterpartyVatId: transaction.counterpartyVatId as string | null,
      isEuTransaction: transaction.isEuTransaction as boolean,
      euVatIdVerified: transaction.euVatIdVerified as boolean | null,
      euVatIdVerificationDate: transaction.euVatIdVerificationDate as Date | null,
      destinationCountry: transaction.destinationCountry as string | null,
      isCorrection: transaction.isCorrection as boolean,
      correctsTransactionId: transaction.correctsTransactionId as string | null,
      correctionReason: transaction.correctionReason as string | null,
      jpkDocumentType: transaction.jpkDocumentType as string | null,
      gtuCodes: transaction.gtuCodes as VatTransaction['gtuCodes'],
      procedureCodes: transaction.procedureCodes as VatTransaction['procedureCodes'],
      splitPaymentRequired: transaction.splitPaymentRequired as boolean,
      status: transaction.status as VatTransaction['status'],
      createdBy: transaction.createdBy as string,
      updatedBy: transaction.updatedBy as string | null,
      createdAt: transaction.createdAt as Date,
      updatedAt: transaction.updatedAt as Date,
    };
  }

  private mapPeriodSummary(summary: Record<string, unknown>): VatPeriodSummary {
    return {
      id: summary.id as string,
      organizationId: summary.organizationId as string,
      clientId: summary.clientId as string,
      year: summary.year as number,
      month: summary.month as number,
      periodType: summary.periodType as VatPeriodSummary['periodType'],
      quarter: summary.quarter as number | null,
      outputVat23: summary.outputVat23 as string,
      outputVat8: summary.outputVat8 as string,
      outputVat5: summary.outputVat5 as string,
      outputVat0: summary.outputVat0 as string,
      outputVatWdt: summary.outputVatWdt as string,
      outputVatExport: summary.outputVatExport as string,
      outputVatReverseCharge: summary.outputVatReverseCharge as string,
      outputVatTotal: summary.outputVatTotal as string,
      inputVatDeductible: summary.inputVatDeductible as string,
      inputVatNonDeductible: summary.inputVatNonDeductible as string,
      inputVatFixedAssets: summary.inputVatFixedAssets as string,
      inputVatWnt: summary.inputVatWnt as string,
      inputVatImport: summary.inputVatImport as string,
      inputVatTotal: summary.inputVatTotal as string,
      vatDue: summary.vatDue as string,
      vatRefund: summary.vatRefund as string,
      carryForwardFromPrevious: summary.carryForwardFromPrevious as string,
      carryForwardToNext: summary.carryForwardToNext as string,
      finalVatDue: summary.finalVatDue as string,
      finalVatRefund: summary.finalVatRefund as string,
      refundOption: summary.refundOption as VatPeriodSummary['refundOption'],
      status: summary.status as VatPeriodSummary['status'],
      jpkFileId: summary.jpkFileId as string | null,
      submissionDate: summary.submissionDate as Date | null,
      upoNumber: summary.upoNumber as string | null,
      calculatedAt: summary.calculatedAt as Date | null,
      calculatedBy: summary.calculatedBy as string | null,
      createdAt: summary.createdAt as Date,
      updatedAt: summary.updatedAt as Date,
    };
  }
}
