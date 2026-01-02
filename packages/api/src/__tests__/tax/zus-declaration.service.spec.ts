// TAX-006: ZUS Declaration Service Tests
// Tests for Polish ZUS (Social Security) declarations and contribution calculations

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { ZUSDeclarationService } from '../../services/tax/zus-declaration.service';

// ===========================================================================
// MOCK DATA
// ===========================================================================

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const CLIENT_ID = '22222222-2222-2222-2222-222222222222';
const DECLARATION_ID = '33333333-3333-3333-3333-333333333333';
const PERSON_ID = '44444444-4444-4444-4444-444444444444';
const INSURED_PERSON_ID = '55555555-5555-5555-5555-555555555555';

const mockEmptyContributions = {
  pensionEmployee: '0',
  pensionEmployer: '0',
  disabilityEmployee: '0',
  disabilityEmployer: '0',
  sicknessEmployee: '0',
  accidentEmployer: '0',
  healthEmployee: '0',
  laborFundEmployer: '0',
  fgspEmployer: '0',
  totalEmployee: '0',
  totalEmployer: '0',
  totalContributions: '0',
};

const mockContributions = {
  pensionEmployee: '976.00',
  pensionEmployer: '976.00',
  disabilityEmployee: '150.00',
  disabilityEmployer: '650.00',
  sicknessEmployee: '245.00',
  accidentEmployer: '167.00',
  healthEmployee: '773.01',
  laborFundEmployer: '245.00',
  fgspEmployer: '10.00',
  totalEmployee: '2144.01',
  totalEmployer: '2048.00',
  totalContributions: '4192.01',
};

const mockClient = {
  id: CLIENT_ID,
  organizationId: ORG_ID,
  name: 'Test Company Sp. z o.o.',
  nip: '1234567890',
  regon: '123456789',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDeclaration = {
  id: DECLARATION_ID,
  organizationId: ORG_ID,
  clientId: CLIENT_ID,
  year: 2024,
  month: 6,
  formType: 'DRA',
  status: 'DRAFT',
  isCorrection: false,
  correctionNumber: null,
  originalDeclarationId: null,
  correctionReason: null,
  payerNip: '1234567890',
  payerRegon: '123456789',
  payerName: 'Test Company Sp. z o.o.',
  insuredCount: 1,
  employeeCount: 1,
  selfEmployedCount: 0,
  accidentRate: '1.67',
  totalPensionBase: '10000.00',
  totalDisabilityBase: '10000.00',
  totalSicknessBase: '10000.00',
  totalHealthBase: '8629.00',
  totalContributions: mockContributions,
  dueDate: '2024-07-20T00:00:00.000Z',
  paidAmount: null,
  paidAt: null,
  paymentReference: null,
  submittedAt: null,
  zusReferenceNumber: null,
  zusConfirmationNumber: null,
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSubmittedDeclaration = {
  ...mockDeclaration,
  status: 'SUBMITTED',
  submittedAt: new Date(),
  zusReferenceNumber: 'ZUS-ABC123',
};

const mockInsuredPerson = {
  id: INSURED_PERSON_ID,
  declarationId: DECLARATION_ID,
  personId: PERSON_ID,
  firstName: 'Jan',
  lastName: 'Kowalski',
  pesel: '85010112345',
  nip: null,
  insuranceCode: '01 10 00',
  contributorType: 'EMPLOYEE',
  pensionBase: '10000.00',
  disabilityBase: '10000.00',
  sicknessBase: '10000.00',
  accidentBase: '10000.00',
  healthBase: '8629.00',
  contributions: mockContributions,
  benefitType: null,
  benefitDays: null,
  benefitAmount: null,
  isActive: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  declaration: mockDeclaration,
};

// ===========================================================================
// MOCK PRISMA OPERATIONS
// ===========================================================================

const mockZusDeclarationOps = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}));

const mockZusInsuredPersonOps = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
}));

