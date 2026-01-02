// TAX-006: ZUS Declaration Service
// Manages ZUS (Social Security) declarations and contribution calculations for Polish compliance

import { TRPCError } from '@trpc/server';
import Decimal from 'decimal.js';
import type {
  CalculateEmployeeZUSInput,
  CalculateSelfEmployedZUSInput,
  CreateZUSDeclarationInput,
  AddInsuredPersonInput,
  UpdateInsuredPersonInput,
  RemoveInsuredPersonInput,
  CalculateDeclarationTotalsInput,
  ValidateZUSDeclarationInput,
  SubmitZUSDeclarationInput,
  CreateZUSCorrectionInput,
  GetZUSDeclarationInput,
  ListZUSDeclarationsInput,
  DeleteZUSDeclarationInput,
  CalculateZUSPaymentInput,
  RecordZUSPaymentInput,
  GetZUSPaymentScheduleInput,
  GetContributionHistoryInput,
  GenerateAnnualReportInput,
  EmployeeZUSCalculationResult,
  SelfEmployedZUSCalculationResult,
  ZUSValidationResult,
  ZUSDeclarationSummary,
  ListZUSDeclarationsResult,
  ZUSPaymentSchedule,
  AnnualZUSReport,
  ZUSDeclaration,
  ZUSInsuredPerson,
  ZUSContributionBreakdown,
  ZUSPayment,
  ContributionHistoryEntry,
} from '@ksiegowacrm/shared';
import type { PrismaClient } from '@prisma/client';

// ===========================================================================
// CONSTANTS - POLISH ZUS RATES 2024
// ===========================================================================

const ZUS_RATES = {
  // Pension (emerytalne) - 19.52% total split equally
  PENSION_EMPLOYEE: new Decimal('9.76'),
  PENSION_EMPLOYER: new Decimal('9.76'),

  // Disability (rentowe) - 8% total (1.5% employee, 6.5% employer)
  DISABILITY_EMPLOYEE: new Decimal('1.5'),
  DISABILITY_EMPLOYER: new Decimal('6.5'),

  // Sickness (chorobowe) - 2.45% employee only
  SICKNESS_EMPLOYEE: new Decimal('2.45'),

  // Accident (wypadkowe) - employer only, varies 0.67%-3.33%
  ACCIDENT_DEFAULT: new Decimal('1.67'),

  // Health (zdrowotne) - 9% employee pays
  HEALTH: new Decimal('9'),
  HEALTH_TAX_DEDUCTIBLE: new Decimal('7.75'), // Portion deductible from PIT

  // Labor Fund (FP) - 2.45% employer only
  LABOR_FUND: new Decimal('2.45'),

  // FGŚP - 0.1% employer only
  FGSP: new Decimal('0.1'),
};

const ZUS_BASES_2024 = {
  MINIMUM_WAGE: new Decimal('4242'),
  MINIMUM_WAGE_JULY: new Decimal('4300'),
  PROJECTED_AVERAGE: new Decimal('7824'),
  STANDARD_BASE: new Decimal('4694.40'),     // 60% of projected average
  PREFERENTIAL_BASE: new Decimal('1272.60'), // 30% of minimum wage
  ANNUAL_LIMIT: new Decimal('234720'),       // 30 × projected average
};

// ===========================================================================
// SERVICE CLASS
// ===========================================================================

