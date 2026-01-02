// TAX-013: White List Router Tests
// Tests for Polish White List (Biała Lista) verification endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '../../index';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  verifyNIP: vi.fn(),
  verifyIBAN: vi.fn(),
  batchVerify: vi.fn(),
  verifyPayment: vi.fn(),
  getVerificationHistory: vi.fn(),
  getVerificationById: vi.fn(),
  getAlerts: vi.fn(),
  createAlert: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
  escalateAlert: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  exportHistory: vi.fn(),
}));

vi.mock('../../services/tax/white-list.service', () => ({
  WhiteListService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const VERIFICATION_ID = '44444444-4444-4444-4444-444444444444';
const ALERT_ID = '55555555-5555-5555-5555-555555555555';
const INVOICE_ID = '66666666-6666-6666-6666-666666666666';

// Valid Polish NIPs (pass checksum validation)
const VALID_NIP = '5260250995'; // Valid test NIP
const VALID_NIP_2 = '5252248481'; // Another valid test NIP
const VALID_NIP_3 = '7680000007'; // Third valid test NIP

// Valid Polish IBAN (26 digits)
const VALID_IBAN = 'PL61109010140000071219812874';
const VALID_IBAN_2 = 'PL83101010230000261395100000';

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

const sampleNIPVerificationResult = {
  id: VERIFICATION_ID,
  organizationId: TEST_ORG_ID,
  verificationType: 'NIP_STATUS',
  nip: VALID_NIP,
  iban: null,
  requestId: 'REQ-001',
  verificationDate: new Date('2024-06-15T10:00:00Z'),
  cacheExpiresAt: new Date('2024-06-16T10:00:00Z'),
  nipStatus: 'ACTIVE',
  nipStatusMessage: 'Podmiot jest czynnym podatnikiem VAT',
  companyName: 'Test Company Sp. z o.o.',
  companyAddress: 'ul. Testowa 1, 00-001 Warszawa',
  registeredBankAccounts: [VALID_IBAN],
  ibanRegistered: null,
  ibanAccountType: null,
  riskLevel: 'low',
  riskScore: 10,
  riskFactors: [],
  recommendations: [],
  contextType: 'PAYMENT_VERIFICATION',
  contextData: null,
  fromCache: false,
  mfApiRequestId: 'MF-REQ-001',
  mfApiResponseTime: 150,
  clientId: CLIENT_ID,
  createdBy: TEST_USER_ID,
  createdAt: new Date('2024-06-15T10:00:00Z'),
};

const sampleIBANVerificationResult = {
  ...sampleNIPVerificationResult,
  id: '66666666-6666-6666-6666-666666666666',
  verificationType: 'NIP_IBAN',
  iban: VALID_IBAN,
  ibanRegistered: true,
  ibanAccountType: 'STANDARD',
  riskScore: 5,
};

const sampleAlert = {
  id: ALERT_ID,
  organizationId: TEST_ORG_ID,
  verificationId: VERIFICATION_ID,
  alertType: 'vat_status_changed',
  severity: 'error',
  title: 'Kontrahent wykreślony z rejestru VAT',
  message: `Firma Test Sp. z o.o. (NIP: ${VALID_NIP}) została wykreślona z rejestru VAT`,
  nip: VALID_NIP,
  iban: null,
  paymentId: null,
  invoiceId: null,
  amount: null,
  deadline: null,
  status: 'open',
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  resolutionNotes: null,
  escalatedAt: null,
  escalatedTo: null,
  createdAt: new Date('2024-06-15T10:00:00Z'),
  updatedAt: new Date('2024-06-15T10:00:00Z'),
};

const sampleConfig = {
  id: '77777777-7777-7777-7777-777777777777',
  organizationId: TEST_ORG_ID,
  autoVerifyOnPayment: true,
  blockHighRiskPayments: true,
  riskThresholds: {
    low: 20,
    medium: 50,
    high: 80,
    critical: 100,
  },
  alertSettings: {
    emailNotifications: true,
    slackNotifications: false,
    escalationTimeoutHours: 24,
  },
  cacheSettings: {
    enabled: true,
    maxAgeHours: 24,
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-06-15T10:00:00Z'),
};

describe('whiteListRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AUTHENTICATION TESTS
  // =========================================================================

  describe('authentication', () => {
    it('should reject unauthenticated requests for verifyNIP', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.tax.whiteList.verifyNIP({
          nip: VALID_NIP,
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests for verifyIBAN', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.tax.whiteList.verifyIBAN({
          nip: VALID_NIP,
          iban: VALID_IBAN,
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests for getAlerts', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.tax.whiteList.getAlerts({})
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // NIP VERIFICATION ENDPOINTS
  // =========================================================================

  describe('verifyNIP', () => {
    it('should verify an active NIP', async () => {
      mocks.verifyNIP.mockResolvedValue(sampleNIPVerificationResult);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyNIP({
        nip: VALID_NIP,
      });

      expect(result.nip).toBe(VALID_NIP);
      expect(result.nipStatus).toBe('ACTIVE');
      expect(result.riskLevel).toBe('low');
      expect(mocks.verifyNIP).toHaveBeenCalledWith(
        expect.objectContaining({ nip: VALID_NIP })
      );
    });

    it('should verify NIP with context type', async () => {
      mocks.verifyNIP.mockResolvedValue({
        ...sampleNIPVerificationResult,
        contextType: 'INVOICE_VERIFICATION',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyNIP({
        nip: VALID_NIP,
        contextType: 'INVOICE_VERIFICATION',
      });

      expect(result.contextType).toBe('INVOICE_VERIFICATION');
    });

    it('should verify NIP with force refresh', async () => {
      mocks.verifyNIP.mockResolvedValue({
        ...sampleNIPVerificationResult,
        fromCache: false,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyNIP({
        nip: VALID_NIP,
        forceRefresh: true,
      });

      expect(result.fromCache).toBe(false);
      expect(mocks.verifyNIP).toHaveBeenCalledWith(
        expect.objectContaining({ forceRefresh: true })
      );
    });

    it('should return inactive NIP status', async () => {
      mocks.verifyNIP.mockResolvedValue({
        ...sampleNIPVerificationResult,
        nip: VALID_NIP_2,
        nipStatus: 'INACTIVE',
        nipStatusMessage: 'Podmiot nie jest czynnym podatnikiem VAT',
        riskLevel: 'high',
        riskScore: 70,
        riskFactors: ['NIP_INACTIVE'],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyNIP({
        nip: VALID_NIP_2,
      });

      expect(result.nipStatus).toBe('INACTIVE');
      expect(result.riskLevel).toBe('high');
      expect(result.riskFactors).toContain('NIP_INACTIVE');
    });

    it('should return cached verification', async () => {
      mocks.verifyNIP.mockResolvedValue({
        ...sampleNIPVerificationResult,
        fromCache: true,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyNIP({
        nip: VALID_NIP,
      });

      expect(result.fromCache).toBe(true);
    });
  });

  // =========================================================================
  // IBAN VERIFICATION ENDPOINTS
  // =========================================================================

  describe('verifyIBAN', () => {
    it('should verify NIP and IBAN combination', async () => {
      mocks.verifyIBAN.mockResolvedValue(sampleIBANVerificationResult);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyIBAN({
        nip: VALID_NIP,
        iban: VALID_IBAN,
      });

      expect(result.nip).toBe(VALID_NIP);
      expect(result.iban).toBe(VALID_IBAN);
      expect(result.ibanRegistered).toBe(true);
      expect(mocks.verifyIBAN).toHaveBeenCalled();
    });

    it('should verify with amount for risk assessment', async () => {
      mocks.verifyIBAN.mockResolvedValue({
        ...sampleIBANVerificationResult,
        riskScore: 25,
        riskFactors: ['AMOUNT_ABOVE_15000_PLN'],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyIBAN({
        nip: VALID_NIP,
        iban: VALID_IBAN,
        amount: 20000,
      });

      expect(result.riskFactors).toContain('AMOUNT_ABOVE_15000_PLN');
    });

    it('should detect unregistered IBAN', async () => {
      mocks.verifyIBAN.mockResolvedValue({
        ...sampleIBANVerificationResult,
        iban: VALID_IBAN_2,
        ibanRegistered: false,
        riskLevel: 'high',
        riskScore: 60,
        riskFactors: ['IBAN_NOT_REGISTERED'],
        recommendations: ['Verify bank account with counterparty'],
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyIBAN({
        nip: VALID_NIP,
        iban: VALID_IBAN_2,
      });

      expect(result.ibanRegistered).toBe(false);
      expect(result.riskLevel).toBe('high');
      expect(result.riskFactors).toContain('IBAN_NOT_REGISTERED');
    });
  });

  // =========================================================================
  // BATCH VERIFICATION ENDPOINTS
  // =========================================================================

  describe('batchVerify', () => {
    it('should batch verify multiple NIPs', async () => {
      mocks.batchVerify.mockResolvedValue({
        results: [
          { ...sampleNIPVerificationResult, nip: VALID_NIP },
          { ...sampleNIPVerificationResult, nip: VALID_NIP_2 },
          { ...sampleNIPVerificationResult, nip: VALID_NIP_3 },
        ],
        summary: {
          total: 3,
          active: 3,
          inactive: 0,
          notFound: 0,
          errors: 0,
          lowRisk: 3,
          mediumRisk: 0,
          highRisk: 0,
          criticalRisk: 0,
        },
        processingTime: 450,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.batchVerify({
        nips: [VALID_NIP, VALID_NIP_2, VALID_NIP_3],
      });

      expect(result.results).toHaveLength(3);
      expect(result.summary.total).toBe(3);
      expect(result.summary.active).toBe(3);
      expect(mocks.batchVerify).toHaveBeenCalled();
    });

    it('should handle batch with mixed results', async () => {
      mocks.batchVerify.mockResolvedValue({
        results: [
          { ...sampleNIPVerificationResult, nip: VALID_NIP, nipStatus: 'ACTIVE' },
          { ...sampleNIPVerificationResult, nip: VALID_NIP_2, nipStatus: 'INACTIVE', riskLevel: 'high' },
        ],
        summary: {
          total: 2,
          active: 1,
          inactive: 1,
          notFound: 0,
          errors: 0,
          lowRisk: 1,
          mediumRisk: 0,
          highRisk: 1,
          criticalRisk: 0,
        },
        processingTime: 300,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.batchVerify({
        nips: [VALID_NIP, VALID_NIP_2],
      });

      expect(result.summary.active).toBe(1);
      expect(result.summary.inactive).toBe(1);
      expect(result.summary.highRisk).toBe(1);
    });

    it('should batch verify with client ID', async () => {
      mocks.batchVerify.mockResolvedValue({
        results: [sampleNIPVerificationResult],
        summary: {
          total: 1,
          active: 1,
          inactive: 0,
          notFound: 0,
          errors: 0,
          lowRisk: 1,
          mediumRisk: 0,
          highRisk: 0,
          criticalRisk: 0,
        },
        processingTime: 150,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.batchVerify({
        nips: [VALID_NIP],
      });

      expect(mocks.batchVerify).toHaveBeenCalledWith(
        expect.objectContaining({ nips: [VALID_NIP] })
      );
    });
  });

  // =========================================================================
  // PAYMENT VERIFICATION ENDPOINTS
  // =========================================================================

  describe('verifyPayment', () => {
    it('should authorize a low-risk payment', async () => {
      mocks.verifyPayment.mockResolvedValue({
        authorized: true,
        riskLevel: 'low',
        riskScore: 10,
        verification: sampleIBANVerificationResult,
        splitPaymentRequired: false,
        recommendations: [],
        warnings: [],
        blockedReason: null,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 5000,
        paymentDate: '2024-06-15',
      });

      expect(result.authorized).toBe(true);
      expect(result.riskLevel).toBe('low');
      expect(result.splitPaymentRequired).toBe(false);
    });

    it('should require split payment for large amounts', async () => {
      mocks.verifyPayment.mockResolvedValue({
        authorized: true,
        riskLevel: 'medium',
        riskScore: 35,
        verification: sampleIBANVerificationResult,
        splitPaymentRequired: true,
        recommendations: ['Use split payment mechanism'],
        warnings: ['Transaction exceeds 15,000 PLN threshold'],
        blockedReason: null,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 50000,
        paymentDate: '2024-06-15',
      });

      expect(result.splitPaymentRequired).toBe(true);
      expect(result.warnings).toContain('Transaction exceeds 15,000 PLN threshold');
    });

    it('should block high-risk payment', async () => {
      mocks.verifyPayment.mockResolvedValue({
        authorized: false,
        riskLevel: 'critical',
        riskScore: 95,
        verification: {
          ...sampleIBANVerificationResult,
          nip: VALID_NIP_2,
          nipStatus: 'INACTIVE',
          ibanRegistered: false,
        },
        splitPaymentRequired: false,
        recommendations: ['Do not proceed with payment'],
        warnings: ['Counterparty is not an active VAT payer', 'Bank account not registered'],
        blockedReason: 'High risk payment blocked due to inactive VAT status and unregistered bank account',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.verifyPayment({
        recipientNip: VALID_NIP_2,
        recipientIban: VALID_IBAN_2,
        amount: 100000,
        paymentDate: '2024-06-15',
      });

      expect(result.authorized).toBe(false);
      expect(result.riskLevel).toBe('critical');
      expect(result.blockedReason).toBeTruthy();
    });

    it('should verify payment with invoice reference', async () => {
      mocks.verifyPayment.mockResolvedValue({
        authorized: true,
        riskLevel: 'low',
        riskScore: 5,
        verification: sampleIBANVerificationResult,
        splitPaymentRequired: false,
        recommendations: [],
        warnings: [],
        blockedReason: null,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 5000,
        paymentDate: '2024-06-15',
        invoiceId: INVOICE_ID,
      });

      expect(mocks.verifyPayment).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: INVOICE_ID })
      );
    });
  });

  // =========================================================================
  // HISTORY ENDPOINTS
  // =========================================================================

  describe('getHistory', () => {
    it('should retrieve verification history', async () => {
      mocks.getVerificationHistory.mockResolvedValue({
        items: [sampleNIPVerificationResult, sampleIBANVerificationResult],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.getHistory({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter history by NIP', async () => {
      mocks.getVerificationHistory.mockResolvedValue({
        items: [sampleNIPVerificationResult],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.getHistory({
        nip: VALID_NIP,
      });

      expect(mocks.getVerificationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ nip: VALID_NIP })
      );
    });

    it('should filter history by date range', async () => {
      mocks.getVerificationHistory.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.getHistory({
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      });

      expect(mocks.getVerificationHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-06-01',
          dateTo: '2024-06-30',
        })
      );
    });

    it('should filter history by risk level', async () => {
      mocks.getVerificationHistory.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.getHistory({
        riskLevel: 'high',
      });

      expect(mocks.getVerificationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ riskLevel: 'high' })
      );
    });
  });

  describe('getById', () => {
    it('should retrieve verification by ID', async () => {
      mocks.getVerificationById.mockResolvedValue(sampleNIPVerificationResult);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.getById({
        verificationId: VERIFICATION_ID,
      });

      expect(result.id).toBe(VERIFICATION_ID);
      expect(mocks.getVerificationById).toHaveBeenCalledWith(
        expect.objectContaining({ verificationId: VERIFICATION_ID })
      );
    });

    it('should return null for non-existent verification', async () => {
      mocks.getVerificationById.mockResolvedValue(null);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.getById({
        verificationId: '99999999-9999-9999-9999-999999999999',
      });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // ALERT ENDPOINTS
  // =========================================================================

  describe('getAlerts', () => {
    it('should retrieve alerts', async () => {
      mocks.getAlerts.mockResolvedValue({
        items: [sampleAlert],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.getAlerts({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].alertType).toBe('vat_status_changed');
    });

    it('should filter alerts by status', async () => {
      mocks.getAlerts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.getAlerts({
        status: 'open',
      });

      expect(mocks.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' })
      );
    });

    it('should filter alerts by severity', async () => {
      mocks.getAlerts.mockResolvedValue({
        items: [sampleAlert],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.getAlerts({
        severity: 'error',
      });

      expect(mocks.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      );
    });
  });

  describe('createAlert', () => {
    it('should create a new alert', async () => {
      mocks.createAlert.mockResolvedValue(sampleAlert);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.createAlert({
        alertType: 'vat_status_changed',
        severity: 'error',
        title: 'Kontrahent wykreślony z rejestru VAT',
        message: `Firma Test Sp. z o.o. (NIP: ${VALID_NIP}) została wykreślona z rejestru VAT`,
        nip: VALID_NIP,
      });

      expect(result.id).toBe(ALERT_ID);
      expect(result.alertType).toBe('vat_status_changed');
      expect(mocks.createAlert).toHaveBeenCalled();
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      mocks.acknowledgeAlert.mockResolvedValue({
        ...sampleAlert,
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date('2024-06-15T12:00:00Z'),
        acknowledgedBy: TEST_USER_ID,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.acknowledgeAlert({
        alertId: ALERT_ID,
      });

      expect(result.status).toBe('ACKNOWLEDGED');
      expect(result.acknowledgedBy).toBe(TEST_USER_ID);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      mocks.resolveAlert.mockResolvedValue({
        ...sampleAlert,
        status: 'resolved',
        resolvedAt: new Date('2024-06-15T14:00:00Z'),
        resolvedBy: TEST_USER_ID,
        resolutionNotes: 'VAT status verified directly with tax office',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.resolveAlert({
        alertId: ALERT_ID,
        status: 'resolved',
        resolutionNotes: 'VAT status verified directly with tax office',
      });

      expect(result.status).toBe('resolved');
      expect(result.resolutionNotes).toBe('VAT status verified directly with tax office');
    });
  });

  describe('escalateAlert', () => {
    const MANAGER_ID = '88888888-8888-8888-8888-888888888888';

    it('should escalate an alert', async () => {
      mocks.escalateAlert.mockResolvedValue({
        ...sampleAlert,
        status: 'ESCALATED',
        escalatedAt: new Date('2024-06-15T13:00:00Z'),
        escalatedTo: MANAGER_ID,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.escalateAlert({
        alertId: ALERT_ID,
        escalateTo: MANAGER_ID,
        notes: 'Requires immediate management attention',
      });

      expect(result.status).toBe('ESCALATED');
      expect(result.escalatedTo).toBe(MANAGER_ID);
    });
  });

  // =========================================================================
  // CONFIGURATION ENDPOINTS
  // =========================================================================

  describe('getConfig', () => {
    it('should retrieve organization configuration', async () => {
      mocks.getConfig.mockResolvedValue(sampleConfig);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.getConfig();

      expect(result.autoVerifyOnPayment).toBe(true);
      expect(result.blockHighRiskPayments).toBe(true);
      expect(result.riskThresholds.high).toBe(80);
    });
  });

  describe('updateConfig', () => {
    it('should update organization configuration', async () => {
      mocks.updateConfig.mockResolvedValue({
        ...sampleConfig,
        autoVerifyOnPayment: false,
        blockHighRiskPayments: false,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.updateConfig({
        autoVerifyOnPayment: false,
        blockHighRiskPayments: false,
      });

      expect(result.autoVerifyOnPayment).toBe(false);
      expect(result.blockHighRiskPayments).toBe(false);
    });

    it('should update risk thresholds', async () => {
      mocks.updateConfig.mockResolvedValue({
        ...sampleConfig,
        riskThresholds: {
          low: 15,
          medium: 40,
          high: 70,
          critical: 90,
        },
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.updateConfig({
        riskThresholds: {
          low: 15,
          medium: 40,
          high: 70,
          critical: 90,
        },
      });

      expect(result.riskThresholds.low).toBe(15);
      expect(result.riskThresholds.critical).toBe(90);
    });
  });

  // =========================================================================
  // EXPORT ENDPOINTS
  // =========================================================================

  describe('exportHistory', () => {
    it('should export verification history as CSV', async () => {
      mocks.exportHistory.mockResolvedValue({
        format: 'csv',
        data: 'NIP,Status,Risk Level,Date\n5260250995,ACTIVE,low,2024-06-15',
        filename: 'white-list-export-2024-06-15.csv',
        recordCount: 1,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.exportHistory({
        format: 'csv',
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      });

      expect(result.format).toBe('csv');
      expect(result.recordCount).toBe(1);
      expect(result.filename).toContain('.csv');
    });

    it('should export verification history as JSON', async () => {
      mocks.exportHistory.mockResolvedValue({
        format: 'json',
        data: JSON.stringify([sampleNIPVerificationResult]),
        filename: 'white-list-export-2024-06-15.json',
        recordCount: 1,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.whiteList.exportHistory({
        format: 'json',
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      });

      expect(result.format).toBe('json');
      expect(result.filename).toContain('.json');
    });

    it('should export with date range filter', async () => {
      mocks.exportHistory.mockResolvedValue({
        format: 'csv',
        data: '',
        filename: 'white-list-export-2024-06-15.csv',
        recordCount: 0,
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.whiteList.exportHistory({
        format: 'csv',
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30',
      });

      expect(mocks.exportHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-06-01',
          dateTo: '2024-06-30',
        })
      );
    });
  });
});
