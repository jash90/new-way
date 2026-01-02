import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  type UpdateProfileInput,
  type CompleteOnboardingStepInput,
  type GusLookupByNipInput,
  type GusLookupByRegonInput,
  type SkipOnboardingStepInput,
  type OnboardingStep,
  type ProfileOutput,
  type OnboardingStatusOutput,
  type GusCompanyDataOutput,
  type ProfileUpdateResult,
  type OnboardingStepResult,
} from '@ksiegowacrm/shared';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Profile Service (AIM-007)
 *
 * TODO: This service requires the following Prisma schema updates:
 *
 * 1. OnboardingProgress model - for tracking multi-step onboarding
 *    - userId, completedSteps[], skippedSteps[], currentStep, isComplete
 *
 * 2. UserProfile fields - extended profile fields:
 *    - country, city, postalCode, voivodeship, street, buildingNumber, apartmentNumber
 *    - dateOfBirth, accountType, krs, taxOffice
 *    - language, currency, dateFormat (currently only has locale)
 *    - emailNotifications, smsNotifications, marketingConsent
 *    - termsAccepted, privacyPolicyAccepted
 *
 * Until these schema changes are made, complex onboarding methods will throw NotImplementedError.
 */

/**
 * Error thrown when a feature requires missing Prisma models
 */
class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model which is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

// Onboarding steps in order
const ONBOARDING_STEPS: OnboardingStep[] = [
  'PERSONAL_INFO',
  'COMPANY_INFO',
  'ADDRESS_INFO',
  'PREFERENCES',
];

// Steps that cannot be skipped (reserved for future use)
const _REQUIRED_STEPS: OnboardingStep[] = ['PERSONAL_INFO', 'PREFERENCES'];
void _REQUIRED_STEPS; // Suppress unused warning

// Cache TTL in seconds
const PROFILE_CACHE_TTL = 300; // 5 minutes
const GUS_CACHE_TTL = 86400; // 24 hours

// GUS API configuration (placeholder - would need real API credentials)
const GUS_API_URL = process.env.GUS_API_URL || 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';

