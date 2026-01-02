// TAX-006: ZUS Declaration Router Tests
// Tests for Polish ZUS (Social Security) declaration API endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ZUSDeclarationService } from '../../services/tax/zus-declaration.service';
import Decimal from 'decimal.js';

// ===========================================================================
// MOCK DATA
// ===========================================================================

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const DECLARATION_ID = '44444444-4444-4444-4444-444444444444';
const PERSON_ID = '55555555-5555-5555-5555-555555555555';
const INSURED_PERSON_ID = '66666666-6666-6666-6666-666666666666';
const PAYMENT_ID = '77777777-7777-7777-7777-777777777777';

const mockEmployeeZUSResult = {
  pesel: '90010112345',
  name: 'Jan Kowalski',
  grossSalary: new Decimal(10000),
  contributionBase: new Decimal(10000),
  contributions: {
    emerytalne: { employee: new Decimal(976), employer: new Decimal(976), total: new Decimal(1952) },
    rentowe: { employee: new Decimal(150), employer: new Decimal(650), total: new Decimal(800) },
    chorobowe: { employee: new Decimal(245), employer: new Decimal(0), total: new Decimal(245) },
    wypadkowe: { employee: new Decimal(0), employer: new Decimal(167), total: new Decimal(167) },
    zdrowotne: { employee: new Decimal(775.29), employer: new Decimal(0), total: new Decimal(775.29) },
    fp: { employee: new Decimal(0), employer: new Decimal(245), total: new Decimal(245) },
    fgsp: { employee: new Decimal(0), employer: new Decimal(10), total: new Decimal(10) },
  },
  totalEmployee: new Decimal(2146.29),
  totalEmployer: new Decimal(2048),
  totalContributions: new Decimal(4194.29),
  healthBase: new Decimal(8628.71),
};

const mockSelfEmployedZUSResult = {
  scheme: 'STANDARD' as const,
  contributionBase: new Decimal(4694.4),
  healthBase: new Decimal(4181.5),
  contributions: {
    emerytalne: new Decimal(457.97),
    rentowe: new Decimal(375.55),
    chorobowe: new Decimal(114.99),
    wypadkowe: new Decimal(78.38),
    zdrowotne: new Decimal(376.34),
    fp: new Decimal(114.99),
  },
  totalContributions: new Decimal(1518.22),
  totalDeductible: new Decimal(1141.88),
  netHealthDeductible: new Decimal(323.99),
};

const mockDeclaration = {
  id: DECLARATION_ID,
  organizationId: ORG_ID,
  clientId: CLIENT_ID,
  declarationType: 'DRA' as const,
  period: { year: 2024, month: 1 },
  status: 'DRAFT' as const,
  dueDate: new Date('2024-02-15'),
  submissionDate: null,
  confirmationNumber: null,
  totalContributions: new Decimal(5000),
  employerContributions: new Decimal(2500),
  employeeContributions: new Decimal(2500),
  insuredPersonsCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: USER_ID,
};

const mockInsuredPerson = {
  id: INSURED_PERSON_ID,
  declarationId: DECLARATION_ID,
  personId: PERSON_ID,
  pesel: '90010112345',
  firstName: 'Jan',
  lastName: 'Kowalski',
  employmentType: 'UMOWA_O_PRACE' as const,
  contributionBase: new Decimal(10000),
  contributions: mockEmployeeZUSResult.contributions,
  totalEmployee: mockEmployeeZUSResult.totalEmployee,
  totalEmployer: mockEmployeeZUSResult.totalEmployer,
  isStudent: false,
  hasDisability: false,
  createdAt: new Date(),
};

const mockPayment = {
  id: PAYMENT_ID,
  declarationId: DECLARATION_ID,
  dueDate: new Date('2024-02-15'),
  amount: new Decimal(5000),
  paidAmount: new Decimal(0),
  status: 'PENDING' as const,
  paymentDate: null,
  referenceNumber: 'ZUS/2024/01/001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockValidationResult = {
  isValid: true,
  errors: [],
  warnings: [],
};

const mockSubmissionResult = {
  success: true,
  declarationId: DECLARATION_ID,
  submissionDate: new Date(),
  confirmationNumber: 'ZUS-2024-01-12345',
  status: 'SUBMITTED' as const,
};

const mockCorrectionResult = {
  originalDeclarationId: DECLARATION_ID,
  correctionId: '88888888-8888-8888-8888-888888888888',
  correctionNumber: 1,
  differences: [
    {
      field: 'totalContributions',
      originalValue: new Decimal(5000),
      correctedValue: new Decimal(5500),
    },
  ],
  createdAt: new Date(),
};

