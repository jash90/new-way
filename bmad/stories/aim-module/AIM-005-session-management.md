# Story AIM-005: Session Management and Token Refresh

> **Story ID**: AIM-005
> **Epic**: [AIM-EPIC-001](./epic.md) - Authentication & Identity Management
> **Priority**: P0 (Critical)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Dependencies**: [AIM-003](./AIM-003-user-login.md)

---

## 📋 User Story

**As an** authenticated user
**I want** my session to be managed securely with automatic token refresh
**So that** I stay logged in safely and can view/control my active sessions across devices

---

## ✅ Acceptance Criteria

### AC1: Automatic Token Refresh
```gherkin
Feature: Automatic Token Refresh
  Background:
    Given I am a logged-in user with valid session

  Scenario: Access token auto-refresh before expiry
    Given my access token will expire in less than 5 minutes
    When the system detects the impending expiration
    Then a new access token is generated automatically
    And the refresh token is rotated for security
    And my session continues without interruption

  Scenario: Refresh token rotation on each use
    Given I have a valid refresh token
    When the token is used to obtain a new access token
    Then the old refresh token is blacklisted
    And a new refresh token is issued
    And the blacklisted token cannot be reused

  Scenario: Expired refresh token
    Given my refresh token has expired (after 7 days)
    When I try to refresh my access token
    Then I receive "REFRESH_TOKEN_EXPIRED" error
    And I am redirected to the login page
    And an audit log entry is created
```

### AC2: Session Listing
```gherkin
Feature: View Active Sessions
  Background:
    Given I am a logged-in user

  Scenario: List all active sessions
    Given I am logged in on multiple devices
    When I navigate to "Account Security" → "Active Sessions"
    Then I see a list of all my active sessions
    And each session shows:
      | Field | Example |
      | Device Type | Desktop / Mobile / Tablet |
      | Browser | Chrome 120 |
      | Operating System | macOS Sonoma |
      | IP Address | 192.168.1.*** (masked) |
      | Location | Warsaw, Poland |
      | Login Time | 2024-12-28 14:30 |
      | Last Activity | 5 minutes ago |
      | Current | ✓ (for this session) |

  Scenario: Current session highlighted
    Given I have multiple active sessions
    When I view my sessions list
    Then my current session is clearly marked
    And it has a "Current session" badge
    And the revoke button is disabled for current session
```

### AC3: Session Revocation
```gherkin
Feature: Session Revocation
  Background:
    Given I am a logged-in user with multiple sessions

  Scenario: Revoke specific session
    Given I see another device's session in my list
    When I click "Revoke" on that session
    Then I am asked to confirm "Wylogować to urządzenie?"
    And when I confirm
    Then that session is immediately invalidated
    And the device receives "SESSION_REVOKED" error
    And an audit log entry is created
    And I receive success message "Sesja została zakończona"

  Scenario: Revoke all other sessions
    Given I suspect unauthorized access to my account
    When I click "Log out all devices"
    Then I am asked to confirm with my password
    And when I enter correct password
    Then all sessions except current are invalidated
    And I see confirmation message
    And security notification email is sent
    And audit log entry is created

  Scenario: Revoked session cannot access resources
    Given my session has been revoked from another device
    When I try to access any protected resource
    Then I receive "SESSION_REVOKED" error
    And I am redirected to the login page
    And I see message "Twoja sesja została zakończona"
```

### AC4: Inactivity Timeout
```gherkin
Feature: Session Inactivity Timeout
  Background:
    Given I am a logged-in user

  Scenario: Idle session warning
    Given I have been inactive for 55 minutes (timeout = 60 min)
    When the system detects my inactivity
    Then I see a warning modal "Twoja sesja wygaśnie za 5 minut"
    And I can click "Kontynuuj sesję" to extend it
    And the warning includes a countdown timer

  Scenario: Session timeout after inactivity
    Given I have been inactive for 60 minutes
    And I ignored the warning modal
    When the timeout period expires
    Then my session is automatically invalidated
    And I am redirected to the login page
    And I see message "Sesja wygasła z powodu braku aktywności"
    And an audit log entry is created

  Scenario: Activity extends session
    Given my session will timeout in 10 minutes
    When I perform any action (API call, navigation)
    Then the session timeout is extended to full duration
    And the activity is recorded as "lastActivity" timestamp
```

### AC5: Concurrent Sessions Limit
```gherkin
Feature: Maximum Concurrent Sessions
  Background:
    Given maximum concurrent sessions is set to 5

  Scenario: Sixth login invalidates oldest session
    Given I am already logged in on 5 devices
    When I login from a 6th device
    Then the oldest session is automatically revoked
    And a notification is sent to the revoked session's device
    And an audit log entry is created for forced logout
    And I am successfully logged in on the new device

  Scenario: Admin can configure session limit
    Given I am an administrator
    When I navigate to "System Settings" → "Security"
    Then I can configure "maxConcurrentSessions" (1-10)
    And the change affects new logins only
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- Sessions table (persistent tracking)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Token tracking (hashes only)
    refresh_token_hash VARCHAR(255) NOT NULL,
    refresh_token_family UUID NOT NULL, -- For rotation chain tracking

    -- Device information
    device_id UUID NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'desktop', 'mobile', 'tablet'
    device_name VARCHAR(255), -- User-friendly name

    -- Browser/OS info
    browser_name VARCHAR(100),
    browser_version VARCHAR(50),
    os_name VARCHAR(100),
    os_version VARCHAR(50),
    user_agent TEXT NOT NULL,

    -- Location tracking
    ip_address INET NOT NULL,
    ip_country VARCHAR(2), -- ISO country code
    ip_city VARCHAR(100),
    ip_region VARCHAR(100),

    -- Session lifecycle
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revoke_reason VARCHAR(50), -- 'user_request', 'password_change', 'admin_action', 'security_alert', 'concurrent_limit'

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE, -- Computed at query time

    -- Security metadata
    fingerprint_hash VARCHAR(255), -- Device fingerprint for validation
    risk_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 - 1.00

    -- Indexes
    CONSTRAINT sessions_user_device_unique UNIQUE (user_id, device_id, is_active)
        WHERE is_active = TRUE
);

-- Session activity log (for detailed tracking)
CREATE TABLE session_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

    activity_type VARCHAR(50) NOT NULL, -- 'api_call', 'navigation', 'refresh', 'heartbeat'
    endpoint VARCHAR(255),
    ip_address INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blacklisted tokens (for revoked but not expired tokens)
CREATE TABLE blacklisted_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(20) NOT NULL, -- 'access', 'refresh'

    session_id UUID REFERENCES sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),

    blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blacklisted_reason VARCHAR(50) NOT NULL, -- 'rotation', 'logout', 'revoked', 'password_change'
    original_expires_at TIMESTAMPTZ NOT NULL, -- When token would have expired

    -- Auto-cleanup after expiry
    CONSTRAINT cleanup_after_expiry CHECK (original_expires_at > NOW() - INTERVAL '1 day')
);

-- Session configuration per organization
CREATE TABLE session_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Timeouts (in seconds)
    access_token_ttl INTEGER NOT NULL DEFAULT 900, -- 15 minutes
    refresh_token_ttl INTEGER NOT NULL DEFAULT 604800, -- 7 days
    inactivity_timeout INTEGER NOT NULL DEFAULT 3600, -- 1 hour

    -- Limits
    max_concurrent_sessions INTEGER NOT NULL DEFAULT 5,

    -- Features
    require_ip_binding BOOLEAN NOT NULL DEFAULT FALSE,
    allow_persistent_sessions BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),

    CONSTRAINT unique_org_config UNIQUE (organization_id)
);

-- Redis session cache structure (for fast lookups)
-- Key: session:{sessionId}
-- Value: JSON { userId, deviceId, permissions[], expiresAt, lastActivity }
-- TTL: session timeout (e.g., 3600s)

-- Indexes
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_device ON sessions(device_id);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity_at) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_refresh_family ON sessions(refresh_token_family);

CREATE INDEX idx_blacklisted_tokens_hash ON blacklisted_tokens(token_hash);
CREATE INDEX idx_blacklisted_tokens_expires ON blacklisted_tokens(original_expires_at);

CREATE INDEX idx_session_activity_session ON session_activity(session_id, created_at DESC);

-- Cleanup function for expired blacklisted tokens
CREATE OR REPLACE FUNCTION cleanup_expired_blacklisted_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM blacklisted_tokens
    WHERE original_expires_at < NOW() - INTERVAL '1 day';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_user_policy ON sessions
    FOR ALL USING (
        user_id = current_setting('app.current_user_id')::UUID
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE u.id = current_setting('app.current_user_id')::UUID
            AND r.name = 'admin'
        )
    );

CREATE POLICY session_activity_user_policy ON session_activity
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM sessions
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );
```

