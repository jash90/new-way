import { router, protectedProcedure } from '../../trpc';
import {
  getProfileSchema,
  updateProfileSchema,
  completeOnboardingStepSchema,
  getOnboardingStatusSchema,
  skipOnboardingStepSchema,
  resetOnboardingSchema,
  gusLookupByNipSchema,
  gusLookupByRegonSchema,
} from '@ksiegowacrm/shared';
import { ProfileService } from '../../services/aim/profile.service';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Profile Router (AIM-002)
 * Handles user profile management and onboarding operations
 */
export const profileRouter = router({
  // =========================================================================
  // GET PROFILE
  // =========================================================================

  /**
   * Get user profile
   * Returns full profile data including personal info, company info, address, and preferences
   */
  getProfile: protectedProcedure
    .input(getProfileSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      const userId = input.userId || session!.userId;
      return profileService.getProfile(userId);
    }),

  // =========================================================================
  // UPDATE PROFILE
  // =========================================================================

  /**
   * Update user profile
   * Allows updating personal info, company info, address info, and preferences
   */
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      return profileService.updateProfile(session!.userId, input);
    }),

  // =========================================================================
  // COMPLETE ONBOARDING STEP
  // =========================================================================

  /**
   * Complete an onboarding step
   * Steps: PERSONAL_INFO -> COMPANY_INFO -> ADDRESS_INFO -> PREFERENCES
   */
  completeOnboardingStep: protectedProcedure
    .input(completeOnboardingStepSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      return profileService.completeOnboardingStep(session!.userId, input);
    }),

  // =========================================================================
  // GET ONBOARDING STATUS
  // =========================================================================

  /**
   * Get onboarding status
   * Returns current step, completed steps, skipped steps, and completion percentage
   */
  getOnboardingStatus: protectedProcedure
    .input(getOnboardingStatusSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      const userId = input.userId || session!.userId;
      return profileService.getOnboardingStatus(userId);
    }),

  // =========================================================================
  // SKIP ONBOARDING STEP
  // =========================================================================

  /**
   * Skip an optional onboarding step
   * Only COMPANY_INFO and ADDRESS_INFO can be skipped
   * PERSONAL_INFO and PREFERENCES are required
   */
  skipOnboardingStep: protectedProcedure
    .input(skipOnboardingStepSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      return profileService.skipOnboardingStep(session!.userId, input);
    }),

  // =========================================================================
  // RESET ONBOARDING
  // =========================================================================

  /**
   * Reset onboarding progress
   * Clears all completed and skipped steps, starts fresh
   */
  resetOnboarding: protectedProcedure
    .input(resetOnboardingSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      const userId = input.userId || session!.userId;
      return profileService.resetOnboarding(userId);
    }),

  // =========================================================================
  // GUS LOOKUP BY NIP
  // =========================================================================

  /**
   * Look up company data from GUS REGON API by NIP
   * Returns company info including address, legal form, PKD codes
   */
  gusLookupByNip: protectedProcedure
    .input(gusLookupByNipSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      return profileService.gusLookupByNip(input, session!.userId);
    }),

  // =========================================================================
  // GUS LOOKUP BY REGON
  // =========================================================================

  /**
   * Look up company data from GUS REGON API by REGON
   * Supports both 9-digit and 14-digit REGON numbers
   */
  gusLookupByRegon: protectedProcedure
    .input(gusLookupByRegonSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const profileService = new ProfileService(prisma, redis, auditLogger);

      return profileService.gusLookupByRegon(input, session!.userId);
    }),
});

export type ProfileRouter = typeof profileRouter;
