import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import {
  mfaSetupInitSchema,
  mfaSetupVerifySchema,
  mfaDisableSchema,
  mfaTotpVerifySchema,
  mfaBackupCodeVerifySchema,
  mfaRegenerateBackupCodesSchema,
} from '@ksiegowacrm/shared';
import { MfaService } from '../../services/aim/mfa.service';
import { AuditLogger } from '../../utils/audit-logger';
import { totpService, argon2Service } from '@ksiegowacrm/auth';

/**
 * MFA Router (AIM-009)
 * Handles TOTP Multi-Factor Authentication operations
 */
export const mfaRouter = router({
  // =========================================================================
  // MFA Status & Setup
  // =========================================================================

  /**
   * Get current MFA status for authenticated user
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

    return mfaService.getMfaStatus(session!.userId);
  }),

  /**
   * Initiate MFA setup - returns QR code and setup token
   */
  initiateSetup: protectedProcedure
    .input(mfaSetupInitSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

      try {
        return await mfaService.initiateSetup(session!.userId, input.password);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas inicjowania konfiguracji MFA',
        });
      }
    }),

  /**
   * Verify setup with TOTP code and enable MFA
   */
  verifySetup: protectedProcedure
    .input(mfaSetupVerifySchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

      try {
        return await mfaService.verifySetup(input.setupToken, input.code);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas weryfikacji konfiguracji MFA',
        });
      }
    }),

  /**
   * Disable MFA for the user
   */
  disable: protectedProcedure
    .input(mfaDisableSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

      try {
        return await mfaService.disableMfa(session!.userId, input.password, input.code);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas dezaktywacji MFA',
        });
      }
    }),

  // =========================================================================
  // MFA Challenge & Verification
  // =========================================================================

  /**
   * Create MFA challenge for login verification
   */
  createChallenge: protectedProcedure.mutation(async ({ ctx }) => {
    const { prisma, redis, session, req } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

    // Get IP address from request headers
    const ipAddress = req?.headers?.['x-forwarded-for'] as string ||
                      req?.headers?.['x-real-ip'] as string ||
                      '0.0.0.0';

    try {
      return await mfaService.createChallenge(session!.userId, ipAddress);
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas tworzenia wyzwania MFA',
      });
    }
  }),

  /**
   * Verify TOTP code for MFA challenge
   */
  verifyTotp: protectedProcedure
    .input(mfaTotpVerifySchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

      try {
        return await mfaService.verifyTotp(input.challengeToken, input.code);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas weryfikacji kodu TOTP',
        });
      }
    }),

  /**
   * Verify backup code for MFA challenge
   */
  verifyBackupCode: protectedProcedure
    .input(mfaBackupCodeVerifySchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

      try {
        return await mfaService.verifyBackupCode(input.challengeToken, input.code);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas weryfikacji kodu zapasowego',
        });
      }
    }),

  // =========================================================================
  // Backup Codes Management
  // =========================================================================

  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes: protectedProcedure
    .input(mfaRegenerateBackupCodesSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const mfaService = new MfaService(prisma, redis, auditLogger, totpService, argon2Service);

      try {
        return await mfaService.regenerateBackupCodes(
          session!.userId,
          input.password,
          input.code
        );
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas generowania kodów zapasowych',
        });
      }
    }),
});
