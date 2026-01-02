/**
 * Authentication result types
 */

export interface AuthResult {
  success: boolean;
  userId?: string;
  requiresMfa?: boolean;
  mfaChallengeId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: AuthError;
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_NOT_VERIFIED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_ALREADY_USED'
  | 'TOKEN_INVALIDATED'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID_CODE'
  | 'MFA_CODE_EXPIRED'
  | 'MFA_BACKUP_CODE_ALREADY_USED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PASSWORD_BREACHED'
  | 'PASSWORD_TOO_WEAK'
  | 'PASSWORD_RECENTLY_USED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'INTERNAL_ERROR';

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  userId: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  operatingSystem: string | null;
  ipAddress: string;
  location: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

/**
 * MFA setup result
 */
export interface MfaSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

/**
 * Device fingerprint
 */
export interface DeviceFingerprint {
  userAgent: string;
  language: string;
  colorDepth: number;
  screenResolution: string;
  timezone: string;
  platform: string;
  hardwareConcurrency: number;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetAt: Date;
}