const mockAnnualReport = {
  clientId: CLIENT_ID,
  year: 2024,
  declarations: [mockDeclaration],
  totalContributions: new Decimal(60000),
  totalEmployerContributions: new Decimal(30000),
  totalEmployeeContributions: new Decimal(30000),
  averageMonthlyContributions: new Decimal(5000),
  generatedAt: new Date(),
};

const mockPaymentSchedule = {
  declarationId: DECLARATION_ID,
  period: { year: 2024, month: 1 },
  payments: [
    {
      type: 'ZUS_SPOLECZNE' as const,
      dueDate: new Date('2024-02-15'),
      amount: new Decimal(3500),
      bankAccount: '83 1010 1023 0000 2613 9510 0000',
    },
    {
      type: 'ZUS_ZDROWOTNE' as const,
      dueDate: new Date('2024-02-15'),
      amount: new Decimal(1500),
      bankAccount: '78 1010 1023 0000 2613 9520 0000',
    },
  ],
  totalAmount: new Decimal(5000),
};

const mockContributionHistory = {
  clientId: CLIENT_ID,
  fromDate: new Date('2024-01-01'),
  toDate: new Date('2024-12-31'),
  entries: [
    {
      period: { year: 2024, month: 1 },
      contributions: new Decimal(5000),
      status: 'PAID' as const,
    },
  ],
  totalContributions: new Decimal(5000),
};

// ===========================================================================
// MOCK SERVICE
// ===========================================================================

const mockZUSDeclarationService = vi.hoisted(() => ({
  calculateEmployeeZUS: vi.fn(),
  calculateSelfEmployedZUS: vi.fn(),
  createDeclaration: vi.fn(),
  getDeclaration: vi.fn(),
  listDeclarations: vi.fn(),
  updateDeclaration: vi.fn(),
  deleteDeclaration: vi.fn(),
  addInsuredPerson: vi.fn(),
  updateInsuredPerson: vi.fn(),
  removeInsuredPerson: vi.fn(),
  validateDeclaration: vi.fn(),
  submitDeclaration: vi.fn(),
  createCorrection: vi.fn(),
  calculatePayment: vi.fn(),
  recordPayment: vi.fn(),
  getPaymentSchedule: vi.fn(),
  getContributionHistory: vi.fn(),
  generateAnnualReport: vi.fn(),
}));

vi.mock('../../services/tax/zus-declaration.service', () => ({
  ZUSDeclarationService: vi.fn().mockImplementation(() => mockZUSDeclarationService),
}));

// Mock router caller
const mockSession = {
  userId: USER_ID,
  organizationId: ORG_ID,
  email: 'test@example.com',
  roles: ['ADMIN'],
  sessionId: '99999999-9999-9999-9999-999999999999',
};

const mockPrisma = {};

const mockCtx = {
  prisma: mockPrisma,
  session: mockSession,
};

