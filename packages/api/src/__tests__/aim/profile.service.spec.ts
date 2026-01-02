import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { ProfileService } from '../../services/aim/profile.service';
import { AuditLogger } from '../../utils/audit-logger';

// Test data constants
const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROFILE_ID = '550e8400-e29b-41d4-a716-446655440002';
const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655449999';

// Mock Prisma client
const mockPrisma = {
  userProfile: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  onboardingProgress: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  setex: vi.fn(),
};

// Mock GUS API client
const mockGusClient = {
  lookupByNip: vi.fn(),
  lookupByRegon: vi.fn(),
};

// Mock fetch for GUS API
global.fetch = vi.fn();

describe('ProfileService', () => {
  let profileService: ProfileService;
  let auditLogger: AuditLogger;

  const baseProfile = {
    id: PROFILE_ID,
    userId: USER_ID,
    firstName: 'Jan',
    lastName: 'Kowalski',
    phone: '123456789',
    dateOfBirth: '1990-01-15',
    accountType: 'COMPANY',
    companyName: 'Test Sp. z o.o.',
    nip: '5213017228',
    regon: '012345678',
    krs: '0000000001',
    taxOffice: 'Urząd Skarbowy Warszawa',
    street: 'Testowa',
    buildingNumber: '10',
    apartmentNumber: '5',
    city: 'Warszawa',
    postalCode: '00-001',
    voivodeship: 'mazowieckie',
    country: 'PL',
    language: 'pl',
    timezone: 'Europe/Warsaw',
    currency: 'PLN',
    dateFormat: 'DD.MM.YYYY',
    emailNotifications: true,
    smsNotifications: false,
    marketingConsent: false,
    termsAccepted: true,
    privacyPolicyAccepted: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  const baseOnboardingProgress = {
    id: 'onboarding-1',
    userId: USER_ID,
    completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO'],
    skippedSteps: [],
    currentStep: 'ADDRESS_INFO',
    isComplete: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-10'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogger = new AuditLogger(mockPrisma as any);
    profileService = new ProfileService(
      mockPrisma as any,
      mockRedis as any,
      auditLogger
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // GET PROFILE
  // ===========================================================================

  describe('getProfile', () => {
    it('should return profile for the current user', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.getProfile(USER_ID);

      expect(result).toBeDefined();
      expect(result.userId).toBe(USER_ID);
      expect(result.firstName).toBe('Jan');
      expect(result.lastName).toBe('Kowalski');
      expect(mockPrisma.userProfile.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });

    it('should return profile with completion percentage', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO', 'PREFERENCES'],
        isComplete: true,
      });

      const result = await profileService.getProfile(USER_ID);

      expect(result.completionPercentage).toBe(100);
      expect(result.completionStatus).toBe('COMPLETED');
    });

    it('should calculate partial completion percentage', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue({
        ...baseProfile,
        firstName: 'Jan',
        lastName: 'Kowalski',
        companyName: null,
        nip: null,
        city: null,
        postalCode: null,
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO'],
        isComplete: false,
      });

      const result = await profileService.getProfile(USER_ID);

      expect(result.completionPercentage).toBe(25);
      expect(result.completionStatus).toBe('IN_PROGRESS');
    });

    it('should throw NOT_FOUND if profile does not exist', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(null);

      await expect(profileService.getProfile(NON_EXISTENT_ID)).rejects.toThrow(TRPCError);
      await expect(profileService.getProfile(NON_EXISTENT_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should use cached profile if available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(baseProfile));
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.getProfile(USER_ID);

      expect(result.userId).toBe(USER_ID);
      expect(mockPrisma.userProfile.findFirst).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // UPDATE PROFILE
  // ===========================================================================

  describe('updateProfile', () => {
    it('should update personal info', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue({
        ...baseProfile,
        firstName: 'Adam',
        lastName: 'Nowak',
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.updateProfile(USER_ID, {
        personalInfo: {
          firstName: 'Adam',
          lastName: 'Nowak',
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.firstName).toBe('Adam');
      expect(result.profile.lastName).toBe('Nowak');
      expect(mockPrisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROFILE_ID },
          data: expect.objectContaining({
            firstName: 'Adam',
            lastName: 'Nowak',
          }),
        })
      );
    });

    it('should update company info', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue({
        ...baseProfile,
        companyName: 'Nowa Firma Sp. z o.o.',
        nip: '1234563218',
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.updateProfile(USER_ID, {
        companyInfo: {
          accountType: 'COMPANY',
          companyName: 'Nowa Firma Sp. z o.o.',
          nip: '1234563218',
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.companyName).toBe('Nowa Firma Sp. z o.o.');
    });

    it('should update address info', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue({
        ...baseProfile,
        city: 'Kraków',
        postalCode: '30-001',
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.updateProfile(USER_ID, {
        addressInfo: {
          city: 'Kraków',
          postalCode: '30-001',
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.city).toBe('Kraków');
      expect(result.profile.postalCode).toBe('30-001');
    });

    it('should update preferences', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue({
        ...baseProfile,
        language: 'en',
        emailNotifications: false,
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.updateProfile(USER_ID, {
        preferences: {
          language: 'en',
          emailNotifications: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.language).toBe('en');
      expect(result.profile.emailNotifications).toBe(false);
    });

    it('should create profile if it does not exist', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(null);
      mockPrisma.userProfile.create.mockResolvedValue({
        ...baseProfile,
        id: 'new-profile-id',
        firstName: 'Jan',
        lastName: 'Kowalski',
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingProgress.create.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.updateProfile(USER_ID, {
        personalInfo: {
          firstName: 'Jan',
          lastName: 'Kowalski',
        },
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.userProfile.create).toHaveBeenCalled();
    });

    it('should invalidate cache after update', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      await profileService.updateProfile(USER_ID, {
        personalInfo: {
          firstName: 'Jan',
          lastName: 'Nowak',
        },
      });

      expect(mockRedis.del).toHaveBeenCalledWith(`profile:${USER_ID}`);
    });

    it('should log audit event on update', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      await profileService.updateProfile(USER_ID, {
        personalInfo: { firstName: 'Jan', lastName: 'Nowak' },
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'PROFILE_UPDATED',
          userId: USER_ID,
        }),
      });
    });
  });

  // ===========================================================================
  // ONBOARDING STEPS
  // ===========================================================================

  describe('completeOnboardingStep', () => {
    it('should complete PERSONAL_INFO step', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: [],
        currentStep: 'PERSONAL_INFO',
      });
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO'],
        currentStep: 'COMPANY_INFO',
      });

      const result = await profileService.completeOnboardingStep(USER_ID, {
        step: 'PERSONAL_INFO',
        data: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '123456789',
        },
      });

      expect(result.success).toBe(true);
      expect(result.step).toBe('PERSONAL_INFO');
      expect(result.completedSteps).toContain('PERSONAL_INFO');
      expect(result.nextStep).toBe('COMPANY_INFO');
    });

    it('should complete COMPANY_INFO step', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO'],
        currentStep: 'COMPANY_INFO',
      });
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO'],
        currentStep: 'ADDRESS_INFO',
      });

      const result = await profileService.completeOnboardingStep(USER_ID, {
        step: 'COMPANY_INFO',
        data: {
          accountType: 'COMPANY',
          companyName: 'Test Sp. z o.o.',
          nip: '5213017228',
        },
      });

      expect(result.success).toBe(true);
      expect(result.step).toBe('COMPANY_INFO');
      expect(result.nextStep).toBe('ADDRESS_INFO');
    });

    it('should complete ADDRESS_INFO step', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO'],
        currentStep: 'ADDRESS_INFO',
      });
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO'],
        currentStep: 'PREFERENCES',
      });

      const result = await profileService.completeOnboardingStep(USER_ID, {
        step: 'ADDRESS_INFO',
        data: {
          city: 'Warszawa',
          postalCode: '00-001',
          street: 'Testowa',
          buildingNumber: '10',
        },
      });

      expect(result.success).toBe(true);
      expect(result.nextStep).toBe('PREFERENCES');
    });

    it('should complete PREFERENCES step and finish onboarding', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO'],
        currentStep: 'PREFERENCES',
      });
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO', 'PREFERENCES'],
        currentStep: null,
        isComplete: true,
      });
      mockPrisma.user.update.mockResolvedValue({ id: USER_ID, status: 'ACTIVE' });

      const result = await profileService.completeOnboardingStep(USER_ID, {
        step: 'PREFERENCES',
        data: {
          language: 'pl',
          timezone: 'Europe/Warsaw',
          currency: 'PLN',
          dateFormat: 'DD.MM.YYYY',
          emailNotifications: true,
          smsNotifications: false,
          marketingConsent: false,
          termsAccepted: true,
          privacyPolicyAccepted: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(result.completionPercentage).toBe(100);
      expect(result.nextStep).toBeNull();
    });

    it('should throw error if trying to complete step out of order', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: [],
        currentStep: 'PERSONAL_INFO',
      });

      await expect(
        profileService.completeOnboardingStep(USER_ID, {
          step: 'ADDRESS_INFO',
          data: {
            city: 'Warszawa',
            postalCode: '00-001',
          },
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if step already completed', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO'],
        currentStep: 'ADDRESS_INFO',
      });

      await expect(
        profileService.completeOnboardingStep(USER_ID, {
          step: 'PERSONAL_INFO',
          data: {
            firstName: 'Jan',
            lastName: 'Kowalski',
          },
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // GET ONBOARDING STATUS
  // ===========================================================================

  describe('getOnboardingStatus', () => {
    it('should return onboarding status', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      const result = await profileService.getOnboardingStatus(USER_ID);

      expect(result.currentStep).toBe('ADDRESS_INFO');
      expect(result.completedSteps).toEqual(['PERSONAL_INFO', 'COMPANY_INFO']);
      expect(result.completionPercentage).toBe(50);
      expect(result.isComplete).toBe(false);
    });

    it('should return NOT_STARTED status for new user', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);

      const result = await profileService.getOnboardingStatus(USER_ID);

      expect(result.status).toBe('NOT_STARTED');
      expect(result.currentStep).toBe('PERSONAL_INFO');
      expect(result.completedSteps).toEqual([]);
      expect(result.completionPercentage).toBe(0);
    });

    it('should return COMPLETED status when onboarding is finished', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO', 'PREFERENCES'],
        currentStep: null,
        isComplete: true,
      });

      const result = await profileService.getOnboardingStatus(USER_ID);

      expect(result.status).toBe('COMPLETED');
      expect(result.isComplete).toBe(true);
      expect(result.completionPercentage).toBe(100);
      expect(result.nextStep).toBeNull();
    });

    it('should return next step correctly', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO'],
        currentStep: 'COMPANY_INFO',
      });

      const result = await profileService.getOnboardingStatus(USER_ID);

      expect(result.currentStep).toBe('COMPANY_INFO');
      expect(result.nextStep).toBe('COMPANY_INFO');
    });
  });

  // ===========================================================================
  // SKIP ONBOARDING STEP
  // ===========================================================================

  describe('skipOnboardingStep', () => {
    it('should skip COMPANY_INFO step for individual account', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue({
        ...baseProfile,
        accountType: 'INDIVIDUAL',
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO'],
        currentStep: 'COMPANY_INFO',
        skippedSteps: [],
      });
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO'],
        skippedSteps: ['COMPANY_INFO'],
        currentStep: 'ADDRESS_INFO',
      });

      const result = await profileService.skipOnboardingStep(USER_ID, {
        step: 'COMPANY_INFO',
      });

      expect(result.success).toBe(true);
      expect(result.completedSteps).not.toContain('COMPANY_INFO');
      expect(result.nextStep).toBe('ADDRESS_INFO');
    });

    it('should not allow skipping PERSONAL_INFO step', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: [],
        currentStep: 'PERSONAL_INFO',
      });

      await expect(
        profileService.skipOnboardingStep(USER_ID, { step: 'PERSONAL_INFO' })
      ).rejects.toThrow(TRPCError);
    });

    it('should not allow skipping PREFERENCES step', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO'],
        currentStep: 'PREFERENCES',
      });

      await expect(
        profileService.skipOnboardingStep(USER_ID, { step: 'PREFERENCES' })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // RESET ONBOARDING
  // ===========================================================================

  describe('resetOnboarding', () => {
    it('should reset onboarding progress', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: [],
        skippedSteps: [],
        currentStep: 'PERSONAL_INFO',
        isComplete: false,
      });

      const result = await profileService.resetOnboarding(USER_ID);

      expect(result.completedSteps).toEqual([]);
      expect(result.currentStep).toBe('PERSONAL_INFO');
      expect(result.isComplete).toBe(false);
    });

    it('should log audit event when resetting', async () => {
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: [],
      });

      await profileService.resetOnboarding(USER_ID);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'ONBOARDING_RESET',
          userId: USER_ID,
        }),
      });
    });
  });

  // ===========================================================================
  // GUS LOOKUP BY NIP
  // ===========================================================================

  describe('gusLookupByNip', () => {
    const gusCompanyData = {
      found: true,
      companyName: 'Testowa Firma Sp. z o.o.',
      nip: '5213017228',
      regon: '012345678',
      krs: '0000123456',
      street: 'Marszałkowska',
      buildingNumber: '1',
      apartmentNumber: '100',
      city: 'Warszawa',
      postalCode: '00-001',
      voivodeship: 'MAZOWIECKIE',
      country: 'PL',
      legalForm: 'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      pkdMain: '62.01.Z',
      pkdMainDescription: 'Działalność związana z oprogramowaniem',
      registrationDate: '2020-01-15',
      isActive: true,
    };

    it('should return company data for valid NIP', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gusCompanyData),
      });

      const result = await profileService.gusLookupByNip({ nip: '5213017228' });

      expect(result.found).toBe(true);
      expect(result.companyName).toBe('Testowa Firma Sp. z o.o.');
      expect(result.nip).toBe('5213017228');
      expect(result.city).toBe('Warszawa');
    });

    it('should return not found for invalid NIP', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ found: false }),
      });

      const result = await profileService.gusLookupByNip({ nip: '5213017228' });

      expect(result.found).toBe(false);
      expect(result.companyName).toBeNull();
    });

    it('should use cached GUS data if available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(gusCompanyData));

      const result = await profileService.gusLookupByNip({ nip: '5213017228' });

      expect(result.found).toBe(true);
      expect(result.companyName).toBe('Testowa Firma Sp. z o.o.');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should cache GUS lookup results', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gusCompanyData),
      });

      await profileService.gusLookupByNip({ nip: '5213017228' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('gus:nip:5213017228'),
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should handle GUS API errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('API unavailable'));

      const result = await profileService.gusLookupByNip({ nip: '5213017228' });

      expect(result.found).toBe(false);
    });

    it('should log audit event for GUS lookup', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gusCompanyData),
      });

      await profileService.gusLookupByNip({ nip: '5213017228' }, USER_ID);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'GUS_LOOKUP',
          metadata: expect.objectContaining({
            lookupType: 'NIP',
            identifier: '5213017228',
          }),
        }),
      });
    });
  });

  // ===========================================================================
  // GUS LOOKUP BY REGON
  // ===========================================================================

  describe('gusLookupByRegon', () => {
    const gusCompanyData = {
      found: true,
      companyName: 'Testowa Firma Sp. z o.o.',
      nip: '5213017228',
      regon: '012345678',
      city: 'Warszawa',
    };

    it('should return company data for valid REGON', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gusCompanyData),
      });

      const result = await profileService.gusLookupByRegon({ regon: '012345678' });

      expect(result.found).toBe(true);
      expect(result.companyName).toBe('Testowa Firma Sp. z o.o.');
      expect(result.regon).toBe('012345678');
    });

    it('should return not found for invalid REGON', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ found: false }),
      });

      const result = await profileService.gusLookupByRegon({ regon: '012345678' });

      expect(result.found).toBe(false);
    });

    it('should support 14-digit REGON', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...gusCompanyData, regon: '01234567890123' }),
      });

      const result = await profileService.gusLookupByRegon({ regon: '01234567890123' });

      expect(result.found).toBe(true);
    });

    it('should use cached GUS data for REGON lookup', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(gusCompanyData));

      const result = await profileService.gusLookupByRegon({ regon: '012345678' });

      expect(result.found).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // PROFILE COMPLETION
  // ===========================================================================

  describe('calculateCompletionPercentage', () => {
    it('should return 0% for empty profile', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue({
        ...baseProfile,
        firstName: null,
        lastName: null,
        companyName: null,
        city: null,
        postalCode: null,
        termsAccepted: false,
        privacyPolicyAccepted: false,
      });
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: [],
        isComplete: false,
      });

      const result = await profileService.getProfile(USER_ID);

      expect(result.completionPercentage).toBe(0);
      expect(result.completionStatus).toBe('NOT_STARTED');
    });

    it('should return 100% for complete profile', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue({
        ...baseOnboardingProgress,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO', 'PREFERENCES'],
        isComplete: true,
      });

      const result = await profileService.getProfile(USER_ID);

      expect(result.completionPercentage).toBe(100);
      expect(result.completionStatus).toBe('COMPLETED');
    });
  });

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  describe('validation', () => {
    it('should validate NIP checksum', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      // This is a valid NIP that passes checksum validation
      await expect(
        profileService.updateProfile(USER_ID, {
          companyInfo: {
            accountType: 'COMPANY',
            nip: '5213017228', // Valid NIP
          },
        })
      ).resolves.not.toThrow();
    });

    it('should validate phone number format', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      await expect(
        profileService.updateProfile(USER_ID, {
          personalInfo: {
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48123456789',
          },
        })
      ).resolves.not.toThrow();
    });

    it('should validate postal code format', async () => {
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.userProfile.update.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      await expect(
        profileService.updateProfile(USER_ID, {
          addressInfo: {
            city: 'Warszawa',
            postalCode: '00-001', // Valid format XX-XXX
          },
        })
      ).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.userProfile.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(profileService.getProfile(USER_ID)).rejects.toThrow();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockPrisma.userProfile.findFirst.mockResolvedValue(baseProfile);
      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(baseOnboardingProgress);

      // Should still work by falling back to database
      const result = await profileService.getProfile(USER_ID);

      expect(result.userId).toBe(USER_ID);
    });
  });
});
