import { z } from 'zod';

// ==========================================================================
// MFA SCHEMAS (AIM-009)
// TOTP Multi-Factor Authentication
// ==========================================================================

/**
 * TOTP code validation (6 digits)
 */
export const totpCodeSchema = z
  .string()
  .length(6, 'Kod TOTP musi mieć 6 cyfr')
  .regex(/^\d{6}$/, 'Kod musi składać się wyłącznie z cyfr');

/**
 * Backup code validation (8 alphanumeric characters)
 */
export const backupCodeSchema = z
  .string()
  .length(8, 'Kod zapasowy musi mieć 8 znaków')
  .regex(/^[A-Z0-9]{8}$/i, 'Nieprawidłowy format kodu zapasowego')
  .transform((val) => val.toUpperCase());

/**
 * User ID schema for MFA operations
 */
export const mfaUserIdSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
});

export type MfaUserIdInput = z.infer<typeof mfaUserIdSchema>;

/**
 * MFA Setup initiation - starts the TOTP setup process
 * Returns QR code and secret for authenticator app
 */
export const mfaSetupInitSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane do aktywacji MFA'),
});

export type MfaSetupInitInput = z.infer<typeof mfaSetupInitSchema>;

/**
 * MFA Setup verification - confirms TOTP setup with a valid code
 * This enables MFA for the user
 */
export const mfaSetupVerifySchema = z.object({
  code: totpCodeSchema,
  setupToken: z.string().min(1, 'Token konfiguracji jest wymagany'),
});

export type MfaSetupVerifyInput = z.infer<typeof mfaSetupVerifySchema>;

/**
 * MFA Disable schema - requires password and current TOTP code
 */
export const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
  code: totpCodeSchema,
});

export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;

/**
 * MFA Challenge schema - used during login when MFA is required
 */
export const mfaChallengeSchema = z.object({
  challengeToken: z.string().min(1, 'Token wyzwania jest wymagany'),
});

export type MfaChallengeInput = z.infer<typeof mfaChallengeSchema>;

/**
 * MFA TOTP verification schema - verifies a TOTP code for a challenge
 */
export const mfaTotpVerifySchema = z.object({
  challengeToken: z.string().min(1, 'Token wyzwania jest wymagany'),
  code: totpCodeSchema,
});

export type MfaTotpVerifyInput = z.infer<typeof mfaTotpVerifySchema>;

/**
 * MFA Backup code verification schema - uses a backup code for a challenge
 */
export const mfaBackupCodeVerifySchema = z.object({
  challengeToken: z.string().min(1, 'Token wyzwania jest wymagany'),
  code: backupCodeSchema,
});

export type MfaBackupCodeVerifyInput = z.infer<typeof mfaBackupCodeVerifySchema>;

/**
 * Generate new backup codes schema - requires password confirmation
 */
export const mfaRegenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
  code: totpCodeSchema,
});

export type MfaRegenerateBackupCodesInput = z.infer<typeof mfaRegenerateBackupCodesSchema>;

/**
 * MFA Status response type
 */
export const mfaStatusSchema = z.object({
  isEnabled: z.boolean(),
  isVerified: z.boolean(),
  lastUsedAt: z.string().datetime().nullable(),
  backupCodesRemaining: z.number(),
  createdAt: z.string().datetime().nullable(),
});

export type MfaStatusOutput = z.infer<typeof mfaStatusSchema>;

/**
 * MFA Setup result - returned when setup is initiated
 */
export const mfaSetupResultSchema = z.object({
  setupToken: z.string(),
  qrCodeDataUrl: z.string(),
  otpauthUrl: z.string(),
  expiresAt: z.string().datetime(),
});

export type MfaSetupResultOutput = z.infer<typeof mfaSetupResultSchema>;

/**
 * MFA Enable result - returned when MFA is successfully enabled
 */
export const mfaEnableResultSchema = z.object({
  success: z.boolean(),
  backupCodes: z.array(z.string()).length(10),
  message: z.string(),
});

export type MfaEnableResultOutput = z.infer<typeof mfaEnableResultSchema>;

/**
 * MFA Challenge result - returned when MFA challenge is created
 */
export const mfaChallengeResultSchema = z.object({
  challengeToken: z.string(),
  type: z.enum(['totp', 'backup_code']),
  expiresAt: z.string().datetime(),
  attemptsRemaining: z.number(),
});

export type MfaChallengeResultOutput = z.infer<typeof mfaChallengeResultSchema>;

/**
 * MFA Verification result - returned after successful MFA verification
 */
export const mfaVerificationResultSchema = z.object({
  success: z.boolean(),
  userId: z.string().uuid(),
  completedAt: z.string().datetime(),
});

export type MfaVerificationResultOutput = z.infer<typeof mfaVerificationResultSchema>;

/**
 * Backup codes result - returned when backup codes are generated
 */
export const backupCodesResultSchema = z.object({
  codes: z.array(z.string()).length(10),
  generatedAt: z.string().datetime(),
  warning: z.string(),
});

export type BackupCodesResultOutput = z.infer<typeof backupCodesResultSchema>;