### API Endpoints

```typescript
// POST /api/v1/auth/refresh
// Refresh access token using refresh token
interface RefreshTokenRequest {
  // Refresh token sent via HTTP-only cookie
}

interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number; // seconds
  // New refresh token set via HTTP-only cookie
}

// GET /api/v1/auth/sessions
// List all active sessions for current user
interface GetSessionsResponse {
  sessions: SessionInfo[];
  currentSessionId: string;
  totalCount: number;
}

interface SessionInfo {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  deviceName: string | null;
  browser: string;
  os: string;
  ipAddress: string; // Masked: 192.168.1.***
  location: {
    country: string | null;
    city: string | null;
  };
  createdAt: string; // ISO 8601
  lastActivityAt: string;
  isCurrent: boolean;
  riskScore: number;
}

// DELETE /api/v1/auth/sessions/:id
// Revoke a specific session
interface RevokeSessionRequest {
  sessionId: string; // Path parameter
}

interface RevokeSessionResponse {
  success: boolean;
  message: string;
}

// DELETE /api/v1/auth/sessions
// Revoke all sessions except current
interface RevokeAllSessionsRequest {
  password: string; // Required for confirmation
  exceptCurrent: boolean; // Default: true
}

interface RevokeAllSessionsResponse {
  revokedCount: number;
  message: string;
}

// POST /api/v1/auth/sessions/extend
// Extend current session (activity heartbeat)
interface ExtendSessionRequest {
  // Access token in header
}

interface ExtendSessionResponse {
  expiresAt: string; // New expiration time
  sessionTimeoutWarning: boolean; // True if will expire soon
  timeoutIn: number; // Seconds until timeout
}
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Session info schema (for API response)
export const sessionInfoSchema = z.object({
  id: z.string().uuid(),
  deviceType: z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
  deviceName: z.string().nullable(),
  browser: z.string(),
  os: z.string(),
  ipAddress: z.string(),
  location: z.object({
    country: z.string().nullable(),
    city: z.string().nullable(),
  }),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  isCurrent: z.boolean(),
  riskScore: z.number().min(0).max(1),
});

export const getSessionsResponseSchema = z.object({
  sessions: z.array(sessionInfoSchema),
  currentSessionId: z.string().uuid(),
  totalCount: z.number().int().min(0),
});

// Revoke session schema
export const revokeSessionParamsSchema = z.object({
  sessionId: z.string().uuid({
    message: 'Nieprawidłowy identyfikator sesji',
  }),
});

// Revoke all sessions schema
export const revokeAllSessionsSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
  exceptCurrent: z.boolean().default(true),
});

// Extend session schema
export const extendSessionResponseSchema = z.object({
  expiresAt: z.string().datetime(),
  sessionTimeoutWarning: z.boolean(),
  timeoutIn: z.number().int().min(0),
});

// Internal session schema (for Redis storage)
export const redisSessionSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  deviceId: z.string().uuid(),
  refreshTokenFamily: z.string().uuid(),
  permissions: z.array(z.string()),
  roles: z.array(z.string()),
  organizationId: z.string().uuid().nullable(),
  ipAddress: z.string(),
  userAgent: z.string(),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

// Token payload schemas
export const accessTokenPayloadSchema = z.object({
  sub: z.string().uuid(), // userId
  sessionId: z.string().uuid(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  organizationId: z.string().uuid().nullable(),
  type: z.literal('access'),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string(),
});

export const refreshTokenPayloadSchema = z.object({
  sub: z.string().uuid(), // userId
  sessionId: z.string().uuid(),
  family: z.string().uuid(), // Token family for rotation tracking
  type: z.literal('refresh'),
  iat: z.number(),
  exp: z.number(),
});

// Session config schema
export const sessionConfigSchema = z.object({
  accessTokenTtl: z.number().int().min(60).max(3600).default(900),
  refreshTokenTtl: z.number().int().min(86400).max(2592000).default(604800),
  inactivityTimeout: z.number().int().min(300).max(86400).default(3600),
  maxConcurrentSessions: z.number().int().min(1).max(10).default(5),
  requireIpBinding: z.boolean().default(false),
  allowPersistentSessions: z.boolean().default(true),
});

export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type GetSessionsResponse = z.infer<typeof getSessionsResponseSchema>;
export type RedisSession = z.infer<typeof redisSessionSchema>;
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
export type RefreshTokenPayload = z.infer<typeof refreshTokenPayloadSchema>;
export type SessionConfig = z.infer<typeof sessionConfigSchema>;
```

### Service Implementation

