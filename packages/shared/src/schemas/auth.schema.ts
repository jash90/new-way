import { z } from 'zod';

/**
 * Password validation schema
 * Requirements from Constitution and AIM-001:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(12, 'Hasło musi mieć minimum 12 znaków')
  .regex(/[A-Z]/, 'Hasło musi zawierać co najmniej jedną wielką literę')
  .regex(/[a-z]/, 'Hasło musi zawierać co najmniej jedną małą literę')
  .regex(/[0-9]/, 'Hasło musi zawierać co najmniej jedną cyfrę')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    'Hasło musi zawierać co najmniej jeden znak specjalny'
  );

/**
 * Email validation schema (RFC 5322 compliant)
 */
export const emailSchema = z
  .string()
  .email('Nieprawidłowy format adresu email')
  .min(5, 'Email jest za krótki')
  .max(254, 'Email jest za długi')
  .toLowerCase();

/**
 * Registration input schema
 */
export const registrationInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Musisz zaakceptować regulamin' }),
  }),
  acceptPrivacyPolicy: z.literal(true, {
    errorMap: () => ({ message: 'Musisz zaakceptować politykę prywatności' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Hasła muszą być identyczne',
  path: ['confirmPassword'],
});

export type RegistrationInput = z.infer<typeof registrationInputSchema>;

/**
 * Login input schema
 */
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Hasło jest wymagane'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * MFA verification schema
 */
export const mfaVerificationSchema = z.object({
  code: z.string().length(6, 'Kod musi mieć 6 cyfr').regex(/^\d{6}$/, 'Kod musi składać się z cyfr'),
  challengeId: z.string().uuid('Nieprawidłowy identyfikator wyzwania'),
});

export type MfaVerificationInput = z.infer<typeof mfaVerificationSchema>;

/**
 * Backup code verification schema
 */
export const backupCodeVerificationSchema = z.object({
  code: z.string().length(8, 'Kod zapasowy musi mieć 8 znaków').regex(/^[A-Z0-9]{8}$/i, 'Nieprawidłowy format kodu'),
  challengeId: z.string().uuid('Nieprawidłowy identyfikator wyzwania'),
});

export type BackupCodeVerificationInput = z.infer<typeof backupCodeVerificationSchema>;

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

/**
 * Password reset schema
 */
export const passwordResetSchema = z.object({
  token: z.string().min(64, 'Nieprawidłowy token').max(64, 'Nieprawidłowy token'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Hasła muszą być identyczne',
  path: ['confirmPassword'],
});

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

/**
 * Email verification schema
 */
export const emailVerificationSchema = z.object({
  token: z.string().min(64, 'Nieprawidłowy token').max(64, 'Nieprawidłowy token'),
});

export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Aktualne hasło jest wymagane'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Hasła muszą być identyczne',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'Nowe hasło musi być różne od aktualnego',
  path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Session refresh schema
 */
export const sessionRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Token odświeżania jest wymagany'),
});

export type SessionRefreshInput = z.infer<typeof sessionRefreshSchema>;

/**
 * Session revoke schema
 */
export const sessionRevokeSchema = z.object({
  sessionId: z.string().uuid('Nieprawidłowy identyfikator sesji'),
});

export type SessionRevokeInput = z.infer<typeof sessionRevokeSchema>;

/**
 * Session revoke all schema (requires password confirmation)
 */
export const sessionRevokeAllSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane do potwierdzenia'),
});

export type SessionRevokeAllInput = z.infer<typeof sessionRevokeAllSchema>;

/**
 * Logout request schema
 * Supports both single session logout and logout from all devices
 */
export const logoutRequestSchema = z.object({
  logoutAllDevices: z.boolean().default(false),
  password: z.string().optional(),
}).refine(
  (data) => !data.logoutAllDevices || data.password,
  { message: 'Hasło jest wymagane do wylogowania ze wszystkich urządzeń', path: ['password'] }
);

export type LogoutRequestInput = z.infer<typeof logoutRequestSchema>;

/**
 * Logout all devices schema (requires password confirmation)
 */
export const logoutAllRequestSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
});

export type LogoutAllRequestInput = z.infer<typeof logoutAllRequestSchema>;
