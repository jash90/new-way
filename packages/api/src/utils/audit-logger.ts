import type { PrismaClient } from '@prisma/client';
import type { AuditEventType } from '@ksiegowacrm/shared';

export interface AuditLogParams {
  eventType: AuditEventType;
  userId?: string | null;
  targetUserId?: string | null;
  organizationId?: string | null;
  ipAddress: string;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  correlationId: string;
}

/**
 * Service-compatible audit logger interface
 * Used by ACE and other module services
 */
export interface ServiceAuditLogger {
  log: (data: Record<string, unknown>) => void;
}

/**
 * Audit logger service for immutable audit trail
 * Per AIM-011 specification - 10-year retention
 */
export class AuditLogger implements ServiceAuditLogger {
  private prisma: PrismaClient;
  private defaultIpAddress: string = 'system';
  private defaultCorrelationId: string = 'system';

  constructor(prisma: PrismaClient, options?: { ipAddress?: string; correlationId?: string }) {
    this.prisma = prisma;
    if (options?.ipAddress) this.defaultIpAddress = options.ipAddress;
    if (options?.correlationId) this.defaultCorrelationId = options.correlationId;
  }

  /**
   * Service-compatible generic log method
   * Accepts any data object and stores it as metadata
   */
  log(data: Record<string, unknown>): void {
    // Fire and forget - services don't await this
    this.logAsync(data).catch(console.error);
  }

  /**
   * Internal async log for service compatibility
   */
  private async logAsync(data: Record<string, unknown>): Promise<void> {
    const eventType = (data.eventType as AuditEventType) ||
                      (data.action ? `${String(data.action).toUpperCase()}_${String(data.entityType || 'ENTITY').toUpperCase()}` : 'SYSTEM_EVENT') as AuditEventType;

    await this.prisma.authAuditLog.create({
      data: {
        eventType,
        userId: data.userId as string | null,
        targetUserId: data.targetUserId as string | null,
        organizationId: data.organizationId as string | null,
        ipAddress: (data.ipAddress as string) || this.defaultIpAddress,
        userAgent: data.userAgent as string | null,
        metadata: data,
        correlationId: (data.correlationId as string) || this.defaultCorrelationId,
      },
    });
  }

  /**
   * Log an audit event with full parameters
   */
  async logFull(params: AuditLogParams): Promise<void> {
    const {
      eventType,
      userId,
      targetUserId,
      organizationId,
      ipAddress,
      userAgent,
      metadata,
      correlationId,
    } = params;

    await this.prisma.authAuditLog.create({
      data: {
        eventType,
        userId,
        targetUserId,
        organizationId,
        ipAddress,
        userAgent,
        metadata: metadata ?? {},
        correlationId,
      },
    });
  }

  /**
   * Set default context for service-compatible logging
   */
  setContext(ipAddress: string, correlationId: string): void {
    this.defaultIpAddress = ipAddress;
    this.defaultCorrelationId = correlationId;
  }

  /**
   * Log registration event
   */
  async logRegistration(params: {
    userId: string;
    email: string;
    ipAddress: string;
    userAgent?: string;
    correlationId: string;
  }): Promise<void> {
    await this.log({
      eventType: 'USER_REGISTERED',
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { email: params.email },
      correlationId: params.correlationId,
    });
  }

  /**
   * Log login success event
   */
  async logLoginSuccess(params: {
    userId: string;
    sessionId: string;
    ipAddress: string;
    userAgent?: string;
    deviceFingerprint?: Record<string, unknown>;
    correlationId: string;
  }): Promise<void> {
    await this.log({
      eventType: 'LOGIN_SUCCESS',
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        sessionId: params.sessionId,
        deviceFingerprint: params.deviceFingerprint,
      },
      correlationId: params.correlationId,
    });
  }

  /**
   * Log login failure event
   */
  async logLoginFailed(params: {
    email: string;
    reason: string;
    ipAddress: string;
    userAgent?: string;
    correlationId: string;
    userId?: string;
  }): Promise<void> {
    await this.log({
      eventType: 'LOGIN_FAILED',
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        email: params.email,
        reason: params.reason,
      },
      correlationId: params.correlationId,
    });
  }

  /**
   * Log logout event
   */
  async logLogout(params: {
    userId: string;
    sessionId: string;
    ipAddress: string;
    userAgent?: string;
    correlationId: string;
    logoutAll?: boolean;
  }): Promise<void> {
    await this.log({
      eventType: params.logoutAll ? 'LOGOUT_ALL' : 'LOGOUT',
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        sessionId: params.sessionId,
        logoutAll: params.logoutAll,
      },
      correlationId: params.correlationId,
    });
  }

  /**
   * Log MFA event
   */
  async logMfaEvent(params: {
    eventType: 'MFA_ENABLED' | 'MFA_DISABLED' | 'MFA_CHALLENGE_SUCCESS' | 'MFA_CHALLENGE_FAILED' | 'MFA_BACKUP_CODE_USED';
    userId: string;
    ipAddress: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    correlationId: string;
  }): Promise<void> {
    await this.log({
      eventType: params.eventType,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata,
      correlationId: params.correlationId,
    });
  }

  /**
   * Log role/permission change
   */
  async logRbacChange(params: {
    eventType: 'ROLE_ASSIGNED' | 'ROLE_REVOKED' | 'PERMISSION_GRANTED' | 'PERMISSION_REVOKED';
    userId: string;
    targetUserId: string;
    roleOrPermission: string;
    performedBy: string;
    ipAddress: string;
    userAgent?: string;
    correlationId: string;
  }): Promise<void> {
    await this.log({
      eventType: params.eventType,
      userId: params.performedBy,
      targetUserId: params.targetUserId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        roleOrPermission: params.roleOrPermission,
      },
      correlationId: params.correlationId,
    });
  }

  /**
   * Log security alert
   */
  async logSecurityAlert(params: {
    eventType: 'SUSPICIOUS_ACTIVITY_DETECTED' | 'ACCOUNT_LOCKED' | 'RATE_LIMIT_EXCEEDED' | 'NEW_DEVICE_LOGIN';
    userId?: string;
    ipAddress: string;
    userAgent?: string;
    metadata: Record<string, unknown>;
    correlationId: string;
  }): Promise<void> {
    await this.log({
      eventType: params.eventType,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata,
      correlationId: params.correlationId,
    });
  }
}
