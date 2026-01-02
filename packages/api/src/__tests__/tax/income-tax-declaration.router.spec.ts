import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '../../index';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  calculateCIT: vi.fn(),
  calculatePIT: vi.fn(),
  createDeclaration: vi.fn(),
  updateDeclaration: vi.fn(),
  calculateDeclaration: vi.fn(),
  submitDeclaration: vi.fn(),
  createCorrection: vi.fn(),
  getDeclaration: vi.fn(),
  listDeclarations: vi.fn(),
  deleteDeclaration: vi.fn(),
  calculateAdvance: vi.fn(),
  recordAdvancePayment: vi.fn(),
  getAdvanceSchedule: vi.fn(),
  getLossCarryForward: vi.fn(),
  applyLoss: vi.fn(),
}));

vi.mock('../../services/tax/income-tax-declaration.service', () => ({
  IncomeTaxDeclarationService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const DECLARATION_ID = '44444444-4444-4444-4444-444444444444';
const ADVANCE_ID = '55555555-5555-5555-5555-555555555555';
const LOSS_RECORD_ID = '66666666-6666-6666-6666-666666666666';

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

const sampleDeclaration = {
  id: DECLARATION_ID,
  organizationId: TEST_ORG_ID,
  clientId: CLIENT_ID,
  taxType: 'CIT',
  declarationType: 'ANNUAL',
  formType: 'CIT-8',
  taxYear: 2024,
  periodMonth: null,
  periodQuarter: null,
  totalRevenue: '1000000',
  totalCosts: '600000',
  taxableIncome: '400000',
  taxLoss: '0',
  calculationMethod: 'CIT_STANDARD',
  taxRate: '19',
  taxDue: '76000',
  taxPaid: '50000',
  taxToPay: '26000',
  taxToRefund: '0',
  deductions: null,
  allowances: null,
  lossCarryForward: null,
  status: 'DRAFT',
  calculatedAt: null,
  calculatedBy: null,
  submittedAt: null,
  submittedBy: null,
  submissionReference: null,
  upoReference: null,
  correctsDeclarationId: null,
  correctionReason: null,
  correctionNumber: null,
  createdAt: new Date('2024-01-15'),
  createdBy: TEST_USER_ID,
  updatedAt: new Date('2024-01-15'),
};

const sampleAdvancePayment = {
  id: ADVANCE_ID,
  organizationId: TEST_ORG_ID,
  clientId: CLIENT_ID,
  taxType: 'CIT',
  taxYear: 2024,
  periodType: 'MONTHLY',
  periodNumber: 6,
  cumulativeRevenue: '500000',
  cumulativeCosts: '300000',
  cumulativeIncome: '200000',
  taxDue: '38000',
  previousAdvances: '28500',
  currentAdvance: '9500',
  dueDate: new Date('2024-07-20'),
  paidAmount: null,
  paidDate: null,
  isPaid: false,
  declarationId: null,
  createdAt: new Date('2024-06-15'),
  updatedAt: new Date('2024-06-15'),
};

const sampleLossCarryForward = {
  id: LOSS_RECORD_ID,
  organizationId: TEST_ORG_ID,
  clientId: CLIENT_ID,
  taxType: 'CIT',
  lossYear: 2023,
  originalAmount: '100000',
  usedAmount: '0',
  remainingAmount: '100000',
  expiryYear: 2028,
  usageHistory: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const sampleCITCalculation = {
  revenue: '1000000',
  deductibleCosts: '600000',
  nonDeductibleCosts: '0',
  taxExemptRevenue: '0',
  taxableIncome: '400000',
  taxLoss: '0',
  appliedLossCarryForward: '0',
  incomeAfterLoss: '400000',
  taxRate: '19',
  taxDue: '76000',
  isSmallTaxpayer: false,
  isEstonianCIT: false,
  effectiveRate: '19',
  solidaritySurcharge: null,
  totalTax: '76000',
};

const samplePITCalculation = {
  revenue: '200000',
  costs: '50000',
  income: '150000',
  zusDeduction: '12000',
  healthDeduction: '5000',
  taxBase: '138000',
  appliedLossCarryForward: '0',
  taxBaseAfterLoss: '138000',
  taxMethod: 'progressive',
  taxRate: '12/32',
  taxBrackets: [
    { bracket: '0 - 120000 PLN', rate: '12%', amount: '108000', tax: '12960' },
    { bracket: 'Above 120000 PLN', rate: '32%', amount: '18000', tax: '5760' },
  ],
  taxDue: '18720',
  childRelief: '0',
  otherReliefs: '0',
  taxAfterReliefs: '18720',
  healthDeductionFromTax: '0',
  finalTax: '18720',
  effectiveRate: '12.48',
};

describe('incomeTaxDeclarationRouter', () => {
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
        caller.tax.incomeTaxDeclaration.calculateCIT({
          clientId: CLIENT_ID,
          taxYear: 2024,
          revenue: '1000000',
          costs: '600000',
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // CIT CALCULATION ENDPOINTS
  // =========================================================================

  describe('calculateCIT', () => {
    it('should calculate CIT with standard rate', async () => {
      mocks.calculateCIT.mockResolvedValue(sampleCITCalculation);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateCIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '1000000',
        costs: '600000',
      });

      expect(result.revenue).toBe('1000000');
      expect(result.taxableIncome).toBe('400000');
      expect(result.taxRate).toBe('19');
      expect(result.taxDue).toBe('76000');
      expect(result.isSmallTaxpayer).toBe(false);
    });

    it('should calculate CIT with small taxpayer rate', async () => {
      mocks.calculateCIT.mockResolvedValue({
        ...sampleCITCalculation,
        taxRate: '9',
        taxDue: '36000',
        isSmallTaxpayer: true,
        effectiveRate: '9',
        totalTax: '36000',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateCIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '1000000',
        costs: '600000',
        useSmallTaxpayerRate: true,
      });

      expect(result.taxRate).toBe('9');
      expect(result.isSmallTaxpayer).toBe(true);
    });

    it('should calculate CIT with solidarity surcharge for high income', async () => {
      mocks.calculateCIT.mockResolvedValue({
        ...sampleCITCalculation,
        taxableIncome: '1500000',
        incomeAfterLoss: '1500000',
        taxDue: '285000',
        solidaritySurcharge: '20000',
        totalTax: '305000',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateCIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '2000000',
        costs: '500000',
      });

      expect(result.solidaritySurcharge).toBe('20000');
      expect(result.totalTax).toBe('305000');
    });

    it('should handle loss carry forward', async () => {
      mocks.calculateCIT.mockResolvedValue({
        ...sampleCITCalculation,
        appliedLossCarryForward: '50000',
        incomeAfterLoss: '350000',
        taxDue: '66500',
        totalTax: '66500',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateCIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '1000000',
        costs: '600000',
        applyLossCarryForward: true,
      });

      expect(result.appliedLossCarryForward).toBe('50000');
      expect(result.incomeAfterLoss).toBe('350000');
    });

    it('should handle Estonian CIT', async () => {
      mocks.calculateCIT.mockResolvedValue({
        ...sampleCITCalculation,
        taxRate: '0',
        taxDue: '0',
        isEstonianCIT: true,
        effectiveRate: '0',
        totalTax: '0',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateCIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '1000000',
        costs: '600000',
        useEstonianCIT: true,
      });

      expect(result.isEstonianCIT).toBe(true);
      expect(result.taxDue).toBe('0');
    });
  });

  // =========================================================================
  // PIT CALCULATION ENDPOINTS
  // =========================================================================

  describe('calculatePIT', () => {
    it('should calculate PIT with progressive scale', async () => {
      mocks.calculatePIT.mockResolvedValue(samplePITCalculation);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculatePIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '200000',
        costs: '50000',
        taxMethod: 'progressive',
      });

      expect(result.taxMethod).toBe('progressive');
      expect(result.taxBrackets).toHaveLength(2);
      expect(result.finalTax).toBe('18720');
    });

    it('should calculate PIT with flat 19% rate', async () => {
      mocks.calculatePIT.mockResolvedValue({
        ...samplePITCalculation,
        taxMethod: 'flat',
        taxRate: '19',
        taxBrackets: [{ bracket: 'Flat rate', rate: '19%', amount: '138000', tax: '26220' }],
        taxDue: '26220',
        healthDeductionFromTax: '5000',
        taxAfterReliefs: '21220',
        finalTax: '21220',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculatePIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '200000',
        costs: '50000',
        taxMethod: 'flat',
        healthInsurance: '5000',
      });

      expect(result.taxMethod).toBe('flat');
      expect(result.taxRate).toBe('19');
      expect(result.healthDeductionFromTax).toBe('5000');
    });

    it('should calculate PIT with lump sum taxation', async () => {
      mocks.calculatePIT.mockResolvedValue({
        ...samplePITCalculation,
        taxMethod: 'lump_sum',
        taxRate: '12',
        taxBrackets: null,
        taxDue: '24000',
        finalTax: '24000',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculatePIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '200000',
        costs: '0',
        taxMethod: 'lump_sum',
        lumpSumRateCode: 'IT_SERVICES',
      });

      expect(result.taxMethod).toBe('lump_sum');
      expect(result.taxBrackets).toBeNull();
    });

    it('should apply child relief', async () => {
      mocks.calculatePIT.mockResolvedValue({
        ...samplePITCalculation,
        childRelief: '2224.08',
        taxAfterReliefs: '16495.92',
        finalTax: '16496',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculatePIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '200000',
        costs: '50000',
        taxMethod: 'progressive',
        childReliefCount: 2,
      });

      expect(result.childRelief).toBe('2224.08');
    });

    it('should handle ZUS deductions', async () => {
      mocks.calculatePIT.mockResolvedValue({
        ...samplePITCalculation,
        zusDeduction: '15000',
        taxBase: '135000',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculatePIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '200000',
        costs: '50000',
        taxMethod: 'progressive',
        zusContributions: '15000',
      });

      expect(result.zusDeduction).toBe('15000');
    });
  });

  // =========================================================================
  // DECLARATION MANAGEMENT ENDPOINTS
  // =========================================================================

  describe('createDeclaration', () => {
    it('should create new CIT declaration', async () => {
      mocks.createDeclaration.mockResolvedValue(sampleDeclaration);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.createDeclaration({
        clientId: CLIENT_ID,
        taxType: 'CIT',
        declarationType: 'ANNUAL',
        formType: 'CIT-8',
        taxYear: 2024,
      });

      expect(result.id).toBe(DECLARATION_ID);
      expect(result.taxType).toBe('CIT');
      expect(result.status).toBe('DRAFT');
    });

    it('should create PIT declaration with monthly period', async () => {
      mocks.createDeclaration.mockResolvedValue({
        ...sampleDeclaration,
        taxType: 'PIT',
        formType: 'PIT-36',
        periodMonth: 6,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.createDeclaration({
        clientId: CLIENT_ID,
        taxType: 'PIT',
        declarationType: 'ADVANCE',
        formType: 'PIT-36',
        taxYear: 2024,
        periodMonth: 6,
      });

      expect(result.taxType).toBe('PIT');
      expect(result.periodMonth).toBe(6);
    });
  });

  describe('updateDeclaration', () => {
    it('should update declaration financials', async () => {
      mocks.updateDeclaration.mockResolvedValue({
        ...sampleDeclaration,
        totalRevenue: '1200000',
        totalCosts: '700000',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.updateDeclaration({
        declarationId: DECLARATION_ID,
        totalRevenue: '1200000',
        totalCosts: '700000',
      });

      expect(result.totalRevenue).toBe('1200000');
      expect(result.totalCosts).toBe('700000');
    });

    it('should update declaration status', async () => {
      mocks.updateDeclaration.mockResolvedValue({
        ...sampleDeclaration,
        status: 'APPROVED',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.updateDeclaration({
        declarationId: DECLARATION_ID,
        status: 'APPROVED',
      });

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('calculateDeclaration', () => {
    it('should calculate declaration and update status', async () => {
      mocks.calculateDeclaration.mockResolvedValue({
        declaration: {
          ...sampleDeclaration,
          status: 'CALCULATED',
          calculatedAt: new Date(),
          calculatedBy: TEST_USER_ID,
        },
        calculation: sampleCITCalculation,
        advancePayments: [],
        availableLossCarryForward: [],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.declaration.status).toBe('CALCULATED');
      expect(result.calculation).toBeDefined();
    });
  });

  describe('submitDeclaration', () => {
    it('should submit declaration to tax authority', async () => {
      mocks.submitDeclaration.mockResolvedValue({
        ...sampleDeclaration,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: TEST_USER_ID,
        submissionReference: 'ED-1234567890-ABCDEFGHI',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.submitDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.status).toBe('SUBMITTED');
      expect(result.submissionReference).toContain('ED-');
    });
  });

  describe('createCorrection', () => {
    it('should create correction declaration', async () => {
      mocks.createCorrection.mockResolvedValue({
        ...sampleDeclaration,
        id: '77777777-7777-7777-7777-777777777777',
        declarationType: 'CORRECTION',
        status: 'DRAFT',
        correctsDeclarationId: DECLARATION_ID,
        correctionReason: 'Error in revenue calculation',
        correctionNumber: 1,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.createCorrection({
        originalDeclarationId: DECLARATION_ID,
        correctionReason: 'Error in revenue calculation',
      });

      expect(result.declarationType).toBe('CORRECTION');
      expect(result.correctsDeclarationId).toBe(DECLARATION_ID);
      expect(result.correctionNumber).toBe(1);
    });
  });

  describe('getDeclaration', () => {
    it('should retrieve declaration with summary', async () => {
      mocks.getDeclaration.mockResolvedValue({
        declaration: sampleDeclaration,
        calculation: null,
        advancePayments: [sampleAdvancePayment],
        availableLossCarryForward: [sampleLossCarryForward],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.getDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.declaration.id).toBe(DECLARATION_ID);
      expect(result.advancePayments).toHaveLength(1);
      expect(result.availableLossCarryForward).toHaveLength(1);
    });
  });

  describe('listDeclarations', () => {
    it('should list declarations with pagination', async () => {
      mocks.listDeclarations.mockResolvedValue({
        declarations: [sampleDeclaration],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.listDeclarations({
        clientId: CLIENT_ID,
      });

      expect(result.declarations).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by tax type and year', async () => {
      mocks.listDeclarations.mockResolvedValue({
        declarations: [sampleDeclaration],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.incomeTaxDeclaration.listDeclarations({
        taxType: 'CIT',
        taxYear: 2024,
      });

      expect(mocks.listDeclarations).toHaveBeenCalledWith(
        expect.objectContaining({
          taxType: 'CIT',
          taxYear: 2024,
        })
      );
    });

    it('should filter by status', async () => {
      mocks.listDeclarations.mockResolvedValue({
        declarations: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.incomeTaxDeclaration.listDeclarations({
        status: 'SUBMITTED',
      });

      expect(mocks.listDeclarations).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUBMITTED',
        })
      );
    });
  });

  describe('deleteDeclaration', () => {
    it('should delete draft declaration', async () => {
      mocks.deleteDeclaration.mockResolvedValue({ success: true });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.deleteDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // ADVANCE PAYMENT ENDPOINTS
  // =========================================================================

  describe('calculateAdvance', () => {
    it('should calculate monthly advance payment', async () => {
      mocks.calculateAdvance.mockResolvedValue(sampleAdvancePayment);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateAdvance({
        clientId: CLIENT_ID,
        taxType: 'CIT',
        taxYear: 2024,
        periodType: 'MONTHLY',
        periodNumber: 6,
        cumulativeRevenue: '500000',
        cumulativeCosts: '300000',
      });

      expect(result.periodNumber).toBe(6);
      expect(result.currentAdvance).toBe('9500');
      expect(result.previousAdvances).toBe('28500');
    });

    it('should calculate quarterly advance for small taxpayer', async () => {
      mocks.calculateAdvance.mockResolvedValue({
        ...sampleAdvancePayment,
        periodType: 'QUARTERLY',
        periodNumber: 2,
        currentAdvance: '28500',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculateAdvance({
        clientId: CLIENT_ID,
        taxType: 'CIT',
        taxYear: 2024,
        periodType: 'QUARTERLY',
        periodNumber: 2,
        cumulativeRevenue: '500000',
        cumulativeCosts: '300000',
      });

      expect(result.periodType).toBe('QUARTERLY');
    });
  });

  describe('recordAdvancePayment', () => {
    it('should record advance payment', async () => {
      mocks.recordAdvancePayment.mockResolvedValue({
        ...sampleAdvancePayment,
        paidAmount: '9500',
        paidDate: new Date('2024-07-15'),
        isPaid: true,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.recordAdvancePayment({
        advanceId: ADVANCE_ID,
        paidAmount: '9500',
        paidDate: '2024-07-15',
      });

      expect(result.isPaid).toBe(true);
      expect(result.paidAmount).toBe('9500');
    });
  });

  describe('getAdvanceSchedule', () => {
    it('should return full year advance schedule', async () => {
      const monthlyAdvances = Array.from({ length: 6 }, (_, i) => ({
        ...sampleAdvancePayment,
        id: `advance-${i + 1}`,
        periodNumber: i + 1,
        currentAdvance: `${(i + 1) * 5000}`,
      }));

      mocks.getAdvanceSchedule.mockResolvedValue({
        clientId: CLIENT_ID,
        taxType: 'CIT',
        taxYear: 2024,
        periodType: 'MONTHLY',
        advances: monthlyAdvances,
        totalDue: '105000',
        totalPaid: '50000',
        totalRemaining: '55000',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.getAdvanceSchedule({
        clientId: CLIENT_ID,
        taxType: 'CIT',
        taxYear: 2024,
      });

      expect(result.advances).toHaveLength(6);
      expect(result.totalDue).toBe('105000');
      expect(result.totalRemaining).toBe('55000');
    });
  });

  // =========================================================================
  // LOSS CARRY FORWARD ENDPOINTS
  // =========================================================================

  describe('getLossCarryForward', () => {
    it('should return available losses', async () => {
      mocks.getLossCarryForward.mockResolvedValue([
        sampleLossCarryForward,
        {
          ...sampleLossCarryForward,
          id: '88888888-8888-8888-8888-888888888888',
          lossYear: 2022,
          originalAmount: '50000',
          remainingAmount: '25000',
          usedAmount: '25000',
        },
      ]);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.getLossCarryForward({
        clientId: CLIENT_ID,
        taxType: 'CIT',
      });

      expect(result).toHaveLength(2);
      expect(result[0].remainingAmount).toBe('100000');
    });
  });

  describe('applyLoss', () => {
    it('should apply loss to declaration', async () => {
      mocks.applyLoss.mockResolvedValue({
        ...sampleLossCarryForward,
        usedAmount: '50000',
        remainingAmount: '50000',
        usageHistory: [
          {
            usedInYear: 2024,
            amount: '50000',
            declarationId: DECLARATION_ID,
          },
        ],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.applyLoss({
        lossRecordId: LOSS_RECORD_ID,
        declarationId: DECLARATION_ID,
        amount: '50000',
      });

      expect(result.usedAmount).toBe('50000');
      expect(result.remainingAmount).toBe('50000');
      expect(result.usageHistory).toHaveLength(1);
    });

    it('should track multiple loss applications', async () => {
      mocks.applyLoss.mockResolvedValue({
        ...sampleLossCarryForward,
        usedAmount: '75000',
        remainingAmount: '25000',
        usageHistory: [
          { usedInYear: 2024, amount: '50000', declarationId: DECLARATION_ID },
          { usedInYear: 2025, amount: '25000', declarationId: '99999999-9999-9999-9999-999999999999' },
        ],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.applyLoss({
        lossRecordId: LOSS_RECORD_ID,
        declarationId: '99999999-9999-9999-9999-999999999999',
        amount: '25000',
      });

      expect(result.usageHistory).toHaveLength(2);
      expect(result.remainingAmount).toBe('25000');
    });
  });

  // =========================================================================
  // EDGE CASES AND ERROR HANDLING
  // =========================================================================

  describe('error handling', () => {
    it('should handle declaration not found', async () => {
      mocks.getDeclaration.mockRejectedValue(new Error('Declaration not found'));

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.incomeTaxDeclaration.getDeclaration({
          declarationId: 'non-existent-id',
        })
      ).rejects.toThrow();
    });

    it('should handle invalid tax calculation', async () => {
      mocks.calculateCIT.mockRejectedValue(new Error('Invalid input'));

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.incomeTaxDeclaration.calculateCIT({
          clientId: CLIENT_ID,
          taxYear: 2024,
          revenue: 'invalid',
          costs: '600000',
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // INTEGRATION SCENARIOS
  // =========================================================================

  describe('integration scenarios', () => {
    it('should handle complete CIT declaration workflow', async () => {
      // 1. Create declaration
      mocks.createDeclaration.mockResolvedValue(sampleDeclaration);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const created = await caller.tax.incomeTaxDeclaration.createDeclaration({
        clientId: CLIENT_ID,
        taxType: 'CIT',
        declarationType: 'ANNUAL',
        formType: 'CIT-8',
        taxYear: 2024,
      });

      expect(created.status).toBe('DRAFT');

      // 2. Update with financials
      mocks.updateDeclaration.mockResolvedValue({
        ...sampleDeclaration,
        totalRevenue: '1000000',
        totalCosts: '600000',
      });

      const updated = await caller.tax.incomeTaxDeclaration.updateDeclaration({
        declarationId: DECLARATION_ID,
        totalRevenue: '1000000',
        totalCosts: '600000',
      });

      expect(updated.totalRevenue).toBe('1000000');

      // 3. Calculate
      mocks.calculateDeclaration.mockResolvedValue({
        declaration: { ...sampleDeclaration, status: 'CALCULATED' },
        calculation: sampleCITCalculation,
        advancePayments: [],
        availableLossCarryForward: [],
      });

      const calculated = await caller.tax.incomeTaxDeclaration.calculateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(calculated.declaration.status).toBe('CALCULATED');

      // 4. Submit
      mocks.submitDeclaration.mockResolvedValue({
        ...sampleDeclaration,
        status: 'SUBMITTED',
        submissionReference: 'ED-123',
      });

      const submitted = await caller.tax.incomeTaxDeclaration.submitDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(submitted.status).toBe('SUBMITTED');
    });

    it('should handle PIT with all deductions and reliefs', async () => {
      mocks.calculatePIT.mockResolvedValue({
        ...samplePITCalculation,
        zusDeduction: '12000',
        healthDeduction: '5000',
        childRelief: '3224.08', // 3 children
        taxAfterReliefs: '15495.92',
        finalTax: '15496',
        effectiveRate: '10.33',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.incomeTaxDeclaration.calculatePIT({
        clientId: CLIENT_ID,
        taxYear: 2024,
        revenue: '200000',
        costs: '50000',
        taxMethod: 'progressive',
        zusContributions: '12000',
        healthInsurance: '5000',
        childReliefCount: 3,
      });

      expect(result.zusDeduction).toBe('12000');
      expect(result.childRelief).toBe('3224.08');
      expect(result.finalTax).toBe('15496');
    });
  });
});
