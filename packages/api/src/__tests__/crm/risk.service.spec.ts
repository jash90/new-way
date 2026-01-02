import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskService } from '../../services/crm/risk.service';

// ===========================================
// MOCK SETUP
// ===========================================

const mockPrisma = {
  client: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  riskAssessment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  riskConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  vatValidation: {
    findFirst: vi.fn(),
  },
  timelineEvent: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
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

const mockAuditLogger = {
  log: vi.fn(),
  logAsync: vi.fn().mockResolvedValue(undefined),
};

// ===========================================
// TEST DATA
// ===========================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const ASSESSMENT_ID = '44444444-4444-4444-4444-444444444444';

const mockClient = {
  id: CLIENT_ID,
  organizationId: ORG_ID,
  type: 'company',
  status: 'active',
  displayName: 'Test Company',
  nip: '1234567890',
  vatStatus: 'ACTIVE',
  vatValidatedAt: new Date(),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
  deletedAt: null,
  email: 'test@company.com',
  phone: '+48123456789',
};

const mockRiskAssessment = {
  id: ASSESSMENT_ID,
  clientId: CLIENT_ID,
  overallScore: 35,
  riskLevel: 'medium',
  factors: JSON.stringify([
    {
      type: 'vat_status',
      name: 'Status VAT',
      description: 'Status weryfikacji VAT klienta',
      score: 20,
      weight: 25,
      weightedScore: 5,
      category: 'compliance',
    },
  ]),
  summary: 'Średnie ryzyko - wymaga monitorowania',
  recommendations: JSON.stringify(['Regularnie weryfikuj status VAT']),
  assessedAt: new Date(),
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  triggeredBy: 'manual',
  createdBy: TEST_USER_ID,
  createdAt: new Date(),
};

const mockRiskConfig = {
  id: 'config-1',
  organizationId: ORG_ID,
  factorWeights: JSON.stringify({
    vat_status: 25,
    payment_history: 20,
    legal_status: 15,
    data_completeness: 15,
    activity_level: 10,
    document_compliance: 10,
    communication_pattern: 5,
  }),
  thresholds: JSON.stringify({
    low: 25,
    medium: 50,
    high: 75,
  }),
  autoAssessInterval: 30,
  enableAutoAssess: true,
  updatedAt: new Date(),
};

// ===========================================
// TEST SUITE
// ===========================================

describe('RiskService (CRM-009)', () => {
  let service: RiskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RiskService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      ORG_ID
    );
  });

  // ===========================================
  // ASSESS CLIENT RISK
  // ===========================================

  describe('assessClientRisk', () => {
    it('should assess risk for a client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockResolvedValue(mockRiskAssessment);

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment).toBeDefined();
      expect(result.assessment.clientId).toBe(CLIENT_ID);
      expect(result.assessment.riskLevel).toBeDefined();
      expect(result.assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.assessment.overallScore).toBeLessThanOrEqual(100);
    });

    it('should return cached assessment if not expired', async () => {
      const cachedAssessment = {
        ...mockRiskAssessment,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(cachedAssessment);

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.clientId).toBe(CLIENT_ID);
      expect(result.assessment.overallScore).toBe(35);
      expect(mockPrisma.riskAssessment.create).not.toHaveBeenCalled();
    });

    it('should recalculate when recalculate flag is true', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(mockRiskAssessment);
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        ...mockRiskAssessment,
        id: 'new-assessment-id',
      });

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: true,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.riskAssessment.create).toHaveBeenCalled();
    });

    it('should include history when includeHistory is true', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockResolvedValue(mockRiskAssessment);
      mockPrisma.riskAssessment.findMany.mockResolvedValue([mockRiskAssessment]);

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: true,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.previousScore).toBeDefined();
    });

    it('should throw error for non-existent client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.assessClientRisk({
          clientId: CLIENT_ID,
          includeHistory: false,
          recalculate: false,
        })
      ).rejects.toThrow();
    });

    it('should calculate VAT status factor correctly', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        vatStatus: 'NOT_REGISTERED',
      });
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'NOT_REGISTERED',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...mockRiskAssessment,
        ...data.data,
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      const factors = result.assessment.factors;
      const vatFactor = factors.find((f: any) => f.type === 'vat_status');
      expect(vatFactor).toBeDefined();
      expect(vatFactor?.score).toBeGreaterThan(0);
    });

    it('should calculate data completeness factor', async () => {
      const incompleteClient = {
        ...mockClient,
        email: null,
        phone: null,
      };
      mockPrisma.client.findUnique.mockResolvedValue(incompleteClient);
      mockPrisma.vatValidation.findFirst.mockResolvedValue(null);
      mockPrisma.timelineEvent.count.mockResolvedValue(0);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...mockRiskAssessment,
        ...data.data,
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      const factors = result.assessment.factors;
      const dataFactor = factors.find((f: any) => f.type === 'data_completeness');
      expect(dataFactor).toBeDefined();
      expect(dataFactor?.score).toBeGreaterThan(0); // Higher score = more risk
    });
  });

  // ===========================================
  // GET CLIENT RISK HISTORY
  // ===========================================

  describe('getClientRiskHistory', () => {
    it('should return risk assessment history', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.riskAssessment.findMany.mockResolvedValue([
        mockRiskAssessment,
        { ...mockRiskAssessment, id: 'assessment-2', assessedAt: new Date('2024-01-01') },
      ]);
      mockPrisma.riskAssessment.count.mockResolvedValue(2);

      const result = await service.getClientRiskHistory({
        clientId: CLIENT_ID,
        limit: 10,
      });

      expect(result.clientId).toBe(CLIENT_ID);
      expect(result.history).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should respect limit parameter', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.riskAssessment.findMany.mockResolvedValue([mockRiskAssessment]);
      mockPrisma.riskAssessment.count.mockResolvedValue(5);

      const result = await service.getClientRiskHistory({
        clientId: CLIENT_ID,
        limit: 1,
      });

      expect(result.history).toHaveLength(1);
      expect(result.total).toBe(5);
    });

    it('should throw error for non-existent client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.getClientRiskHistory({
          clientId: CLIENT_ID,
          limit: 10,
        })
      ).rejects.toThrow();
    });

    it('should return empty history for new client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.riskAssessment.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.count.mockResolvedValue(0);

      const result = await service.getClientRiskHistory({
        clientId: CLIENT_ID,
        limit: 10,
      });

      expect(result.history).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ===========================================
  // UPDATE RISK CONFIG
  // ===========================================

  describe('updateRiskConfig', () => {
    it('should update factor weights', async () => {
      mockPrisma.riskConfig.upsert.mockResolvedValue({
        ...mockRiskConfig,
        factorWeights: JSON.stringify({ vat_status: 30, payment_history: 25 }),
      });

      const result = await service.updateRiskConfig({
        factorWeights: {
          vat_status: 30,
          payment_history: 25,
        },
      });

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(mockPrisma.riskConfig.upsert).toHaveBeenCalled();
    });

    it('should update thresholds', async () => {
      mockPrisma.riskConfig.upsert.mockResolvedValue({
        ...mockRiskConfig,
        thresholds: JSON.stringify({ low: 20, medium: 45, high: 70 }),
      });

      const result = await service.updateRiskConfig({
        thresholds: {
          low: 20,
          medium: 45,
          high: 70,
        },
      });

      expect(result.success).toBe(true);
      expect(result.config.thresholds.low).toBe(20);
    });

    it('should update auto assess settings', async () => {
      mockPrisma.riskConfig.upsert.mockResolvedValue({
        ...mockRiskConfig,
        autoAssessInterval: 14,
        enableAutoAssess: false,
      });

      const result = await service.updateRiskConfig({
        autoAssessInterval: 14,
        enableAutoAssess: false,
      });

      expect(result.success).toBe(true);
      expect(result.config.autoAssessInterval).toBe(14);
      expect(result.config.enableAutoAssess).toBe(false);
    });

    it('should handle partial updates', async () => {
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskConfig.upsert.mockResolvedValue({
        ...mockRiskConfig,
        enableAutoAssess: false,
      });

      const result = await service.updateRiskConfig({
        enableAutoAssess: false,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.riskConfig.upsert).toHaveBeenCalled();
    });
  });

  // ===========================================
  // GET RISK CONFIG
  // ===========================================

  describe('getRiskConfig', () => {
    it('should return current risk config', async () => {
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);

      const result = await service.getRiskConfig();

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config.factorWeights).toBeDefined();
      expect(result.config.thresholds).toBeDefined();
    });

    it('should return default config if none exists', async () => {
      mockPrisma.riskConfig.findUnique.mockResolvedValue(null);

      const result = await service.getRiskConfig();

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config.thresholds.low).toBe(25);
      expect(result.config.thresholds.medium).toBe(50);
      expect(result.config.thresholds.high).toBe(75);
    });
  });

  // ===========================================
  // BULK ASSESS RISK
  // ===========================================

  describe('bulkAssessRisk', () => {
    it('should assess multiple clients', async () => {
      const clientId2 = '55555555-5555-5555-5555-555555555555';
      mockPrisma.client.findUnique
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce({ ...mockClient, id: clientId2 });
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create
        .mockResolvedValueOnce(mockRiskAssessment)
        .mockResolvedValueOnce({ ...mockRiskAssessment, clientId: clientId2 });

      const result = await service.bulkAssessRisk({
        clientIds: [CLIENT_ID, clientId2],
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.assessments).toHaveLength(2);
    });

    it('should handle partial failures', async () => {
      mockPrisma.client.findUnique
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(null); // Second client doesn't exist
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockResolvedValue(mockRiskAssessment);

      const result = await service.bulkAssessRisk({
        clientIds: [CLIENT_ID, 'non-existent-id'],
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should recalculate all when flag is true', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(mockRiskAssessment);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        ...mockRiskAssessment,
        id: 'new-assessment',
      });

      const result = await service.bulkAssessRisk({
        clientIds: [CLIENT_ID],
        recalculate: true,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.riskAssessment.create).toHaveBeenCalled();
    });
  });

  // ===========================================
  // GET HIGH RISK CLIENTS
  // ===========================================

  describe('getHighRiskClients', () => {
    it('should return high risk clients', async () => {
      const highRiskAssessment = {
        ...mockRiskAssessment,
        overallScore: 80,
        riskLevel: 'high',
        client: mockClient,
      };
      mockPrisma.riskAssessment.findMany.mockResolvedValue([highRiskAssessment]);
      mockPrisma.riskAssessment.count.mockResolvedValue(1);

      const result = await service.getHighRiskClients({
        minLevel: 'high',
        page: 1,
        limit: 20,
      });

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].riskLevel).toBe('high');
      expect(result.total).toBe(1);
    });

    it('should filter by risk category', async () => {
      const financialRiskAssessment = {
        ...mockRiskAssessment,
        overallScore: 85,
        riskLevel: 'critical',
        factors: JSON.stringify([
          { type: 'payment_history', category: 'financial', score: 90 },
        ]),
        client: mockClient,
      };
      mockPrisma.riskAssessment.findMany.mockResolvedValue([financialRiskAssessment]);
      mockPrisma.riskAssessment.count.mockResolvedValue(1);

      const result = await service.getHighRiskClients({
        minLevel: 'high',
        category: 'financial',
        page: 1,
        limit: 20,
      });

      expect(result.clients).toHaveLength(1);
    });

    it('should paginate results', async () => {
      mockPrisma.riskAssessment.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.count.mockResolvedValue(50);

      const result = await service.getHighRiskClients({
        minLevel: 'high',
        page: 2,
        limit: 20,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should return critical clients by default', async () => {
      mockPrisma.riskAssessment.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.count.mockResolvedValue(0);

      await service.getHighRiskClients({
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.riskAssessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            riskLevel: expect.objectContaining({
              in: expect.arrayContaining(['high', 'critical']),
            }),
          }),
        })
      );
    });

    it('should include top risk factors', async () => {
      const assessmentWithFactors = {
        ...mockRiskAssessment,
        overallScore: 80,
        riskLevel: 'high',
        factors: JSON.stringify([
          { type: 'vat_status', score: 90 },
          { type: 'payment_history', score: 70 },
          { type: 'data_completeness', score: 50 },
        ]),
        client: mockClient,
      };
      mockPrisma.riskAssessment.findMany.mockResolvedValue([assessmentWithFactors]);
      mockPrisma.riskAssessment.count.mockResolvedValue(1);

      const result = await service.getHighRiskClients({
        minLevel: 'high',
        page: 1,
        limit: 20,
      });

      expect(result.clients[0].topFactors).toBeDefined();
      expect(result.clients[0].topFactors.length).toBeLessThanOrEqual(3);
    });
  });

  // ===========================================
  // RISK LEVEL DETERMINATION
  // ===========================================

  describe('risk level determination', () => {
    it('should classify low risk correctly', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        vatStatus: 'ACTIVE',
        email: 'test@company.com',
        phone: '+48123456789',
      });
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(10);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...data.data,
        id: 'new-id',
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      // Low risk clients have complete data and active VAT
      expect(['low', 'medium']).toContain(result.assessment.riskLevel);
    });

    it('should classify high risk correctly', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        vatStatus: 'NOT_REGISTERED',
        email: null,
        phone: null,
        status: 'inactive',
      });
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'NOT_REGISTERED',
        validatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(0);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...data.data,
        id: 'new-id',
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(['high', 'critical']).toContain(result.assessment.riskLevel);
    });
  });

  // ===========================================
  // SCORE TREND CALCULATION
  // ===========================================

  describe('score trend calculation', () => {
    it('should detect improving trend', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(10);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.findMany.mockResolvedValue([
        { ...mockRiskAssessment, overallScore: 60 }, // Previous higher score (worse)
      ]);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...data.data,
        id: 'new-id',
        overallScore: 30, // Current lower score (better)
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: true,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.scoreTrend).toBe('improving');
    });

    it('should detect worsening trend', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        vatStatus: 'INVALID',
        email: null,
      });
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'INVALID',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(0);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.findMany.mockResolvedValue([
        { ...mockRiskAssessment, overallScore: 30 }, // Previous lower score (better)
      ]);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...data.data,
        id: 'new-id',
        overallScore: 70, // Current higher score (worse)
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: true,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.scoreTrend).toBe('worsening');
    });

    it('should detect stable trend', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);

      // Get calculated score first by capturing what the service calculates
      let calculatedScore = 0;
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => {
        calculatedScore = data.data.overallScore;
        return {
          ...data.data,
          id: 'new-id',
        };
      });

      // Set previous score to be within ±5 of calculated score
      // We'll mock findMany to return previous score that's stable relative to new
      mockPrisma.riskAssessment.findMany.mockImplementation(() => {
        // Return score that's within stable range (±5) of calculated score
        return [{ ...mockRiskAssessment, overallScore: calculatedScore + 2 }];
      });

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: true,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.scoreTrend).toBe('stable');
    });
  });

  // ===========================================
  // RECOMMENDATIONS
  // ===========================================

  describe('recommendations generation', () => {
    it('should generate recommendations for VAT issues', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        vatStatus: 'NOT_REGISTERED',
      });
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'NOT_REGISTERED',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...data.data,
        id: 'new-id',
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.recommendations).toBeDefined();
      expect(result.assessment.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate recommendations for incomplete data', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        email: null,
        phone: null,
        vatStatus: null,
      });
      mockPrisma.vatValidation.findFirst.mockResolvedValue(null);
      mockPrisma.timelineEvent.count.mockResolvedValue(0);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockImplementation((data: any) => ({
        ...data.data,
        id: 'new-id',
      }));

      const result = await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(result.success).toBe(true);
      expect(result.assessment.recommendations).toBeDefined();
      // Should have recommendations for incomplete data (email, phone, vat)
      expect(result.assessment.recommendations.some((r: string) =>
        r.toLowerCase().includes('uzupełnij') ||
        r.toLowerCase().includes('email') ||
        r.toLowerCase().includes('telefon') ||
        r.toLowerCase().includes('vat') ||
        r.toLowerCase().includes('zweryfikuj')
      )).toBe(true);
    });
  });

  // ===========================================
  // AUDIT LOGGING
  // ===========================================

  describe('audit logging', () => {
    it('should log risk assessment', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.vatValidation.findFirst.mockResolvedValue({
        vatStatus: 'ACTIVE',
        validatedAt: new Date(),
      });
      mockPrisma.timelineEvent.count.mockResolvedValue(5);
      mockPrisma.riskConfig.findUnique.mockResolvedValue(mockRiskConfig);
      mockPrisma.riskAssessment.findFirst.mockResolvedValue(null);
      mockPrisma.riskAssessment.create.mockResolvedValue(mockRiskAssessment);

      await service.assessClientRisk({
        clientId: CLIENT_ID,
        includeHistory: false,
        recalculate: false,
      });

      expect(mockAuditLogger.logAsync).toHaveBeenCalled();
    });

    it('should log config updates', async () => {
      mockPrisma.riskConfig.upsert.mockResolvedValue(mockRiskConfig);

      await service.updateRiskConfig({
        enableAutoAssess: false,
      });

      expect(mockAuditLogger.logAsync).toHaveBeenCalled();
    });
  });
});
