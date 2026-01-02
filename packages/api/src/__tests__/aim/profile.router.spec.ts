import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

const mockProfileServiceMethods = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  completeOnboardingStep: vi.fn(),
  getOnboardingStatus: vi.fn(),
  skipOnboardingStep: vi.fn(),
  resetOnboarding: vi.fn(),
  gusLookupByNip: vi.fn(),
  gusLookupByRegon: vi.fn(),
}));

// Mock ProfileService module
vi.mock('../../services/aim/profile.service', () => ({
  ProfileService: vi.fn(() => mockProfileServiceMethods),
}));

// Mock @ksiegowacrm/auth
vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
  argon2Service: {
    verify: vi.fn().mockResolvedValue(true),
  },
  TotpService: vi.fn().mockImplementation(() => ({
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  })),
  totpService: {
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  },
}));

// Alias for cleaner access in tests
const mocks = {
  getProfile: mockProfileServiceMethods.getProfile,
  updateProfile: mockProfileServiceMethods.updateProfile,
  completeOnboardingStep: mockProfileServiceMethods.completeOnboardingStep,
  getOnboardingStatus: mockProfileServiceMethods.getOnboardingStatus,
  skipOnboardingStep: mockProfileServiceMethods.skipOnboardingStep,
  resetOnboarding: mockProfileServiceMethods.resetOnboarding,
  gusLookupByNip: mockProfileServiceMethods.gusLookupByNip,
  gusLookupByRegon: mockProfileServiceMethods.gusLookupByRegon,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  userProfile: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  onboardingProgress: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// ==========================================================================
// TEST SUITE
// ==========================================================================

describe('Profile Router', () => {
  // UUIDs
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const PROFILE_ID = '550e8400-e29b-41d4-a716-446655440050';
  const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655449999';

  // Test data
  const baseProfile = {
    id: PROFILE_ID,
    userId: TEST_USER_ID,
    firstName: 'Jan',
    lastName: 'Kowalski',
    phone: '+48123456789',
    dateOfBirth: '1990-01-15',
    accountType: 'INDIVIDUAL' as const,
    companyName: null,
    nip: null,
    regon: null,
    krs: null,
    taxOffice: null,
    street: 'Marszałkowska',
    buildingNumber: '100',
    apartmentNumber: '5A',
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
    completionPercentage: 75,
    completionStatus: 'IN_PROGRESS' as const,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };

  const baseOnboardingStatus = {
    currentStep: 'PREFERENCES' as const,
    completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO'] as const,
    skippedSteps: [] as const,
    completionPercentage: 75,
    status: 'IN_PROGRESS' as const,
    nextStep: 'PREFERENCES' as const,
    isComplete: false,
  };

  const gusCompanyData = {
    found: true,
    companyName: 'Testowa Firma Sp. z o.o.',
    nip: '5213017228',
    regon: '123456789',
    krs: '0000123456',
    street: 'Marszałkowska',
    buildingNumber: '100',
    apartmentNumber: '5A',
    city: 'Warszawa',
    postalCode: '00-001',
    voivodeship: 'mazowieckie',
    country: 'PL',
    legalForm: 'Spółka z ograniczoną odpowiedzialnością',
    pkdMain: '62.01.Z',
    pkdMainDescription: 'Działalność związana z oprogramowaniem',
    registrationDate: '2020-01-01',
    isActive: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mocks for Redis
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);

    // Default mocks for Prisma
    mockPrisma.authAuditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
      status: 'ACTIVE',
      isEmailVerified: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // CONTEXT HELPERS
  // ===========================================================================

  function createUserContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer user-token',
        },
        url: '/api/trpc/aim.profile',
        method: 'POST',
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

  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/aim.profile',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ===========================================================================
  // GET PROFILE
  // ===========================================================================

  describe('getProfile', () => {
    it('should return user profile for authenticated user', async () => {
      mocks.getProfile.mockResolvedValue(baseProfile);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.getProfile({});

      expect(result).toEqual(baseProfile);
      expect(mocks.getProfile).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should return profile for specific user when userId provided', async () => {
      const targetUserId = '550e8400-e29b-41d4-a716-446655440099';
      mocks.getProfile.mockResolvedValue({ ...baseProfile, userId: targetUserId });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.getProfile({ userId: targetUserId });

      expect(mocks.getProfile).toHaveBeenCalledWith(targetUserId);
    });

    it('should throw NOT_FOUND when profile does not exist', async () => {
      mocks.getProfile.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.getProfile({})
      ).rejects.toThrow('Profile not found');
    });
  });

  // ===========================================================================
  // UPDATE PROFILE
  // ===========================================================================

  describe('updateProfile', () => {
    it('should update personal info', async () => {
      mocks.updateProfile.mockResolvedValue({
        success: true,
        profile: {
          ...baseProfile,
          firstName: 'Piotr',
          lastName: 'Nowak',
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.updateProfile({
        personalInfo: {
          firstName: 'Piotr',
          lastName: 'Nowak',
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.firstName).toBe('Piotr');
      expect(result.profile.lastName).toBe('Nowak');
    });

    it('should update company info', async () => {
      mocks.updateProfile.mockResolvedValue({
        success: true,
        profile: {
          ...baseProfile,
          accountType: 'COMPANY',
          companyName: 'Firma Test Sp. z o.o.',
          nip: '5213017228',
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.updateProfile({
        companyInfo: {
          accountType: 'COMPANY',
          companyName: 'Firma Test Sp. z o.o.',
          nip: '5213017228',
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.accountType).toBe('COMPANY');
      expect(result.profile.companyName).toBe('Firma Test Sp. z o.o.');
    });

    it('should update address info', async () => {
      mocks.updateProfile.mockResolvedValue({
        success: true,
        profile: {
          ...baseProfile,
          city: 'Kraków',
          postalCode: '30-001',
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.updateProfile({
        addressInfo: {
          city: 'Kraków',
          postalCode: '30-001',
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.city).toBe('Kraków');
    });

    it('should update preferences', async () => {
      mocks.updateProfile.mockResolvedValue({
        success: true,
        profile: {
          ...baseProfile,
          language: 'en',
          emailNotifications: false,
        },
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.updateProfile({
        preferences: {
          language: 'en',
          emailNotifications: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.profile.language).toBe('en');
    });

    it('should reject invalid NIP format', async () => {
      mocks.updateProfile.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid NIP format' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.updateProfile({
          companyInfo: {
            accountType: 'COMPANY',
            nip: 'invalid-nip',
          },
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // COMPLETE ONBOARDING STEP
  // ===========================================================================

  describe('completeOnboardingStep', () => {
    it('should complete personal info step', async () => {
      mocks.completeOnboardingStep.mockResolvedValue({
        success: true,
        step: 'PERSONAL_INFO',
        completedSteps: ['PERSONAL_INFO'],
        nextStep: 'COMPANY_INFO',
        completionPercentage: 25,
        isComplete: false,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.completeOnboardingStep({
        step: 'PERSONAL_INFO',
        data: {
          firstName: 'Jan',
          lastName: 'Kowalski',
        },
      });

      expect(result.success).toBe(true);
      expect(result.step).toBe('PERSONAL_INFO');
      expect(result.nextStep).toBe('COMPANY_INFO');
      expect(result.completionPercentage).toBe(25);
    });

    it('should complete company info step', async () => {
      mocks.completeOnboardingStep.mockResolvedValue({
        success: true,
        step: 'COMPANY_INFO',
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO'],
        nextStep: 'ADDRESS_INFO',
        completionPercentage: 50,
        isComplete: false,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.completeOnboardingStep({
        step: 'COMPANY_INFO',
        data: {
          accountType: 'INDIVIDUAL',
        },
      });

      expect(result.success).toBe(true);
      expect(result.step).toBe('COMPANY_INFO');
    });

    it('should complete address info step', async () => {
      mocks.completeOnboardingStep.mockResolvedValue({
        success: true,
        step: 'ADDRESS_INFO',
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO'],
        nextStep: 'PREFERENCES',
        completionPercentage: 75,
        isComplete: false,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.completeOnboardingStep({
        step: 'ADDRESS_INFO',
        data: {
          city: 'Warszawa',
          postalCode: '00-001',
        },
      });

      expect(result.success).toBe(true);
      expect(result.step).toBe('ADDRESS_INFO');
    });

    it('should complete preferences step and finish onboarding', async () => {
      mocks.completeOnboardingStep.mockResolvedValue({
        success: true,
        step: 'PREFERENCES',
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO', 'PREFERENCES'],
        nextStep: null,
        completionPercentage: 100,
        isComplete: true,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.completeOnboardingStep({
        step: 'PREFERENCES',
        data: {
          language: 'pl',
          termsAccepted: true,
          privacyPolicyAccepted: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(result.completionPercentage).toBe(100);
    });

    it('should reject completing already completed step', async () => {
      mocks.completeOnboardingStep.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Step already completed' })
      );

      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.completeOnboardingStep({
          step: 'PERSONAL_INFO',
          data: {
            firstName: 'Jan',
            lastName: 'Kowalski',
          },
        })
      ).rejects.toThrow('Step already completed');
    });
  });

  // ===========================================================================
  // GET ONBOARDING STATUS
  // ===========================================================================

  describe('getOnboardingStatus', () => {
    it('should return current onboarding status', async () => {
      mocks.getOnboardingStatus.mockResolvedValue(baseOnboardingStatus);

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.getOnboardingStatus({});

      expect(result.currentStep).toBe('PREFERENCES');
      expect(result.completedSteps).toEqual(['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO']);
      expect(result.completionPercentage).toBe(75);
    });

    it('should return not started status for new users', async () => {
      mocks.getOnboardingStatus.mockResolvedValue({
        currentStep: 'PERSONAL_INFO',
        completedSteps: [],
        skippedSteps: [],
        completionPercentage: 0,
        status: 'NOT_STARTED',
        nextStep: 'PERSONAL_INFO',
        isComplete: false,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.getOnboardingStatus({});

      expect(result.status).toBe('NOT_STARTED');
      expect(result.completionPercentage).toBe(0);
    });

    it('should return completed status when all steps done', async () => {
      mocks.getOnboardingStatus.mockResolvedValue({
        currentStep: null,
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO', 'ADDRESS_INFO', 'PREFERENCES'],
        skippedSteps: [],
        completionPercentage: 100,
        status: 'COMPLETED',
        nextStep: null,
        isComplete: true,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.getOnboardingStatus({});

      expect(result.status).toBe('COMPLETED');
      expect(result.isComplete).toBe(true);
    });
  });

  // ===========================================================================
  // SKIP ONBOARDING STEP
  // ===========================================================================

  describe('skipOnboardingStep', () => {
    it('should skip optional step (COMPANY_INFO)', async () => {
      mocks.skipOnboardingStep.mockResolvedValue({
        currentStep: 'ADDRESS_INFO',
        completedSteps: ['PERSONAL_INFO'],
        skippedSteps: ['COMPANY_INFO'],
        completionPercentage: 50,
        status: 'IN_PROGRESS',
        nextStep: 'ADDRESS_INFO',
        isComplete: false,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.skipOnboardingStep({
        step: 'COMPANY_INFO',
      });

      expect(result.skippedSteps).toContain('COMPANY_INFO');
      expect(result.nextStep).toBe('ADDRESS_INFO');
    });

    it('should skip optional step (ADDRESS_INFO)', async () => {
      mocks.skipOnboardingStep.mockResolvedValue({
        currentStep: 'PREFERENCES',
        completedSteps: ['PERSONAL_INFO', 'COMPANY_INFO'],
        skippedSteps: ['ADDRESS_INFO'],
        completionPercentage: 75,
        status: 'IN_PROGRESS',
        nextStep: 'PREFERENCES',
        isComplete: false,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.skipOnboardingStep({
        step: 'ADDRESS_INFO',
      });

      expect(result.skippedSteps).toContain('ADDRESS_INFO');
    });

    it('should reject skipping required step (PERSONAL_INFO)', async () => {
      mocks.skipOnboardingStep.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot skip required step' })
      );

      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.skipOnboardingStep({
          step: 'PERSONAL_INFO',
        })
      ).rejects.toThrow('Cannot skip required step');
    });

    it('should reject skipping required step (PREFERENCES)', async () => {
      mocks.skipOnboardingStep.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot skip required step' })
      );

      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.skipOnboardingStep({
          step: 'PREFERENCES',
        })
      ).rejects.toThrow('Cannot skip required step');
    });
  });

  // ===========================================================================
  // RESET ONBOARDING
  // ===========================================================================

  describe('resetOnboarding', () => {
    it('should reset onboarding progress', async () => {
      mocks.resetOnboarding.mockResolvedValue({
        currentStep: 'PERSONAL_INFO',
        completedSteps: [],
        skippedSteps: [],
        completionPercentage: 0,
        status: 'NOT_STARTED',
        nextStep: 'PERSONAL_INFO',
        isComplete: false,
      });

      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.resetOnboarding({});

      expect(result.status).toBe('NOT_STARTED');
      expect(result.completedSteps).toEqual([]);
      expect(result.skippedSteps).toEqual([]);
      expect(result.completionPercentage).toBe(0);
    });

    it('should throw error when reset fails', async () => {
      mocks.resetOnboarding.mockRejectedValue(
        new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Reset failed' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.resetOnboarding({})
      ).rejects.toThrow('Reset failed');
    });
  });

  // ===========================================================================
  // GUS LOOKUP BY NIP
  // ===========================================================================

  describe('gusLookupByNip', () => {
    it('should return company data for valid NIP', async () => {
      mocks.gusLookupByNip.mockResolvedValue(gusCompanyData);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.gusLookupByNip({
        nip: '5213017228',
      });

      expect(result.found).toBe(true);
      expect(result.companyName).toBe('Testowa Firma Sp. z o.o.');
      expect(result.nip).toBe('5213017228');
    });

    it('should return not found for non-existent NIP', async () => {
      mocks.gusLookupByNip.mockResolvedValue({
        found: false,
        companyName: null,
        nip: null,
        regon: null,
        krs: null,
        street: null,
        buildingNumber: null,
        apartmentNumber: null,
        city: null,
        postalCode: null,
        voivodeship: null,
        country: null,
        legalForm: null,
        pkdMain: null,
        pkdMainDescription: null,
        registrationDate: null,
        isActive: null,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.gusLookupByNip({
        nip: '0000000000',
      });

      expect(result.found).toBe(false);
      expect(result.companyName).toBeNull();
    });

    it('should validate NIP format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.gusLookupByNip({
          nip: 'invalid',
        })
      ).rejects.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      mocks.gusLookupByNip.mockRejectedValue(
        new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'GUS API unavailable' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.gusLookupByNip({
          nip: '5213017228',
        })
      ).rejects.toThrow('GUS API unavailable');
    });
  });

  // ===========================================================================
  // GUS LOOKUP BY REGON
  // ===========================================================================

  describe('gusLookupByRegon', () => {
    it('should return company data for valid REGON (9 digits)', async () => {
      // Use valid REGON with correct checksum: 123456785
      mocks.gusLookupByRegon.mockResolvedValue({ ...gusCompanyData, regon: '123456785' });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.gusLookupByRegon({
        regon: '123456785',
      });

      expect(result.found).toBe(true);
      expect(result.companyName).toBe('Testowa Firma Sp. z o.o.');
      expect(result.regon).toBe('123456785');
    });

    it('should return company data for valid REGON (14 digits)', async () => {
      // Use valid 14-digit REGON with correct checksum: 12345678512347
      mocks.gusLookupByRegon.mockResolvedValue({
        ...gusCompanyData,
        regon: '12345678512347',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.gusLookupByRegon({
        regon: '12345678512347',
      });

      expect(result.found).toBe(true);
      expect(result.regon).toBe('12345678512347');
    });

    it('should return not found for non-existent REGON', async () => {
      mocks.gusLookupByRegon.mockResolvedValue({
        found: false,
        companyName: null,
        nip: null,
        regon: null,
        krs: null,
        street: null,
        buildingNumber: null,
        apartmentNumber: null,
        city: null,
        postalCode: null,
        voivodeship: null,
        country: null,
        legalForm: null,
        pkdMain: null,
        pkdMainDescription: null,
        registrationDate: null,
        isActive: null,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.aim.profile.gusLookupByRegon({
        regon: '000000000',
      });

      expect(result.found).toBe(false);
    });

    it('should validate REGON format', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.gusLookupByRegon({
          regon: 'invalid',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // AUTHENTICATION REQUIREMENTS
  // ===========================================================================

  describe('authentication', () => {
    it('should require authentication for all profile operations', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.profile.getProfile({})
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mocks.getProfile.mockRejectedValue(new Error('Database connection failed'));
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.getProfile({})
      ).rejects.toThrow();
    });

    it('should handle validation errors', async () => {
      // Invalid postal code format
      mocks.updateProfile.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid postal code format' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.updateProfile({
          addressInfo: {
            city: 'Warszawa',
            postalCode: 'invalid',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent update conflicts', async () => {
      mocks.updateProfile.mockRejectedValue(
        new TRPCError({ code: 'CONFLICT', message: 'Profile was modified by another request' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.aim.profile.updateProfile({
          personalInfo: {
            firstName: 'Jan',
            lastName: 'Kowalski',
          },
        })
      ).rejects.toThrow('Profile was modified by another request');
    });
  });
});
