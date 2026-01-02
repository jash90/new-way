import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VatCalculationService } from '../../services/tax/vat-calculation.service';
import { TRPCError } from '@trpc/server';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  vatTransaction: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  vatPeriodSummary: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  vatCarryForward: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  vatCarryForwardApplication: {
    create: vi.fn(),
  },
  euVatVerification: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  whiteListVerification: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  taxConfiguration: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(mockPrisma)),
};

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const TRANSACTION_ID = '44444444-4444-4444-4444-444444444444';
const CARRY_FORWARD_ID = '55555555-5555-5555-5555-555555555555';
const SUMMARY_ID = '66666666-6666-6666-6666-666666666666';

const createService = () =>
  new VatCalculationService(
    mockPrisma as unknown as Parameters<typeof VatCalculationService.prototype.calculateVat>[0] extends infer T ? T extends { db: infer D } ? D : never : never,
    TEST_ORG_ID,
    TEST_USER_ID
  );

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

const sampleWntTransaction = {
  ...sampleVatTransaction,
  transactionType: 'WNT',
  counterpartyVatId: 'DE123456789',
  counterpartyCountry: 'DE',
  isEuTransaction: true,
  euVatIdVerified: true,
  euVatIdVerificationDate: new Date('2024-06-15'),
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

// Helper to normalize decimal strings (remove trailing zeros for comparison)
const normalizeDecimal = (value: string): string => {
  const num = parseFloat(value);
  return num.toString();
};

describe('VatCalculationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // CALCULATION TESTS
  // =========================================================================

  describe('calculateVat', () => {
    it('should calculate VAT from net amount with standard rate (23%)', async () => {
      const service = createService();

      const result = await service.calculateVat({
        netAmount: '1000',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.netAmount)).toBe('1000');
      expect(normalizeDecimal(result.vatRate)).toBe('23');
      expect(result.vatRateCode).toBe('STANDARD');
      expect(normalizeDecimal(result.vatAmount)).toBe('230');
      expect(normalizeDecimal(result.grossAmount)).toBe('1230');
      expect(result.currency).toBe('PLN');
    });

    it('should calculate VAT from net amount with reduced rate (8%)', async () => {
      const service = createService();

      const result = await service.calculateVat({
        netAmount: '100',
        vatRateCode: 'REDUCED_8',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.netAmount)).toBe('100');
      expect(normalizeDecimal(result.vatRate)).toBe('8');
      expect(normalizeDecimal(result.vatAmount)).toBe('8');
      expect(normalizeDecimal(result.grossAmount)).toBe('108');
    });

    it('should calculate VAT from net amount with reduced rate (5%)', async () => {
      const service = createService();

      const result = await service.calculateVat({
        netAmount: '200',
        vatRateCode: 'REDUCED_5',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.netAmount)).toBe('200');
      expect(normalizeDecimal(result.vatRate)).toBe('5');
      expect(normalizeDecimal(result.vatAmount)).toBe('10');
      expect(normalizeDecimal(result.grossAmount)).toBe('210');
    });

    it('should calculate VAT from net amount with zero rate', async () => {
      const service = createService();

      const result = await service.calculateVat({
        netAmount: '500',
        vatRateCode: 'ZERO',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.netAmount)).toBe('500');
      expect(normalizeDecimal(result.vatRate)).toBe('0');
      expect(normalizeDecimal(result.vatAmount)).toBe('0');
      expect(normalizeDecimal(result.grossAmount)).toBe('500');
    });

    it('should calculate VAT from gross amount', async () => {
      const service = createService();

      const result = await service.calculateVat({
        grossAmount: '1230',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.netAmount)).toBe('1000');
      expect(normalizeDecimal(result.vatAmount)).toBe('230');
      expect(normalizeDecimal(result.grossAmount)).toBe('1230');
    });

    it('should apply exchange rate for foreign currency', async () => {
      const service = createService();

      const result = await service.calculateVat({
        netAmount: '1000',
        vatRateCode: 'STANDARD',
        currency: 'EUR',
        exchangeRate: '4.5',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.netAmount)).toBe('1000');
      expect(normalizeDecimal(result.vatAmount)).toBe('230');
      expect(normalizeDecimal(result.grossAmount)).toBe('1230');
      expect(normalizeDecimal(result.netAmountPln)).toBe('4500');
      expect(normalizeDecimal(result.vatAmountPln)).toBe('1035');
      expect(normalizeDecimal(result.grossAmountPln)).toBe('5535');
      expect(normalizeDecimal(result.exchangeRate)).toBe('4.5');
    });

    it('should throw error when neither net nor gross amount provided', async () => {
      const service = createService();

      await expect(
        service.calculateVat({
          vatRateCode: 'STANDARD',
          currency: 'PLN',
          transactionDate: new Date('2024-06-15'),
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should handle EXEMPT rate correctly', async () => {
      const service = createService();

      const result = await service.calculateVat({
        netAmount: '1000',
        vatRateCode: 'EXEMPT',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.vatAmount)).toBe('0');
      expect(normalizeDecimal(result.grossAmount)).toBe('1000');
    });

    it('should handle REVERSE_CHARGE rate correctly', async () => {
      const service = createService();

      const result = await service.calculateVat({
        netAmount: '1000',
        vatRateCode: 'REVERSE_CHARGE',
        currency: 'PLN',
        transactionDate: new Date('2024-06-15'),
      });

      expect(normalizeDecimal(result.vatAmount)).toBe('0');
      expect(normalizeDecimal(result.grossAmount)).toBe('1000');
    });
  });

  // =========================================================================
  // TRANSACTION RECORDING TESTS
  // =========================================================================

  describe('recordTransaction', () => {
    it('should record a domestic sale transaction', async () => {
      const service = createService();
      mockPrisma.vatTransaction.create.mockResolvedValue(sampleVatTransaction);

      const result = await service.recordTransaction({
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

      expect(mockPrisma.vatTransaction.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(TRANSACTION_ID);
      expect(result.transactionType).toBe('DOMESTIC_SALE');
      expect(result.vatDirection).toBe('OUTPUT');
    });

    it('should record a domestic purchase transaction', async () => {
      const service = createService();
      const purchaseTransaction = {
        ...sampleVatTransaction,
        transactionType: 'DOMESTIC_PURCHASE',
        vatDirection: 'INPUT',
      };
      mockPrisma.vatTransaction.create.mockResolvedValue(purchaseTransaction);

      const result = await service.recordTransaction({
        clientId: CLIENT_ID,
        transactionType: 'DOMESTIC_PURCHASE',
        netAmount: '1000',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        counterpartyName: 'Supplier Sp. z o.o.',
        counterpartyNip: '9876543210',
      });

      expect(result.transactionType).toBe('DOMESTIC_PURCHASE');
      expect(result.vatDirection).toBe('INPUT');
    });

    it('should include GTU codes in transaction', async () => {
      const service = createService();
      mockPrisma.vatTransaction.create.mockResolvedValue({
        ...sampleVatTransaction,
        gtuCodes: ['GTU_01', 'GTU_02'],
      });

      await service.recordTransaction({
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

      expect(mockPrisma.vatTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gtuCodes: ['GTU_01', 'GTU_02'],
          }),
        })
      );
    });

    it('should set splitPaymentRequired when specified', async () => {
      const service = createService();
      mockPrisma.vatTransaction.create.mockResolvedValue({
        ...sampleVatTransaction,
        splitPaymentRequired: true,
      });

      await service.recordTransaction({
        clientId: CLIENT_ID,
        transactionType: 'DOMESTIC_SALE',
        netAmount: '15001',
        vatRateCode: 'STANDARD',
        currency: 'PLN',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        splitPaymentRequired: true,
      });

      expect(mockPrisma.vatTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            splitPaymentRequired: true,
          }),
        })
      );
    });
  });

  // =========================================================================
  // EU TRANSACTION TESTS
  // =========================================================================

  describe('processWnt', () => {
    it('should create both input and output VAT transactions for WNT', async () => {
      const service = createService();

      mockPrisma.euVatVerification.findFirst.mockResolvedValue(null);
      mockPrisma.euVatVerification.create.mockResolvedValue({
        vatId: 'DE123456789',
        countryCode: 'DE',
        isValid: true,
        companyName: 'German Company GmbH',
        companyAddress: 'Berlin, Germany',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const outputTx = { ...sampleWntTransaction, vatDirection: 'OUTPUT' };
      const inputTx = { ...sampleWntTransaction, vatDirection: 'INPUT' };

      mockPrisma.vatTransaction.create
        .mockResolvedValueOnce(outputTx)
        .mockResolvedValueOnce(inputTx);

      const result = await service.processWnt({
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

      expect(mockPrisma.vatTransaction.create).toHaveBeenCalledTimes(2);
      expect(result.outputTransaction.vatDirection).toBe('OUTPUT');
      expect(result.inputTransaction.vatDirection).toBe('INPUT');
      expect(result.outputTransaction.isEuTransaction).toBe(true);
    });

    it('should throw error for invalid EU VAT ID', async () => {
      const service = createService();

      mockPrisma.euVatVerification.findFirst.mockResolvedValue(null);
      mockPrisma.euVatVerification.create.mockResolvedValue({
        vatId: 'XX123456789',
        countryCode: 'XX',
        isValid: false,
        companyName: null,
        companyAddress: null,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await expect(
        service.processWnt({
          clientId: CLIENT_ID,
          netAmount: '1000',
          currency: 'EUR',
          periodYear: 2024,
          periodMonth: 6,
          transactionDate: new Date('2024-06-15'),
          supplierName: 'Invalid Company',
          supplierVatId: 'XX123456789',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('processWdt', () => {
    it('should create 0% VAT transaction for WDT', async () => {
      const service = createService();

      mockPrisma.euVatVerification.findFirst.mockResolvedValue(null);
      mockPrisma.euVatVerification.create.mockResolvedValue({
        vatId: 'FR12345678901',
        countryCode: 'FR',
        isValid: true,
        companyName: 'French Company SARL',
        companyAddress: 'Paris, France',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      mockPrisma.vatTransaction.create.mockResolvedValue({
        ...sampleVatTransaction,
        transactionType: 'WDT',
        vatRateCode: 'ZERO',
        vatRateValue: '0',
        vatAmount: '0',
        grossAmount: '1000',
        counterpartyVatId: 'FR12345678901',
        isEuTransaction: true,
      });

      const result = await service.processWdt({
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
      expect(normalizeDecimal(result.vatAmount)).toBe('0');
      expect(result.isEuTransaction).toBe(true);
    });
  });

  describe('processImportServices', () => {
    it('should create both input and output transactions for import services', async () => {
      const service = createService();

      const outputTx = {
        ...sampleVatTransaction,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'OUTPUT',
        vatRateCode: 'REVERSE_CHARGE',
      };
      const inputTx = {
        ...sampleVatTransaction,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'INPUT',
        vatRateCode: 'REVERSE_CHARGE',
      };

      mockPrisma.vatTransaction.create
        .mockResolvedValueOnce(outputTx)
        .mockResolvedValueOnce(inputTx);

      const result = await service.processImportServices({
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

      expect(mockPrisma.vatTransaction.create).toHaveBeenCalledTimes(2);
      expect(result.outputTransaction.transactionType).toBe('IMPORT_SERVICES');
      expect(result.inputTransaction.transactionType).toBe('IMPORT_SERVICES');
    });

    it('should set VAT to 0 for input when not deductible', async () => {
      const service = createService();

      const outputTx = {
        ...sampleVatTransaction,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'OUTPUT',
      };
      const inputTx = {
        ...sampleVatTransaction,
        transactionType: 'IMPORT_SERVICES',
        vatDirection: 'INPUT',
        vatAmount: '0',
        vatAmountPln: '0',
      };

      mockPrisma.vatTransaction.create
        .mockResolvedValueOnce(outputTx)
        .mockResolvedValueOnce(inputTx);

      const result = await service.processImportServices({
        clientId: CLIENT_ID,
        netAmount: '1000',
        currency: 'USD',
        exchangeRate: '4',
        periodYear: 2024,
        periodMonth: 6,
        transactionDate: new Date('2024-06-15'),
        supplierName: 'US Service Provider Inc.',
        supplierCountry: 'US',
        isDeductible: false,
        serviceDescription: 'Entertainment services',
      });

      expect(normalizeDecimal(result.inputTransaction.vatAmount)).toBe('0');
    });
  });

  // =========================================================================
  // CORRECTION TESTS
  // =========================================================================

  describe('createCorrection', () => {
    it('should create correction transaction and mark original as corrected', async () => {
      const service = createService();

      mockPrisma.vatTransaction.findUnique.mockResolvedValue(sampleVatTransaction);

      const correctionTx = {
        ...sampleVatTransaction,
        id: '77777777-7777-7777-7777-777777777777',
        transactionType: 'CORRECTION',
        isCorrection: true,
        correctsTransactionId: TRANSACTION_ID,
        netAmount: '-100',
        vatAmount: '-23',
        grossAmount: '-123',
      };
      mockPrisma.vatTransaction.create.mockResolvedValue(correctionTx);
      mockPrisma.vatTransaction.update.mockResolvedValue({
        ...sampleVatTransaction,
        status: 'CORRECTED',
      });

      const result = await service.createCorrection({
        originalTransactionId: TRANSACTION_ID,
        netAmountDifference: '-100',
        reason: 'Quantity adjustment',
        periodYear: 2024,
        periodMonth: 6,
        correctionDate: new Date('2024-06-20'),
      });

      expect(result.originalTransactionId).toBe(TRANSACTION_ID);
      expect(normalizeDecimal(result.netAmountDifference)).toBe('-100');
      expect(result.reason).toBe('Quantity adjustment');
      expect(mockPrisma.vatTransaction.update).toHaveBeenCalledWith({
        where: { id: TRANSACTION_ID },
        data: expect.objectContaining({ status: 'CORRECTED' }),
      });
    });

    it('should throw error when original transaction not found', async () => {
      const service = createService();
      mockPrisma.vatTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.createCorrection({
          originalTransactionId: 'non-existent-id',
          netAmountDifference: '-100',
          reason: 'Test',
          periodYear: 2024,
          periodMonth: 6,
          correctionDate: new Date(),
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // SETTLEMENT TESTS
  // =========================================================================

  describe('getSettlement', () => {
    it('should calculate VAT settlement for a period', async () => {
      const service = createService();

      mockPrisma.vatTransaction.findMany.mockResolvedValue([
        // Output transactions
        {
          ...sampleVatTransaction,
          vatDirection: 'OUTPUT',
          vatRateCode: 'STANDARD',
          vatAmountPln: '2300',
          netAmountPln: '10000',
        },
        // Input transactions
        {
          ...sampleVatTransaction,
          vatDirection: 'INPUT',
          transactionType: 'DOMESTIC_PURCHASE',
          vatRateCode: 'STANDARD',
          vatAmountPln: '1150',
          netAmountPln: '5000',
        },
      ]);
      mockPrisma.vatPeriodSummary.findFirst.mockResolvedValue(null);

      const result = await service.getSettlement({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
      });

      expect(result.period.year).toBe(2024);
      expect(result.period.month).toBe(6);
      expect(result.transactionCount).toBe(2);
      expect(parseFloat(result.outputVat.total)).toBeGreaterThan(0);
      expect(parseFloat(result.inputVat.total)).toBeGreaterThan(0);
    });

    it('should include refund options when refund is due', async () => {
      const service = createService();

      mockPrisma.vatTransaction.findMany.mockResolvedValue([
        // More input VAT than output
        {
          ...sampleVatTransaction,
          vatDirection: 'INPUT',
          transactionType: 'DOMESTIC_PURCHASE',
          vatRateCode: 'STANDARD',
          vatAmountPln: '5000',
          netAmountPln: '21739.13',
        },
        {
          ...sampleVatTransaction,
          vatDirection: 'OUTPUT',
          vatRateCode: 'STANDARD',
          vatAmountPln: '1000',
          netAmountPln: '4347.83',
        },
      ]);
      mockPrisma.vatPeriodSummary.findFirst.mockResolvedValue(null);

      const result = await service.getSettlement({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
      });

      expect(result.refundOptions).toBeDefined();
      expect(result.refundOptions?.length).toBeGreaterThan(0);
    });
  });

  describe('finalizeSettlement', () => {
    it('should create period summary and carry forward when offsetting to next period', async () => {
      const service = createService();

      mockPrisma.vatTransaction.findMany.mockResolvedValue([
        {
          ...sampleVatTransaction,
          vatDirection: 'INPUT',
          transactionType: 'DOMESTIC_PURCHASE',
          vatRateCode: 'STANDARD',
          vatAmountPln: '5000',
          netAmountPln: '21739.13',
        },
        {
          ...sampleVatTransaction,
          vatDirection: 'OUTPUT',
          vatRateCode: 'STANDARD',
          vatAmountPln: '1000',
          netAmountPln: '4347.83',
        },
      ]);
      mockPrisma.vatPeriodSummary.findFirst.mockResolvedValue(null);
      mockPrisma.vatPeriodSummary.upsert.mockResolvedValue(sampleVatPeriodSummary);
      mockPrisma.vatCarryForward.create.mockResolvedValue(sampleCarryForward);

      const result = await service.finalizeSettlement({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        refundOption: 'OFFSET_NEXT_PERIOD',
      });

      expect(mockPrisma.vatPeriodSummary.upsert).toHaveBeenCalled();
      expect(result.status).toBe('CALCULATED');
    });
  });

  // =========================================================================
  // CARRY FORWARD TESTS
  // =========================================================================

  describe('applyCarryForward', () => {
    it('should apply carry forward amount to target period', async () => {
      const service = createService();

      mockPrisma.vatCarryForward.findUnique
        .mockResolvedValueOnce(sampleCarryForward)
        .mockResolvedValueOnce({
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

      mockPrisma.vatCarryForward.update.mockResolvedValue({
        ...sampleCarryForward,
        remainingAmount: '300',
        status: 'PARTIALLY_APPLIED',
      });
      mockPrisma.vatCarryForwardApplication.create.mockResolvedValue({
        id: '88888888-8888-8888-8888-888888888888',
        carryForwardId: CARRY_FORWARD_ID,
        targetYear: 2024,
        targetMonth: 7,
        amountApplied: '200',
        appliedAt: new Date(),
      });

      const result = await service.applyCarryForward({
        carryForwardId: CARRY_FORWARD_ID,
        targetYear: 2024,
        targetMonth: 7,
        amountToApply: '200',
      });

      expect(normalizeDecimal(result.remainingAmount)).toBe('300');
      expect(result.status).toBe('PARTIALLY_APPLIED');
    });

    it('should mark as fully applied when all amount used', async () => {
      const service = createService();

      mockPrisma.vatCarryForward.findUnique
        .mockResolvedValueOnce(sampleCarryForward)
        .mockResolvedValueOnce({
          ...sampleCarryForward,
          remainingAmount: '0',
          status: 'FULLY_APPLIED',
          applications: [{
            id: '88888888-8888-8888-8888-888888888888',
            targetYear: 2024,
            targetMonth: 7,
            amountApplied: '500',
            appliedAt: new Date(),
          }],
        });

      mockPrisma.vatCarryForward.update.mockResolvedValue({
        ...sampleCarryForward,
        remainingAmount: '0',
        status: 'FULLY_APPLIED',
      });
      mockPrisma.vatCarryForwardApplication.create.mockResolvedValue({
        id: '88888888-8888-8888-8888-888888888888',
        carryForwardId: CARRY_FORWARD_ID,
        targetYear: 2024,
        targetMonth: 7,
        amountApplied: '500',
        appliedAt: new Date(),
      });

      const result = await service.applyCarryForward({
        carryForwardId: CARRY_FORWARD_ID,
        targetYear: 2024,
        targetMonth: 7,
        amountToApply: '500',
      });

      expect(result.status).toBe('FULLY_APPLIED');
    });

    it('should throw error when applying more than remaining amount', async () => {
      const service = createService();
      mockPrisma.vatCarryForward.findUnique.mockResolvedValue(sampleCarryForward);

      await expect(
        service.applyCarryForward({
          carryForwardId: CARRY_FORWARD_ID,
          targetYear: 2024,
          targetMonth: 7,
          amountToApply: '600', // More than 500 remaining
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error when carry forward not found', async () => {
      const service = createService();
      mockPrisma.vatCarryForward.findUnique.mockResolvedValue(null);

      await expect(
        service.applyCarryForward({
          carryForwardId: 'non-existent-id',
          targetYear: 2024,
          targetMonth: 7,
          amountToApply: '100',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // RETRIEVAL TESTS
  // =========================================================================

  describe('getTransactions', () => {
    it('should retrieve transactions for a period', async () => {
      const service = createService();
      mockPrisma.vatTransaction.findMany.mockResolvedValue([
        sampleVatTransaction,
        { ...sampleVatTransaction, id: '99999999-9999-9999-9999-999999999999' },
      ]);

      const result = await service.getTransactions({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
      });

      expect(result).toHaveLength(2);
      expect(mockPrisma.vatTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: CLIENT_ID,
            taxPeriodYear: 2024,
            taxPeriodMonth: 6,
          }),
        })
      );
    });

    it('should filter by transaction type', async () => {
      const service = createService();
      mockPrisma.vatTransaction.findMany.mockResolvedValue([sampleVatTransaction]);

      await service.getTransactions({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        transactionType: 'DOMESTIC_SALE',
      });

      expect(mockPrisma.vatTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transactionType: 'DOMESTIC_SALE',
          }),
        })
      );
    });

    it('should filter by VAT direction', async () => {
      const service = createService();
      mockPrisma.vatTransaction.findMany.mockResolvedValue([sampleVatTransaction]);

      await service.getTransactions({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        vatDirection: 'OUTPUT',
      });

      expect(mockPrisma.vatTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vatDirection: 'OUTPUT',
          }),
        })
      );
    });
  });

  describe('getTransactionById', () => {
    it('should retrieve transaction by ID', async () => {
      const service = createService();
      mockPrisma.vatTransaction.findUnique.mockResolvedValue(sampleVatTransaction);

      const result = await service.getTransactionById({
        transactionId: TRANSACTION_ID,
      });

      expect(result.id).toBe(TRANSACTION_ID);
      expect(mockPrisma.vatTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: TRANSACTION_ID },
      });
    });

    it('should throw error when transaction not found', async () => {
      const service = createService();
      mockPrisma.vatTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.getTransactionById({
          transactionId: 'non-existent-id',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // EU VAT VERIFICATION TESTS
  // =========================================================================

  describe('verifyEuVatId', () => {
    it('should return cached verification result', async () => {
      const service = createService();
      const cachedResult = {
        vatId: 'DE123456789',
        countryCode: 'DE',
        isValid: true,
        companyName: 'German Company GmbH',
        companyAddress: 'Berlin, Germany',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockPrisma.euVatVerification.findFirst.mockResolvedValue(cachedResult);

      const result = await service.verifyEuVatId({
        vatId: 'DE123456789',
      });

      expect(result.cached).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.companyName).toBe('German Company GmbH');
    });

    it('should verify new VAT ID and cache result', async () => {
      const service = createService();
      mockPrisma.euVatVerification.findFirst.mockResolvedValue(null);
      mockPrisma.euVatVerification.create.mockResolvedValue({
        vatId: 'FR12345678901',
        countryCode: 'FR',
        isValid: true,
        companyName: 'Company for FR12345678901',
        companyAddress: 'Address from VIES',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await service.verifyEuVatId({
        vatId: 'FR12345678901',
      });

      expect(result.cached).toBe(false);
      expect(result.isValid).toBe(true);
      expect(mockPrisma.euVatVerification.create).toHaveBeenCalled();
    });

    it('should force refresh when specified', async () => {
      const service = createService();
      mockPrisma.euVatVerification.findFirst.mockResolvedValue(null);
      mockPrisma.euVatVerification.create.mockResolvedValue({
        vatId: 'IT12345678901',
        countryCode: 'IT',
        isValid: true,
        companyName: 'Company for IT12345678901',
        companyAddress: 'Address from VIES',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await service.verifyEuVatId({
        vatId: 'IT12345678901',
        forceRefresh: true,
      });

      expect(result.cached).toBe(false);
      // findFirst is still called but result is ignored when forceRefresh is true
      expect(mockPrisma.euVatVerification.create).toHaveBeenCalled();
    });

    it('should return invalid for non-EU country codes', async () => {
      const service = createService();
      mockPrisma.euVatVerification.findFirst.mockResolvedValue(null);
      mockPrisma.euVatVerification.create.mockResolvedValue({
        vatId: 'US123456789',
        countryCode: 'US',
        isValid: false,
        companyName: null,
        companyAddress: null,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await service.verifyEuVatId({
        vatId: 'US123456789',
      });

      expect(result.isValid).toBe(false);
    });
  });

  // =========================================================================
  // CARRY FORWARD RETRIEVAL TESTS
  // =========================================================================

  describe('getCarryForwards', () => {
    it('should retrieve carry forwards for a client', async () => {
      const service = createService();
      mockPrisma.vatCarryForward.findMany.mockResolvedValue([
        { ...sampleCarryForward, applications: [] },
      ]);

      const result = await service.getCarryForwards({
        clientId: CLIENT_ID,
      });

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe(CLIENT_ID);
    });

    it('should filter by status', async () => {
      const service = createService();
      mockPrisma.vatCarryForward.findMany.mockResolvedValue([
        { ...sampleCarryForward, applications: [] },
      ]);

      await service.getCarryForwards({
        clientId: CLIENT_ID,
        status: 'ACTIVE',
      });

      expect(mockPrisma.vatCarryForward.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });
  });

  // =========================================================================
  // PERIOD SUMMARIES TESTS
  // =========================================================================

  describe('getPeriodSummaries', () => {
    it('should retrieve period summaries within date range', async () => {
      const service = createService();
      mockPrisma.vatPeriodSummary.findMany.mockResolvedValue([
        sampleVatPeriodSummary,
      ]);

      const result = await service.getPeriodSummaries({
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
