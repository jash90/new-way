import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '../../index';
import { createContext } from '../../context';

// ===========================================
// HOISTED MOCKS
// ===========================================

const mocks = vi.hoisted(() => ({
  assessClientRisk: vi.fn(),
  getClientRiskHistory: vi.fn(),
  updateRiskConfig: vi.fn(),
  getRiskConfig: vi.fn(),
  bulkAssessRisk: vi.fn(),
  getHighRiskClients: vi.fn(),
}));

vi.mock('../../services/crm/risk.service', () => ({
  RiskService: vi.fn().mockImplementation(() => mocks),
}));

vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    hash: vi.fn().mockResolvedValue('hashedPassword'),
    verify: vi.fn().mockResolvedValue(true),
  })),
  TotpService: vi.fn().mockImplementation(() => ({
    generateSecret: vi.fn().mockReturnValue('secret'),
    verify: vi.fn().mockReturnValue(true),
  })),
}));

// ===========================================
// MOCK SETUP
// ===========================================

const mockPrisma = {
  user: { findUnique: vi.fn() },
  session: { findUnique: vi.fn() },
  client: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  riskAssessment: { findMany: vi.fn(), count: vi.fn() },
  riskConfig: { findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn((callback: any) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => ({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// ===========================================
// TEST DATA
// ===========================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const SESSION_ID = '66666666-6666-6666-6666-666666666666';

// ===========================================
// CONTEXT HELPERS
// ===========================================

function createUserContext() {
  const ctx = createContext({
    prisma: mockPrisma as any,
    redis: mockRedis as any,
    req: {
      headers: { 'user-agent': 'test' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    } as any,
    res: {} as any,
  });
  return {
    ...ctx,
    session: {
      sessionId: SESSION_ID,
      userId: TEST_USER_ID,
      email: 'test@example.com',
      roles: ['USER'],
      organizationId: ORG_ID,
    },
  };
}

function createAdminContext() {
  const ctx = createContext({
    prisma: mockPrisma as any,
    redis: mockRedis as any,
    req: {
      headers: { 'user-agent': 'test' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    } as any,
    res: {} as any,
  });
  return {
    ...ctx,
    session: {
      sessionId: SESSION_ID,
      userId: TEST_USER_ID,
      email: 'admin@example.com',
      roles: ['ADMIN'],
      organizationId: ORG_ID,
    },
  };
}

function createUnauthenticatedContext() {
  return createContext({
    prisma: mockPrisma as any,
    redis: mockRedis as any,
    req: {
      headers: { 'user-agent': 'test' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    } as any,
    res: {} as any,
  });
}

// ===========================================
// TEST SUITE
// ===========================================

describe('Risk Router (CRM-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // AUTHENTICATION
  // ===========================================

  describe('authentication', () => {
    it('should reject unauthenticated requests to assessClientRisk', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.risk.assessClientRisk({
          clientId: CLIENT_ID,
          includeHistory: false,
          recalculate: false,
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests to getClientRiskHistory', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.risk.getClientRiskHistory({
          clientId: CLIENT_ID,
          limit: 10,
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests to getHighRiskClients', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.risk.getHighRiskClients({
          minLevel: 'high',
          page: 1,
          limit: 20,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================
  // ASSESS CLIENT RISK
  // ===========================================

  describe('assessClientRisk', () => {
    const mockAssessment = {
      success: true,
      assessment: {
        clientId: CLIENT_ID,
        overallScore: 35,
        riskLevel: 'medium',
        factors: [
          {
            type: 'vat_status',
            name: 'Status VAT',
            description: 'Status weryfikacji VAT',
            score: 20,
            weight: 25,
            weightedScore: 5,
            category: 'compliance',
          },
        ],
        summary: 'Średnie ryzyko',
        recommendations: ['Regularnie weryfikuj VAT'],
        assessedAt: new Date(),
        validUntil: new Date(),
      },
      message: 'Ocena ryzyka przeprowadzona',
    };

    it('should assess client risk', async () => {
      mocks.assessClientRisk.mockResolvedValue(mockAssessment);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.clientId).toBe(CLIENT_ID);
      expect(result.assessment.riskLevel).toBe('medium');
      expect(mocks.assessClientRisk).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });
    });

    it('should include history when requested', async () => {
      const assessmentWithHistory = {
        ...mockAssessment,
        assessment: {
          ...mockAssessment.assessment,
          previousScore: 45,
          scoreTrend: 'improving',
        },
      };
      mocks.assessClientRisk.mockResolvedValue(assessmentWithHistory);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: true,
        recalculate: false,
      });

      expect(result.assessment.previousScore).toBe(45);
      expect(result.assessment.scoreTrend).toBe('improving');
    });

    it('should force recalculation when requested', async () => {
      mocks.assessClientRisk.mockResolvedValue(mockAssessment);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.risk.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: true,
      });

      expect(mocks.assessClientRisk).toHaveBeenCalledWith(
        expect.objectContaining({ recalculate: true })
      );
    });
  });

  // ===========================================
  // GET CLIENT RISK HISTORY
  // ===========================================

  describe('getClientRiskHistory', () => {
    const mockHistory = {
      clientId: CLIENT_ID,
      history: [
        {
          id: 'assessment-1',
          score: 35,
          riskLevel: 'medium',
          factorsSummary: { vat_status: 20 },
          assessedAt: new Date(),
          triggeredBy: 'manual',
        },
        {
          id: 'assessment-2',
          score: 45,
          riskLevel: 'medium',
          factorsSummary: { vat_status: 30 },
          assessedAt: new Date('2024-01-01'),
          triggeredBy: 'auto',
        },
      ],
      total: 2,
    };

    it('should return risk assessment history', async () => {
      mocks.getClientRiskHistory.mockResolvedValue(mockHistory);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.getClientRiskHistory({
        clientId: CLIENT_ID,
        limit: 10,
      });

      expect(result.clientId).toBe(CLIENT_ID);
      expect(result.history).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should respect limit parameter', async () => {
      mocks.getClientRiskHistory.mockResolvedValue({
        ...mockHistory,
        history: [mockHistory.history[0]],
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.risk.getClientRiskHistory({
        clientId: CLIENT_ID,
        limit: 1,
      });

      expect(mocks.getClientRiskHistory).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        limit: 1,
      });
    });
  });

  // ===========================================
  // UPDATE RISK CONFIG
  // ===========================================

  describe('updateRiskConfig', () => {
    const mockConfigResult = {
      success: true,
      config: {
        factorWeights: { vat_status: 30, payment_history: 25 },
        thresholds: { low: 25, medium: 50, high: 75 },
        autoAssessInterval: 30,
        enableAutoAssess: true,
        updatedAt: new Date(),
      },
      message: 'Konfiguracja zaktualizowana',
    };

    it('should update risk configuration', async () => {
      mocks.updateRiskConfig.mockResolvedValue(mockConfigResult);
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.risk.updateRiskConfig({
        factorWeights: { vat_status: 30 },
      });

      expect(result.success).toBe(true);
      expect(result.config.factorWeights.vat_status).toBe(30);
    });

    it('should update thresholds', async () => {
      mocks.updateRiskConfig.mockResolvedValue({
        ...mockConfigResult,
        config: {
          ...mockConfigResult.config,
          thresholds: { low: 20, medium: 45, high: 70 },
        },
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.risk.updateRiskConfig({
        thresholds: { low: 20, medium: 45, high: 70 },
      });

      expect(result.config.thresholds.low).toBe(20);
    });

    it('should update auto assess settings', async () => {
      mocks.updateRiskConfig.mockResolvedValue({
        ...mockConfigResult,
        config: {
          ...mockConfigResult.config,
          autoAssessInterval: 14,
          enableAutoAssess: false,
        },
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.risk.updateRiskConfig({
        autoAssessInterval: 14,
        enableAutoAssess: false,
      });

      expect(result.config.autoAssessInterval).toBe(14);
      expect(result.config.enableAutoAssess).toBe(false);
    });
  });

  // ===========================================
  // GET RISK CONFIG
  // ===========================================

  describe('getRiskConfig', () => {
    it('should return current risk configuration', async () => {
      const mockConfig = {
        success: true,
        config: {
          factorWeights: { vat_status: 25, payment_history: 20 },
          thresholds: { low: 25, medium: 50, high: 75 },
          autoAssessInterval: 30,
          enableAutoAssess: true,
          updatedAt: new Date(),
        },
        message: 'Pobrano konfigurację',
      };
      mocks.getRiskConfig.mockResolvedValue(mockConfig);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.getRiskConfig();

      expect(result.success).toBe(true);
      expect(result.config.factorWeights).toBeDefined();
      expect(result.config.thresholds).toBeDefined();
    });
  });

  // ===========================================
  // BULK ASSESS RISK
  // ===========================================

  describe('bulkAssessRisk', () => {
    const mockBulkResult = {
      success: true,
      assessed: 2,
      failed: 0,
      assessments: [
        {
          clientId: CLIENT_ID,
          overallScore: 35,
          riskLevel: 'medium',
          factors: [],
          summary: 'Średnie ryzyko',
          recommendations: [],
          assessedAt: new Date(),
          validUntil: new Date(),
        },
        {
          clientId: '55555555-5555-5555-5555-555555555555',
          overallScore: 45,
          riskLevel: 'medium',
          factors: [],
          summary: 'Średnie ryzyko',
          recommendations: [],
          assessedAt: new Date(),
          validUntil: new Date(),
        },
      ],
      message: 'Oceniono 2 klientów',
    };

    it('should assess multiple clients', async () => {
      mocks.bulkAssessRisk.mockResolvedValue(mockBulkResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.bulkAssessRisk({
        clientIds: [CLIENT_ID, '55555555-5555-5555-5555-555555555555'],
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.assessments).toHaveLength(2);
    });

    it('should handle partial failures', async () => {
      const nonExistentClientId = '99999999-9999-9999-9999-999999999999';
      mocks.bulkAssessRisk.mockResolvedValue({
        ...mockBulkResult,
        assessed: 1,
        failed: 1,
        assessments: [mockBulkResult.assessments[0]],
        errors: [{ clientId: nonExistentClientId, error: 'Klient nie znaleziony' }],
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.bulkAssessRisk({
        clientIds: [CLIENT_ID, nonExistentClientId],
        recalculate: false,
      });

      expect(result.assessed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ===========================================
  // GET HIGH RISK CLIENTS
  // ===========================================

  describe('getHighRiskClients', () => {
    const mockHighRiskResult = {
      clients: [
        {
          clientId: CLIENT_ID,
          displayName: 'High Risk Company',
          type: 'company',
          overallScore: 85,
          riskLevel: 'critical',
          topFactors: [
            { type: 'vat_status', score: 100 },
            { type: 'data_completeness', score: 80 },
          ],
          assessedAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasMore: false,
    };

    it('should return high risk clients', async () => {
      mocks.getHighRiskClients.mockResolvedValue(mockHighRiskResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.getHighRiskClients({
        minLevel: 'high',
        page: 1,
        limit: 20,
      });

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].riskLevel).toBe('critical');
      expect(result.total).toBe(1);
    });

    it('should filter by risk category', async () => {
      mocks.getHighRiskClients.mockResolvedValue(mockHighRiskResult);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.risk.getHighRiskClients({
        minLevel: 'high',
        category: 'financial',
        page: 1,
        limit: 20,
      });

      expect(mocks.getHighRiskClients).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'financial' })
      );
    });

    it('should paginate results', async () => {
      mocks.getHighRiskClients.mockResolvedValue({
        ...mockHighRiskResult,
        page: 2,
        totalPages: 3,
        hasMore: true,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.risk.getHighRiskClients({
        minLevel: 'high',
        page: 2,
        limit: 20,
      });

      expect(result.page).toBe(2);
      expect(result.hasMore).toBe(true);
    });
  });

  // ===========================================
  // INPUT VALIDATION
  // ===========================================

  describe('input validation', () => {
    it('should reject invalid clientId format', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.risk.assessClientRisk({
          clientId: 'invalid-uuid',
          includeHistory: false,
          recalculate: false,
        })
      ).rejects.toThrow();
    });

    it('should reject invalid limit in history', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.risk.getClientRiskHistory({
          clientId: CLIENT_ID,
          limit: 0,
        })
      ).rejects.toThrow();
    });

    it('should reject too many clients in bulk assess', async () => {
      const caller = appRouter.createCaller(createUserContext());
      const tooManyClients = Array.from({ length: 51 }, (_, i) =>
        `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`
      );

      await expect(
        caller.crm.risk.bulkAssessRisk({
          clientIds: tooManyClients,
          recalculate: false,
        })
      ).rejects.toThrow();
    });

    it('should reject invalid threshold values', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.risk.updateRiskConfig({
          thresholds: { low: 150, medium: 50, high: 75 },
        })
      ).rejects.toThrow();
    });
  });
});