export class ProfileService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger
  ) {
    // Suppress unused warnings for reserved methods
    void this._suppressUnusedWarnings;
  }

  // ===========================================================================
  // GET PROFILE
  // ===========================================================================

  async getProfile(userId: string): Promise<ProfileOutput> {
    // Try to get from cache first
    const cacheKey = `profile:${userId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const profile = JSON.parse(cached);
        const onboardingStatus = await this.getOnboardingStatus(userId);
        return this.formatProfileOutput(profile, onboardingStatus);
      }
    } catch {
      // Cache miss or error, continue to database
    }

    const profile = await this.prisma.userProfile.findFirst({
      where: { userId },
    });

    if (!profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Profil nie został znaleziony',
      });
    }

    // Cache the profile
    try {
      await this.redis.setex(cacheKey, PROFILE_CACHE_TTL, JSON.stringify(profile));
    } catch {
      // Ignore cache errors
    }

    const onboardingStatus = await this.getOnboardingStatus(userId);
    return this.formatProfileOutput(profile, onboardingStatus);
  }

  // ===========================================================================
  // UPDATE PROFILE
  // ===========================================================================

  async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<ProfileUpdateResult> {
    let profile = await this.prisma.userProfile.findFirst({
      where: { userId },
    });

    const updateData: Record<string, unknown> = {};

    // Personal info
    if (input.personalInfo) {
      if (input.personalInfo.firstName) updateData.firstName = input.personalInfo.firstName;
      if (input.personalInfo.lastName) updateData.lastName = input.personalInfo.lastName;
      if (input.personalInfo.phone) updateData.phone = input.personalInfo.phone;
      if (input.personalInfo.dateOfBirth) updateData.dateOfBirth = input.personalInfo.dateOfBirth;
    }

    // Company info
    if (input.companyInfo) {
      if (input.companyInfo.accountType) updateData.accountType = input.companyInfo.accountType;
      if (input.companyInfo.companyName) updateData.companyName = input.companyInfo.companyName;
      if (input.companyInfo.nip) updateData.nip = input.companyInfo.nip;
      if (input.companyInfo.regon) updateData.regon = input.companyInfo.regon;
      if (input.companyInfo.krs) updateData.krs = input.companyInfo.krs;
      if (input.companyInfo.taxOffice) updateData.taxOffice = input.companyInfo.taxOffice;
    }

    // Address info
    if (input.addressInfo) {
      if (input.addressInfo.street) updateData.street = input.addressInfo.street;
      if (input.addressInfo.buildingNumber) updateData.buildingNumber = input.addressInfo.buildingNumber;
      if (input.addressInfo.apartmentNumber) updateData.apartmentNumber = input.addressInfo.apartmentNumber;
      if (input.addressInfo.city) updateData.city = input.addressInfo.city;
      if (input.addressInfo.postalCode) updateData.postalCode = input.addressInfo.postalCode;
      if (input.addressInfo.voivodeship) updateData.voivodeship = input.addressInfo.voivodeship;
      if (input.addressInfo.country) updateData.country = input.addressInfo.country;
    }

    // Preferences
    if (input.preferences) {
      if (input.preferences.language) updateData.language = input.preferences.language;
      if (input.preferences.timezone) updateData.timezone = input.preferences.timezone;
      if (input.preferences.currency) updateData.currency = input.preferences.currency;
      if (input.preferences.dateFormat) updateData.dateFormat = input.preferences.dateFormat;
      if (input.preferences.emailNotifications !== undefined)
        updateData.emailNotifications = input.preferences.emailNotifications;
      if (input.preferences.smsNotifications !== undefined)
        updateData.smsNotifications = input.preferences.smsNotifications;
      if (input.preferences.marketingConsent !== undefined)
        updateData.marketingConsent = input.preferences.marketingConsent;
      if (input.preferences.termsAccepted !== undefined)
        updateData.termsAccepted = input.preferences.termsAccepted;
      if (input.preferences.privacyPolicyAccepted !== undefined)
        updateData.privacyPolicyAccepted = input.preferences.privacyPolicyAccepted;
    }

    if (profile) {
      // Update existing profile
      profile = await this.prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new profile with basic fields (schema has limited fields)
      // Note: Many fields from updateData are not in the schema yet
      profile = await this.prisma.userProfile.create({
        data: {
          userId,
          firstName: updateData.firstName as string | undefined,
          lastName: updateData.lastName as string | undefined,
          phone: updateData.phone as string | undefined,
          companyName: updateData.companyName as string | undefined,
          nip: updateData.nip as string | undefined,
          regon: updateData.regon as string | undefined,
          locale: (updateData.language as string) || 'pl',
          timezone: (updateData.timezone as string) || 'Europe/Warsaw',
          onboardingStep: 0,
        },
      });

      // Note: OnboardingProgress model doesn't exist in schema yet
      // Onboarding is tracked via the simple onboardingStep Int field
    }

    // Invalidate cache
    await this.redis.del(`profile:${userId}`);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'PROFILE_UPDATED',
      userId,
      metadata: {
        updatedFields: Object.keys(updateData),
      },
    });

    const onboardingStatus = await this.getOnboardingStatus(userId);
    return {
      success: true,
      profile: this.formatProfileOutput(profile, onboardingStatus),
    };
  }

  // ===========================================================================
  // COMPLETE ONBOARDING STEP
  // ===========================================================================

  /**
   * Complete an onboarding step
   *
   * NOTE: This method requires the OnboardingProgress Prisma model and extended
   * UserProfile fields that are not yet implemented in the schema.
   *
   * Current schema only supports simple onboardingStep (Int) tracking.
   * For full multi-step onboarding, schema needs:
   * - OnboardingProgress model with completedSteps[], skippedSteps[], currentStep, isComplete
   * - Extended UserProfile fields for address, preferences, etc.
   */
  async completeOnboardingStep(
    userId: string,
    input: CompleteOnboardingStepInput
  ): Promise<OnboardingStepResult> {
    // Suppress unused parameter warnings - will be used when schema is updated
    void userId;
    void input;

    throw new NotImplementedError(
      'completeOnboardingStep',
      'OnboardingProgress model and extended UserProfile fields'
    );
  }

  // ===========================================================================
  // GET ONBOARDING STATUS
  // ===========================================================================

  /**
   * Get onboarding status for a user
   *
   * NOTE: Uses simplified onboarding based on current schema (onboardingStep Int field).
   * Full multi-step onboarding requires OnboardingProgress model.
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatusOutput> {
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId },
    });

    if (!profile) {
      return {
        currentStep: 'PERSONAL_INFO',
        completedSteps: [],
        skippedSteps: [],
        completionPercentage: 0,
        status: 'NOT_STARTED',
        nextStep: 'PERSONAL_INFO',
        isComplete: false,
      };
    }

    // Simple logic based on onboardingStep Int field
    const step = profile.onboardingStep;
    const isComplete = profile.onboardingCompletedAt !== null || step >= ONBOARDING_STEPS.length;
    const completionPercentage = Math.min(Math.round((step / ONBOARDING_STEPS.length) * 100), 100);

    // Derive completed steps from the step number
    const completedSteps: OnboardingStep[] = ONBOARDING_STEPS.slice(0, step);
    const currentStep: OnboardingStep | null = isComplete ? null : (ONBOARDING_STEPS[step] ?? null);

    let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    if (isComplete) {
      status = 'COMPLETED';
    } else if (step > 0) {
      status = 'IN_PROGRESS';
    } else {
      status = 'NOT_STARTED';
    }

    return {
      currentStep,
      completedSteps,
      skippedSteps: [],
      completionPercentage,
      status,
      nextStep: currentStep,
      isComplete,
    };
  }

  // ===========================================================================
  // SKIP ONBOARDING STEP
  // ===========================================================================

  /**
   * Skip an onboarding step
   *
   * NOTE: This method requires the OnboardingProgress Prisma model
   * which is not yet implemented in the schema.
   */
  async skipOnboardingStep(
    userId: string,
    input: SkipOnboardingStepInput
  ): Promise<OnboardingStepResult> {
    // Suppress unused parameter warnings
    void userId;
    void input;

    throw new NotImplementedError(
      'skipOnboardingStep',
      'OnboardingProgress model'
    );
  }

  // ===========================================================================
  // RESET ONBOARDING
  // ===========================================================================

  /**
   * Reset onboarding progress for a user
   *
   * Uses simplified implementation based on current schema (onboardingStep Int field).
   */
  async resetOnboarding(userId: string): Promise<OnboardingStatusOutput> {
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId },
    });

    if (profile) {
      await this.prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          onboardingStep: 0,
          onboardingCompletedAt: null,
          updatedAt: new Date(),
        },
      });
    }

    await this.auditLogger.log({
      eventType: 'ONBOARDING_RESET',
      userId,
      metadata: {},
    });

    return {
      currentStep: 'PERSONAL_INFO',
      completedSteps: [],
      skippedSteps: [],
      completionPercentage: 0,
      status: 'NOT_STARTED',
      nextStep: 'PERSONAL_INFO',
      isComplete: false,
    };
  }

  // ===========================================================================
  // GUS LOOKUP BY NIP
  // ===========================================================================

  async gusLookupByNip(
    input: GusLookupByNipInput,
    userId?: string
  ): Promise<GusCompanyDataOutput> {
    const { nip } = input;
    const cacheKey = `gus:nip:${nip}`;

    // Try cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss or error
    }

    try {
      // Call GUS API
      const response = await fetch(`${GUS_API_URL}/lookup/nip/${nip}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return this.getEmptyGusResult();
      }

      const data = await response.json();

      if (!data.found) {
        return this.getEmptyGusResult();
      }

      // Normalize the result to ensure null values
      const result: GusCompanyDataOutput = {
        found: true,
        companyName: data.companyName ?? null,
        nip: data.nip ?? null,
        regon: data.regon ?? null,
        krs: data.krs ?? null,
        street: data.street ?? null,
        buildingNumber: data.buildingNumber ?? null,
        apartmentNumber: data.apartmentNumber ?? null,
        city: data.city ?? null,
        postalCode: data.postalCode ?? null,
        voivodeship: data.voivodeship ?? null,
        country: data.country ?? null,
        legalForm: data.legalForm ?? null,
        pkdMain: data.pkdMain ?? null,
        pkdMainDescription: data.pkdMainDescription ?? null,
        registrationDate: data.registrationDate ?? null,
        isActive: data.isActive ?? null,
      };

      // Cache the result
      try {
        await this.redis.setex(cacheKey, GUS_CACHE_TTL, JSON.stringify(result));
      } catch {
        // Ignore cache errors
      }

      // Log audit event if user is provided
      if (userId) {
        await this.auditLogger.log({
          eventType: 'GUS_LOOKUP',
          userId,
          metadata: {
            lookupType: 'NIP',
            identifier: nip,
            found: result.found,
          },
        });
      }

      return result;
    } catch {
      // API error - return empty result
      return this.getEmptyGusResult();
    }
  }

  // ===========================================================================
  // GUS LOOKUP BY REGON
  // ===========================================================================

  async gusLookupByRegon(
    input: GusLookupByRegonInput,
    userId?: string
  ): Promise<GusCompanyDataOutput> {
    const { regon } = input;
    const cacheKey = `gus:regon:${regon}`;

    // Try cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss or error
    }

    try {
      // Call GUS API
      const response = await fetch(`${GUS_API_URL}/lookup/regon/${regon}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return this.getEmptyGusResult();
      }

      const data = await response.json();

      if (!data.found) {
        return this.getEmptyGusResult();
      }

      // Normalize the result to ensure null values
      const result: GusCompanyDataOutput = {
        found: true,
        companyName: data.companyName ?? null,
        nip: data.nip ?? null,
        regon: data.regon ?? null,
        krs: data.krs ?? null,
        street: data.street ?? null,
        buildingNumber: data.buildingNumber ?? null,
        apartmentNumber: data.apartmentNumber ?? null,
        city: data.city ?? null,
        postalCode: data.postalCode ?? null,
        voivodeship: data.voivodeship ?? null,
        country: data.country ?? null,
        legalForm: data.legalForm ?? null,
        pkdMain: data.pkdMain ?? null,
        pkdMainDescription: data.pkdMainDescription ?? null,
        registrationDate: data.registrationDate ?? null,
        isActive: data.isActive ?? null,
      };

      // Cache the result
      try {
        await this.redis.setex(cacheKey, GUS_CACHE_TTL, JSON.stringify(result));
      } catch {
        // Ignore cache errors
      }

      // Log audit event if user is provided
      if (userId) {
        await this.auditLogger.log({
          eventType: 'GUS_LOOKUP',
          userId,
          metadata: {
            lookupType: 'REGON',
            identifier: regon,
            found: result.found,
          },
        });
      }

      return result;
    } catch {
      // API error - return empty result
      return this.getEmptyGusResult();
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Get next step index (reserved for future use when OnboardingProgress model is added)
   * @deprecated Will be used when OnboardingProgress model is implemented
   */
  private _getNextStepIndex(
    completedSteps: OnboardingStep[],
    skippedSteps: OnboardingStep[]
  ): number {
    const processedSteps = [...completedSteps, ...skippedSteps];

    for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
      const step = ONBOARDING_STEPS[i];
      if (step && !processedSteps.includes(step)) {
        return i;
      }
    }

    return -1; // All steps completed/skipped
  }

  /**
   * Suppress unused method warning
   */
  private _suppressUnusedWarnings(): void {
    void this._getNextStepIndex;
  }

  private getEmptyGusResult(): GusCompanyDataOutput {
    return {
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
    };
  }

  /**
   * Format profile output
   *
   * NOTE: Many output fields are set to null because the current schema
   * only has basic UserProfile fields. Extended fields will be added
   * when the schema is updated.
   */
  private formatProfileOutput(
    profile: Record<string, unknown>,
    onboardingStatus: OnboardingStatusOutput
  ): ProfileOutput {
    return {
      id: profile.id as string,
      userId: profile.userId as string,
      // Basic fields from current schema
      firstName: (profile.firstName as string) || null,
      lastName: (profile.lastName as string) || null,
      phone: (profile.phone as string) || null,
      companyName: (profile.companyName as string) || null,
      nip: (profile.nip as string) || null,
      regon: (profile.regon as string) || null,
      timezone: (profile.timezone as string) || 'Europe/Warsaw',
      // Fields not in schema yet - return defaults/null
      dateOfBirth: null, // Not in schema
      accountType: null, // Not in schema
      krs: null, // Not in schema
      taxOffice: null, // Not in schema
      street: null, // Not in schema
      buildingNumber: null, // Not in schema
      apartmentNumber: null, // Not in schema
      city: null, // Not in schema
      postalCode: null, // Not in schema
      voivodeship: null, // Not in schema
      country: 'PL', // Default - not in schema
      language: (profile.locale as string) || 'pl', // Schema uses 'locale' instead of 'language'
      currency: 'PLN', // Default - not in schema
      dateFormat: 'DD.MM.YYYY', // Default - not in schema
      emailNotifications: true, // Default - not in schema
      smsNotifications: false, // Default - not in schema
      marketingConsent: false, // Default - not in schema
      termsAccepted: false, // Default - not in schema
      privacyPolicyAccepted: false, // Default - not in schema
      completionPercentage: onboardingStatus.completionPercentage,
      completionStatus: onboardingStatus.status,
      createdAt: profile.createdAt as Date,
      updatedAt: profile.updatedAt as Date,
    };
  }
}