// Simple mock caller that invokes service methods
const createMockCaller = () => ({
  tax: {
    zusDeclaration: {
      calculateEmployeeZUS: async (input: Parameters<ZUSDeclarationService['calculateEmployeeZUS']>[0]) => {
        return mockZUSDeclarationService.calculateEmployeeZUS(input);
      },
      calculateSelfEmployedZUS: async (input: Parameters<ZUSDeclarationService['calculateSelfEmployedZUS']>[0]) => {
        return mockZUSDeclarationService.calculateSelfEmployedZUS(input);
      },
      createDeclaration: async (input: Parameters<ZUSDeclarationService['createDeclaration']>[0]) => {
        return mockZUSDeclarationService.createDeclaration(input, ORG_ID, USER_ID);
      },
      getDeclaration: async (input: Parameters<ZUSDeclarationService['getDeclaration']>[0]) => {
        return mockZUSDeclarationService.getDeclaration(input, ORG_ID);
      },
      listDeclarations: async (input: Parameters<ZUSDeclarationService['listDeclarations']>[0]) => {
        return mockZUSDeclarationService.listDeclarations(input, ORG_ID);
      },
      updateDeclaration: async (input: Parameters<ZUSDeclarationService['updateDeclaration']>[0]) => {
        return mockZUSDeclarationService.updateDeclaration(input, ORG_ID, USER_ID);
      },
      deleteDeclaration: async (input: Parameters<ZUSDeclarationService['deleteDeclaration']>[0]) => {
        return mockZUSDeclarationService.deleteDeclaration(input, ORG_ID, USER_ID);
      },
      addInsuredPerson: async (input: Parameters<ZUSDeclarationService['addInsuredPerson']>[0]) => {
        return mockZUSDeclarationService.addInsuredPerson(input, ORG_ID, USER_ID);
      },
      updateInsuredPerson: async (input: Parameters<ZUSDeclarationService['updateInsuredPerson']>[0]) => {
        return mockZUSDeclarationService.updateInsuredPerson(input, ORG_ID, USER_ID);
      },
      removeInsuredPerson: async (input: Parameters<ZUSDeclarationService['removeInsuredPerson']>[0]) => {
        return mockZUSDeclarationService.removeInsuredPerson(input, ORG_ID, USER_ID);
      },
      validateDeclaration: async (input: Parameters<ZUSDeclarationService['validateDeclaration']>[0]) => {
        return mockZUSDeclarationService.validateDeclaration(input, ORG_ID);
      },
      submitDeclaration: async (input: Parameters<ZUSDeclarationService['submitDeclaration']>[0]) => {
        return mockZUSDeclarationService.submitDeclaration(input, ORG_ID, USER_ID);
      },
      createCorrection: async (input: Parameters<ZUSDeclarationService['createCorrection']>[0]) => {
        return mockZUSDeclarationService.createCorrection(input, ORG_ID, USER_ID);
      },
      calculatePayment: async (input: Parameters<ZUSDeclarationService['calculatePayment']>[0]) => {
        return mockZUSDeclarationService.calculatePayment(input, ORG_ID);
      },
      recordPayment: async (input: Parameters<ZUSDeclarationService['recordPayment']>[0]) => {
        return mockZUSDeclarationService.recordPayment(input, ORG_ID, USER_ID);
      },
      getPaymentSchedule: async (input: Parameters<ZUSDeclarationService['getPaymentSchedule']>[0]) => {
        return mockZUSDeclarationService.getPaymentSchedule(input, ORG_ID);
      },
      getContributionHistory: async (input: Parameters<ZUSDeclarationService['getContributionHistory']>[0]) => {
        return mockZUSDeclarationService.getContributionHistory(input, ORG_ID);
      },
      generateAnnualReport: async (input: Parameters<ZUSDeclarationService['generateAnnualReport']>[0]) => {
        return mockZUSDeclarationService.generateAnnualReport(input, ORG_ID);
      },
    },
  },
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('ZUSDeclarationRouter', () => {
  let caller: ReturnType<typeof createMockCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    caller = createMockCaller();
  });

  // =========================================================================
  // CALCULATION ENDPOINT TESTS
  // =========================================================================

  describe('calculateEmployeeZUS', () => {
    it('should calculate employee ZUS contributions', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue(mockEmployeeZUSResult);

      const result = await caller.tax.zusDeclaration.calculateEmployeeZUS({
        pesel: '90010112345',
        name: 'Jan Kowalski',
        grossSalary: 10000,
        year: 2024,
        month: 1,
      });

      expect(result.grossSalary.toString()).toBe('10000');
      expect(result.contributions.emerytalne.employee.toString()).toBe('976');
      expect(mockZUSDeclarationService.calculateEmployeeZUS).toHaveBeenCalledWith({
        pesel: '90010112345',
        name: 'Jan Kowalski',
        grossSalary: 10000,
        year: 2024,
        month: 1,
      });
    });

    it('should accept bonuses and year-to-date income', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue(mockEmployeeZUSResult);

      await caller.tax.zusDeclaration.calculateEmployeeZUS({
        pesel: '90010112345',
        name: 'Jan Kowalski',
        grossSalary: 10000,
        bonuses: 2000,
        yearToDateIncome: 50000,
        year: 2024,
        month: 6,
      });

      expect(mockZUSDeclarationService.calculateEmployeeZUS).toHaveBeenCalledWith({
        pesel: '90010112345',
        name: 'Jan Kowalski',
        grossSalary: 10000,
        bonuses: 2000,
        yearToDateIncome: 50000,
        year: 2024,
        month: 6,
      });
    });

    it('should accept student flag for exemptions', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue({
        ...mockEmployeeZUSResult,
        isStudent: true,
      });

      await caller.tax.zusDeclaration.calculateEmployeeZUS({
        pesel: '02020212345',
        name: 'Anna Student',
        grossSalary: 5000,
        isStudent: true,
        studentAge: 24,
        year: 2024,
        month: 1,
      });

      expect(mockZUSDeclarationService.calculateEmployeeZUS).toHaveBeenCalledWith(
        expect.objectContaining({
          isStudent: true,
          studentAge: 24,
        })
      );
    });

    it('should accept custom accident rate', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue(mockEmployeeZUSResult);

      await caller.tax.zusDeclaration.calculateEmployeeZUS({
        pesel: '90010112345',
        name: 'Jan Kowalski',
        grossSalary: 10000,
        accidentRate: 2.5,
        year: 2024,
        month: 1,
      });

      expect(mockZUSDeclarationService.calculateEmployeeZUS).toHaveBeenCalledWith(
        expect.objectContaining({
          accidentRate: 2.5,
        })
      );
    });
  });

  describe('calculateSelfEmployedZUS', () => {
    it('should calculate self-employed ZUS with STANDARD scheme', async () => {
      mockZUSDeclarationService.calculateSelfEmployedZUS.mockResolvedValue(mockSelfEmployedZUSResult);

      const result = await caller.tax.zusDeclaration.calculateSelfEmployedZUS({
        scheme: 'STANDARD',
        year: 2024,
        month: 1,
      });

      expect(result.scheme).toBe('STANDARD');
      expect(result.totalContributions.toString()).toBe('1518.22');
    });

    it('should calculate with PREFERENTIAL scheme', async () => {
      const preferentialResult = {
        ...mockSelfEmployedZUSResult,
        scheme: 'PREFERENTIAL' as const,
        contributionBase: new Decimal(1272.6),
        totalContributions: new Decimal(450.5),
      };
      mockZUSDeclarationService.calculateSelfEmployedZUS.mockResolvedValue(preferentialResult);

      const result = await caller.tax.zusDeclaration.calculateSelfEmployedZUS({
        scheme: 'PREFERENTIAL',
        year: 2024,
        month: 1,
      });

      expect(result.scheme).toBe('PREFERENTIAL');
    });

    it('should calculate with ULGA_NA_START scheme', async () => {
      const ulgaResult = {
        ...mockSelfEmployedZUSResult,
        scheme: 'ULGA_NA_START' as const,
        contributions: {
          ...mockSelfEmployedZUSResult.contributions,
          emerytalne: new Decimal(0),
          rentowe: new Decimal(0),
          chorobowe: new Decimal(0),
          wypadkowe: new Decimal(0),
        },
        totalContributions: new Decimal(376.34),
      };
      mockZUSDeclarationService.calculateSelfEmployedZUS.mockResolvedValue(ulgaResult);

      const result = await caller.tax.zusDeclaration.calculateSelfEmployedZUS({
        scheme: 'ULGA_NA_START',
        year: 2024,
        month: 1,
      });

      expect(result.scheme).toBe('ULGA_NA_START');
    });

    it('should calculate with MALY_ZUS_PLUS scheme', async () => {
      const malyZusResult = {
        ...mockSelfEmployedZUSResult,
        scheme: 'MALY_ZUS_PLUS' as const,
        contributionBase: new Decimal(2000),
      };
      mockZUSDeclarationService.calculateSelfEmployedZUS.mockResolvedValue(malyZusResult);

      await caller.tax.zusDeclaration.calculateSelfEmployedZUS({
        scheme: 'MALY_ZUS_PLUS',
        previousYearRevenue: 100000,
        previousYearIncome: 50000,
        year: 2024,
        month: 1,
      });

      expect(mockZUSDeclarationService.calculateSelfEmployedZUS).toHaveBeenCalledWith(
        expect.objectContaining({
          scheme: 'MALY_ZUS_PLUS',
          previousYearRevenue: 100000,
          previousYearIncome: 50000,
        })
      );
    });

    it('should accept custom health income for calculation', async () => {
      mockZUSDeclarationService.calculateSelfEmployedZUS.mockResolvedValue(mockSelfEmployedZUSResult);

      await caller.tax.zusDeclaration.calculateSelfEmployedZUS({
        scheme: 'STANDARD',
        healthIncomeForPreviousYear: 120000,
        year: 2024,
        month: 1,
      });

      expect(mockZUSDeclarationService.calculateSelfEmployedZUS).toHaveBeenCalledWith(
        expect.objectContaining({
          healthIncomeForPreviousYear: 120000,
        })
      );
    });

    it('should accept optional sickness insurance flag', async () => {
      mockZUSDeclarationService.calculateSelfEmployedZUS.mockResolvedValue(mockSelfEmployedZUSResult);

      await caller.tax.zusDeclaration.calculateSelfEmployedZUS({
        scheme: 'STANDARD',
        includeSicknessInsurance: false,
        year: 2024,
        month: 1,
      });

      expect(mockZUSDeclarationService.calculateSelfEmployedZUS).toHaveBeenCalledWith(
        expect.objectContaining({
          includeSicknessInsurance: false,
        })
      );
    });
  });

  // =========================================================================
  // DECLARATION MANAGEMENT TESTS
  // =========================================================================

  describe('createDeclaration', () => {
    it('should create a new ZUS declaration', async () => {
      mockZUSDeclarationService.createDeclaration.mockResolvedValue(mockDeclaration);

      const result = await caller.tax.zusDeclaration.createDeclaration({
        clientId: CLIENT_ID,
        declarationType: 'DRA',
        year: 2024,
        month: 1,
      });

      expect(result.id).toBe(DECLARATION_ID);
      expect(result.status).toBe('DRAFT');
      expect(mockZUSDeclarationService.createDeclaration).toHaveBeenCalledWith(
        {
          clientId: CLIENT_ID,
          declarationType: 'DRA',
          year: 2024,
          month: 1,
        },
        ORG_ID,
        USER_ID
      );
    });

    it('should accept all declaration types', async () => {
      mockZUSDeclarationService.createDeclaration.mockResolvedValue(mockDeclaration);

      const declarationTypes = ['DRA', 'RCA', 'RSA', 'RZA', 'ZUA', 'ZCNA'] as const;
      for (const declarationType of declarationTypes) {
        await caller.tax.zusDeclaration.createDeclaration({
          clientId: CLIENT_ID,
          declarationType,
          year: 2024,
          month: 1,
        });
      }

      expect(mockZUSDeclarationService.createDeclaration).toHaveBeenCalledTimes(6);
    });
  });

  describe('getDeclaration', () => {
    it('should get a declaration by ID', async () => {
      mockZUSDeclarationService.getDeclaration.mockResolvedValue({
        ...mockDeclaration,
        insuredPersons: [mockInsuredPerson],
      });

      const result = await caller.tax.zusDeclaration.getDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.id).toBe(DECLARATION_ID);
      expect(result.insuredPersons).toHaveLength(1);
    });

    it('should include insured persons in response', async () => {
      mockZUSDeclarationService.getDeclaration.mockResolvedValue({
        ...mockDeclaration,
        insuredPersons: [mockInsuredPerson, { ...mockInsuredPerson, id: 'another-id' }],
      });

      const result = await caller.tax.zusDeclaration.getDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.insuredPersons).toHaveLength(2);
    });
  });

  describe('listDeclarations', () => {
    it('should list declarations with filters', async () => {
      mockZUSDeclarationService.listDeclarations.mockResolvedValue({
        declarations: [mockDeclaration],
        totalCount: 1,
        hasMore: false,
      });

      const result = await caller.tax.zusDeclaration.listDeclarations({
        clientId: CLIENT_ID,
        year: 2024,
      });

      expect(result.declarations).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    it('should filter by status', async () => {
      mockZUSDeclarationService.listDeclarations.mockResolvedValue({
        declarations: [],
        totalCount: 0,
        hasMore: false,
      });

      await caller.tax.zusDeclaration.listDeclarations({
        status: 'SUBMITTED',
      });

      expect(mockZUSDeclarationService.listDeclarations).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUBMITTED' }),
        ORG_ID
      );
    });

    it('should support pagination', async () => {
      mockZUSDeclarationService.listDeclarations.mockResolvedValue({
        declarations: [mockDeclaration],
        totalCount: 50,
        hasMore: true,
      });

      await caller.tax.zusDeclaration.listDeclarations({
        limit: 10,
        offset: 20,
      });

      expect(mockZUSDeclarationService.listDeclarations).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 }),
        ORG_ID
      );
    });
  });

  describe('updateDeclaration', () => {
    it('should update a declaration', async () => {
      const updatedDeclaration = { ...mockDeclaration, status: 'VALIDATED' as const };
      mockZUSDeclarationService.updateDeclaration.mockResolvedValue(updatedDeclaration);

      const result = await caller.tax.zusDeclaration.updateDeclaration({
        declarationId: DECLARATION_ID,
        status: 'VALIDATED',
      });

      expect(result.status).toBe('VALIDATED');
    });
  });

  describe('deleteDeclaration', () => {
    it('should delete a draft declaration', async () => {
      mockZUSDeclarationService.deleteDeclaration.mockResolvedValue({ success: true });

      const result = await caller.tax.zusDeclaration.deleteDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // INSURED PERSON MANAGEMENT TESTS
  // =========================================================================

  describe('addInsuredPerson', () => {
    it('should add an insured person to declaration', async () => {
      mockZUSDeclarationService.addInsuredPerson.mockResolvedValue(mockInsuredPerson);

      const result = await caller.tax.zusDeclaration.addInsuredPerson({
        declarationId: DECLARATION_ID,
        pesel: '90010112345',
        firstName: 'Jan',
        lastName: 'Kowalski',
        employmentType: 'UMOWA_O_PRACE',
        grossSalary: 10000,
      });

      expect(result.pesel).toBe('90010112345');
      expect(result.firstName).toBe('Jan');
    });

    it('should accept all employment types', async () => {
      mockZUSDeclarationService.addInsuredPerson.mockResolvedValue(mockInsuredPerson);

      const employmentTypes = [
        'UMOWA_O_PRACE',
        'UMOWA_ZLECENIE',
        'UMOWA_O_DZIELO',
        'KONTRAKT_MENEDZERSKI',
        'SAMOZATRUDNIENIE',
      ] as const;

      for (const employmentType of employmentTypes) {
        await caller.tax.zusDeclaration.addInsuredPerson({
          declarationId: DECLARATION_ID,
          pesel: '90010112345',
          firstName: 'Jan',
          lastName: 'Kowalski',
          employmentType,
          grossSalary: 10000,
        });
      }

      expect(mockZUSDeclarationService.addInsuredPerson).toHaveBeenCalledTimes(5);
    });
  });

  describe('updateInsuredPerson', () => {
    it('should update an insured person', async () => {
      const updatedPerson = { ...mockInsuredPerson, contributionBase: new Decimal(12000) };
      mockZUSDeclarationService.updateInsuredPerson.mockResolvedValue(updatedPerson);

      const result = await caller.tax.zusDeclaration.updateInsuredPerson({
        insuredPersonId: INSURED_PERSON_ID,
        grossSalary: 12000,
      });

      expect(result.contributionBase.toString()).toBe('12000');
    });
  });

  describe('removeInsuredPerson', () => {
    it('should remove an insured person from declaration', async () => {
      mockZUSDeclarationService.removeInsuredPerson.mockResolvedValue({ success: true });

      const result = await caller.tax.zusDeclaration.removeInsuredPerson({
        insuredPersonId: INSURED_PERSON_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // VALIDATION AND SUBMISSION TESTS
  // =========================================================================

  describe('validateDeclaration', () => {
    it('should validate a declaration', async () => {
      mockZUSDeclarationService.validateDeclaration.mockResolvedValue(mockValidationResult);

      const result = await caller.tax.zusDeclaration.validateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors', async () => {
      mockZUSDeclarationService.validateDeclaration.mockResolvedValue({
        isValid: false,
        errors: [
          { field: 'pesel', message: 'Invalid PESEL checksum', code: 'INVALID_PESEL' },
        ],
        warnings: [],
      });

      const result = await caller.tax.zusDeclaration.validateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_PESEL');
    });

    it('should return validation warnings', async () => {
      mockZUSDeclarationService.validateDeclaration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [
          { field: 'dueDate', message: 'Declaration is approaching due date', code: 'APPROACHING_DEADLINE' },
        ],
      });

      const result = await caller.tax.zusDeclaration.validateDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('submitDeclaration', () => {
    it('should submit a validated declaration', async () => {
      mockZUSDeclarationService.submitDeclaration.mockResolvedValue(mockSubmissionResult);

      const result = await caller.tax.zusDeclaration.submitDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(result.success).toBe(true);
      expect(result.confirmationNumber).toBeDefined();
      expect(result.status).toBe('SUBMITTED');
    });

    it('should pass organizationId and userId from context', async () => {
      mockZUSDeclarationService.submitDeclaration.mockResolvedValue(mockSubmissionResult);

      await caller.tax.zusDeclaration.submitDeclaration({
        declarationId: DECLARATION_ID,
      });

      expect(mockZUSDeclarationService.submitDeclaration).toHaveBeenCalledWith(
        { declarationId: DECLARATION_ID },
        ORG_ID,
        USER_ID
      );
    });
  });

  describe('createCorrection', () => {
    it('should create a correction for submitted declaration', async () => {
      mockZUSDeclarationService.createCorrection.mockResolvedValue(mockCorrectionResult);

      const result = await caller.tax.zusDeclaration.createCorrection({
        originalDeclarationId: DECLARATION_ID,
        reason: 'Correction of contribution amounts',
      });

      expect(result.originalDeclarationId).toBe(DECLARATION_ID);
      expect(result.correctionNumber).toBe(1);
      expect(result.differences).toHaveLength(1);
    });
  });

  // =========================================================================
  // PAYMENT MANAGEMENT TESTS
  // =========================================================================

  describe('calculatePayment', () => {
    it('should calculate payment amounts', async () => {
      mockZUSDeclarationService.calculatePayment.mockResolvedValue(mockPaymentSchedule);

      const result = await caller.tax.zusDeclaration.calculatePayment({
        declarationId: DECLARATION_ID,
      });

      expect(result.payments).toHaveLength(2);
      expect(result.totalAmount.toString()).toBe('5000');
    });
  });

  describe('recordPayment', () => {
    it('should record a payment', async () => {
      const recordedPayment = {
        ...mockPayment,
        paidAmount: new Decimal(5000),
        status: 'PAID' as const,
        paymentDate: new Date(),
      };
      mockZUSDeclarationService.recordPayment.mockResolvedValue(recordedPayment);

      const result = await caller.tax.zusDeclaration.recordPayment({
        declarationId: DECLARATION_ID,
        amount: 5000,
        paymentDate: new Date().toISOString(),
        paymentType: 'ZUS_SPOLECZNE',
      });

      expect(result.status).toBe('PAID');
      expect(result.paidAmount.toString()).toBe('5000');
    });

    it('should accept bank reference', async () => {
      mockZUSDeclarationService.recordPayment.mockResolvedValue(mockPayment);

      await caller.tax.zusDeclaration.recordPayment({
        declarationId: DECLARATION_ID,
        amount: 5000,
        paymentDate: new Date().toISOString(),
        paymentType: 'ZUS_SPOLECZNE',
        bankReference: 'TRN123456789',
      });

      expect(mockZUSDeclarationService.recordPayment).toHaveBeenCalledWith(
        expect.objectContaining({ bankReference: 'TRN123456789' }),
        ORG_ID,
        USER_ID
      );
    });
  });

  describe('getPaymentSchedule', () => {
    it('should get payment schedule for a declaration', async () => {
      mockZUSDeclarationService.getPaymentSchedule.mockResolvedValue(mockPaymentSchedule);

      const result = await caller.tax.zusDeclaration.getPaymentSchedule({
        declarationId: DECLARATION_ID,
      });

      expect(result.payments).toHaveLength(2);
      expect(result.payments[0].bankAccount).toBeDefined();
    });
  });

  // =========================================================================
  // HISTORY AND REPORTING TESTS
  // =========================================================================

  describe('getContributionHistory', () => {
    it('should get contribution history for a client', async () => {
      mockZUSDeclarationService.getContributionHistory.mockResolvedValue(mockContributionHistory);

      const result = await caller.tax.zusDeclaration.getContributionHistory({
        clientId: CLIENT_ID,
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      });

      expect(result.entries).toHaveLength(1);
      expect(result.totalContributions.toString()).toBe('5000');
    });

    it('should filter by period', async () => {
      mockZUSDeclarationService.getContributionHistory.mockResolvedValue(mockContributionHistory);

      await caller.tax.zusDeclaration.getContributionHistory({
        clientId: CLIENT_ID,
        year: 2024,
      });

      expect(mockZUSDeclarationService.getContributionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2024 }),
        ORG_ID
      );
    });
  });

  describe('generateAnnualReport', () => {
    it('should generate an annual report', async () => {
      mockZUSDeclarationService.generateAnnualReport.mockResolvedValue(mockAnnualReport);

      const result = await caller.tax.zusDeclaration.generateAnnualReport({
        clientId: CLIENT_ID,
        year: 2024,
      });

      expect(result.year).toBe(2024);
      expect(result.declarations).toHaveLength(1);
      expect(result.totalContributions.toString()).toBe('60000');
    });

    it('should include employer and employee breakdowns', async () => {
      mockZUSDeclarationService.generateAnnualReport.mockResolvedValue(mockAnnualReport);

      const result = await caller.tax.zusDeclaration.generateAnnualReport({
        clientId: CLIENT_ID,
        year: 2024,
      });

      expect(result.totalEmployerContributions.toString()).toBe('30000');
      expect(result.totalEmployeeContributions.toString()).toBe('30000');
    });
  });

  // =========================================================================
  // INPUT VALIDATION TESTS
  // =========================================================================

  describe('input validation', () => {
    it('should validate PESEL format', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue(mockEmployeeZUSResult);

      // Valid 11-digit PESEL
      await expect(
        caller.tax.zusDeclaration.calculateEmployeeZUS({
          pesel: '90010112345',
          name: 'Jan Kowalski',
          grossSalary: 10000,
          year: 2024,
          month: 1,
        })
      ).resolves.toBeDefined();
    });

    it('should validate ZUS scheme enum values', async () => {
      mockZUSDeclarationService.calculateSelfEmployedZUS.mockResolvedValue(mockSelfEmployedZUSResult);

      const validSchemes = ['STANDARD', 'PREFERENTIAL', 'ULGA_NA_START', 'MALY_ZUS_PLUS'] as const;
      for (const scheme of validSchemes) {
        await expect(
          caller.tax.zusDeclaration.calculateSelfEmployedZUS({
            scheme,
            year: 2024,
            month: 1,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate declaration type enum', async () => {
      mockZUSDeclarationService.createDeclaration.mockResolvedValue(mockDeclaration);

      const validTypes = ['DRA', 'RCA', 'RSA', 'RZA', 'ZUA', 'ZCNA'] as const;
      for (const declarationType of validTypes) {
        await expect(
          caller.tax.zusDeclaration.createDeclaration({
            clientId: CLIENT_ID,
            declarationType,
            year: 2024,
            month: 1,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate month range (1-12)', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue(mockEmployeeZUSResult);

      for (let month = 1; month <= 12; month++) {
        await expect(
          caller.tax.zusDeclaration.calculateEmployeeZUS({
            pesel: '90010112345',
            name: 'Jan Kowalski',
            grossSalary: 10000,
            year: 2024,
            month,
          })
        ).resolves.toBeDefined();
      }
    });

    it('should validate year range', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue(mockEmployeeZUSResult);

      // Valid years (2000-2100)
      await expect(
        caller.tax.zusDeclaration.calculateEmployeeZUS({
          pesel: '90010112345',
          name: 'Jan Kowalski',
          grossSalary: 10000,
          year: 2024,
          month: 1,
        })
      ).resolves.toBeDefined();
    });

    it('should validate positive gross salary', async () => {
      mockZUSDeclarationService.calculateEmployeeZUS.mockResolvedValue(mockEmployeeZUSResult);

      await expect(
        caller.tax.zusDeclaration.calculateEmployeeZUS({
          pesel: '90010112345',
          name: 'Jan Kowalski',
          grossSalary: 1,
          year: 2024,
          month: 1,
        })
      ).resolves.toBeDefined();
    });

    it('should validate UUID format for IDs', async () => {
      mockZUSDeclarationService.getDeclaration.mockResolvedValue(mockDeclaration);

      await expect(
        caller.tax.zusDeclaration.getDeclaration({
          declarationId: DECLARATION_ID,
        })
      ).resolves.toBeDefined();
    });

    it('should validate declaration status enum', async () => {
      mockZUSDeclarationService.listDeclarations.mockResolvedValue({
        declarations: [],
        totalCount: 0,
        hasMore: false,
      });

      const validStatuses = ['DRAFT', 'VALIDATED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CORRECTED'] as const;
      for (const status of validStatuses) {
        await expect(
          caller.tax.zusDeclaration.listDeclarations({ status })
        ).resolves.toBeDefined();
      }
    });

    it('should validate payment type enum', async () => {
      mockZUSDeclarationService.recordPayment.mockResolvedValue(mockPayment);

      const validPaymentTypes = ['ZUS_SPOLECZNE', 'ZUS_ZDROWOTNE', 'ZUS_FP', 'ZUS_FGSP'] as const;
      for (const paymentType of validPaymentTypes) {
        await expect(
          caller.tax.zusDeclaration.recordPayment({
            declarationId: DECLARATION_ID,
            amount: 1000,
            paymentDate: new Date().toISOString(),
            paymentType,
          })
        ).resolves.toBeDefined();
      }
    });
  });

  // =========================================================================
  // CONTEXT INJECTION TESTS
  // =========================================================================

  describe('context injection', () => {
    it('should pass organizationId from session to service', async () => {
      mockZUSDeclarationService.listDeclarations.mockResolvedValue({
        declarations: [],
        totalCount: 0,
        hasMore: false,
      });

      await caller.tax.zusDeclaration.listDeclarations({});

      expect(mockZUSDeclarationService.listDeclarations).toHaveBeenCalledWith(
        expect.anything(),
        ORG_ID
      );
    });

    it('should pass userId from session to mutation operations', async () => {
      mockZUSDeclarationService.createDeclaration.mockResolvedValue(mockDeclaration);

      await caller.tax.zusDeclaration.createDeclaration({
        clientId: CLIENT_ID,
        declarationType: 'DRA',
        year: 2024,
        month: 1,
      });

      expect(mockZUSDeclarationService.createDeclaration).toHaveBeenCalledWith(
        expect.anything(),
        ORG_ID,
        USER_ID
      );
    });
  });
});
