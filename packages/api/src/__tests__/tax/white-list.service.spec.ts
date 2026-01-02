import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhiteListService } from '../../services/tax/white-list.service';
import { TRPCError } from '@trpc/server';

// ===========================================================================
// MOCKS
// ===========================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockPrisma = {
  whiteListVerification: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  whiteListAlert: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  whiteListConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  whiteListBatchJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(mockPrisma)),
};

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const VERIFICATION_ID = '33333333-3333-3333-3333-333333333333';
const ALERT_ID = '44444444-4444-4444-4444-444444444444';

// Valid Polish NIP (with correct checksum)
const VALID_NIP = '5260250995'; // Valid test NIP
const VALID_IBAN = 'PL61109010140000071219812874'; // Valid test IBAN

const createService = () =>
  new WhiteListService(
    mockPrisma as unknown as Parameters<typeof WhiteListService.prototype.verifyNIP>[0] extends infer T ? T extends { db: infer D } ? D : never : never,
    TEST_ORG_ID,
    TEST_USER_ID,
  );

const mockMFApiNIPResponse = {
  result: {
    requestId: 'req-123',
    requestDateTime: '2024-06-15T10:00:00.000Z',
    subject: {
      name: 'Test Company Sp. z o.o.',
      nip: VALID_NIP,
      statusVat: 'Czynny' as const,
      regon: '012345678',
      krs: '0000012345',
      residenceAddress: 'ul. Testowa 1, 00-001 Warszawa',
      workingAddress: 'ul. Testowa 1, 00-001 Warszawa',
      accountNumbers: ['61109010140000071219812874', '12345678901234567890123456'],
      hasVirtualAccounts: false,
      registrationLegalDate: '2020-01-01',
    },
  },
};

const mockMFApiNIPsResponse = {
  result: {
    requestId: 'req-batch-123',
    requestDateTime: '2024-06-15T10:00:00.000Z',
    subjects: [
      mockMFApiNIPResponse.result.subject,
      {
        ...mockMFApiNIPResponse.result.subject,
        nip: '1234567890',
        name: 'Another Company',
      },
    ],
  },
};

const mockMFApiCheckResponse = {
  result: {
    requestId: 'req-check-123',
    requestDateTime: '2024-06-15T10:00:00.000Z',
    accountAssigned: 'TAK' as const,
  },
};

const sampleVerification = {
  id: VERIFICATION_ID,
  organizationId: TEST_ORG_ID,
  nip: VALID_NIP,
  iban: null,
  verificationType: 'nip_only',
  contextType: null,
  contextReferenceId: null,
  contextReferenceType: null,
  requestId: 'req-123',
  requestTimestamp: new Date('2024-06-15T10:00:00.000Z'),
  requestDate: new Date('2024-06-15'),
  responseTimestamp: new Date('2024-06-15T10:00:01.000Z'),
  responseTimeMs: 150,
  nipStatus: 'active',
  registrationDate: new Date('2020-01-01'),
  deregistrationDate: null,
  restorationDate: null,
  ibanRegistered: null,
  ibanAssignmentDate: null,
  subjectName: 'Test Company Sp. z o.o.',
  subjectLegalForm: null,
  subjectAddress: 'ul. Testowa 1, 00-001 Warszawa',
  krsNumber: '0000012345',
  regon: '012345678',
  registeredAccounts: [
    { iban: '61109010140000071219812874', bankName: 'Santander Bank Polska', assignmentDate: null },
  ],
  amountVerified: null,
  requiresSplitPayment: false,
  riskLevel: 'low',
  riskReasons: [],
  verifiedBy: TEST_USER_ID,
  isCached: false,
  cacheSourceId: null,
  createdAt: new Date('2024-06-15T10:00:01.000Z'),
};

const sampleAlert = {
  id: ALERT_ID,
  organizationId: TEST_ORG_ID,
  alertType: 'account_not_registered',
  severity: 'critical',
  nip: VALID_NIP,
  iban: VALID_IBAN,
  paymentId: null,
  invoiceId: null,
  verificationId: VERIFICATION_ID,
  title: 'Rachunek niezarejestrowany na Białej Liście',
  message: 'Płatność została zablokowana - rachunek nie jest zarejestrowany.',
  amount: '25000',
  deadline: null,
  status: 'open',
  resolvedAt: null,
  resolvedBy: null,
  resolutionNotes: null,
  escalatedAt: null,
  escalatedTo: null,
  notificationsSent: [],
  createdAt: new Date('2024-06-15'),
  updatedAt: new Date('2024-06-15'),
};

