import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '../../index';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  calculateVat: vi.fn(),
  recordTransaction: vi.fn(),
  processWnt: vi.fn(),
  processWdt: vi.fn(),
  processImportServices: vi.fn(),
  createCorrection: vi.fn(),
  getSettlement: vi.fn(),
  finalizeSettlement: vi.fn(),
  applyCarryForward: vi.fn(),
  getTransactions: vi.fn(),
  getTransactionById: vi.fn(),
  verifyEuVatId: vi.fn(),
  getCarryForwards: vi.fn(),
  getPeriodSummaries: vi.fn(),
}));

vi.mock('../../services/tax/vat-calculation.service', () => ({
  VatCalculationService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const TRANSACTION_ID = '44444444-4444-4444-4444-444444444444';
const CARRY_FORWARD_ID = '55555555-5555-5555-5555-555555555555';
const SUMMARY_ID = '66666666-6666-6666-6666-666666666666';

const createAuthenticatedContext = () => ({
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
    email: 'test@example.com',
    role: 'user',
  },
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
});

const createUnauthenticatedContext = () => ({
  session: null,
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
});

const sampleVatTransaction = {
  id: TRANSACTION_ID,
  organizationId: TEST_ORG_ID,
  clientId: CLIENT_ID,
  documentId: null,
  journalEntryId: null,
  transactionType: 'DOMESTIC_SALE',
  vatDirection: 'OUTPUT',
  netAmount: '1000',
  vatRateCode: 'STANDARD',
  vatRateValue: '23',
  vatAmount: '230',
  grossAmount: '1230',
  currency: 'PLN',
  exchangeRate: '1',
  netAmountPln: '1000',
  vatAmountPln: '230',
  grossAmountPln: '1230',
  taxPeriodYear: 2024,
  taxPeriodMonth: 6,
  transactionDate: new Date('2024-06-15'),
  counterpartyName: 'Test Company Sp. z o.o.',
  counterpartyNip: '1234567890',
  counterpartyCountry: 'PL',
  counterpartyVatId: null,
  isEuTransaction: false,
  euVatIdVerified: null,
  euVatIdVerificationDate: null,
  destinationCountry: null,
  isCorrection: false,
  correctsTransactionId: null,
  correctionReason: null,
  jpkDocumentType: null,
  gtuCodes: null,
  procedureCodes: null,
  splitPaymentRequired: false,
  status: 'ACTIVE',
  createdBy: TEST_USER_ID,
  createdAt: new Date('2024-06-15'),
  updatedAt: new Date('2024-06-15'),
};

const sampleVatPeriodSummary = {
  id: SUMMARY_ID,
  organizationId: TEST_ORG_ID,
  clientId: CLIENT_ID,
  year: 2024,
  month: 6,
  periodType: 'MONTHLY',
  outputVat23: '2300',
  outputVat8: '0',
  outputVat5: '0',
  outputVat0: '0',
  outputVatWdt: '0',
  outputVatExport: '0',
  outputVatReverseCharge: '0',
  outputVatTotal: '2300',
  inputVatDeductible: '1150',
  inputVatNonDeductible: '0',
  inputVatFixedAssets: '0',
  inputVatWnt: '0',
  inputVatImport: '0',
  inputVatTotal: '1150',
  vatDue: '1150',
  vatRefund: '0',
  carryForwardFromPrevious: '0',
  carryForwardToNext: '0',
  finalVatDue: '1150',
  finalVatRefund: '0',
  refundOption: null,
  status: 'CALCULATED',
  calculatedAt: new Date('2024-07-01'),
  calculatedBy: TEST_USER_ID,
  createdAt: new Date('2024-07-01'),
  updatedAt: new Date('2024-07-01'),
};

const sampleCarryForward = {
  id: CARRY_FORWARD_ID,
  organizationId: TEST_ORG_ID,
  clientId: CLIENT_ID,
  sourceYear: 2024,
  sourceMonth: 5,
  sourceSummaryId: SUMMARY_ID,
  originalAmount: '500',
  remainingAmount: '500',
  status: 'ACTIVE',
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date('2024-06-01'),
  applications: [],
};

describe('vatCalculationRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AUTHENTICATION TESTS
  // =========================================================================

  describe('authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.tax.vatCalculation.calculateVat({
          netAmount: '1000',
          vatRateCode: 'STANDARD',
          currency: 'PLN',
          transactionDate: new Date('2024-06-15'),
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // CALCULATION ENDPOINTS
  // =========================================================================

  describe('calculateVat', () => {
    it('should calculate VAT from net amount', async () => {
      mocks.calculateVat.mockResolvedValue({
        netAmount: '1000',
        vatRate: '23',
        vatRateCode: 'STANDARD',
        vatAmount: '230',
        grossAmount: '1230',
        netAmountPln: '1000',
        vatAmountPln: '230',
        grossAmountPln: '1230',
        exchangeRate: '1',
        currency: 'PLN',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.calculateVat({
        netAmount: '1000',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(result.netAmount).toBe('1000');
      expect(result.vatAmount).toBe('230');
      expect(result.grossAmount).toBe('1230');
      expect(result.vatRate).toBe('23');
    });

    it('should calculate VAT from gross amount', async () => {
      mocks.calculateVat.mockResolvedValue({
        netAmount: '1000',
        vatRate: '23',
        vatRateCode: 'STANDARD',
        vatAmount: '230',
        grossAmount: '1230',
        netAmountPln: '1000',
        vatAmountPln: '230',
        grossAmountPln: '1230',
        exchangeRate: '1',
        currency: 'PLN',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.calculateVat({
        grossAmount: '1230',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(result.netAmount).toBe('1000');
      expect(result.vatAmount).toBe('230');
    });

    it('should apply exchange rate correctly', async () => {
      mocks.calculateVat.mockResolvedValue({
        netAmount: '1000',
        vatRate: '23',
        vatRateCode: 'STANDARD',
        vatAmount: '230',
        grossAmount: '1230',
        netAmountPln: '4500',
        vatAmountPln: '1035',
        grossAmountPln: '5535',
        exchangeRate: '4.5',
        currency: 'EUR',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.calculateVat({
        netAmount: '1000',
        vatRateCode: 'STANDARD',
        currency: 'EUR',
        exchangeRate: '4.5',
        transactionDate: new Date('2024-06-15'),
      });

      expect(result.netAmountPln).toBe('4500');
      expect(result.vatAmountPln).toBe('1035');
      expect(result.grossAmountPln).toBe('5535');
    });

    it('should calculate reduced VAT rates correctly', async () => {
      mocks.calculateVat
        .mockResolvedValueOnce({
          netAmount: '100',
          vatRate: '8',
          vatRateCode: 'REDUCED_8',
          vatAmount: '8',
          grossAmount: '108',
          netAmountPln: '100',
          vatAmountPln: '8',
          grossAmountPln: '108',
          exchangeRate: '1',
          currency: 'PLN',
        })
        .mockResolvedValueOnce({
          netAmount: '100',
          vatRate: '5',
          vatRateCode: 'REDUCED_5',
          vatAmount: '5',
          grossAmount: '105',
          netAmountPln: '100',
          vatAmountPln: '5',
          grossAmountPln: '105',
          exchangeRate: '1',
          currency: 'PLN',
        });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result8 = await caller.tax.vatCalculation.calculateVat({
        netAmount: '100',
        vatRateCode: 'REDUCED_8',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      const result5 = await caller.tax.vatCalculation.calculateVat({
        netAmount: '100',
        vatRateCode: 'REDUCED_5',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(result8.vatAmount).toBe('8');
      expect(result5.vatAmount).toBe('5');
    });
  });

  describe('recordTransaction', () => {
    it('should record a domestic sale transaction', async () => {
      mocks.recordTransaction.mockResolvedValue(sampleVatTransaction);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.recordTransaction({
        clientId: CLIENT_ID,
        transactionType: 'DOMESTIC_SALE',
        netAmount: '1000',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        counterpartyName: 'Test Company Sp. z o.o.',
        counterpartyNip: '1234567890',
      });

      expect(result.id).toBe(TRANSACTION_ID);
      expect(result.transactionType).toBe('DOMESTIC_SALE');
      expect(mocks.recordTransaction).toHaveBeenCalled();
    });

    it('should include GTU codes when provided', async () => {
      mocks.recordTransaction.mockResolvedValue({
        ...sampleVatTransaction,
        gtuCodes: ['GTU_01', 'GTU_02'],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.recordTransaction({
        clientId: CLIENT_ID,
        transactionType: 'DOMESTIC_SALE',
        netAmount: '1000',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        gtuCodes: ['GTU_01', 'GTU_02'],
      });

      expect(result.gtuCodes).toEqual(['GTU_01', 'GTU_02']);
    });
  });

  // =========================================================================
  // EU TRANSACTION ENDPOINTS
  // =========================================================================

  describe('processWnt', () => {
    it('should process WNT and create both transactions', async () => {
      const outputTx = { ...sampleVatTransaction, transactionType: 'WNT', vatDirection: 'OUTPUT', isEuTransaction: true };
      const inputTx = { ...sampleVatTransaction, transactionType: 'WNT', vatDirection: 'INPUT', isEuTransaction: true };

      mocks.processWnt.mockResolvedValue({
        outputTransaction: outputTx,
        inputTransaction: inputTx,
        vatIdVerification: {
          isValid: true,
          companyName: 'German Company GmbH',
          companyAddress: 'Berlin, Germany',
          countryCode: 'DE',
        },
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.processWnt({
        clientId: CLIENT_ID,
        netAmount: '1000',
        currency: 'EUR',
        exchangeRate: '4.5',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        supplierName: 'German Company GmbH',
        supplierVatId: 'DE123456789',
      });

      expect(result.outputTransaction.transactionType).toBe('WNT');
      expect(result.inputTransaction.transactionType).toBe('WNT');
      expect(result.outputTransaction.isEuTransaction).toBe(true);
    });
  });

  describe('processWdt', () => {
    it('should process WDT with 0% VAT', async () => {
      mocks.processWdt.mockResolvedValue({
        ...sampleVatTransaction,
        transactionType: 'WDT',
        vatRateCode: 'ZERO',
        vatAmount: '0',
        isEuTransaction: true,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.processWdt({
        clientId: CLIENT_ID,
        netAmount: '1000',
        currency: 'PLN',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        customerName: 'French Company SARL',
        customerVatId: 'FR12345678901',
      });

      expect(result.transactionType).toBe('WDT');
      expect(result.vatRateCode).toBe('ZERO');
      expect(result.vatAmount).toBe('0');
    });
  });

  describe('processImportServices', () => {
    it('should process import services with reverse charge', async () => {
      const outputTx = {
        ...sampleVatTransaction,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'OUTPUT',
      };
      const inputTx = {
        ...sampleVatTransaction,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'INPUT',
      };

      mocks.processImportServices.mockResolvedValue({
        outputTransaction: outputTx,
        inputTransaction: inputTx,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.processImportServices({
        clientId: CLIENT_ID,
        netAmount: '1000',
        currency: 'USD',
        exchangeRate: '4',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        supplierName: 'US Service Provider Inc.',
        supplierCountry: 'US',
        isDeductible: true,
        serviceDescription: 'IT consulting services',
      });

      expect(result.outputTransaction.transactionType).toBe('IMPORT_SERVICES');
      expect(result.inputTransaction.transactionType).toBe('IMPORT_SERVICES');
    });
  });

  // =========================================================================
  // CORRECTION ENDPOINT
  // =========================================================================

  describe('createCorrection', () => {
    it('should create correction and mark original as corrected', async () => {
      mocks.createCorrection.mockResolvedValue({
        correctionTransaction: {
          ...sampleVatTransaction,
          id: '77777777-7777-7777-7777-777777777777',
          transactionType: 'CORRECTION',
          isCorrection: true,
          correctsTransactionId: TRANSACTION_ID,
        },
        originalTransactionId: TRANSACTION_ID,
        netAmountDifference: '-100',
        vatAmountDifference: '-23',
        reason: 'Quantity adjustment',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.createCorrection({
        originalTransactionId: TRANSACTION_ID,
        netAmountDifference: '-100',
        reason: 'Quantity adjustment',
        periodYear: 2024,
        periodMonth: 6,
        correctionDate: new Date('2024-06-20'),
      });

      expect(result.originalTransactionId).toBe(TRANSACTION_ID);
      expect(result.reason).toBe('Quantity adjustment');
    });
  });

  // =========================================================================
  // SETTLEMENT ENDPOINTS
  // =========================================================================

  describe('getSettlement', () => {
    it('should return settlement for a period', async () => {
      mocks.getSettlement.mockResolvedValue({
        period: { year: 2024, month: 6 },
        clientId: CLIENT_ID,
        outputVat: {
          vat23: '2300',
          vat8: '0',
          vat5: '0',
          vat0: '0',
          wdt: '0',
          export: '0',
          reverseCharge: '0',
          total: '2300',
        },
        inputVat: {
          deductible: '1150',
          nonDeductible: '0',
          fixedAssets: '0',
          wnt: '0',
          import: '0',
          total: '1150',
        },
        settlement: {
          vatDue: '1150',
          vatRefund: '0',
          carryForwardFromPrevious: '0',
          finalVatDue: '1150',
          finalVatRefund: '0',
        },
        transactionCount: 2,
        status: 'DRAFT',
        refundOptions: [],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.getSettlement({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
      });

      expect(result.period.year).toBe(2024);
      expect(result.period.month).toBe(6);
      expect(result.transactionCount).toBe(2);
    });
  });

  describe('finalizeSettlement', () => {
    it('should finalize settlement and create period summary', async () => {
      mocks.finalizeSettlement.mockResolvedValue(sampleVatPeriodSummary);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.finalizeSettlement({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        refundOption: 'BANK_TRANSFER',
      });

      expect(result.status).toBe('CALCULATED');
      expect(mocks.finalizeSettlement).toHaveBeenCalled();
    });
  });

  describe('applyCarryForward', () => {
    it('should apply carry forward to target period', async () => {
      mocks.applyCarryForward.mockResolvedValue({
        ...sampleCarryForward,
        remainingAmount: '300',
        status: 'PARTIALLY_APPLIED',
        applications: [{
          id: '88888888-8888-8888-8888-888888888888',
          targetYear: 2024,
          targetMonth: 7,
          amountApplied: '200',
          appliedAt: new Date(),
        }],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.applyCarryForward({
        carryForwardId: CARRY_FORWARD_ID,
        targetYear: 2024,
        targetMonth: 7,
        amountToApply: '200',
      });

      expect(result.remainingAmount).toBe('300');
      expect(result.status).toBe('PARTIALLY_APPLIED');
    });
  });

  // =========================================================================
  // RETRIEVAL ENDPOINTS
  // =========================================================================

  describe('getTransactions', () => {
    it('should retrieve transactions for a period', async () => {
      mocks.getTransactions.mockResolvedValue([
        sampleVatTransaction,
        { ...sampleVatTransaction, id: '99999999-9999-9999-9999-999999999999' },
      ]);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.getTransactions({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
      });

      expect(result).toHaveLength(2);
    });

    it('should filter by transaction type', async () => {
      mocks.getTransactions.mockResolvedValue([sampleVatTransaction]);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.vatCalculation.getTransactions({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        transactionType: 'DOMESTIC_SALE',
      });

      expect(mocks.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: 'DOMESTIC_SALE',
        })
      );
    });
  });

  describe('getTransactionById', () => {
    it('should retrieve transaction by ID', async () => {
      mocks.getTransactionById.mockResolvedValue(sampleVatTransaction);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.getTransactionById({
        transactionId: TRANSACTION_ID,
      });

      expect(result.id).toBe(TRANSACTION_ID);
    });

    it('should throw error when transaction not found', async () => {
      mocks.getTransactionById.mockRejectedValue(
        new Error('Transaction not found')
      );

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.vatCalculation.getTransactionById({
          transactionId: 'non-existent-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('verifyEuVatId', () => {
    it('should return cached verification', async () => {
      mocks.verifyEuVatId.mockResolvedValue({
        vatId: 'DE123456789',
        countryCode: 'DE',
        isValid: true,
        companyName: 'German Company GmbH',
        companyAddress: 'Berlin, Germany',
        cached: true,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.verifyEuVatId({
        vatId: 'DE123456789',
      });

      expect(result.cached).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should verify new VAT ID', async () => {
      mocks.verifyEuVatId.mockResolvedValue({
        vatId: 'FR12345678901',
        countryCode: 'FR',
        isValid: true,
        companyName: 'Company for FR12345678901',
        companyAddress: 'Address from VIES',
        cached: false,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.verifyEuVatId({
        vatId: 'FR12345678901',
      });

      expect(result.cached).toBe(false);
      expect(result.isValid).toBe(true);
    });
  });

  describe('getCarryForwards', () => {
    it('should retrieve carry forwards for a client', async () => {
      mocks.getCarryForwards.mockResolvedValue([
        { ...sampleCarryForward, applications: [] },
      ]);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.getCarryForwards({
        clientId: CLIENT_ID,
      });

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe(CLIENT_ID);
    });
  });

  describe('getPeriodSummaries', () => {
    it('should retrieve period summaries', async () => {
      mocks.getPeriodSummaries.mockResolvedValue([sampleVatPeriodSummary]);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.vatCalculation.getPeriodSummaries({
        clientId: CLIENT_ID,
        startYear: 2024,
        startMonth: 1,
        endYear: 2024,
        endMonth: 12,
      });

      expect(result).toHaveLength(1);
      expect(result[0].year).toBe(2024);
    });
  });
});