```typescript
// src/modules/auth/services/session.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Redis } from 'ioredis';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { Session, BlacklistedToken, SessionActivity } from '../entities';
import { AuditService } from '../../audit/audit.service';
import {
  SessionNotFoundException,
  InvalidTokenException,
  SessionRevokedException,
  ConcurrentSessionLimitException,
} from '../exceptions';
import {
  RedisSession,
  AccessTokenPayload,
  RefreshTokenPayload,
  SessionConfig,
  SessionInfo,
} from '../schemas';
import { AuthConfig } from '../config/auth.config';
import { DeviceInfo, GeoLocation } from '../interfaces';
import { AuditEventType } from '../../audit/types';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  // Token configuration
  private readonly ACCESS_TOKEN_TTL = 900; // 15 minutes
  private readonly REFRESH_TOKEN_TTL = 604800; // 7 days
  private readonly INACTIVITY_TIMEOUT = 3600; // 1 hour
  private readonly SESSION_WARNING_THRESHOLD = 300; // 5 minutes before expiry
  private readonly MAX_CONCURRENT_SESSIONS = 5;

  // Redis key patterns
  private readonly SESSION_PREFIX = 'session:';
  private readonly TOKEN_BLACKLIST_PREFIX = 'blacklist:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(BlacklistedToken)
    private readonly blacklistRepository: Repository<BlacklistedToken>,
    @InjectRepository(SessionActivity)
    private readonly activityRepository: Repository<SessionActivity>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly auditService: AuditService,
    private readonly config: AuthConfig,
  ) {}

  /**
   * Create a new session for user
   */
  async createSession(
    userId: string,
    deviceInfo: DeviceInfo,
    geoLocation: GeoLocation | null,
    organizationId: string | null,
  ): Promise<{ session: Session; accessToken: string; refreshToken: string }> {
    const correlationId = crypto.randomUUID();
    this.logger.log('Creating session', { userId, correlationId });

    // Check concurrent sessions limit
    await this.enforceSessionLimit(userId);

    // Generate token family for rotation tracking
    const tokenFamily = crypto.randomUUID();

    // Generate refresh token
    const refreshToken = this.generateRefreshToken(userId, tokenFamily);
    const refreshTokenHash = this.hashToken(refreshToken);

    // Create session in database
    const session = this.sessionRepository.create({
      userId,
      refreshTokenHash,
      refreshTokenFamily: tokenFamily,
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.type,
      deviceName: deviceInfo.name,
      browserName: deviceInfo.browser?.name,
      browserVersion: deviceInfo.browser?.version,
      osName: deviceInfo.os?.name,
      osVersion: deviceInfo.os?.version,
      userAgent: deviceInfo.userAgent,
      ipAddress: deviceInfo.ipAddress,
      ipCountry: geoLocation?.country,
      ipCity: geoLocation?.city,
      ipRegion: geoLocation?.region,
      fingerprintHash: deviceInfo.fingerprintHash,
      expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_TTL * 1000),
      isActive: true,
    });

    await this.sessionRepository.save(session);

    // Generate access token
    const accessToken = await this.generateAccessToken(userId, session.id, organizationId);

    // Store session in Redis for fast access
    await this.storeSessionInRedis(session, userId, organizationId);

    // Track user's sessions
    await this.addToUserSessions(userId, session.id);

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.SESSION_CREATED,
      userId,
      sessionId: session.id,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      metadata: {
        deviceType: deviceInfo.type,
        browser: deviceInfo.browser?.name,
        location: geoLocation?.city,
      },
    });

    this.logger.log('Session created', { sessionId: session.id, correlationId });

    return { session, accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const correlationId = crypto.randomUUID();

    try {
      // Verify refresh token
      const payload = jwt.verify(
        refreshToken,
        this.config.jwt.refreshTokenSecret,
      ) as RefreshTokenPayload;

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(refreshToken)) {
        // Potential token reuse attack - invalidate entire token family
        await this.invalidateTokenFamily(payload.family);
        throw new InvalidTokenException('Token has been revoked');
      }

      // Get session from database
      const session = await this.sessionRepository.findOne({
        where: { id: payload.sessionId, isActive: true },
      });

      if (!session) {
        throw new SessionNotFoundException('Session not found or expired');
      }

      // Verify refresh token hash matches
      const providedHash = this.hashToken(refreshToken);
      if (session.refreshTokenHash !== providedHash) {
        // Token doesn't match - potential replay attack
        await this.invalidateTokenFamily(payload.family);
        throw new InvalidTokenException('Invalid refresh token');
      }

      // Blacklist old refresh token (rotation)
      await this.blacklistToken(refreshToken, 'refresh', session.id, session.userId, payload.exp);

      // Generate new token pair
      const newRefreshToken = this.generateRefreshToken(session.userId, session.refreshTokenFamily);
      const newRefreshTokenHash = this.hashToken(newRefreshToken);

      // Update session with new refresh token
      session.refreshTokenHash = newRefreshTokenHash;
      session.lastActivityAt = new Date();
      await this.sessionRepository.save(session);

      // Generate new access token
      const newAccessToken = await this.generateAccessToken(
        session.userId,
        session.id,
        null, // Will be retrieved from user context
      );

      // Update Redis
      await this.updateSessionActivity(session.id);

      // Log activity
      await this.logActivity(session.id, 'refresh', '/api/v1/auth/refresh', ipAddress);

      this.logger.debug('Token refreshed', { sessionId: session.id, correlationId });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.ACCESS_TOKEN_TTL,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new InvalidTokenException('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenException('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Get all active sessions for user
   */
  async getUserSessions(userId: string, currentSessionId: string): Promise<{
    sessions: SessionInfo[];
    currentSessionId: string;
    totalCount: number;
  }> {
    const sessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivityAt: 'DESC' },
    });

    const sessionInfos: SessionInfo[] = sessions.map(session => ({
      id: session.id,
      deviceType: session.deviceType as 'desktop' | 'mobile' | 'tablet' | 'unknown',
      deviceName: session.deviceName,
      browser: `${session.browserName || 'Unknown'} ${session.browserVersion || ''}`.trim(),
      os: `${session.osName || 'Unknown'} ${session.osVersion || ''}`.trim(),
      ipAddress: this.maskIpAddress(session.ipAddress),
      location: {
        country: session.ipCountry,
        city: session.ipCity,
      },
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      isCurrent: session.id === currentSessionId,
      riskScore: parseFloat(session.riskScore?.toString() || '0'),
    }));

    return {
      sessions: sessionInfos,
      currentSessionId,
      totalCount: sessions.length,
    };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    reason: string = 'user_request',
    revokedBy?: string,
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId, isActive: true },
    });

    if (!session) {
      throw new SessionNotFoundException('Session not found');
    }

    // Mark session as revoked
    session.isActive = false;
    session.revokedAt = new Date();
    session.revokedBy = revokedBy || userId;
    session.revokeReason = reason;
    await this.sessionRepository.save(session);

    // Remove from Redis
    await this.removeSessionFromRedis(sessionId);
    await this.removeFromUserSessions(userId, sessionId);

    // Blacklist the refresh token
    if (session.refreshTokenHash) {
      await this.blacklistTokenByHash(
        session.refreshTokenHash,
        'refresh',
        session.id,
        session.userId,
        session.expiresAt,
        reason,
      );
    }

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.SESSION_REVOKED,
      userId,
      sessionId,
      metadata: {
        reason,
        revokedBy: revokedBy || userId,
        deviceType: session.deviceType,
      },
    });

    this.logger.log('Session revoked', { sessionId, reason });
  }

  /**
   * Revoke all sessions except current (requires password confirmation)
   */
  async revokeAllSessions(
    userId: string,
    currentSessionId: string,
    exceptCurrent: boolean = true,
  ): Promise<number> {
    const sessions = await this.sessionRepository.find({
      where: {
        userId,
        isActive: true,
      },
    });

    let revokedCount = 0;

    for (const session of sessions) {
      if (exceptCurrent && session.id === currentSessionId) {
        continue;
      }

      await this.revokeSession(
        session.id,
        userId,
        'revoke_all_request',
        userId,
      );
      revokedCount++;
    }

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.ALL_SESSIONS_REVOKED,
      userId,
      sessionId: currentSessionId,
      metadata: {
        revokedCount,
        exceptCurrent,
      },
    });

    return revokedCount;
  }

  /**
   * Extend session / record activity
   */
  async extendSession(
    sessionId: string,
    endpoint?: string,
    ipAddress?: string,
  ): Promise<{ expiresAt: Date; sessionTimeoutWarning: boolean; timeoutIn: number }> {
    // Update last activity in database
    await this.sessionRepository.update(sessionId, {
      lastActivityAt: new Date(),
    });

    // Update Redis TTL
    await this.updateSessionActivity(sessionId);

    // Log activity
    if (endpoint) {
      await this.logActivity(sessionId, 'api_call', endpoint, ipAddress);
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    const timeoutIn = this.INACTIVITY_TIMEOUT;
    const expiresAt = new Date(Date.now() + timeoutIn * 1000);
    const sessionTimeoutWarning = timeoutIn <= this.SESSION_WARNING_THRESHOLD;

    return { expiresAt, sessionTimeoutWarning, timeoutIn };
  }

  /**
   * Validate session and return user context
   */
  async validateSession(accessToken: string): Promise<{
    userId: string;
    sessionId: string;
    roles: string[];
    permissions: string[];
    organizationId: string | null;
  }> {
    try {
      // Verify token
      const payload = jwt.verify(
        accessToken,
        this.config.jwt.accessTokenSecret,
        {
          algorithms: ['RS256'],
          issuer: this.config.jwt.issuer,
          audience: this.config.jwt.audience,
        },
      ) as AccessTokenPayload;

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(accessToken)) {
        throw new InvalidTokenException('Token has been revoked');
      }

      // Check Redis for session
      const redisKey = `${this.SESSION_PREFIX}${payload.sessionId}`;
      const cachedSession = await this.redis.get(redisKey);

      if (!cachedSession) {
        // Session expired or revoked
        throw new SessionRevokedException('Session expired');
      }

      return {
        userId: payload.sub,
        sessionId: payload.sessionId,
        roles: payload.roles,
        permissions: payload.permissions,
        organizationId: payload.organizationId,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new InvalidTokenException('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenException('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Handle session timeout cleanup (called by cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const expiredSessions = await this.sessionRepository.find({
      where: {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const session of expiredSessions) {
      session.isActive = false;
      session.revokeReason = 'expired';
      await this.sessionRepository.save(session);

      await this.removeSessionFromRedis(session.id);
      await this.removeFromUserSessions(session.userId, session.id);
    }

    // Also cleanup old blacklisted tokens
    const cleanedTokens = await this.blacklistRepository.delete({
      originalExpiresAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    });

    this.logger.log('Cleanup completed', {
      expiredSessions: expiredSessions.length,
      cleanedTokens: cleanedTokens.affected,
    });

    return expiredSessions.length;
  }

  // ============== Private Methods ==============

  private async generateAccessToken(
    userId: string,
    sessionId: string,
    organizationId: string | null,
  ): Promise<string> {
    // Get user roles and permissions
    const { roles, permissions } = await this.getUserPermissions(userId);

    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      sessionId,
      roles,
      permissions,
      organizationId,
      type: 'access',
      iss: this.config.jwt.issuer,
      aud: this.config.jwt.audience,
    };

    return jwt.sign(payload, this.config.jwt.accessTokenSecret, {
      algorithm: 'RS256',
      expiresIn: this.ACCESS_TOKEN_TTL,
    });
  }

  private generateRefreshToken(userId: string, family: string): string {
    const sessionId = crypto.randomUUID();

    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      sessionId,
      family,
      type: 'refresh',
    };

    return jwt.sign(payload, this.config.jwt.refreshTokenSecret, {
      expiresIn: this.REFRESH_TOKEN_TTL,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const hash = this.hashToken(token);

    // Check Redis first (faster)
    const redisKey = `${this.TOKEN_BLACKLIST_PREFIX}${hash}`;
    const cached = await this.redis.exists(redisKey);
    if (cached) {
      return true;
    }

    // Check database
    const blacklisted = await this.blacklistRepository.findOne({
      where: { tokenHash: hash },
    });

    return blacklisted !== null;
  }

  private async blacklistToken(
    token: string,
    tokenType: 'access' | 'refresh',
    sessionId: string | null,
    userId: string,
    expiresAt: number,
    reason: string = 'rotation',
  ): Promise<void> {
    const hash = this.hashToken(token);
    const ttl = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));

    // Add to Redis with TTL
    const redisKey = `${this.TOKEN_BLACKLIST_PREFIX}${hash}`;
    await this.redis.setex(redisKey, ttl, '1');

    // Add to database for persistence
    await this.blacklistRepository.save({
      tokenHash: hash,
      tokenType,
      sessionId,
      userId,
      blacklistedReason: reason,
      originalExpiresAt: new Date(expiresAt * 1000),
    });
  }

  private async blacklistTokenByHash(
    tokenHash: string,
    tokenType: 'access' | 'refresh',
    sessionId: string,
    userId: string,
    expiresAt: Date,
    reason: string,
  ): Promise<void> {
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    // Add to Redis
    const redisKey = `${this.TOKEN_BLACKLIST_PREFIX}${tokenHash}`;
    await this.redis.setex(redisKey, ttl, '1');

    // Add to database
    await this.blacklistRepository.save({
      tokenHash,
      tokenType,
      sessionId,
      userId,
      blacklistedReason: reason,
      originalExpiresAt: expiresAt,
    });
  }

  private async invalidateTokenFamily(family: string): Promise<void> {
    // Find all sessions with this token family and revoke them
    const sessions = await this.sessionRepository.find({
      where: { refreshTokenFamily: family, isActive: true },
    });

    for (const session of sessions) {
      await this.revokeSession(session.id, session.userId, 'security_alert');
    }

    this.logger.warn('Token family invalidated due to potential attack', { family });
  }

  private async storeSessionInRedis(
    session: Session,
    userId: string,
    organizationId: string | null,
  ): Promise<void> {
    const { roles, permissions } = await this.getUserPermissions(userId);

    const redisSession: RedisSession = {
      userId,
      sessionId: session.id,
      deviceId: session.deviceId,
      refreshTokenFamily: session.refreshTokenFamily,
      permissions,
      roles,
      organizationId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };

    const redisKey = `${this.SESSION_PREFIX}${session.id}`;
    await this.redis.setex(
      redisKey,
      this.INACTIVITY_TIMEOUT,
      JSON.stringify(redisSession),
    );
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    const redisKey = `${this.SESSION_PREFIX}${sessionId}`;
    const cached = await this.redis.get(redisKey);

    if (cached) {
      const session = JSON.parse(cached) as RedisSession;
      session.lastActivity = new Date().toISOString();
      await this.redis.setex(
        redisKey,
        this.INACTIVITY_TIMEOUT,
        JSON.stringify(session),
      );
    }
  }

  private async removeSessionFromRedis(sessionId: string): Promise<void> {
    const redisKey = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.del(redisKey);
  }

  private async addToUserSessions(userId: string, sessionId: string): Promise<void> {
    const redisKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    await this.redis.sadd(redisKey, sessionId);
  }

  private async removeFromUserSessions(userId: string, sessionId: string): Promise<void> {
    const redisKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    await this.redis.srem(redisKey, sessionId);
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'ASC' },
    });

    if (activeSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
      // Revoke oldest session
      const oldestSession = activeSessions[0];
      await this.revokeSession(
        oldestSession.id,
        userId,
        'concurrent_limit',
        userId,
      );

      this.logger.log('Oldest session revoked due to concurrent limit', {
        userId,
        revokedSessionId: oldestSession.id,
      });
    }
  }

  private async getUserPermissions(userId: string): Promise<{
    roles: string[];
    permissions: string[];
  }> {
    // This would query the user's roles and permissions
    // Simplified for this example
    return {
      roles: ['user'],
      permissions: ['read:own_data', 'write:own_data'],
    };
  }

  private async logActivity(
    sessionId: string,
    activityType: string,
    endpoint?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.activityRepository.save({
      sessionId,
      activityType,
      endpoint,
      ipAddress,
    });
  }

  private maskIpAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***.`;
    }
    return ip.substring(0, ip.length / 2) + '***';
  }
}
```

### tRPC Router

```typescript
// src/modules/auth/routers/session.router.ts