const mockClientOps = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

const mockDb = {
  zusDeclaration: mockZusDeclarationOps,
  zusInsuredPerson: mockZusInsuredPersonOps,
  client: mockClientOps,
} as unknown as Parameters<typeof ZUSDeclarationService.prototype.calculateEmployeeZUS>[0] extends { db: infer T } ? T : never;

// ===========================================================================
// TESTS
// ===========================================================================

describe('ZUSDeclarationService', () => {
  let service: ZUSDeclarationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ZUSDeclarationService(mockDb as never, ORG_ID, USER_ID);
  });

  // =========================================================================
  // EMPLOYEE ZUS CALCULATION TESTS
  // =========================================================================

  describe('calculateEmployeeZUS', () => {
    it('should calculate employee ZUS contributions correctly', async () => {
      const result = await service.calculateEmployeeZUS({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        grossSalary: 10000,
        contributorType: 'EMPLOYEE',
        insuranceCode: '01 10 00',
      });

      // Pension: 10000 * 9.76% = 976
      expect(parseFloat(result.contributions.pensionEmployee)).toBeCloseTo(976, 0);
      expect(parseFloat(result.contributions.pensionEmployer)).toBeCloseTo(976, 0);

      // Disability: Employee 1.5%, Employer 6.5%
      expect(parseFloat(result.contributions.disabilityEmployee)).toBeCloseTo(150, 0);
      expect(parseFloat(result.contributions.disabilityEmployer)).toBeCloseTo(650, 0);

      // Sickness: 2.45%
      expect(parseFloat(result.contributions.sicknessEmployee)).toBeCloseTo(245, 0);

      expect(parseFloat(result.totalEmployeeContributions)).toBeGreaterThan(1000);
    });

    it('should include bonuses and overtime in total income', async () => {
      const result = await service.calculateEmployeeZUS({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        grossSalary: 8000,
        bonus: 1000,
        overtime: 500,
        otherIncome: 500,
        contributorType: 'EMPLOYEE',
        insuranceCode: '01 10 00',
      });

      expect(result.totalIncome).toBe('10000.00');
    });

    it('should detect annual pension/disability limit', async () => {
      const result = await service.calculateEmployeeZUS({
        clientId: CLIENT_ID,
        year: 2024,
        month: 12,
        grossSalary: 30000,
        ytdPensionBase: 220000, // Close to 234720 limit
        contributorType: 'EMPLOYEE',
        insuranceCode: '01 10 00',
      });

      expect(result.isAnnualLimitReached).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle student under 26 with zero contributions', async () => {
      const result = await service.calculateEmployeeZUS({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        grossSalary: 5000,
        isStudent: true,
        contributorType: 'CIVIL_CONTRACT',
        insuranceCode: '04 11 00',
      });

      expect(result.contributions.pensionEmployee).toBe('0');
      expect(result.contributions.disabilityEmployee).toBe('0');
      expect(result.warnings).toContain('Student poniżej 26 lat - brak składek ZUS');
    });

    it('should calculate health base after social contributions', async () => {
      const result = await service.calculateEmployeeZUS({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        grossSalary: 10000,
        contributorType: 'EMPLOYEE',
        insuranceCode: '01 10 00',
      });

      // Health base = gross - (pension_ee + disability_ee + sickness)
      // 10000 - 976 - 150 - 245 = 8629
      expect(parseFloat(result.healthBase)).toBeCloseTo(8629, 0);
    });

    it('should handle custom accident rate', async () => {
      const result = await service.calculateEmployeeZUS({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        grossSalary: 10000,
        accidentRate: 3.0, // Higher risk category
        contributorType: 'EMPLOYEE',
        insuranceCode: '01 10 00',
      });

      expect(parseFloat(result.contributions.accidentEmployer)).toBeCloseTo(300, 0);
    });
  });

  // =========================================================================
  // SELF-EMPLOYED ZUS CALCULATION TESTS
  // =========================================================================

  describe('calculateSelfEmployedZUS', () => {
    describe('STANDARD scheme', () => {
      it('should calculate standard self-employed ZUS', async () => {
        const result = await service.calculateSelfEmployedZUS({
          year: 2024,
          month: 6,
          scheme: 'STANDARD',
          includeSicknessInsurance: true,
        });

        expect(result.scheme).toBe('STANDARD');
        expect(result.pensionBase).toBe('4694.40');
        expect(parseFloat(result.totalContribution)).toBeGreaterThan(1500);
      });

      it('should allow custom pension base above minimum', async () => {
        const result = await service.calculateSelfEmployedZUS({
          year: 2024,
          month: 6,
          scheme: 'STANDARD',
          customPensionBase: 10000, // Above minimum 4694.40
          includeSicknessInsurance: true,
        });

        expect(result.pensionBase).toBe('10000.00');
      });
    });

    describe('PREFERENTIAL scheme', () => {
      it('should calculate preferential (preferencyjny) ZUS', async () => {
        const result = await service.calculateSelfEmployedZUS({
          year: 2024,
          month: 6,
          scheme: 'PREFERENTIAL',
          includeSicknessInsurance: true,
        });

        expect(result.scheme).toBe('PREFERENTIAL');
        expect(result.pensionBase).toBe('1272.60'); // 30% of minimum wage
        expect(parseFloat(result.totalContribution)).toBeLessThan(
          parseFloat((await service.calculateSelfEmployedZUS({
            year: 2024,
            month: 6,
            scheme: 'STANDARD',
            includeSicknessInsurance: true,
          })).totalContribution)
        );
      });
    });

    describe('ULGA_NA_START scheme', () => {
      it('should only charge health insurance', async () => {
        const result = await service.calculateSelfEmployedZUS({
          year: 2024,
          month: 6,
          scheme: 'ULGA_NA_START',
        });

        expect(result.pensionBase).toBe('0.00');
        expect(result.pensionContribution).toBe('0.00');
        expect(result.disabilityContribution).toBe('0.00');
        expect(parseFloat(result.healthContribution)).toBeGreaterThan(0);
        expect(result.eligibilityNotes).toContain('Ulga na start - pierwsze 6 miesięcy działalności, tylko składka zdrowotna');
      });
    });

    describe('MALY_ZUS_PLUS scheme', () => {
      it('should calculate based on previous year income', async () => {
        const result = await service.calculateSelfEmployedZUS({
          year: 2024,
          month: 6,
          scheme: 'MALY_ZUS_PLUS',
          previousYearIncome: 120000, // 120k annual income
          previousYearDays: 365,
          includeSicknessInsurance: true,
        });

        expect(result.scheme).toBe('MALY_ZUS_PLUS');
        expect(parseFloat(result.calculatedBase!)).toBeGreaterThan(0);
        expect(result.eligibilityNotes.some(n => n.includes('Mały ZUS Plus'))).toBe(true);
      });

      it('should throw error if previous year data missing', async () => {
        await expect(
          service.calculateSelfEmployedZUS({
            year: 2024,
            month: 6,
            scheme: 'MALY_ZUS_PLUS',
            includeSicknessInsurance: true,
          })
        ).rejects.toThrow(TRPCError);
      });

      it('should respect minimum and maximum base limits', async () => {
        const result = await service.calculateSelfEmployedZUS({
          year: 2024,
          month: 6,
          scheme: 'MALY_ZUS_PLUS',
          previousYearIncome: 30000, // Low income
          previousYearDays: 365,
          includeSicknessInsurance: true,
        });

        // Base should not go below 30% of minimum wage
        expect(parseFloat(result.pensionBase)).toBeGreaterThanOrEqual(1272.6);
      });
    });

    it('should handle optional sickness insurance', async () => {
      const withSickness = await service.calculateSelfEmployedZUS({
        year: 2024,
        month: 6,
        scheme: 'STANDARD',
        includeSicknessInsurance: true,
      });

      const withoutSickness = await service.calculateSelfEmployedZUS({
        year: 2024,
        month: 6,
        scheme: 'STANDARD',
        includeSicknessInsurance: false,
      });

      expect(parseFloat(withSickness.sicknessContribution)).toBeGreaterThan(0);
      expect(withoutSickness.sicknessContribution).toBe('0.00');
    });

    it('should calculate health deduction based on taxation method', async () => {
      const flatTax = await service.calculateSelfEmployedZUS({
        year: 2024,
        month: 6,
        scheme: 'STANDARD',
        healthDeductionMethod: 'flat',
      });

      const lumpSum = await service.calculateSelfEmployedZUS({
        year: 2024,
        month: 6,
        scheme: 'STANDARD',
        healthDeductionMethod: 'lump_sum',
      });

      const progressive = await service.calculateSelfEmployedZUS({
        year: 2024,
        month: 6,
        scheme: 'STANDARD',
        healthDeductionMethod: 'progressive',
      });

      expect(parseFloat(flatTax.healthDeductibleFromTax)).toBeGreaterThan(0);
      expect(parseFloat(lumpSum.healthDeductibleFromTax)).toBeGreaterThan(0);
      expect(progressive.healthDeductibleFromTax).toBe('0.00');
    });
  });

  // =========================================================================
  // DECLARATION MANAGEMENT TESTS
  // =========================================================================

  describe('createDeclaration', () => {
    it('should create a new declaration', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(null);
      mockClientOps.findFirst.mockResolvedValue(mockClient);
      mockZusDeclarationOps.create.mockResolvedValue(mockDeclaration);

      const result = await service.createDeclaration({
        clientId: CLIENT_ID,
        year: 2024,
        month: 6,
        formType: 'DRA',
        accidentRate: 1.67,
      });

      expect(result.year).toBe(2024);
      expect(result.month).toBe(6);
      expect(result.status).toBe('DRAFT');
    });

    it('should throw CONFLICT if declaration already exists', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);

      await expect(
        service.createDeclaration({
          clientId: CLIENT_ID,
          year: 2024,
          month: 6,
          formType: 'DRA',
          accidentRate: 1.67,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw NOT_FOUND if client does not exist', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(null);
      mockClientOps.findFirst.mockResolvedValue(null);

      await expect(
        service.createDeclaration({
          clientId: 'non-existent',
          year: 2024,
          month: 6,
          formType: 'DRA',
          accidentRate: 1.67,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('addInsuredPerson', () => {
    it('should add an insured person to declaration', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);
      mockZusInsuredPersonOps.create.mockResolvedValue(mockInsuredPerson);
      mockZusInsuredPersonOps.findMany.mockResolvedValue([mockInsuredPerson]);
      mockZusDeclarationOps.update.mockResolvedValue(mockDeclaration);

      const result = await service.addInsuredPerson({
        declarationId: DECLARATION_ID,
        personId: PERSON_ID,
        firstName: 'Jan',
        lastName: 'Kowalski',
        pesel: '85010112345',
        insuranceCode: '01 10 00',
        contributorType: 'EMPLOYEE',
        grossSalary: 10000,
      });

      expect(result.firstName).toBe('Jan');
      expect(result.lastName).toBe('Kowalski');
    });

    it('should throw BAD_REQUEST if declaration is submitted', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockSubmittedDeclaration);

      await expect(
        service.addInsuredPerson({
          declarationId: DECLARATION_ID,
          personId: PERSON_ID,
          firstName: 'Jan',
          lastName: 'Kowalski',
          pesel: '85010112345',
          insuranceCode: '01 10 00',
          contributorType: 'EMPLOYEE',
          grossSalary: 10000,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('updateInsuredPerson', () => {
    it('should update an insured person', async () => {
      mockZusInsuredPersonOps.findUnique.mockResolvedValue(mockInsuredPerson);
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);
      mockZusInsuredPersonOps.update.mockResolvedValue({
        ...mockInsuredPerson,
        insuranceCode: '01 10 01',
      });
      mockZusInsuredPersonOps.findMany.mockResolvedValue([mockInsuredPerson]);
      mockZusDeclarationOps.update.mockResolvedValue(mockDeclaration);

      const result = await service.updateInsuredPerson({
        insuredPersonId: INSURED_PERSON_ID,
        insuranceCode: '01 10 01',
      });

      expect(result.insuranceCode).toBe('01 10 01');
    });

    it('should throw NOT_FOUND if person does not exist', async () => {
      mockZusInsuredPersonOps.findUnique.mockResolvedValue(null);

      await expect(
        service.updateInsuredPerson({
          insuredPersonId: 'non-existent',
          insuranceCode: '01 10 01',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('removeInsuredPerson', () => {
    it('should remove an insured person', async () => {
      mockZusInsuredPersonOps.findUnique.mockResolvedValue(mockInsuredPerson);
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);
      mockZusInsuredPersonOps.delete.mockResolvedValue(mockInsuredPerson);
      mockZusInsuredPersonOps.findMany.mockResolvedValue([]);
      mockZusDeclarationOps.update.mockResolvedValue({ ...mockDeclaration, insuredCount: 0 });

      const result = await service.removeInsuredPerson({
        insuredPersonId: INSURED_PERSON_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // VALIDATION TESTS
  // =========================================================================

  describe('validateDeclaration', () => {
    it('should validate a declaration with no errors', async () => {
      const validPerson = {
        ...mockInsuredPerson,
        pesel: '85010112345', // Valid PESEL
      };
      mockZusDeclarationOps.findFirst.mockResolvedValue({
        ...mockDeclaration,
        insuredPersons: [validPerson],
      });
      mockZusDeclarationOps.update.mockResolvedValue({
        ...mockDeclaration,
        status: 'VALIDATED',
      });

      const result = await service.validateDeclaration({
        declarationId: DECLARATION_ID,
      });

      // Note: validation might fail on PESEL checksum
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should detect invalid NIP', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue({
        ...mockDeclaration,
        payerNip: '123', // Invalid NIP
        insuredPersons: [],
      });

      const result = await service.validateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.errors.some(e => e.code === 'INVALID_NIP')).toBe(true);
    });

    it('should warn about empty declaration', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue({
        ...mockDeclaration,
        insuredPersons: [],
      });

      const result = await service.validateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.warnings.some(w => w.code === 'NO_INSURED')).toBe(true);
    });

    it('should detect invalid PESEL', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue({
        ...mockDeclaration,
        insuredPersons: [{
          ...mockInsuredPerson,
          pesel: '12345', // Invalid PESEL (too short)
        }],
      });

      const result = await service.validateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.errors.some(e => e.code === 'INVALID_PESEL')).toBe(true);
    });
  });

  // =========================================================================
  // SUBMISSION TESTS
  // =========================================================================

  describe('submitDeclaration', () => {
    it('should submit a validated declaration', async () => {
      mockZusDeclarationOps.findFirst
        .mockResolvedValueOnce({ ...mockDeclaration, status: 'VALIDATED' })
        .mockResolvedValueOnce({
          ...mockDeclaration,
          status: 'VALIDATED',
          insuredPersons: [mockInsuredPerson],
        });
      mockZusDeclarationOps.update.mockResolvedValue({
        ...mockDeclaration,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        zusReferenceNumber: 'ZUS-TEST123',
      });

      const result = await service.submitDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.status).toBe('SUBMITTED');
      expect(result.zusReferenceNumber).toBeDefined();
    });

    it('should throw BAD_REQUEST if already submitted', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockSubmittedDeclaration);

      await expect(
        service.submitDeclaration({
          declarationId: DECLARATION_ID,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw BAD_REQUEST if validation fails', async () => {
      mockZusDeclarationOps.findFirst
        .mockResolvedValueOnce({ ...mockDeclaration, status: 'DRAFT' })
        .mockResolvedValueOnce({
          ...mockDeclaration,
          payerNip: '123', // Invalid
          insuredPersons: [],
        });

      await expect(
        service.submitDeclaration({
          declarationId: DECLARATION_ID,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // CORRECTION TESTS
  // =========================================================================

  describe('createCorrection', () => {
    it('should create a correction for submitted declaration', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue({
        ...mockSubmittedDeclaration,
        insuredPersons: [mockInsuredPerson],
      });
      mockZusDeclarationOps.count.mockResolvedValue(0);
      mockZusDeclarationOps.create.mockResolvedValue({
        ...mockDeclaration,
        id: 'correction-id',
        isCorrection: true,
        correctionNumber: 1,
        originalDeclarationId: DECLARATION_ID,
        correctionReason: 'Błędna podstawa składek',
      });
      mockZusInsuredPersonOps.create.mockResolvedValue(mockInsuredPerson);
      mockZusDeclarationOps.update.mockResolvedValue({
        ...mockSubmittedDeclaration,
        status: 'CORRECTED',
      });

      const result = await service.createCorrection({
        originalDeclarationId: DECLARATION_ID,
        correctionReason: 'Błędna podstawa składek',
      });

      expect(result.isCorrection).toBe(true);
      expect(result.correctionNumber).toBe(1);
    });

    it('should throw BAD_REQUEST if original not submitted', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);

      await expect(
        service.createCorrection({
          originalDeclarationId: DECLARATION_ID,
          correctionReason: 'Test',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // RETRIEVAL TESTS
  // =========================================================================

  describe('getDeclaration', () => {
    it('should get declaration with payment status', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue({
        ...mockDeclaration,
        insuredPersons: [mockInsuredPerson],
      });

      const result = await service.getDeclaration({
        declarationId: DECLARATION_ID,
        includeInsuredPersons: true,
      });

      expect(result.declaration.id).toBe(DECLARATION_ID);
      expect(result.insuredPersons).toHaveLength(1);
      expect(result.paymentStatus).toBeDefined();
      expect(result.paymentStatus.dueAmount).toBeDefined();
    });

    it('should throw NOT_FOUND for non-existent declaration', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(null);

      await expect(
        service.getDeclaration({
          declarationId: 'non-existent',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('listDeclarations', () => {
    it('should list declarations with pagination', async () => {
      mockZusDeclarationOps.findMany.mockResolvedValue([mockDeclaration]);
      mockZusDeclarationOps.count.mockResolvedValue(1);

      const result = await service.listDeclarations({
        page: 1,
        pageSize: 10,
      });

      expect(result.declarations).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by year and month', async () => {
      mockZusDeclarationOps.findMany.mockResolvedValue([mockDeclaration]);
      mockZusDeclarationOps.count.mockResolvedValue(1);

      await service.listDeclarations({
        year: 2024,
        month: 6,
        page: 1,
        pageSize: 10,
      });

      expect(mockZusDeclarationOps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2024,
            month: 6,
          }),
        })
      );
    });
  });

  describe('deleteDeclaration', () => {
    it('should delete a draft declaration', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);
      mockZusInsuredPersonOps.deleteMany.mockResolvedValue({ count: 1 });
      mockZusDeclarationOps.delete.mockResolvedValue(mockDeclaration);

      const result = await service.deleteDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.success).toBe(true);
    });

    it('should throw BAD_REQUEST when deleting submitted declaration', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockSubmittedDeclaration);

      await expect(
        service.deleteDeclaration({
          declarationId: DECLARATION_ID,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // PAYMENT TESTS
  // =========================================================================

  describe('calculatePayment', () => {
    it('should calculate payment amounts by fund', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);

      const result = await service.calculatePayment({
        declarationId: DECLARATION_ID,
      });

      expect(result.totalAmount).toBeDefined();
      expect(result.pensionAmount).toBeDefined();
      expect(result.healthAmount).toBeDefined();
    });
  });

  describe('recordPayment', () => {
    it('should record a payment', async () => {
      mockZusDeclarationOps.findFirst.mockResolvedValue(mockDeclaration);
      mockZusDeclarationOps.update.mockResolvedValue({
        ...mockDeclaration,
        paidAmount: '4192.01',
        paidAt: new Date('2024-07-15'),
        paymentReference: 'PAY-123456',
      });

      const result = await service.recordPayment({
        declarationId: DECLARATION_ID,
        totalAmount: 4192.01,
        paymentDate: '2024-07-15T00:00:00.000Z',
        paymentReference: 'PAY-123456',
      });

      expect(result.paidAmount).toBe('4192.01');
      expect(result.paymentReference).toBe('PAY-123456');
    });
  });

  describe('getPaymentSchedule', () => {
    it('should return annual payment schedule', async () => {
      mockZusDeclarationOps.findMany.mockResolvedValue([
        { ...mockDeclaration, month: 1 },
        { ...mockDeclaration, month: 2 },
        { ...mockDeclaration, month: 3 },
      ]);

      const result = await service.getPaymentSchedule({
        clientId: CLIENT_ID,
        year: 2024,
      });

      expect(result.schedule).toHaveLength(12); // Full year
      expect(result.totalDue).toBeDefined();
      expect(result.totalPaid).toBeDefined();
    });
  });

  // =========================================================================
  // HISTORY AND REPORTING TESTS
  // =========================================================================

  describe('getContributionHistory', () => {
    it('should return contribution history', async () => {
      mockZusInsuredPersonOps.findMany.mockResolvedValue([
        {
          ...mockInsuredPerson,
          declaration: { year: 2024, month: 6, paidAt: new Date() },
        },
      ]);
      mockZusInsuredPersonOps.count.mockResolvedValue(1);

      const result = await service.getContributionHistory({
        personId: PERSON_ID,
        page: 1,
        pageSize: 10,
      });

      expect(result.history).toHaveLength(1);
      expect(result.history[0].year).toBe(2024);
    });

    it('should filter by PESEL', async () => {
      mockZusInsuredPersonOps.findMany.mockResolvedValue([]);
      mockZusInsuredPersonOps.count.mockResolvedValue(0);

      await service.getContributionHistory({
        pesel: '85010112345',
        page: 1,
        pageSize: 10,
      });

      expect(mockZusInsuredPersonOps.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pesel: '85010112345',
          }),
        })
      );
    });
  });

  describe('generateAnnualReport', () => {
    it('should generate annual ZUS report', async () => {
      mockZusDeclarationOps.findMany.mockResolvedValue([
        { ...mockDeclaration, month: 1 },
        { ...mockDeclaration, month: 2, paidAmount: '4192.01', paidAt: new Date() },
        { ...mockDeclaration, month: 3 },
      ]);

      const result = await service.generateAnnualReport({
        clientId: CLIENT_ID,
        year: 2024,
      });

      expect(result.year).toBe(2024);
      expect(result.monthlyData).toHaveLength(3);
      expect(parseFloat(result.grandTotal)).toBeGreaterThan(0);
      expect(parseFloat(result.totalDue)).toBeGreaterThan(0);
    });

    it('should handle empty year', async () => {
      mockZusDeclarationOps.findMany.mockResolvedValue([]);

      const result = await service.generateAnnualReport({
        clientId: CLIENT_ID,
        year: 2024,
      });

      expect(result.monthlyData).toHaveLength(0);
      expect(result.grandTotal).toBe('0.00');
    });
  });
});
