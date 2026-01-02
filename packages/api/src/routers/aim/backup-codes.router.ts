import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import {
  listUsedBackupCodesSchema,
  exportBackupCodesSchema,
  verifyBackupCodeDirectSchema,
} from '@ksiegowacrm/shared';
import { BackupCodesService } from '../../services/aim/backup-codes.service';
import { AuditLogger } from '../../utils/audit-logger';
import { totpService, argon2Service } from '@ksiegowacrm/auth';

/**
 * Backup Codes Router (AIM-010)
 * Handles backup codes management operations
 */
export const backupCodesRouter = router({
  // =========================================================================
  // GET BACKUP CODES STATUS
  // =========================================================================

  /**
   * Get backup codes status for authenticated user
   * Returns: isEnabled, totalCodes, remainingCodes, usedCodes, lastUsedAt, generatedAt, shouldRegenerate
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const backupCodesService = new BackupCodesService(
      prisma,
      redis,
      auditLogger,
      totpService,
      argon2Service,
    );

    return backupCodesService.getStatus(session!.userId);
  }),

  // =========================================================================
  // LIST USED BACKUP CODES
  // =========================================================================

  /**
   * List used backup codes with pagination
   * Returns paginated list of used codes with tracking info (IP, user agent, timestamp)
   */
  listUsedCodes: protectedProcedure
    .input(listUsedBackupCodesSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const backupCodesService = new BackupCodesService(
        prisma,
        redis,
        auditLogger,
        totpService,
        argon2Service,
      );

      const pagination = input?.pagination ?? { page: 1, limit: 10 };
      return backupCodesService.listUsedCodes(session!.userId, pagination);
    }),

  // =========================================================================
  // EXPORT BACKUP CODES
  // =========================================================================

  /**
   * Export backup codes in specified format (text or PDF)
   * Requires re-authentication with password and TOTP
   */
  export: protectedProcedure
    .input(exportBackupCodesSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const backupCodesService = new BackupCodesService(
        prisma,
        redis,
        auditLogger,
        totpService,
        argon2Service,
      );

      return backupCodesService.exportCodes(session!.userId, {
        password: input.password,
        totpCode: input.totpCode,
        format: input.format,
      });
    }),

  // =========================================================================
  // VERIFY BACKUP CODE DIRECTLY
  // =========================================================================

  /**
   * Verify a backup code directly (outside MFA challenge flow)
   * Marks the code as used and returns remaining codes count
   */
  verifyDirect: protectedProcedure
    .input(verifyBackupCodeDirectSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session, req } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const backupCodesService = new BackupCodesService(
        prisma,
        redis,
        auditLogger,
        totpService,
        argon2Service,
      );

      // Extract IP address and user agent from request
      const ipAddress = (req?.headers?.['x-forwarded-for'] as string) || 'unknown';
      const userAgent = (req?.headers?.['user-agent'] as string) || 'unknown';

      return backupCodesService.verifyDirect(session!.userId, input.code, ipAddress, userAgent);
    }),

  // =========================================================================
  // REGENERATE BACKUP CODES
  // =========================================================================

  /**
   * Regenerate backup codes
   * Requires re-authentication with password and TOTP
   * Invalidates all existing backup codes and generates 10 new ones
   */
  regenerate: protectedProcedure
    .input(
      z.object({
        password: z.string().min(1, 'Hasło jest wymagane'),
        totpCode: z.string().length(6).regex(/^\d{6}$/, 'Nieprawidłowy kod TOTP'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const backupCodesService = new BackupCodesService(
        prisma,
        redis,
        auditLogger,
        totpService,
        argon2Service,
      );

      return backupCodesService.regenerateCodes(session!.userId, input.password, input.totpCode);
    }),
});

export type BackupCodesRouter = typeof backupCodesRouter;