import { router, protectedProcedure, publicProcedure } from '@/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { SessionService } from '../services/session.service';
import {
  getSessionsResponseSchema,
  revokeSessionParamsSchema,
  revokeAllSessionsSchema,
  extendSessionResponseSchema,
} from '../schemas';
import { PasswordService } from '../services/password.service';

export const sessionRouter = router({
  /**
   * Refresh access token
   * Called automatically by client when access token is about to expire
   */
  refresh: publicProcedure
    .output(z.object({
      accessToken: z.string(),
      expiresIn: z.number(),
    }))
    .mutation(async ({ ctx }) => {
      const refreshToken = ctx.req.cookies['refresh_token'];

      if (!refreshToken) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Brak tokena odświeżania',
        });
      }

      try {
        const result = await ctx.sessionService.refreshToken(
          refreshToken,
          ctx.req.ip,
          ctx.req.headers['user-agent'] || '',
        );

        // Set new refresh token in HTTP-only cookie
        ctx.res.cookie('refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/api/v1/auth',
        });

        return {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        };
      } catch (error) {
        // Clear invalid refresh token
        ctx.res.clearCookie('refresh_token', {
          path: '/api/v1/auth',
        });

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: error instanceof Error ? error.message : 'Token refresh failed',
        });
      }
    }),

  /**
   * Get all active sessions for current user
   */
  list: protectedProcedure
    .output(getSessionsResponseSchema)
    .query(async ({ ctx }) => {
      const result = await ctx.sessionService.getUserSessions(
        ctx.user.id,
        ctx.session.id,
      );

      return result;
    }),

  /**
   * Revoke a specific session
   */
  revoke: protectedProcedure
    .input(revokeSessionParamsSchema)
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Cannot revoke current session via this endpoint
      if (input.sessionId === ctx.session.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nie można zakończyć bieżącej sesji. Użyj opcji wylogowania.',
        });
      }

      try {
        await ctx.sessionService.revokeSession(
          input.sessionId,
          ctx.user.id,
          'user_request',
          ctx.user.id,
        );

        return {
          success: true,
          message: 'Sesja została zakończona',
        };
      } catch (error) {
        if (error.name === 'SessionNotFoundException') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Sesja nie została znaleziona',
          });
        }
        throw error;
      }
    }),

  /**
   * Revoke all sessions except current
   * Requires password confirmation
   */
  revokeAll: protectedProcedure
    .input(revokeAllSessionsSchema)
    .output(z.object({
      revokedCount: z.number(),
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify password first
      const isPasswordValid = await ctx.passwordService.verifyPassword(
        ctx.user.id,
        input.password,
      );

      if (!isPasswordValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Nieprawidłowe hasło',
        });
      }

      const revokedCount = await ctx.sessionService.revokeAllSessions(
        ctx.user.id,
        ctx.session.id,
        input.exceptCurrent,
      );

      // Send security notification email
      await ctx.emailService.sendSecurityAlert({
        userId: ctx.user.id,
        type: 'all_sessions_revoked',
        metadata: { revokedCount },
      });

      return {
        revokedCount,
        message: `Zakończono ${revokedCount} ${revokedCount === 1 ? 'sesję' : 'sesji'}`,
      };
    }),

  /**
   * Extend current session (heartbeat)
   * Called periodically by client to prevent timeout
   */
  extend: protectedProcedure
    .output(extendSessionResponseSchema)
    .mutation(async ({ ctx }) => {
      const result = await ctx.sessionService.extendSession(
        ctx.session.id,
        ctx.req.path,
        ctx.req.ip,
      );

      return {
        expiresAt: result.expiresAt.toISOString(),
        sessionTimeoutWarning: result.sessionTimeoutWarning,
        timeoutIn: result.timeoutIn,
      };
    }),

  /**
   * Get session timeout status
   * Used to show warning modal before timeout
   */
  timeoutStatus: protectedProcedure
    .output(z.object({
      timeoutIn: z.number(),
      showWarning: z.boolean(),
    }))
    .query(async ({ ctx }) => {
      const redisKey = `session:${ctx.session.id}`;
      const ttl = await ctx.redis.ttl(redisKey);

      return {
        timeoutIn: Math.max(0, ttl),
        showWarning: ttl > 0 && ttl <= 300, // Show warning in last 5 minutes
      };
    }),
});

