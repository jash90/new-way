import { router } from '../../trpc';
import { registrationRouter } from './registration.router';
import { authRouter } from './auth.router';
import { passwordResetRouter } from './password-reset.router';
import { sessionRouter } from './session.router';
import { logoutRouter } from './logout.router';
import { rbacRouter } from './rbac.router';
import { permissionRouter } from './permission.router';
import { mfaRouter } from './mfa.router';
import { backupCodesRouter } from './backup-codes.router';
import { auditRouter } from './audit.router';
import { securityAlertsRouter } from './security-events.router';
import { profileRouter } from './profile.router';

/**
 * AIM (Authentication & Identity Management) Router
 * Combines all authentication-related routes
 */
export const aimRouter = router({
  registration: registrationRouter,
  auth: authRouter, // AIM-003: Login
  passwordReset: passwordResetRouter, // AIM-004: Password Reset
  session: sessionRouter, // AIM-005: Session Management
  logout: logoutRouter, // AIM-006: Logout
  rbac: rbacRouter, // AIM-007: RBAC
  permission: permissionRouter, // AIM-008: Permissions
  mfa: mfaRouter, // AIM-009: MFA
  backupCodes: backupCodesRouter, // AIM-010: Backup Codes
  audit: auditRouter, // AIM-011: Audit Logs
  securityAlerts: securityAlertsRouter, // AIM-012: Security Alerts
  profile: profileRouter, // AIM-002: Profile Setup
});

export type AimRouter = typeof aimRouter;