const defaultConfig = {
  autoVerifyInvoices: true,
  autoVerifyPayments: true,
  verificationThreshold: 15000,
  blockUnverifiedInvoices: false,
  blockUnverifiedPayments: true,
  cacheDurationHours: 24,
  forceFreshOnPayment: true,
  alertThresholdHours: 24,
  escalationThresholdHours: 48,
  alertRecipients: [],
  autoDetectSplitPayment: true,
  splitPaymentPkdCodes: [],
  apiTimeoutMs: 5000,
  maxRetries: 3,
};

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

const resetMocks = () => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  mockPrisma.whiteListConfig.findUnique.mockResolvedValue(defaultConfig);
};

const mockFetchSuccess = (response: unknown) => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => response,
  });
};

const mockFetchError = (status: number, statusText: string) => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
  });
};

// ===========================================================================
// TESTS - NIP VERIFICATION
// ===========================================================================

describe('WhiteListService', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('verifyNIP', () => {
    it('should verify NIP successfully with active status', async () => {
      const service = createService();

      mockFetchSuccess(mockMFApiNIPResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue(sampleVerification);

      const result = await service.verifyNIP({
        nip: VALID_NIP,
        forceRefresh: false,
      });

      expect(result).toMatchObject({
        nip: VALID_NIP,
        nipStatus: 'active',
        subjectName: 'Test Company Sp. z o.o.',
        riskLevel: 'low',
        isCached: false,
      });
    });

    it('should return cached verification when available', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(sampleVerification);

      const result = await service.verifyNIP({
        nip: VALID_NIP,
        forceRefresh: false,
      });

      expect(result.isCached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should force refresh when forceRefresh is true', async () => {
      const service = createService();

      mockFetchSuccess(mockMFApiNIPResponse);
      mockPrisma.whiteListVerification.create.mockResolvedValue(sampleVerification);

      const result = await service.verifyNIP({
        nip: VALID_NIP,
        forceRefresh: true,
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.isCached).toBe(false);
    });

    it('should handle inactive VAT status', async () => {
      const service = createService();
      const inactiveResponse = {
        result: {
          ...mockMFApiNIPResponse.result,
          subject: {
            ...mockMFApiNIPResponse.result.subject,
            statusVat: 'Zwolniony',
          },
        },
      };

      mockFetchSuccess(inactiveResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        nipStatus: 'inactive',
        riskLevel: 'high',
      });

      const result = await service.verifyNIP({
        nip: VALID_NIP,
        forceRefresh: false,
      });

      expect(result.nipStatus).toBe('inactive');
      expect(result.riskLevel).toBe('high');
    });

    it('should handle not registered status', async () => {
      const service = createService();
      const notRegisteredResponse = {
        result: {
          ...mockMFApiNIPResponse.result,
          subject: null,
        },
      };

      mockFetchSuccess(notRegisteredResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        nipStatus: 'not_registered',
        riskLevel: 'high',
      });

      const result = await service.verifyNIP({
        nip: VALID_NIP,
        forceRefresh: false,
      });

      expect(result.nipStatus).toBe('not_registered');
    });

    it('should throw on API error', async () => {
      const service = createService();

      mockFetchError(500, 'Internal Server Error');
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyNIP({ nip: VALID_NIP, forceRefresh: false }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // TESTS - IBAN VERIFICATION
  // =========================================================================

  describe('verifyIBAN', () => {
    it('should verify IBAN as registered', async () => {
      const service = createService();

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(mockMFApiCheckResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        iban: VALID_IBAN,
        ibanRegistered: true,
        verificationType: 'nip_and_iban',
      });

      const result = await service.verifyIBAN({
        nip: VALID_NIP,
        iban: VALID_IBAN,
        forceRefresh: false,
      });

      expect(result.ibanRegistered).toBe(true);
      expect(result.iban).toBe(VALID_IBAN);
    });

    it('should verify IBAN as not registered', async () => {
      const service = createService();
      const notRegisteredCheck = {
        result: {
          ...mockMFApiCheckResponse.result,
          accountAssigned: 'NIE' as const,
        },
      };

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(notRegisteredCheck);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        iban: VALID_IBAN,
        ibanRegistered: false,
        verificationType: 'nip_and_iban',
        riskLevel: 'medium',
      });

      const result = await service.verifyIBAN({
        nip: VALID_NIP,
        iban: VALID_IBAN,
        forceRefresh: false,
      });

      expect(result.ibanRegistered).toBe(false);
      expect(result.riskLevel).toBe('medium');
    });

    it('should include amount in verification', async () => {
      const service = createService();

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(mockMFApiCheckResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        iban: VALID_IBAN,
        ibanRegistered: true,
        amountVerified: '25000',
      });

      const result = await service.verifyIBAN({
        nip: VALID_NIP,
        iban: VALID_IBAN,
        amount: 25000,
        forceRefresh: false,
      });

      expect(result.ibanRegistered).toBe(true);
      expect(mockPrisma.whiteListVerification.create).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TESTS - BATCH VERIFICATION
  // =========================================================================

  describe('batchVerify', () => {
    it('should verify multiple NIPs', async () => {
      const service = createService();
      const nips = [VALID_NIP, '1234567890'];

      mockFetchSuccess(mockMFApiNIPsResponse);
      mockPrisma.whiteListVerification.create
        .mockResolvedValueOnce(sampleVerification)
        .mockResolvedValueOnce({
          ...sampleVerification,
          id: '55555555-5555-5555-5555-555555555555',
          nip: '1234567890',
        });

      const result = await service.batchVerify({
        nips,
        forceRefresh: false,
      });

      expect(result.results).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.active).toBe(2);
    });

    it('should calculate summary correctly', async () => {
      const service = createService();
      const nips = [VALID_NIP, '1234567890'];

      mockFetchSuccess(mockMFApiNIPsResponse);
      mockPrisma.whiteListVerification.create
        .mockResolvedValueOnce(sampleVerification)
        .mockResolvedValueOnce({
          ...sampleVerification,
          nipStatus: 'inactive',
        });

      const result = await service.batchVerify({
        nips,
        forceRefresh: false,
      });

      expect(result.summary.active).toBe(1);
      expect(result.summary.inactive).toBe(1);
    });
  });

  // =========================================================================
  // TESTS - PAYMENT VERIFICATION
  // =========================================================================

  describe('verifyPayment', () => {
    it('should authorize payment with registered account', async () => {
      const service = createService();

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(mockMFApiCheckResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        iban: VALID_IBAN,
        ibanRegistered: true,
        verificationType: 'nip_and_iban',
      });

      const result = await service.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 25000,
        paymentDate: '2024-06-15',
        forceRefresh: false,
      });

      expect(result.authorized).toBe(true);
      expect(result.status).toBe('approved');
    });

    it('should block payment with unregistered account', async () => {
      const service = createService();
      const notRegisteredCheck = {
        result: {
          ...mockMFApiCheckResponse.result,
          accountAssigned: 'NIE' as const,
        },
      };

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(notRegisteredCheck);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        iban: VALID_IBAN,
        ibanRegistered: false,
        riskLevel: 'critical',
      });
      mockPrisma.whiteListAlert.create.mockResolvedValue(sampleAlert);

      const result = await service.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 25000,
        paymentDate: '2024-06-15',
        forceRefresh: false,
      });

      expect(result.authorized).toBe(false);
      expect(result.status).toBe('blocked_unregistered_account');
      expect(mockPrisma.whiteListAlert.create).toHaveBeenCalled();
    });

    it('should block payment when VAT inactive', async () => {
      const service = createService();
      const inactiveResponse = {
        result: {
          ...mockMFApiNIPResponse.result,
          subject: {
            ...mockMFApiNIPResponse.result.subject,
            statusVat: 'Zwolniony',
          },
        },
      };

      mockFetchSuccess(inactiveResponse);
      mockFetchSuccess(mockMFApiCheckResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        nipStatus: 'inactive',
        riskLevel: 'high',
      });
      mockPrisma.whiteListAlert.create.mockResolvedValue(sampleAlert);

      const result = await service.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 25000,
        paymentDate: '2024-06-15',
        forceRefresh: false,
      });

      expect(result.authorized).toBe(false);
      expect(result.status).toBe('blocked_inactive_vat');
    });

    it('should warn for payments below threshold', async () => {
      const service = createService();

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(mockMFApiCheckResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        iban: VALID_IBAN,
        ibanRegistered: true,
      });

      const result = await service.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 10000, // Below 15,000 PLN threshold
        paymentDate: '2024-06-15',
        forceRefresh: false,
      });

      expect(result.authorized).toBe(true);
      expect(result.status).toBe('warning_below_threshold');
    });

    it('should detect split payment requirement', async () => {
      const service = createService();

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(mockMFApiCheckResponse);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        iban: VALID_IBAN,
        ibanRegistered: true,
        requiresSplitPayment: true,
      });
      mockPrisma.whiteListAlert.create.mockResolvedValue({
        ...sampleAlert,
        alertType: 'split_payment_required',
      });

      const result = await service.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 20000,
        paymentDate: '2024-06-15',
        pkdCodes: ['46.71'], // Fuel wholesale - requires split payment
        forceRefresh: false,
      });

      expect(result.authorized).toBe(true);
      expect(result.status).toBe('requires_split_payment');
    });

    it('should provide recommendations', async () => {
      const service = createService();
      const notRegisteredCheck = {
        result: {
          ...mockMFApiCheckResponse.result,
          accountAssigned: 'NIE' as const,
        },
      };

      mockFetchSuccess(mockMFApiNIPResponse);
      mockFetchSuccess(notRegisteredCheck);
      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);
      mockPrisma.whiteListVerification.create.mockResolvedValue({
        ...sampleVerification,
        ibanRegistered: false,
        riskLevel: 'high',
      });
      mockPrisma.whiteListAlert.create.mockResolvedValue(sampleAlert);

      const result = await service.verifyPayment({
        recipientNip: VALID_NIP,
        recipientIban: VALID_IBAN,
        amount: 25000,
        paymentDate: '2024-06-15',
        forceRefresh: false,
      });

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // TESTS - HISTORY
  // =========================================================================

  describe('getVerificationHistory', () => {
    it('should return paginated history', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findMany.mockResolvedValue([sampleVerification]);
      mockPrisma.whiteListVerification.count.mockResolvedValue(1);

      const result = await service.getVerificationHistory({
        page: 1,
        limit: 20,
      });

      expect(result.verifications).toHaveLength(1);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      });
    });

    it('should filter by NIP', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findMany.mockResolvedValue([sampleVerification]);
      mockPrisma.whiteListVerification.count.mockResolvedValue(1);

      await service.getVerificationHistory({
        nip: VALID_NIP,
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.whiteListVerification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nip: VALID_NIP,
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findMany.mockResolvedValue([]);
      mockPrisma.whiteListVerification.count.mockResolvedValue(0);

      await service.getVerificationHistory({
        dateFrom: '2024-01-01',
        dateTo: '2024-06-30',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.whiteListVerification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requestDate: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-06-30'),
            },
          }),
        }),
      );
    });
  });

  describe('getVerificationById', () => {
    it('should return verification by ID', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(sampleVerification);

      const result = await service.getVerificationById({
        verificationId: VERIFICATION_ID,
      });

      expect(result.id).toBe(VERIFICATION_ID);
    });

    it('should throw NOT_FOUND for missing verification', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findFirst.mockResolvedValue(null);

      await expect(
        service.getVerificationById({ verificationId: 'non-existent' }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // TESTS - ALERTS
  // =========================================================================

  describe('getAlerts', () => {
    it('should return paginated alerts', async () => {
      const service = createService();

      mockPrisma.whiteListAlert.findMany.mockResolvedValue([sampleAlert]);
      mockPrisma.whiteListAlert.count.mockResolvedValue(1);

      const result = await service.getAlerts({
        page: 1,
        limit: 20,
      });

      expect(result.alerts).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      const service = createService();

      mockPrisma.whiteListAlert.findMany.mockResolvedValue([sampleAlert]);
      mockPrisma.whiteListAlert.count.mockResolvedValue(1);

      await service.getAlerts({
        status: 'open',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.whiteListAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'open',
          }),
        }),
      );
    });

    it('should filter by severity', async () => {
      const service = createService();

      mockPrisma.whiteListAlert.findMany.mockResolvedValue([sampleAlert]);
      mockPrisma.whiteListAlert.count.mockResolvedValue(1);

      await service.getAlerts({
        severity: 'critical',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.whiteListAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: 'critical',
          }),
        }),
      );
    });
  });

  describe('createAlert', () => {
    it('should create alert', async () => {
      const service = createService();

      mockPrisma.whiteListAlert.create.mockResolvedValue(sampleAlert);

      const result = await service.createAlert({
        alertType: 'account_not_registered',
        severity: 'critical',
        nip: VALID_NIP,
        iban: VALID_IBAN,
        title: 'Test Alert',
        message: 'Test message',
        amount: 25000,
      });

      expect(result.id).toBe(ALERT_ID);
      expect(mockPrisma.whiteListAlert.create).toHaveBeenCalled();
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert', async () => {
      const service = createService();

      mockPrisma.whiteListAlert.update.mockResolvedValue({
        ...sampleAlert,
        status: 'acknowledged',
      });

      const result = await service.acknowledgeAlert({
        alertId: ALERT_ID,
      });

      expect(result.status).toBe('acknowledged');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert', async () => {
      const service = createService();

      mockPrisma.whiteListAlert.update.mockResolvedValue({
        ...sampleAlert,
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: TEST_USER_ID,
        resolutionNotes: 'Issue resolved',
      });

      const result = await service.resolveAlert({
        alertId: ALERT_ID,
        status: 'resolved',
        resolutionNotes: 'Issue resolved',
      });

      expect(result.status).toBe('resolved');
      expect(result.resolutionNotes).toBe('Issue resolved');
    });

    it('should dismiss alert', async () => {
      const service = createService();

      mockPrisma.whiteListAlert.update.mockResolvedValue({
        ...sampleAlert,
        status: 'dismissed',
      });

      const result = await service.resolveAlert({
        alertId: ALERT_ID,
        status: 'dismissed',
      });

      expect(result.status).toBe('dismissed');
    });
  });

  describe('escalateAlert', () => {
    it('should escalate alert', async () => {
      const service = createService();
      const escalateTo = '77777777-7777-7777-7777-777777777777';

      mockPrisma.whiteListAlert.update.mockResolvedValue({
        ...sampleAlert,
        status: 'escalated',
        escalatedAt: new Date(),
        escalatedTo: escalateTo,
      });

      const result = await service.escalateAlert({
        alertId: ALERT_ID,
        escalateTo,
      });

      expect(result.status).toBe('escalated');
      expect(result.escalatedTo).toBe(escalateTo);
    });
  });

  // =========================================================================
  // TESTS - CONFIGURATION
  // =========================================================================

  describe('getConfig', () => {
    it('should return default config when none exists', async () => {
      const service = createService();

      mockPrisma.whiteListConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig();

      expect(result.verificationThreshold).toBe(15000);
      expect(result.cacheDurationHours).toBe(24);
    });

    it('should return stored config', async () => {
      const service = createService();
      const customConfig = {
        ...defaultConfig,
        verificationThreshold: 10000,
      };

      mockPrisma.whiteListConfig.findUnique.mockResolvedValue(customConfig);

      const result = await service.getConfig();

      expect(result.verificationThreshold).toBe(10000);
    });
  });

  describe('updateConfig', () => {
    it('should update config', async () => {
      const service = createService();
      const updatedConfig = {
        ...defaultConfig,
        verificationThreshold: 20000,
      };

      mockPrisma.whiteListConfig.upsert.mockResolvedValue(updatedConfig);

      const result = await service.updateConfig({
        verificationThreshold: 20000,
      });

      expect(result.verificationThreshold).toBe(20000);
    });
  });

  // =========================================================================
  // TESTS - EXPORT
  // =========================================================================

  describe('exportHistory', () => {
    it('should export to CSV', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findMany.mockResolvedValue([sampleVerification]);

      const result = await service.exportHistory({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      expect(result.content).toContain('Data weryfikacji');
    });

    it('should export to JSON', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findMany.mockResolvedValue([sampleVerification]);

      const result = await service.exportHistory({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        format: 'json',
      });

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('.json');
    });

    it('should export to PDF', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findMany.mockResolvedValue([sampleVerification]);

      const result = await service.exportHistory({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        format: 'pdf',
      });

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toContain('.pdf');
    });

    it('should filter export by NIP', async () => {
      const service = createService();

      mockPrisma.whiteListVerification.findMany.mockResolvedValue([sampleVerification]);

      await service.exportHistory({
        nip: VALID_NIP,
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        format: 'csv',
      });

      expect(mockPrisma.whiteListVerification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nip: VALID_NIP,
          }),
        }),
      );
    });
  });
});
