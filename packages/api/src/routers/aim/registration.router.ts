import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, publicProcedure } from '../../trpc';
import { registrationInputSchema, emailVerificationSchema } from '@ksiegowacrm/shared';
import { RegistrationService } from '../../services/aim/registration.service';
import { RateLimiter, rateLimitConfigs } from '../../utils/rate-limiter';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Registration Router (AIM-001)
 * Handles user registration, email verification
 */
export const registrationRouter = router({
  /**
   * Register a new user
   */
  register: publicProcedure
    .input(registrationInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

      // Initialize services
      const rateLimiter = new RateLimiter(redis, rateLimitConfigs.registration);
      const auditLogger = new AuditLogger(prisma);
      const registrationService = new RegistrationService(prisma, redis, auditLogger);

      // Check rate limit by IP
      const rateLimit = await rateLimiter.check(ipAddress);
      if (!rateLimit.allowed) {
        await auditLogger.logSecurityAlert({
          eventType: 'RATE_LIMIT_EXCEEDED',
          ipAddress,
          userAgent,
          metadata: {
            action: 'registration',
            resetAt: rateLimit.resetAt,
          },
          correlationId,
        });

        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zbyt wiele prób rejestracji. Spróbuj ponownie później.',
        });
      }

      try {
        const result = await registrationService.register({
          email: input.email,
          password: input.password,
          ipAddress,
          userAgent,
          correlationId,
        });

        return {
          success: true,
          message: 'Rejestracja zakończona pomyślnie. Sprawdź swoją skrzynkę email.',
          userId: result.userId,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas rejestracji',
        });
      }
    }),

  /**
   * Verify email address
   */
  verifyEmail: publicProcedure
    .input(emailVerificationSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const registrationService = new RegistrationService(prisma, redis, auditLogger);

      try {
        const result = await registrationService.verifyEmail({
          token: input.token,
          ipAddress,
          userAgent,
          correlationId,
        });

        return {
          success: true,
          message: 'Email został zweryfikowany. Możesz się teraz zalogować.',
          userId: result.userId,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas weryfikacji email',
        });
      }
    }),

  /**
   * Resend verification email
   */
  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

      // Rate limit resend requests
      const rateLimiter = new RateLimiter(redis, rateLimitConfigs.emailVerification);
      const rateLimit = await rateLimiter.check(input.email);

      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zbyt wiele prób. Spróbuj ponownie później.',
        });
      }

      const auditLogger = new AuditLogger(prisma);
      const registrationService = new RegistrationService(prisma, redis, auditLogger);

      try {
        await registrationService.resendVerificationEmail({
          email: input.email,
          ipAddress,
          userAgent,
          correlationId,
        });

        // Always return success to prevent email enumeration
        return {
          success: true,
          message: 'Jeśli konto istnieje, wysłaliśmy nowy link weryfikacyjny.',
        };
      } catch {
        // Return success even on error to prevent email enumeration
        return {
          success: true,
          message: 'Jeśli konto istnieje, wysłaliśmy nowy link weryfikacyjny.',
        };
      }
    }),

  /**
   * Check if email is available (for real-time form validation)
   * Returns generic response to prevent email enumeration
   */
  checkEmailAvailability: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input, ctx }) => {
      const { prisma } = ctx;

      // Add artificial delay to prevent timing attacks
      const minDelay = 200;
      const startTime = Date.now();

      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: { id: true },
      });

      // Ensure minimum response time
      const elapsed = Date.now() - startTime;
      if (elapsed < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
      }

      return {
        available: !user,
      };
    }),
});

export type RegistrationRouter = typeof registrationRouter;