export class ZUSDeclarationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly organizationId: string,
    private readonly userId: string,
  ) {}

  // =========================================================================
  // EMPLOYEE ZUS CALCULATION
  // =========================================================================

  async calculateEmployeeZUS(input: CalculateEmployeeZUSInput): Promise<EmployeeZUSCalculationResult> {
    const totalIncome = new Decimal(input.grossSalary)
      .plus(input.bonus || 0)
      .plus(input.overtime || 0)
      .plus(input.otherIncome || 0);

    const warnings: string[] = [];

    // Check annual pension/disability limit (30x average wage)
    const ytdBase = new Decimal(input.ytdPensionBase || 0);
    const annualLimit = ZUS_BASES_2024.ANNUAL_LIMIT;
    let pensionDisabilityBase = totalIncome;
    let isAnnualLimitReached = false;
    let annualLimitRemaining: Decimal | undefined;

    if (ytdBase.plus(totalIncome).greaterThan(annualLimit)) {
      isAnnualLimitReached = true;
      annualLimitRemaining = annualLimit.minus(ytdBase);

      if (annualLimitRemaining.lessThanOrEqualTo(0)) {
        pensionDisabilityBase = new Decimal(0);
        warnings.push('Roczny limit składek emerytalnych i rentowych został osiągnięty');
      } else {
        pensionDisabilityBase = annualLimitRemaining;
        warnings.push(`Podstawa składek emerytalnych i rentowych została ograniczona do ${annualLimitRemaining.toFixed(2)} PLN`);
      }
    }

    // Student under 26 - no ZUS except health for some contracts
    if (input.isStudent && input.contributorType === 'CIVIL_CONTRACT') {
      return this.createZeroContributionsResult(totalIncome, warnings, 'Student poniżej 26 lat - brak składek ZUS');
    }

    // Calculate bases
    const sicknessBase = totalIncome; // No annual limit
    const accidentBase = totalIncome;
    const healthBase = totalIncome
      .minus(pensionDisabilityBase.times(ZUS_RATES.PENSION_EMPLOYEE.div(100)))
      .minus(pensionDisabilityBase.times(ZUS_RATES.DISABILITY_EMPLOYEE.div(100)))
      .minus(sicknessBase.times(ZUS_RATES.SICKNESS_EMPLOYEE.div(100)));

    const accidentRate = new Decimal(input.accidentRate || 1.67);

    // Calculate contributions
    const contributions = this.calculateContributions(
      pensionDisabilityBase,
      sicknessBase,
      accidentBase,
      healthBase,
      accidentRate,
    );

    const incomeAfterZUS = totalIncome.minus(new Decimal(contributions.totalEmployee));
    const healthDeduction = healthBase.times(ZUS_RATES.HEALTH_TAX_DEDUCTIBLE.div(100));

    return {
      grossSalary: new Decimal(input.grossSalary).toFixed(2),
      totalBonuses: new Decimal(input.bonus || 0)
        .plus(input.overtime || 0)
        .plus(input.otherIncome || 0)
        .toFixed(2),
      totalIncome: totalIncome.toFixed(2),

      pensionBase: pensionDisabilityBase.toFixed(2),
      disabilityBase: pensionDisabilityBase.toFixed(2),
      sicknessBase: sicknessBase.toFixed(2),
      accidentBase: accidentBase.toFixed(2),
      healthBase: healthBase.toFixed(2),

      contributions,

      totalEmployeeContributions: contributions.totalEmployee,
      incomeAfterZUS: incomeAfterZUS.toFixed(2),
      healthDeduction: healthDeduction.toFixed(2),

      isAnnualLimitReached,
      annualLimitRemaining: annualLimitRemaining?.toFixed(2),

      warnings,
    };
  }

  // =========================================================================
  // SELF-EMPLOYED ZUS CALCULATION
  // =========================================================================

  async calculateSelfEmployedZUS(input: CalculateSelfEmployedZUSInput): Promise<SelfEmployedZUSCalculationResult> {
    const warnings: string[] = [];
    const eligibilityNotes: string[] = [];

    let pensionBase: Decimal;
    let disabilityBase: Decimal;
    let sicknessBase: Decimal;
    let healthBase: Decimal;
    let minimumBase: Decimal;
    let maximumBase: Decimal;
    let calculatedBase: Decimal | undefined;

    const currentMinWage = input.month >= 7
      ? ZUS_BASES_2024.MINIMUM_WAGE_JULY
      : ZUS_BASES_2024.MINIMUM_WAGE;

    switch (input.scheme) {
      case 'ULGA_NA_START':
        // First 6 months - only health insurance
        pensionBase = new Decimal(0);
        disabilityBase = new Decimal(0);
        sicknessBase = new Decimal(0);
        minimumBase = new Decimal(0);
        maximumBase = new Decimal(0);
        healthBase = input.customHealthBase
          ? new Decimal(input.customHealthBase)
          : currentMinWage.times(0.75);
        eligibilityNotes.push('Ulga na start - pierwsze 6 miesięcy działalności, tylko składka zdrowotna');
        break;

      case 'PREFERENTIAL':
        // First 24 months (after Ulga na start) - 30% of minimum wage
        minimumBase = ZUS_BASES_2024.PREFERENTIAL_BASE;
        maximumBase = ZUS_BASES_2024.ANNUAL_LIMIT;
        pensionBase = input.customPensionBase
          ? Decimal.max(new Decimal(input.customPensionBase), minimumBase)
          : minimumBase;
        disabilityBase = pensionBase;
        sicknessBase = input.includeSicknessInsurance ? pensionBase : new Decimal(0);
        healthBase = input.customHealthBase
          ? new Decimal(input.customHealthBase)
          : currentMinWage.times(0.75);
        eligibilityNotes.push('ZUS preferencyjny - podstawa 30% płacy minimalnej przez 24 miesiące');
        break;

      case 'MALY_ZUS_PLUS':
        // Based on previous year income
        if (!input.previousYearIncome || !input.previousYearDays) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Mały ZUS Plus wymaga podania przychodu i liczby dni prowadzenia działalności z poprzedniego roku',
          });
        }

        const annualIncome = new Decimal(input.previousYearIncome);
        const daysActive = input.previousYearDays;

        // Calculate daily average income, then monthly base (30 days)
        const dailyIncome = annualIncome.div(daysActive);
        calculatedBase = dailyIncome.times(30).times(0.5); // 50% of average monthly income

        // Mały ZUS Plus limits: 30% min wage to 60% average wage
        minimumBase = currentMinWage.times(0.3);
        maximumBase = ZUS_BASES_2024.STANDARD_BASE;

        pensionBase = Decimal.min(Decimal.max(calculatedBase, minimumBase), maximumBase);
        disabilityBase = pensionBase;
        sicknessBase = input.includeSicknessInsurance ? pensionBase : new Decimal(0);
        healthBase = input.customHealthBase
          ? new Decimal(input.customHealthBase)
          : currentMinWage.times(0.75);

        eligibilityNotes.push(`Mały ZUS Plus - podstawa wyliczona: ${calculatedBase.toFixed(2)} PLN`);
        eligibilityNotes.push(`Podstawa po zastosowaniu limitów: ${pensionBase.toFixed(2)} PLN`);
        break;

      case 'STANDARD':
      default:
        // Standard - 60% of projected average wage
        minimumBase = ZUS_BASES_2024.STANDARD_BASE;
        maximumBase = ZUS_BASES_2024.ANNUAL_LIMIT;
        pensionBase = input.customPensionBase
          ? Decimal.max(new Decimal(input.customPensionBase), minimumBase)
          : minimumBase;
        disabilityBase = pensionBase;
        sicknessBase = input.includeSicknessInsurance ? pensionBase : new Decimal(0);
        healthBase = input.customHealthBase
          ? new Decimal(input.customHealthBase)
          : currentMinWage.times(0.75);
        eligibilityNotes.push('Standardowy ZUS - podstawa 60% prognozowanego przeciętnego wynagrodzenia');
        break;
    }

    // Check annual limit for pension/disability
    const ytdBase = new Decimal(input.ytdPensionBase || 0);
    let isAnnualLimitReached = false;

    if (ytdBase.plus(pensionBase).greaterThan(ZUS_BASES_2024.ANNUAL_LIMIT)) {
      isAnnualLimitReached = true;
      const remaining = ZUS_BASES_2024.ANNUAL_LIMIT.minus(ytdBase);
      if (remaining.lessThanOrEqualTo(0)) {
        pensionBase = new Decimal(0);
        disabilityBase = new Decimal(0);
        warnings.push('Roczny limit składek emerytalnych i rentowych został osiągnięty');
      } else {
        pensionBase = remaining;
        disabilityBase = remaining;
        warnings.push(`Podstawa ograniczona do rocznego limitu: ${remaining.toFixed(2)} PLN`);
      }
    }

    // Calculate contributions (self-employed pays both sides for pension/disability)
    const pensionContribution = pensionBase.times(ZUS_RATES.PENSION_EMPLOYEE.plus(ZUS_RATES.PENSION_EMPLOYER)).div(100);
    const disabilityContribution = disabilityBase.times(ZUS_RATES.DISABILITY_EMPLOYEE.plus(ZUS_RATES.DISABILITY_EMPLOYER)).div(100);
    const sicknessContribution = sicknessBase.times(ZUS_RATES.SICKNESS_EMPLOYEE).div(100);
    const accidentContribution = pensionBase.times(ZUS_RATES.ACCIDENT_DEFAULT).div(100);
    const healthContribution = healthBase.times(ZUS_RATES.HEALTH).div(100);
    const laborFundContribution = pensionBase.times(ZUS_RATES.LABOR_FUND).div(100);

    const totalContribution = pensionContribution
      .plus(disabilityContribution)
      .plus(sicknessContribution)
      .plus(accidentContribution)
      .plus(healthContribution)
      .plus(laborFundContribution);

    // Health deduction for tax (depends on taxation method)
    let healthDeductibleFromTax: Decimal;
    switch (input.healthDeductionMethod) {
      case 'flat':
        // 19% flat tax - 4.9% of health base deductible, but capped
        healthDeductibleFromTax = Decimal.min(healthBase.times(0.049), new Decimal('11600'));
        break;
      case 'lump_sum':
        // Lump sum - 50% of health contribution deductible
        healthDeductibleFromTax = healthContribution.times(0.5);
        break;
      case 'progressive':
      default:
        // Progressive - not deductible from tax (deducted from income)
        healthDeductibleFromTax = new Decimal(0);
        break;
    }

    return {
      scheme: input.scheme,

      pensionBase: pensionBase.toFixed(2),
      disabilityBase: disabilityBase.toFixed(2),
      sicknessBase: sicknessBase.toFixed(2),
      accidentBase: pensionBase.toFixed(2), // Same as pension for self-employed
      healthBase: healthBase.toFixed(2),

      pensionContribution: pensionContribution.toFixed(2),
      disabilityContribution: disabilityContribution.toFixed(2),
      sicknessContribution: sicknessContribution.toFixed(2),
      accidentContribution: accidentContribution.toFixed(2),
      healthContribution: healthContribution.toFixed(2),
      laborFundContribution: laborFundContribution.toFixed(2),
      totalContribution: totalContribution.toFixed(2),

      healthDeductibleFromTax: healthDeductibleFromTax.toFixed(2),

      calculatedBase: calculatedBase?.toFixed(2),
      minimumBase: minimumBase.toFixed(2),
      maximumBase: maximumBase.toFixed(2),

      isAnnualLimitReached,

      warnings,
      eligibilityNotes,
    };
  }

  // =========================================================================
  // DECLARATION MANAGEMENT
  // =========================================================================

  async createDeclaration(input: CreateZUSDeclarationInput): Promise<ZUSDeclaration> {
    // Check for existing declaration for same period
    const existing = await this.prisma.zusDeclaration.findFirst({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        year: input.year,
        month: input.month,
        isCorrection: false,
      },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Deklaracja ZUS za ${input.month}/${input.year} już istnieje. Użyj funkcji korekty.`,
      });
    }

    // Get client/payer information
    const client = await this.prisma.client.findFirst({
      where: {
        id: input.clientId,
        organizationId: this.organizationId,
      },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Klient nie został znaleziony',
      });
    }

    // Calculate due date (15th or 20th of following month)
    const dueDate = this.calculateDueDate(input.year, input.month);

    const declaration = await this.prisma.zusDeclaration.create({
      data: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        year: input.year,
        month: input.month,
        formType: input.formType,
        status: 'DRAFT',
        isCorrection: false,
        payerNip: client.nip || '',
        payerRegon: client.regon,
        payerName: client.name,
        insuredCount: 0,
        employeeCount: 0,
        selfEmployedCount: 0,
        accidentRate: new Decimal(input.accidentRate).toFixed(2),
        totalPensionBase: '0',
        totalDisabilityBase: '0',
        totalSicknessBase: '0',
        totalHealthBase: '0',
        totalContributions: this.createEmptyContributions(),
        dueDate: dueDate.toISOString(),
        createdBy: this.userId,
      },
    });

    return this.mapDeclarationToSchema(declaration);
  }

  async addInsuredPerson(input: AddInsuredPersonInput): Promise<ZUSInsuredPerson> {
    // Verify declaration exists and is editable
    const declaration = await this.getEditableDeclaration(input.declarationId);

    // Calculate contributions for this person
    const calculation = await this.calculateEmployeeZUS({
      clientId: declaration.clientId,
      year: declaration.year,
      month: declaration.month,
      grossSalary: input.grossSalary,
      bonus: input.bonus || 0,
      contributorType: input.contributorType,
      insuranceCode: input.insuranceCode,
      accidentRate: input.accidentRate || 1.67,
    });

    const insuredPerson = await this.prisma.zusInsuredPerson.create({
      data: {
        declarationId: input.declarationId,
        personId: input.personId,
        firstName: input.firstName,
        lastName: input.lastName,
        pesel: input.pesel,
        nip: input.nip,
        insuranceCode: input.insuranceCode,
        contributorType: input.contributorType,
        pensionBase: calculation.pensionBase,
        disabilityBase: calculation.disabilityBase,
        sicknessBase: calculation.sicknessBase,
        accidentBase: calculation.accidentBase,
        healthBase: calculation.healthBase,
        contributions: calculation.contributions,
        benefitType: input.benefitType,
        benefitDays: input.benefitDays,
        benefitAmount: input.benefitAmount?.toString(),
        isActive: true,
      },
    });

    // Update declaration counts and totals
    await this.updateDeclarationTotals(input.declarationId);

    return this.mapInsuredPersonToSchema(insuredPerson);
  }

  async updateInsuredPerson(input: UpdateInsuredPersonInput): Promise<ZUSInsuredPerson> {
    const insuredPerson = await this.prisma.zusInsuredPerson.findUnique({
      where: { id: input.insuredPersonId },
      include: { declaration: true },
    });

    if (!insuredPerson) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Osoba ubezpieczona nie została znaleziona',
      });
    }

    await this.getEditableDeclaration(insuredPerson.declarationId);

    // Recalculate if salary changed
    let contributions = insuredPerson.contributions as ZUSContributionBreakdown;
    if (input.grossSalary !== undefined) {
      const calculation = await this.calculateEmployeeZUS({
        clientId: insuredPerson.declaration.clientId,
        year: insuredPerson.declaration.year,
        month: insuredPerson.declaration.month,
        grossSalary: input.grossSalary,
        bonus: input.bonus || 0,
        contributorType: insuredPerson.contributorType as CalculateEmployeeZUSInput['contributorType'],
        insuranceCode: input.insuranceCode || insuredPerson.insuranceCode as CalculateEmployeeZUSInput['insuranceCode'],
        accidentRate: 1.67,
      });
      contributions = calculation.contributions;
    }

    const updated = await this.prisma.zusInsuredPerson.update({
      where: { id: input.insuredPersonId },
      data: {
        insuranceCode: input.insuranceCode,
        benefitType: input.benefitType,
        benefitDays: input.benefitDays,
        benefitAmount: input.benefitAmount?.toString(),
        isActive: input.isActive,
        contributions,
        updatedAt: new Date(),
      },
    });

    await this.updateDeclarationTotals(insuredPerson.declarationId);

    return this.mapInsuredPersonToSchema(updated);
  }

  async removeInsuredPerson(input: RemoveInsuredPersonInput): Promise<{ success: boolean }> {
    const insuredPerson = await this.prisma.zusInsuredPerson.findUnique({
      where: { id: input.insuredPersonId },
    });

    if (!insuredPerson) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Osoba ubezpieczona nie została znaleziona',
      });
    }

    await this.getEditableDeclaration(insuredPerson.declarationId);

    await this.prisma.zusInsuredPerson.delete({
      where: { id: input.insuredPersonId },
    });

    await this.updateDeclarationTotals(insuredPerson.declarationId);

    return { success: true };
  }

  async calculateDeclarationTotals(input: CalculateDeclarationTotalsInput): Promise<ZUSDeclarationSummary> {
    const _declaration = await this.getEditableDeclaration(input.declarationId);

    if (input.recalculateAll) {
      // Recalculate all insured persons
      const insuredPersons = await this.prisma.zusInsuredPerson.findMany({
        where: { declarationId: input.declarationId, isActive: true },
      });

      for (const _person of insuredPersons) {
        // Recalculate each person (simplified - in reality would need more data)
        // This is a placeholder for full recalculation logic
      }
    }

    await this.updateDeclarationTotals(input.declarationId);

    return this.getDeclaration({ declarationId: input.declarationId, includeInsuredPersons: true });
  }

  async validateDeclaration(input: ValidateZUSDeclarationInput): Promise<ZUSValidationResult> {
    const declaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
      include: { insuredPersons: { where: { isActive: true } } },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja nie została znaleziona',
      });
    }

    const errors: ZUSValidationResult['errors'] = [];
    const warnings: ZUSValidationResult['warnings'] = [];

    // Validate payer NIP
    if (!declaration.payerNip || declaration.payerNip.length !== 10) {
      errors.push({
        code: 'INVALID_NIP',
        field: 'payerNip',
        message: 'Nieprawidłowy NIP płatnika',
        severity: 'error',
      });
    }

    // Check if there are any insured persons
    if (declaration.insuredPersons.length === 0) {
      warnings.push({
        code: 'NO_INSURED',
        message: 'Brak osób ubezpieczonych w deklaracji',
      });
    }

    // Validate each insured person
    for (const person of declaration.insuredPersons) {
      if (!person.pesel || person.pesel.length !== 11) {
        errors.push({
          code: 'INVALID_PESEL',
          field: `insuredPerson.${person.id}.pesel`,
          message: `Nieprawidłowy PESEL: ${person.firstName} ${person.lastName}`,
          severity: 'error',
        });
      }

      // Validate PESEL checksum
      if (person.pesel && !this.validatePeselChecksum(person.pesel)) {
        errors.push({
          code: 'INVALID_PESEL_CHECKSUM',
          field: `insuredPerson.${person.id}.pesel`,
          message: `Nieprawidłowa suma kontrolna PESEL: ${person.firstName} ${person.lastName}`,
          severity: 'error',
        });
      }
    }

    // Check totals are positive
    if (new Decimal(declaration.totalPensionBase).lessThan(0)) {
      errors.push({
        code: 'NEGATIVE_BASE',
        field: 'totalPensionBase',
        message: 'Podstawa składki emerytalnej nie może być ujemna',
        severity: 'error',
      });
    }

    // Update declaration status based on validation
    const isValid = errors.filter((e) => e.severity === 'error').length === 0;

    if (isValid && declaration.status === 'DRAFT') {
      await this.prisma.zusDeclaration.update({
        where: { id: input.declarationId },
        data: { status: 'VALIDATED' },
      });
    }

    return { isValid, errors, warnings };
  }

  async submitDeclaration(input: SubmitZUSDeclarationInput): Promise<ZUSDeclaration> {
    const declaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja nie została znaleziona',
      });
    }

    if (declaration.status === 'SUBMITTED' || declaration.status === 'ACCEPTED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Deklaracja została już złożona',
      });
    }

    // Validate before submission
    const validation = await this.validateDeclaration({ declarationId: input.declarationId });
    if (!validation.isValid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Deklaracja zawiera błędy i nie może zostać złożona',
      });
    }

    // In real implementation, this would integrate with PUE ZUS or Płatnik
    const zusReferenceNumber = this.generateReferenceNumber();

    const updated = await this.prisma.zusDeclaration.update({
      where: { id: input.declarationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        zusReferenceNumber,
      },
    });

    return this.mapDeclarationToSchema(updated);
  }

  async createCorrection(input: CreateZUSCorrectionInput): Promise<ZUSDeclaration> {
    const originalDeclaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: input.originalDeclarationId,
        organizationId: this.organizationId,
      },
      include: { insuredPersons: true },
    });

    if (!originalDeclaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Oryginalna deklaracja nie została znaleziona',
      });
    }

    if (originalDeclaration.status !== 'SUBMITTED' && originalDeclaration.status !== 'ACCEPTED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Korekta może być utworzona tylko dla złożonej deklaracji',
      });
    }

    // Get correction number
    const correctionCount = await this.prisma.zusDeclaration.count({
      where: {
        originalDeclarationId: input.originalDeclarationId,
        isCorrection: true,
      },
    });

    // Create correction declaration
    const correction = await this.prisma.zusDeclaration.create({
      data: {
        organizationId: this.organizationId,
        clientId: originalDeclaration.clientId,
        year: originalDeclaration.year,
        month: originalDeclaration.month,
        formType: originalDeclaration.formType,
        status: 'DRAFT',
        isCorrection: true,
        correctionNumber: correctionCount + 1,
        originalDeclarationId: input.originalDeclarationId,
        correctionReason: input.correctionReason,
        payerNip: originalDeclaration.payerNip,
        payerRegon: originalDeclaration.payerRegon,
        payerName: originalDeclaration.payerName,
        insuredCount: originalDeclaration.insuredCount,
        employeeCount: originalDeclaration.employeeCount,
        selfEmployedCount: originalDeclaration.selfEmployedCount,
        accidentRate: originalDeclaration.accidentRate,
        totalPensionBase: originalDeclaration.totalPensionBase,
        totalDisabilityBase: originalDeclaration.totalDisabilityBase,
        totalSicknessBase: originalDeclaration.totalSicknessBase,
        totalHealthBase: originalDeclaration.totalHealthBase,
        totalContributions: originalDeclaration.totalContributions,
        dueDate: originalDeclaration.dueDate,
        createdBy: this.userId,
      },
    });

    // Copy insured persons
    for (const person of originalDeclaration.insuredPersons) {
      await this.prisma.zusInsuredPerson.create({
        data: {
          declarationId: correction.id,
          personId: person.personId,
          firstName: person.firstName,
          lastName: person.lastName,
          pesel: person.pesel,
          nip: person.nip,
          insuranceCode: person.insuranceCode,
          contributorType: person.contributorType,
          pensionBase: person.pensionBase,
          disabilityBase: person.disabilityBase,
          sicknessBase: person.sicknessBase,
          accidentBase: person.accidentBase,
          healthBase: person.healthBase,
          contributions: person.contributions,
          benefitType: person.benefitType,
          benefitDays: person.benefitDays,
          benefitAmount: person.benefitAmount,
          isActive: person.isActive,
        },
      });
    }

    // Mark original as corrected
    await this.prisma.zusDeclaration.update({
      where: { id: input.originalDeclarationId },
      data: { status: 'CORRECTED' },
    });

    return this.mapDeclarationToSchema(correction);
  }

  async getDeclaration(input: GetZUSDeclarationInput): Promise<ZUSDeclarationSummary> {
    const declaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
      include: input.includeInsuredPersons
        ? { insuredPersons: { where: { isActive: true } } }
        : undefined,
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja nie została znaleziona',
      });
    }

    const contributions = declaration.totalContributions as ZUSContributionBreakdown;
    const dueAmount = new Decimal(contributions.totalContributions);
    const paidAmount = declaration.paidAmount ? new Decimal(declaration.paidAmount) : new Decimal(0);
    const remainingAmount = dueAmount.minus(paidAmount);
    const daysUntilDue = Math.ceil(
      (new Date(declaration.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    return {
      declaration: this.mapDeclarationToSchema(declaration),
      insuredPersons: declaration.insuredPersons?.map(this.mapInsuredPersonToSchema) || [],
      paymentStatus: {
        dueAmount: dueAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        isOverdue: daysUntilDue < 0 && remainingAmount.greaterThan(0),
        daysUntilDue,
      },
    };
  }

  async listDeclarations(input: ListZUSDeclarationsInput): Promise<ListZUSDeclarationsResult> {
    const where = {
      organizationId: this.organizationId,
      ...(input.clientId && { clientId: input.clientId }),
      ...(input.year && { year: input.year }),
      ...(input.month && { month: input.month }),
      ...(input.formType && { formType: input.formType }),
      ...(input.status && { status: input.status }),
      ...(input.isCorrection !== undefined && { isCorrection: input.isCorrection }),
    };

    const [declarations, total] = await Promise.all([
      this.prisma.zusDeclaration.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.zusDeclaration.count({ where }),
    ]);

    return {
      declarations: declarations.map(this.mapDeclarationToSchema),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  async deleteDeclaration(input: DeleteZUSDeclarationInput): Promise<{ success: boolean }> {
    const declaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja nie została znaleziona',
      });
    }

    if (declaration.status === 'SUBMITTED' || declaration.status === 'ACCEPTED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można usunąć złożonej deklaracji',
      });
    }

    // Delete insured persons first
    await this.prisma.zusInsuredPerson.deleteMany({
      where: { declarationId: input.declarationId },
    });

    await this.prisma.zusDeclaration.delete({
      where: { id: input.declarationId },
    });

    return { success: true };
  }

  // =========================================================================
  // PAYMENT MANAGEMENT
  // =========================================================================

  async calculatePayment(input: CalculateZUSPaymentInput): Promise<ZUSPayment> {
    const declaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja nie została znaleziona',
      });
    }

    const contributions = declaration.totalContributions as ZUSContributionBreakdown;

    return {
      id: declaration.id,
      organizationId: this.organizationId,
      declarationId: declaration.id,
      year: declaration.year,
      month: declaration.month,
      pensionAmount: new Decimal(contributions.pensionEmployee)
        .plus(contributions.pensionEmployer)
        .toFixed(2),
      disabilityAmount: new Decimal(contributions.disabilityEmployee)
        .plus(contributions.disabilityEmployer)
        .toFixed(2),
      sicknessAmount: contributions.sicknessEmployee,
      accidentAmount: contributions.accidentEmployer,
      healthAmount: contributions.healthEmployee,
      laborFundAmount: contributions.laborFundEmployer,
      fgspAmount: contributions.fgspEmployer,
      totalAmount: contributions.totalContributions,
      paymentDate: declaration.dueDate,
      paymentReference: '',
      isPaid: !!declaration.paidAt,
      isOverdue: new Date() > new Date(declaration.dueDate) && !declaration.paidAt,
      createdAt: declaration.createdAt.toISOString(),
      updatedAt: declaration.updatedAt.toISOString(),
    };
  }

  async recordPayment(input: RecordZUSPaymentInput): Promise<ZUSDeclaration> {
    const declaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: input.declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja nie została znaleziona',
      });
    }

    const updated = await this.prisma.zusDeclaration.update({
      where: { id: input.declarationId },
      data: {
        paidAmount: new Decimal(input.totalAmount).toFixed(2),
        paidAt: new Date(input.paymentDate),
        paymentReference: input.paymentReference,
      },
    });

    return this.mapDeclarationToSchema(updated);
  }

  async getPaymentSchedule(input: GetZUSPaymentScheduleInput): Promise<ZUSPaymentSchedule> {
    const declarations = await this.prisma.zusDeclaration.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        year: input.year,
        isCorrection: false,
      },
      orderBy: { month: 'asc' },
    });

    const schedule = [];
    let totalDue = new Decimal(0);
    let totalPaid = new Decimal(0);
    let totalOverdue = new Decimal(0);

    for (let month = 1; month <= 12; month++) {
      const declaration = declarations.find((d) => d.month === month);

      if (declaration) {
        const contributions = declaration.totalContributions as ZUSContributionBreakdown;
        const dueAmount = new Decimal(contributions.totalContributions);
        const paidAmount = declaration.paidAmount ? new Decimal(declaration.paidAmount) : new Decimal(0);
        const isOverdue = new Date() > new Date(declaration.dueDate) && paidAmount.lessThan(dueAmount);

        totalDue = totalDue.plus(dueAmount);
        totalPaid = totalPaid.plus(paidAmount);
        if (isOverdue) {
          totalOverdue = totalOverdue.plus(dueAmount.minus(paidAmount));
        }

        schedule.push({
          month,
          dueDate: declaration.dueDate,
          status: declaration.paidAt
            ? paidAmount.greaterThanOrEqualTo(dueAmount) ? 'paid' as const : 'partial' as const
            : isOverdue ? 'overdue' as const : 'pending' as const,
          dueAmount: dueAmount.toFixed(2),
          paidAmount: paidAmount.toFixed(2),
          declarationId: declaration.id,
        });
      } else {
        const dueDate = this.calculateDueDate(input.year, month);
        schedule.push({
          month,
          dueDate: dueDate.toISOString(),
          status: 'pending' as const,
          dueAmount: '0',
          paidAmount: '0',
        });
      }
    }

    return {
      clientId: input.clientId,
      year: input.year,
      schedule,
      totalDue: totalDue.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
    };
  }

  // =========================================================================
  // HISTORY AND REPORTING
  // =========================================================================

  async getContributionHistory(input: GetContributionHistoryInput): Promise<{
    history: ContributionHistoryEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where = {
      ...(input.personId && { personId: input.personId }),
      ...(input.pesel && { pesel: input.pesel }),
      isActive: true,
      declaration: {
        organizationId: this.organizationId,
        ...(input.year && { year: input.year }),
      },
    };

    const [insuredRecords, total] = await Promise.all([
      this.prisma.zusInsuredPerson.findMany({
        where,
        include: { declaration: true },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ declaration: { year: 'desc' } }, { declaration: { month: 'desc' } }],
      }),
      this.prisma.zusInsuredPerson.count({ where }),
    ]);

    const history: ContributionHistoryEntry[] = insuredRecords.map((record) => {
      const contributions = record.contributions as ZUSContributionBreakdown;
      return {
        year: record.declaration.year,
        month: record.declaration.month,
        declarationId: record.declarationId,
        pensionBase: record.pensionBase,
        disabilityBase: record.disabilityBase,
        sicknessBase: record.sicknessBase,
        healthBase: record.healthBase,
        totalContributions: contributions.totalContributions,
        isPaid: !!record.declaration.paidAt,
      };
    });

    return {
      history,
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async generateAnnualReport(input: GenerateAnnualReportInput): Promise<AnnualZUSReport> {
    const declarations = await this.prisma.zusDeclaration.findMany({
      where: {
        organizationId: this.organizationId,
        clientId: input.clientId,
        year: input.year,
        isCorrection: false,
      },
      orderBy: { month: 'asc' },
    });

    let totalPension = new Decimal(0);
    let totalDisability = new Decimal(0);
    let totalSickness = new Decimal(0);
    let totalAccident = new Decimal(0);
    let totalHealth = new Decimal(0);
    let totalLaborFund = new Decimal(0);
    let totalFGSP = new Decimal(0);
    let totalDue = new Decimal(0);
    let totalPaid = new Decimal(0);

    const monthlyData = declarations.map((declaration) => {
      const contributions = declaration.totalContributions as ZUSContributionBreakdown;

      totalPension = totalPension
        .plus(contributions.pensionEmployee)
        .plus(contributions.pensionEmployer);
      totalDisability = totalDisability
        .plus(contributions.disabilityEmployee)
        .plus(contributions.disabilityEmployer);
      totalSickness = totalSickness.plus(contributions.sicknessEmployee);
      totalAccident = totalAccident.plus(contributions.accidentEmployer);
      totalHealth = totalHealth.plus(contributions.healthEmployee);
      totalLaborFund = totalLaborFund.plus(contributions.laborFundEmployer);
      totalFGSP = totalFGSP.plus(contributions.fgspEmployer);

      const monthTotal = new Decimal(contributions.totalContributions);
      totalDue = totalDue.plus(monthTotal);

      if (declaration.paidAmount) {
        totalPaid = totalPaid.plus(declaration.paidAmount);
      }

      return {
        month: declaration.month,
        insuredCount: declaration.insuredCount,
        totalContributions: contributions.totalContributions,
        isPaid: !!declaration.paidAt,
      };
    });

    const grandTotal = totalPension
      .plus(totalDisability)
      .plus(totalSickness)
      .plus(totalAccident)
      .plus(totalHealth)
      .plus(totalLaborFund)
      .plus(totalFGSP);

    return {
      clientId: input.clientId,
      year: input.year,
      totalPensionContributions: totalPension.toFixed(2),
      totalDisabilityContributions: totalDisability.toFixed(2),
      totalSicknessContributions: totalSickness.toFixed(2),
      totalAccidentContributions: totalAccident.toFixed(2),
      totalHealthContributions: totalHealth.toFixed(2),
      totalLaborFundContributions: totalLaborFund.toFixed(2),
      totalFGSPContributions: totalFGSP.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      monthlyData,
      totalDue: totalDue.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalOutstanding: totalDue.minus(totalPaid).toFixed(2),
      generatedAt: new Date().toISOString(),
    };
  }

  // =========================================================================
  // PRIVATE HELPER METHODS
  // =========================================================================

  private calculateContributions(
    pensionDisabilityBase: Decimal,
    sicknessBase: Decimal,
    accidentBase: Decimal,
    healthBase: Decimal,
    accidentRate: Decimal,
  ): ZUSContributionBreakdown {
    const pensionEmployee = pensionDisabilityBase.times(ZUS_RATES.PENSION_EMPLOYEE).div(100);
    const pensionEmployer = pensionDisabilityBase.times(ZUS_RATES.PENSION_EMPLOYER).div(100);
    const disabilityEmployee = pensionDisabilityBase.times(ZUS_RATES.DISABILITY_EMPLOYEE).div(100);
    const disabilityEmployer = pensionDisabilityBase.times(ZUS_RATES.DISABILITY_EMPLOYER).div(100);
    const sicknessEmployee = sicknessBase.times(ZUS_RATES.SICKNESS_EMPLOYEE).div(100);
    const accidentEmployer = accidentBase.times(accidentRate).div(100);
    const healthEmployee = healthBase.times(ZUS_RATES.HEALTH).div(100);
    const laborFundEmployer = pensionDisabilityBase.times(ZUS_RATES.LABOR_FUND).div(100);
    const fgspEmployer = pensionDisabilityBase.times(ZUS_RATES.FGSP).div(100);

    const totalEmployee = pensionEmployee
      .plus(disabilityEmployee)
      .plus(sicknessEmployee)
      .plus(healthEmployee);

    const totalEmployer = pensionEmployer
      .plus(disabilityEmployer)
      .plus(accidentEmployer)
      .plus(laborFundEmployer)
      .plus(fgspEmployer);

    return {
      pensionEmployee: pensionEmployee.toFixed(2),
      pensionEmployer: pensionEmployer.toFixed(2),
      disabilityEmployee: disabilityEmployee.toFixed(2),
      disabilityEmployer: disabilityEmployer.toFixed(2),
      sicknessEmployee: sicknessEmployee.toFixed(2),
      accidentEmployer: accidentEmployer.toFixed(2),
      healthEmployee: healthEmployee.toFixed(2),
      laborFundEmployer: laborFundEmployer.toFixed(2),
      fgspEmployer: fgspEmployer.toFixed(2),
      totalEmployee: totalEmployee.toFixed(2),
      totalEmployer: totalEmployer.toFixed(2),
      totalContributions: totalEmployee.plus(totalEmployer).toFixed(2),
    };
  }

  private createEmptyContributions(): ZUSContributionBreakdown {
    return {
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
  }

  private createZeroContributionsResult(
    totalIncome: Decimal,
    warnings: string[],
    reason: string,
  ): EmployeeZUSCalculationResult {
    warnings.push(reason);
    return {
      grossSalary: totalIncome.toFixed(2),
      totalBonuses: '0',
      totalIncome: totalIncome.toFixed(2),
      pensionBase: '0',
      disabilityBase: '0',
      sicknessBase: '0',
      accidentBase: '0',
      healthBase: '0',
      contributions: this.createEmptyContributions(),
      totalEmployeeContributions: '0',
      incomeAfterZUS: totalIncome.toFixed(2),
      healthDeduction: '0',
      isAnnualLimitReached: false,
      warnings,
    };
  }

  private calculateDueDate(year: number, month: number): Date {
    // ZUS due date: 15th of following month for self-employed
    // 20th for companies with employees
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return new Date(nextYear, nextMonth - 1, 20);
  }

  private generateReferenceNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ZUS-${timestamp}-${random}`.toUpperCase();
  }

  private validatePeselChecksum(pesel: string): boolean {
    if (pesel.length !== 11) return false;

    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    let sum = 0;

    for (let i = 0; i < 10; i++) {
      sum += parseInt(pesel[i], 10) * weights[i];
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(pesel[10], 10);
  }

  private async getEditableDeclaration(declarationId: string) {
    const declaration = await this.prisma.zusDeclaration.findFirst({
      where: {
        id: declarationId,
        organizationId: this.organizationId,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja nie została znaleziona',
      });
    }

    if (declaration.status === 'SUBMITTED' || declaration.status === 'ACCEPTED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można edytować złożonej deklaracji. Użyj funkcji korekty.',
      });
    }

    return declaration;
  }

  private async updateDeclarationTotals(declarationId: string): Promise<void> {
    const insuredPersons = await this.prisma.zusInsuredPerson.findMany({
      where: { declarationId, isActive: true },
    });

    let totalPensionBase = new Decimal(0);
    let totalDisabilityBase = new Decimal(0);
    let totalSicknessBase = new Decimal(0);
    let totalHealthBase = new Decimal(0);
    let totalContributions = this.createEmptyContributions();

    let employeeCount = 0;
    let selfEmployedCount = 0;

    for (const person of insuredPersons) {
      totalPensionBase = totalPensionBase.plus(person.pensionBase);
      totalDisabilityBase = totalDisabilityBase.plus(person.disabilityBase);
      totalSicknessBase = totalSicknessBase.plus(person.sicknessBase);
      totalHealthBase = totalHealthBase.plus(person.healthBase);

      const personContributions = person.contributions as ZUSContributionBreakdown;
      totalContributions = this.sumContributions(totalContributions, personContributions);

      if (person.contributorType === 'SELF_EMPLOYED') {
        selfEmployedCount++;
      } else {
        employeeCount++;
      }
    }

    await this.prisma.zusDeclaration.update({
      where: { id: declarationId },
      data: {
        insuredCount: insuredPersons.length,
        employeeCount,
        selfEmployedCount,
        totalPensionBase: totalPensionBase.toFixed(2),
        totalDisabilityBase: totalDisabilityBase.toFixed(2),
        totalSicknessBase: totalSicknessBase.toFixed(2),
        totalHealthBase: totalHealthBase.toFixed(2),
        totalContributions,
        status: 'CALCULATED',
        updatedAt: new Date(),
      },
    });
  }

  private sumContributions(
    a: ZUSContributionBreakdown,
    b: ZUSContributionBreakdown,
  ): ZUSContributionBreakdown {
    return {
      pensionEmployee: new Decimal(a.pensionEmployee).plus(b.pensionEmployee).toFixed(2),
      pensionEmployer: new Decimal(a.pensionEmployer).plus(b.pensionEmployer).toFixed(2),
      disabilityEmployee: new Decimal(a.disabilityEmployee).plus(b.disabilityEmployee).toFixed(2),
      disabilityEmployer: new Decimal(a.disabilityEmployer).plus(b.disabilityEmployer).toFixed(2),
      sicknessEmployee: new Decimal(a.sicknessEmployee).plus(b.sicknessEmployee).toFixed(2),
      accidentEmployer: new Decimal(a.accidentEmployer).plus(b.accidentEmployer).toFixed(2),
      healthEmployee: new Decimal(a.healthEmployee).plus(b.healthEmployee).toFixed(2),
      laborFundEmployer: new Decimal(a.laborFundEmployer).plus(b.laborFundEmployer).toFixed(2),
      fgspEmployer: new Decimal(a.fgspEmployer).plus(b.fgspEmployer).toFixed(2),
      totalEmployee: new Decimal(a.totalEmployee).plus(b.totalEmployee).toFixed(2),
      totalEmployer: new Decimal(a.totalEmployer).plus(b.totalEmployer).toFixed(2),
      totalContributions: new Decimal(a.totalContributions).plus(b.totalContributions).toFixed(2),
    };
  }

  private mapDeclarationToSchema(declaration: any): ZUSDeclaration {
    return {
      id: declaration.id,
      organizationId: declaration.organizationId,
      clientId: declaration.clientId,
      year: declaration.year,
      month: declaration.month,
      formType: declaration.formType,
      status: declaration.status,
      isCorrection: declaration.isCorrection,
      correctionNumber: declaration.correctionNumber,
      originalDeclarationId: declaration.originalDeclarationId,
      correctionReason: declaration.correctionReason,
      payerNip: declaration.payerNip,
      payerRegon: declaration.payerRegon,
      payerName: declaration.payerName,
      insuredCount: declaration.insuredCount,
      employeeCount: declaration.employeeCount,
      selfEmployedCount: declaration.selfEmployedCount,
      accidentRate: declaration.accidentRate,
      totalPensionBase: declaration.totalPensionBase,
      totalDisabilityBase: declaration.totalDisabilityBase,
      totalSicknessBase: declaration.totalSicknessBase,
      totalHealthBase: declaration.totalHealthBase,
      totalContributions: declaration.totalContributions,
      dueDate: declaration.dueDate instanceof Date
        ? declaration.dueDate.toISOString()
        : declaration.dueDate,
      paidAmount: declaration.paidAmount,
      paidAt: declaration.paidAt instanceof Date
        ? declaration.paidAt.toISOString()
        : declaration.paidAt,
      paymentReference: declaration.paymentReference,
      submittedAt: declaration.submittedAt instanceof Date
        ? declaration.submittedAt.toISOString()
        : declaration.submittedAt,
      zusReferenceNumber: declaration.zusReferenceNumber,
      zusConfirmationNumber: declaration.zusConfirmationNumber,
      createdBy: declaration.createdBy,
      createdAt: declaration.createdAt instanceof Date
        ? declaration.createdAt.toISOString()
        : declaration.createdAt,
      updatedAt: declaration.updatedAt instanceof Date
        ? declaration.updatedAt.toISOString()
        : declaration.updatedAt,
    };
  }

  private mapInsuredPersonToSchema(person: any): ZUSInsuredPerson {
    return {
      id: person.id,
      declarationId: person.declarationId,
      personId: person.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      pesel: person.pesel,
      nip: person.nip,
      insuranceCode: person.insuranceCode,
      contributorType: person.contributorType,
      pensionBase: person.pensionBase,
      disabilityBase: person.disabilityBase,
      sicknessBase: person.sicknessBase,
      accidentBase: person.accidentBase,
      healthBase: person.healthBase,
      contributions: person.contributions,
      benefitType: person.benefitType,
      benefitDays: person.benefitDays,
      benefitAmount: person.benefitAmount,
      isActive: person.isActive,
      notes: person.notes,
      createdAt: person.createdAt instanceof Date
        ? person.createdAt.toISOString()
        : person.createdAt,
      updatedAt: person.updatedAt instanceof Date
        ? person.updatedAt.toISOString()
        : person.updatedAt,
    };
  }
}