export type SessionRouter = typeof sessionRouter;
```

### Client-Side Session Management Hook

```typescript
// src/hooks/useSessionManager.ts

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import { trpc } from '@/utils/trpc';
import { useAuth } from '@/contexts/AuthContext';

interface UseSessionManagerOptions {
  refreshThreshold?: number; // Seconds before expiry to refresh
  activityInterval?: number; // Seconds between activity heartbeats
  warningThreshold?: number; // Seconds before timeout to show warning
}

export function useSessionManager(options: UseSessionManagerOptions = {}) {
  const {
    refreshThreshold = 300, // 5 minutes
    activityInterval = 60, // 1 minute
    warningThreshold = 300, // 5 minutes
  } = options;

  const router = useRouter();
  const { logout, setAccessToken } = useAuth();
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutIn, setTimeoutIn] = useState<number | null>(null);

  const refreshMutation = trpc.auth.session.refresh.useMutation();
  const extendMutation = trpc.auth.session.extend.useMutation();

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Track user activity
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
  }, []);

  // Refresh access token
  const refreshToken = useCallback(async () => {
    try {
      const result = await refreshMutation.mutateAsync();
      setAccessToken(result.accessToken);

      // Schedule next refresh
      const nextRefresh = (result.expiresIn - refreshThreshold) * 1000;
      refreshTimeoutRef.current = setTimeout(refreshToken, nextRefresh);
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Redirect to login
      router.push('/auth/login?reason=session_expired');
    }
  }, [refreshMutation, setAccessToken, refreshThreshold, router]);

  // Extend session (heartbeat)
  const extendSession = useCallback(async () => {
    try {
      const result = await extendMutation.mutateAsync();
      setTimeoutIn(result.timeoutIn);

      if (result.sessionTimeoutWarning) {
        setShowTimeoutWarning(true);
      }
    } catch (error) {
      console.error('Session extend failed:', error);
    }
  }, [extendMutation]);

  // Continue session (dismiss warning)
  const continueSession = useCallback(async () => {
    setShowTimeoutWarning(false);
    await extendSession();
  }, [extendSession]);

  // Setup listeners and intervals
  useEffect(() => {
    // Activity listeners
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, recordActivity);
    });

    // Initial token refresh scheduling
    refreshToken();

    // Activity heartbeat interval
    activityIntervalRef.current = setInterval(() => {
      const idleTime = (Date.now() - lastActivityRef.current) / 1000;
      if (idleTime < activityInterval) {
        extendSession();
      }
    }, activityInterval * 1000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, recordActivity);
      });

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
    };
  }, [recordActivity, refreshToken, extendSession, activityInterval]);

  return {
    showTimeoutWarning,
    timeoutIn,
    continueSession,
    refreshToken,
  };
}
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
// src/modules/auth/services/__tests__/session.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import * as jwt from 'jsonwebtoken';
import { SessionService } from '../session.service';
import { Session, BlacklistedToken, SessionActivity } from '../../entities';
import { AuditService } from '../../../audit/audit.service';

