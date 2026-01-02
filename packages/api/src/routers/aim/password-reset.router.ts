import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, publicProcedure } from '../../trpc';
import {
  passwordResetRequestSchema,
  passwordResetSchema,
} from '@ksiegowacrm/shared';
import { PasswordResetService } from '../../services/aim/password-reset.service';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Validate token schema
 */
const validateTokenSchema = z.object({
  token: z.string().min(64, 'Nieprawidłowy token').max(64, 'Nieprawidłowy token'),
});

/**
 * Password Reset Router (AIM-004)
 * Handles password reset request, password change, and token validation
 *
 * Security features:
 * - Email enumeration prevention (same response for existing/non-existing)
 * - Timing attack prevention (consistent response time)
 * - Token security (64-char, SHA-256 stored, 1-hour expiry)
 * - Password history check (last 5 passwords)
 * - Session invalidation after password change
 */
export const passwordResetRouter = router({
  /**
   * Request password reset
   * Always returns success to prevent email enumeration
   */
  requestReset: publicProcedure
    .input(passwordResetRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const passwordResetService = new PasswordResetService(
        prisma,
        redis,
        auditLogger
      );

      try {
        const result = await passwordResetService.requestPasswordReset({
          email: input.email, // Schema already normalizes to lowercase
          ipAddress,
          userAgent,
          correlationId,
        });

        return result;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        // Don't expose internal errors - return generic success message
        // to prevent information leakage
        return {
          success: true,
          message: 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła.',
        };
      }
    }),

  /**
   * Reset password with valid token
   * Validates token, checks password history, updates password
   */
  reset: publicProcedure
    .input(passwordResetSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const passwordResetService = new PasswordResetService(
        prisma,
        redis,
        auditLogger
      );

      try {
        const result = await passwordResetService.resetPassword({
          token: input.token,
          password: input.password,
          ipAddress,
          userAgent,
          correlationId,
        });

        return result;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas resetowania hasła.',
        });
      }
    }),

  /**
   * Validate reset token without using it
   * Used to check if token is valid before showing password reset form
   */
  validateToken: publicProcedure
    .input(validateTokenSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const passwordResetService = new PasswordResetService(
        prisma,
        redis,
        auditLogger
      );

      const result = await passwordResetService.validateResetToken(input.token);

      return result;
    }),
});

export type PasswordResetRouter = typeof passwordResetRouter;