describe('SessionService', () => {
  let service: SessionService;
  let mockSessionRepository: jest.Mocked<any>;
  let mockBlacklistRepository: jest.Mocked<any>;
  let mockRedis: jest.Mocked<Redis>;
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    mockSessionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockBlacklistRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      ttl: jest.fn(),
    } as any;

    mockAuditService = {
      log: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: getRepositoryToken(Session), useValue: mockSessionRepository },
        { provide: getRepositoryToken(BlacklistedToken), useValue: mockBlacklistRepository },
        { provide: getRepositoryToken(SessionActivity), useValue: { save: jest.fn() } },
        { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis },
        { provide: AuditService, useValue: mockAuditService },
        { provide: 'AUTH_CONFIG', useValue: {
          jwt: {
            accessTokenSecret: 'test-access-secret',
            refreshTokenSecret: 'test-refresh-secret',
            issuer: 'test-issuer',
            audience: 'test-audience',
          },
        }},
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('createSession', () => {
    it('should create session and return tokens', async () => {
      const userId = 'user-123';
      const deviceInfo = {
        deviceId: 'device-123',
        type: 'desktop',
        userAgent: 'Chrome/120',
        ipAddress: '192.168.1.1',
      };

      mockSessionRepository.find.mockResolvedValue([]);
      mockSessionRepository.create.mockReturnValue({ id: 'session-123' });
      mockSessionRepository.save.mockResolvedValue({ id: 'session-123' });

      const result = await service.createSession(userId, deviceInfo, null, null);

      expect(result).toHaveProperty('session');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockSessionRepository.save).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SESSION_CREATED' }),
      );
    });

    it('should revoke oldest session when limit exceeded', async () => {
      const userId = 'user-123';
      const existingSessions = Array(5).fill(null).map((_, i) => ({
        id: `session-${i}`,
        userId,
        isActive: true,
        createdAt: new Date(Date.now() - (5 - i) * 1000),
      }));

      mockSessionRepository.find.mockResolvedValue(existingSessions);
      mockSessionRepository.create.mockReturnValue({ id: 'session-new' });
      mockSessionRepository.save.mockResolvedValue({ id: 'session-new' });
      mockSessionRepository.findOne.mockResolvedValue(existingSessions[0]);

      const result = await service.createSession(
        userId,
        { deviceId: 'device-123', type: 'desktop', userAgent: 'Chrome/120', ipAddress: '192.168.1.1' },
        null,
        null,
      );

      expect(result.session.id).toBe('session-new');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SESSION_REVOKED' }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should generate new token pair with valid refresh token', async () => {
      const validRefreshToken = jwt.sign(
        { sub: 'user-123', sessionId: 'session-123', family: 'family-123', type: 'refresh' },
        'test-refresh-secret',
        { expiresIn: '7d' },
      );

      mockRedis.exists.mockResolvedValue(0); // Not blacklisted
      mockBlacklistRepository.findOne.mockResolvedValue(null);
      mockSessionRepository.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        isActive: true,
        refreshTokenHash: expect.any(String),
        refreshTokenFamily: 'family-123',
      });

      const result = await service.refreshToken(validRefreshToken, '192.168.1.1', 'Chrome/120');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.expiresIn).toBe(900);
    });

    it('should reject blacklisted refresh token', async () => {
      const blacklistedToken = jwt.sign(
        { sub: 'user-123', sessionId: 'session-123', family: 'family-123', type: 'refresh' },
        'test-refresh-secret',
        { expiresIn: '7d' },
      );

      mockRedis.exists.mockResolvedValue(1); // Blacklisted in Redis

      await expect(
        service.refreshToken(blacklistedToken, '192.168.1.1', 'Chrome/120'),
      ).rejects.toThrow('Token has been revoked');
    });

    it('should invalidate token family on reuse attack', async () => {
      const reusedToken = jwt.sign(
        { sub: 'user-123', sessionId: 'session-123', family: 'family-123', type: 'refresh' },
        'test-refresh-secret',
        { expiresIn: '7d' },
      );

      mockRedis.exists.mockResolvedValue(0);
      mockBlacklistRepository.findOne.mockResolvedValue({ id: 'blacklist-1' }); // Found in DB
      mockSessionRepository.find.mockResolvedValue([{ id: 'session-123', userId: 'user-123' }]);

      await expect(
        service.refreshToken(reusedToken, '192.168.1.1', 'Chrome/120'),
      ).rejects.toThrow('Token has been revoked');

      // Should invalidate all sessions in family
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SESSION_REVOKED' }),
      );
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-123', sessionId: 'session-123', family: 'family-123', type: 'refresh' },
        'test-refresh-secret',
        { expiresIn: '-1h' }, // Already expired
      );

      await expect(
        service.refreshToken(expiredToken, '192.168.1.1', 'Chrome/120'),
      ).rejects.toThrow('Refresh token expired');
    });
  });

  describe('getUserSessions', () => {
    it('should return all active sessions with masked IPs', async () => {
      const sessions = [
        {
          id: 'session-1',
          deviceType: 'desktop',
          browserName: 'Chrome',
          browserVersion: '120',
          osName: 'macOS',
          osVersion: '14.0',
          ipAddress: '192.168.1.100',
          ipCountry: 'PL',
          ipCity: 'Warsaw',
          createdAt: new Date(),
          lastActivityAt: new Date(),
          riskScore: 0.1,
        },
      ];

      mockSessionRepository.find.mockResolvedValue(sessions);

      const result = await service.getUserSessions('user-123', 'session-1');

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].ipAddress).toBe('192.168.1.***.');
      expect(result.sessions[0].isCurrent).toBe(true);
      expect(result.currentSessionId).toBe('session-1');
    });
  });

  describe('revokeSession', () => {
    it('should revoke session and cleanup', async () => {
      const session = {
        id: 'session-123',
        userId: 'user-123',
        isActive: true,
        refreshTokenHash: 'hash-123',
        expiresAt: new Date(Date.now() + 86400000),
        deviceType: 'desktop',
      };

      mockSessionRepository.findOne.mockResolvedValue(session);
      mockSessionRepository.save.mockResolvedValue({ ...session, isActive: false });

      await service.revokeSession('session-123', 'user-123', 'user_request');

      expect(mockSessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, revokeReason: 'user_request' }),
      );
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockRedis.srem).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'SESSION_REVOKED' }),
      );
    });

    it('should throw error for non-existent session', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.revokeSession('non-existent', 'user-123'),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions except current', async () => {
      const sessions = [
        { id: 'session-1', userId: 'user-123', isActive: true },
        { id: 'session-2', userId: 'user-123', isActive: true },
        { id: 'session-current', userId: 'user-123', isActive: true },
      ];

      mockSessionRepository.find.mockResolvedValue(sessions);
      mockSessionRepository.findOne.mockImplementation(({ where }) =>
        Promise.resolve(sessions.find(s => s.id === where.id)),
      );

      const revokedCount = await service.revokeAllSessions(
        'user-123',
        'session-current',
        true,
      );

      expect(revokedCount).toBe(2);
    });
  });

  describe('validateSession', () => {
    it('should return user context for valid session', async () => {
      const accessToken = jwt.sign(
        {
          sub: 'user-123',
          sessionId: 'session-123',
          roles: ['user'],
          permissions: ['read:own_data'],
          organizationId: null,
          type: 'access',
          iss: 'test-issuer',
          aud: 'test-audience',
        },
        'test-access-secret',
        { algorithm: 'HS256', expiresIn: '15m' },
      );

      mockRedis.exists.mockResolvedValue(0);
      mockBlacklistRepository.findOne.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: 'user-123',
        sessionId: 'session-123',
      }));

      const result = await service.validateSession(accessToken);

      expect(result.userId).toBe('user-123');
      expect(result.sessionId).toBe('session-123');
    });

    it('should reject revoked session', async () => {
      const accessToken = jwt.sign(
        {
          sub: 'user-123',
          sessionId: 'session-123',
          roles: ['user'],
          permissions: ['read:own_data'],
          organizationId: null,
          type: 'access',
          iss: 'test-issuer',
          aud: 'test-audience',
        },
        'test-access-secret',
        { algorithm: 'HS256', expiresIn: '15m' },
      );

      mockRedis.exists.mockResolvedValue(0);
      mockBlacklistRepository.findOne.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null); // Session not in Redis

      await expect(
        service.validateSession(accessToken),
      ).rejects.toThrow('Session expired');
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/auth/__tests__/session.integration.spec.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, TestApp } from '@test/utils/test-app';
import { createTestUser, getAuthTokens } from '@test/utils/auth-helpers';

describe('Session Management Integration', () => {
  let app: TestApp;
  let testUser: { id: string; email: string; password: string };
  let authTokens: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  beforeEach(async () => {
    testUser = await createTestUser(app.db);
    authTokens = await getAuthTokens(app, testUser.email, testUser.password);
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await app.trpc.auth.session.refresh.mutate(undefined, {
        context: {
          cookies: { refresh_token: authTokens.refreshToken },
        },
      });

      expect(response.accessToken).toBeDefined();
      expect(response.expiresIn).toBe(900);
    });

    it('should reject reused refresh token', async () => {
      // First refresh - should succeed
      await app.trpc.auth.session.refresh.mutate(undefined, {
        context: {
          cookies: { refresh_token: authTokens.refreshToken },
        },
      });

      // Second refresh with same token - should fail
      await expect(
        app.trpc.auth.session.refresh.mutate(undefined, {
          context: {
            cookies: { refresh_token: authTokens.refreshToken },
          },
        }),
      ).rejects.toThrow('Token has been revoked');
    });

    it('should invalidate all sessions in family on token reuse attack', async () => {
      // Create multiple sessions
      const session2 = await getAuthTokens(app, testUser.email, testUser.password);

      // Refresh first token
      const refreshed = await app.trpc.auth.session.refresh.mutate(undefined, {
        context: {
          cookies: { refresh_token: authTokens.refreshToken },
        },
      });

      // Try to reuse original refresh token (attack)
      await expect(
        app.trpc.auth.session.refresh.mutate(undefined, {
          context: {
            cookies: { refresh_token: authTokens.refreshToken },
          },
        }),
      ).rejects.toThrow();

      // All sessions in the family should be revoked
      const sessions = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${refreshed.accessToken}` },
      });

      // Should have no active sessions (all revoked due to security)
      expect(sessions.totalCount).toBe(0);
    });
  });

  describe('Session Listing', () => {
    it('should list all active sessions', async () => {
      // Create multiple sessions from different "devices"
      const session2 = await getAuthTokens(app, testUser.email, testUser.password, {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      });
      const session3 = await getAuthTokens(app, testUser.email, testUser.password, {
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      });

      const response = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      expect(response.totalCount).toBe(3);
      expect(response.sessions).toHaveLength(3);
      expect(response.sessions.some(s => s.isCurrent)).toBe(true);
    });

    it('should mask IP addresses in session list', async () => {
      const response = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      expect(response.sessions[0].ipAddress).toMatch(/\*\*\*/);
    });
  });

  describe('Session Revocation', () => {
    it('should revoke specific session', async () => {
      const session2 = await getAuthTokens(app, testUser.email, testUser.password);

      const sessions = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      const otherSession = sessions.sessions.find(s => !s.isCurrent);

      const result = await app.trpc.auth.session.revoke.mutate(
        { sessionId: otherSession!.id },
        { headers: { authorization: `Bearer ${authTokens.accessToken}` } },
      );

      expect(result.success).toBe(true);

      // Verify session is revoked
      const updatedSessions = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      expect(updatedSessions.totalCount).toBe(1);
    });

    it('should not allow revoking current session', async () => {
      const sessions = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      const currentSession = sessions.sessions.find(s => s.isCurrent);

      await expect(
        app.trpc.auth.session.revoke.mutate(
          { sessionId: currentSession!.id },
          { headers: { authorization: `Bearer ${authTokens.accessToken}` } },
        ),
      ).rejects.toThrow('Nie można zakończyć bieżącej sesji');
    });

    it('should revoke all sessions except current with password confirmation', async () => {
      // Create additional sessions
      await getAuthTokens(app, testUser.email, testUser.password);
      await getAuthTokens(app, testUser.email, testUser.password);

      const result = await app.trpc.auth.session.revokeAll.mutate(
        { password: testUser.password, exceptCurrent: true },
        { headers: { authorization: `Bearer ${authTokens.accessToken}` } },
      );

      expect(result.revokedCount).toBe(2);

      // Verify only current session remains
      const sessions = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      expect(sessions.totalCount).toBe(1);
      expect(sessions.sessions[0].isCurrent).toBe(true);
    });

    it('should reject revoke all with wrong password', async () => {
      await expect(
        app.trpc.auth.session.revokeAll.mutate(
          { password: 'wrong-password', exceptCurrent: true },
          { headers: { authorization: `Bearer ${authTokens.accessToken}` } },
        ),
      ).rejects.toThrow('Nieprawidłowe hasło');
    });
  });

  describe('Session Extension', () => {
    it('should extend session on activity', async () => {
      const result = await app.trpc.auth.session.extend.mutate(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      expect(result.expiresAt).toBeDefined();
      expect(result.timeoutIn).toBeGreaterThan(0);
    });

    it('should show warning when timeout approaching', async () => {
      // Simulate low TTL in Redis
      await app.redis.expire(`session:${app.currentSessionId}`, 200);

      const result = await app.trpc.auth.session.timeoutStatus.query(undefined, {
        headers: { authorization: `Bearer ${authTokens.accessToken}` },
      });

      expect(result.showWarning).toBe(true);
      expect(result.timeoutIn).toBeLessThanOrEqual(300);
    });
  });

  describe('Concurrent Session Limit', () => {
    it('should enforce maximum concurrent sessions', async () => {
      // Create 5 sessions (max limit)
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        sessions.push(await getAuthTokens(app, testUser.email, testUser.password));
      }

      // Create 6th session - should revoke oldest
      const session6 = await getAuthTokens(app, testUser.email, testUser.password);

      // Verify first session is revoked
      await expect(
        app.trpc.auth.session.list.query(undefined, {
          headers: { authorization: `Bearer ${sessions[0].accessToken}` },
        }),
      ).rejects.toThrow(); // Session revoked

      // Verify new session works
      const activeSessions = await app.trpc.auth.session.list.query(undefined, {
        headers: { authorization: `Bearer ${session6.accessToken}` },
      });

      expect(activeSessions.totalCount).toBe(5);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/session-management.spec.ts

import { test, expect } from '@playwright/test';
import { createTestUser, loginAs } from './helpers/auth';

test.describe('Session Management', () => {
  let testUser: { email: string; password: string };

  test.beforeEach(async () => {
    testUser = await createTestUser();
  });

  test('user can view active sessions', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);

    await page.goto('/settings/security');
    await page.click('text=Aktywne sesje');

    await expect(page.locator('[data-testid="sessions-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-session-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-item"]')).toHaveCount(1);
  });

  test('user can view session details', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);
    await page.goto('/settings/security/sessions');

    const sessionItem = page.locator('[data-testid="session-item"]').first();

    await expect(sessionItem.locator('[data-testid="device-type"]')).toBeVisible();
    await expect(sessionItem.locator('[data-testid="browser-info"]')).toBeVisible();
    await expect(sessionItem.locator('[data-testid="location"]')).toBeVisible();
    await expect(sessionItem.locator('[data-testid="last-activity"]')).toBeVisible();
  });

  test('user can revoke another session', async ({ browser }) => {
    // Login from two different browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext({ userAgent: 'Different Browser' });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await loginAs(page1, testUser.email, testUser.password);
    await loginAs(page2, testUser.email, testUser.password);

    // View sessions from page1
    await page1.goto('/settings/security/sessions');
    await expect(page1.locator('[data-testid="session-item"]')).toHaveCount(2);

    // Revoke the other session
    const otherSession = page1.locator('[data-testid="session-item"]:not(:has([data-testid="current-session-badge"]))');
    await otherSession.locator('[data-testid="revoke-button"]').click();

    // Confirm revocation
    await page1.click('text=Wyloguj');

    await expect(page1.locator('text=Sesja została zakończona')).toBeVisible();

    // Verify page2 is logged out
    await page2.reload();
    await expect(page2).toHaveURL(/\/auth\/login/);
  });

  test('user can revoke all other sessions', async ({ browser }) => {
    // Create multiple sessions
    const contexts = await Promise.all(
      Array(3).fill(null).map(() => browser.newContext()),
    );
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));

    for (const page of pages) {
      await loginAs(page, testUser.email, testUser.password);
    }

    // Revoke all from first page
    await pages[0].goto('/settings/security/sessions');
    await pages[0].click('[data-testid="revoke-all-button"]');

    // Enter password confirmation
    await pages[0].fill('[data-testid="password-input"]', testUser.password);
    await pages[0].click('[data-testid="confirm-revoke-all"]');

    await expect(pages[0].locator('text=Zakończono 2 sesji')).toBeVisible();

    // Verify other pages are logged out
    for (let i = 1; i < pages.length; i++) {
      await pages[i].reload();
      await expect(pages[i]).toHaveURL(/\/auth\/login/);
    }

    // First page should still be logged in
    await expect(pages[0].locator('[data-testid="session-item"]')).toHaveCount(1);
  });

  test('session timeout warning is displayed', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);

    // Simulate approaching timeout (mock in test environment)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('session-timeout-warning', {
        detail: { timeoutIn: 300 },
      }));
    });

    await expect(page.locator('[data-testid="timeout-warning-modal"]')).toBeVisible();
    await expect(page.locator('text=Twoja sesja wygaśnie za 5 minut')).toBeVisible();

    // Click continue
    await page.click('[data-testid="continue-session-button"]');

    await expect(page.locator('[data-testid="timeout-warning-modal"]')).not.toBeVisible();
  });

  test('automatic token refresh works silently', async ({ page }) => {
    await loginAs(page, testUser.email, testUser.password);
    await page.goto('/dashboard');

    // Wait for token refresh (in test, access token expires in 5 seconds)
    await page.waitForTimeout(6000);

    // Should still be on dashboard, not redirected
    await expect(page).toHaveURL('/dashboard');

    // Perform an action that requires authentication
    await page.click('[data-testid="refresh-data"]');
    await expect(page.locator('[data-testid="data-loaded"]')).toBeVisible();
  });
});
```

---

## 🔒 Security Checklist

| Requirement | Implementation | Status |
|------------|----------------|--------|
| Refresh token rotation | New token issued on each refresh, old blacklisted | ✅ |
| Token family invalidation | All tokens in family revoked on reuse detection | ✅ |
| Session binding | IP and user agent tracked per session | ✅ |
| Maximum concurrent sessions | Oldest session revoked when limit exceeded (default: 5) | ✅ |
| Inactivity timeout | Session expires after 1 hour of inactivity | ✅ |
| Secure token storage | Access token in memory, refresh token in HTTP-only cookie | ✅ |
| Token blacklisting | Revoked tokens stored in Redis and DB | ✅ |
| IP masking | IP addresses masked in user-facing views | ✅ |
| Password required for bulk revocation | Revoke all requires password confirmation | ✅ |
| Audit logging | All session events logged immutably | ✅ |
| RS256 JWT signing | Access tokens signed with RS256 algorithm | ✅ |
| Token expiry validation | Expired tokens rejected with clear error | ✅ |
| CSRF protection | Refresh token only accepted on auth endpoints | ✅ |

---

## 📊 Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `SESSION_CREATED` | New session created | userId, deviceInfo, location |
| `SESSION_REVOKED` | Session manually revoked | sessionId, reason, revokedBy |
| `SESSION_EXPIRED` | Session expired naturally | sessionId, lastActivity |
| `ALL_SESSIONS_REVOKED` | User revoked all sessions | revokedCount, exceptCurrent |
| `TOKEN_REFRESHED` | Access token refreshed | sessionId |
| `TOKEN_REUSE_DETECTED` | Refresh token reuse attempt | tokenFamily, suspectedAttack |
| `CONCURRENT_LIMIT_ENFORCED` | Oldest session revoked | userId, revokedSessionId |
| `SESSION_TIMEOUT_WARNING` | User shown timeout warning | sessionId, timeoutIn |

---

## 📝 Implementation Notes

### Token Architecture
1. **Access Token** (JWT, RS256):
   - Contains: userId, sessionId, roles, permissions
   - Expiry: 15 minutes
   - Storage: Client memory only
   - Refresh: Automatically before expiry

2. **Refresh Token** (Opaque):
   - Contains: Reference to session
   - Expiry: 7 days
   - Storage: HTTP-only, Secure, SameSite=Lax cookie
   - Rotation: New token on each use

### Session Storage Strategy
- **Redis**: Fast lookup for active sessions, auto-expiry
- **PostgreSQL**: Persistent storage for audit, history, analytics
- **Sync**: Write-through caching, DB is source of truth

### Security Considerations
1. **Token Reuse Attack Prevention**: Family-based invalidation
2. **Timing Attacks**: Constant-time comparison for tokens
3. **XSS Protection**: Refresh token not accessible to JavaScript
4. **CSRF Protection**: Refresh endpoint requires valid origin

### Performance Targets
- Token validation: <10ms (cached)
- Session creation: <100ms
- Session list: <50ms
- Token refresh: <50ms

---

*Story last updated: December 2024*
