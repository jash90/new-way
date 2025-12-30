# Story: User Login (AIM-003)

> **Story ID**: AIM-003
> **Epic**: Authentication & Identity Management (AIM)
> **Priority**: P0 (Core)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Dependencies**: AIM-001 (User Registration)

---

## User Story

**As a** registered user with verified email,
**I want to** securely log into the platform,
**So that** I can access my account and perform authorized actions.

---

## Acceptance Criteria

### Scenario 1: Successful Login
```gherkin
Feature: User Login
  As a registered user
  I need to log in with my credentials
  So that I can access the platform

  Scenario: Login with valid credentials
    Given I am a registered user with email "jan@example.com"
    And my email is verified
    And I am on the login page
    When I enter "jan@example.com" as email
    And I enter my correct password
    And I click "Zaloguj się"
    Then I should be logged in successfully
    And I should be redirected to the dashboard
    And a new session should be created
    And I should see "Witaj ponownie!"

  Scenario: Login with "Remember me" option
    Given I am on the login page
    When I enter valid credentials
    And I check "Zapamiętaj mnie" checkbox
    And I click "Zaloguj się"
    Then I should be logged in
    And my session should last 30 days instead of 24 hours
    And a persistent cookie should be set

  Scenario: Login with unverified email
    Given I am a registered user with unverified email
    When I try to log in with valid credentials
    Then I should see error "Proszę zweryfikować adres email przed zalogowaniem"
    And I should see option to resend verification email
    And login should be blocked
```

### Scenario 2: Failed Login Attempts
```gherkin
Feature: Login Failure Handling
  As a security measure
  The system should handle failed login attempts properly

  Scenario: Login with wrong password
    Given I am on the login page
    When I enter valid email
    And I enter wrong password
    And I click "Zaloguj się"
    Then I should see error "Nieprawidłowy email lub hasło"
    And I should remain on the login page
    And failed attempt should be logged

  Scenario: Login with non-existent email
    Given I am on the login page
    When I enter "nieistnieje@example.com" as email
    And I enter any password
    And I click "Zaloguj się"
    Then I should see error "Nieprawidłowy email lub hasło"
    And the error message should be identical to wrong password error
    And response time should be similar to prevent timing attacks

  Scenario: Login with empty fields
    Given I am on the login page
    When I leave email field empty
    And I click "Zaloguj się"
    Then I should see validation error "Email jest wymagany"

  Scenario: Login with invalid email format
    Given I am on the login page
    When I enter "nieprawidlowy-email" as email
    And I click "Zaloguj się"
    Then I should see validation error "Nieprawidłowy format adresu email"
```

### Scenario 3: Rate Limiting and Account Lockout
```gherkin
Feature: Login Rate Limiting
  As a security measure
  The system should prevent brute force attacks

  Scenario: Rate limiting after multiple failed attempts
    Given I am on the login page
    When I enter valid email
    And I fail to enter correct password 5 times within 15 minutes
    Then I should see error "Zbyt wiele nieudanych prób. Spróbuj ponownie za 15 minut."
    And further login attempts should be blocked for 15 minutes
    And I should see countdown timer

  Scenario: Account lockout after excessive failures
    Given I have failed login 10 times within 1 hour
    When I try to log in again
    Then my account should be temporarily locked
    And I should see "Konto tymczasowo zablokowane. Sprawdź email."
    And I should receive security alert email
    And lockout should last 1 hour

  Scenario: Successful login resets failure counter
    Given I have failed login 3 times
    When I successfully log in
    Then my failed attempt counter should be reset
    And I should be logged in normally

  Scenario: IP-based rate limiting
    Given multiple failed login attempts from same IP
    When 20 failed attempts occur from my IP within 1 hour
    Then all login attempts from this IP should be temporarily blocked
    And block should apply regardless of email used
```

### Scenario 4: Session Management
```gherkin
Feature: Session Creation on Login
  As a logged in user
  I need a secure session to maintain my authentication

  Scenario: Create new session on login
    Given I log in successfully
    Then a new session should be created in the database
    And session should contain my user ID
    And session should have unique token
    And session token should be stored in HTTP-only cookie
    And session should be stored in Redis cache

  Scenario: Expire old sessions
    Given I have an existing session
    When I log in from a new device
    Then a new session should be created
    And old session should remain active
    And I should have maximum 5 concurrent sessions

  Scenario: Session information captured
    Given I log in successfully
    Then session should capture:
      | Field | Example Value |
      | IP address | 192.168.1.100 |
      | User agent | Mozilla/5.0 Chrome/120 |
      | Device type | Desktop |
      | Location | Warsaw, Poland |
      | Login timestamp | 2024-12-28 10:30:00 |
```

### Scenario 5: New Device/Location Detection
```gherkin
Feature: Login Security Alerts
  As a user
  I want to be notified of suspicious login activity

  Scenario: Login from new device
    Given I log in from a device I haven't used before
    When login is successful
    Then I should receive email "Nowe logowanie do konta"
    And email should contain device information
    And email should have "To nie ja" button
    And login should complete normally

  Scenario: Login from new location
    Given I usually log in from Warsaw, Poland
    When I log in from Berlin, Germany
    Then I should receive security alert email
    And email should mention unusual location
    And I should be prompted to verify this login

  Scenario: Login from suspicious IP
    Given the IP address is on a known threat list
    When I try to log in
    Then additional verification may be required
    And security team should be alerted
    And login attempt should be flagged for review
```

### Scenario 6: MFA Integration (Preparation)
```gherkin
Feature: MFA-Ready Login Flow
  As a user with MFA enabled
  I need to complete second factor after password

  Scenario: Redirect to MFA if enabled
    Given I am a user with MFA enabled
    When I enter valid email and password
    Then I should see "Weryfikacja dwuetapowa"
    And I should be prompted for TOTP code
    And password verification should be complete
    And MFA challenge should be created

  Scenario: Login without MFA when not enabled
    Given I am a user without MFA enabled
    When I enter valid credentials
    Then I should be logged in directly
    And I should not see MFA prompt
```

---

## Technical Specification

### Database Schema

```sql
-- Login attempts tracking (extends auth_audit_logs)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason VARCHAR(100),
    device_fingerprint VARCHAR(255),
    geo_location JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Known devices for users
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_trusted BOOLEAN DEFAULT false,
    trust_expires_at TIMESTAMPTZ,
    UNIQUE(user_id, device_fingerprint)
);

-- Rate limiting state (also in Redis for performance)
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- email or IP
    identifier_type VARCHAR(20) NOT NULL, -- 'email', 'ip'
    attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(identifier, identifier_type)
);

-- Sessions table extension
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
    device_id UUID REFERENCES user_devices(id) ON DELETE SET NULL;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
    login_ip INET;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
    geo_location JSONB;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
    is_remembered BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_created ON login_attempts(created_at DESC);
CREATE INDEX idx_login_attempts_user ON login_attempts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_devices_user ON user_devices(user_id);
CREATE INDEX idx_user_devices_fingerprint ON user_devices(device_fingerprint);
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier, identifier_type);
CREATE INDEX idx_rate_limits_locked ON rate_limits(locked_until) WHERE locked_until IS NOT NULL;

-- Cleanup old login attempts (retention: 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
    DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

### API Endpoints

```typescript
// Authentication Endpoints
POST   /api/v1/auth/login           // User login
POST   /api/v1/auth/logout          // User logout
POST   /api/v1/auth/refresh         // Refresh access token
GET    /api/v1/auth/session         // Get current session info
DELETE /api/v1/auth/sessions/:id    // Revoke specific session
DELETE /api/v1/auth/sessions        // Revoke all sessions

// Device Management
GET    /api/v1/auth/devices         // List user's devices
DELETE /api/v1/auth/devices/:id     // Remove device
PUT    /api/v1/auth/devices/:id/trust // Trust a device
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Login request schema
export const loginSchema = z.object({
  email: z.string()
    .email('Nieprawidłowy format adresu email')
    .max(255, 'Email może mieć maksimum 255 znaków')
    .transform(val => val.toLowerCase().trim()),
  password: z.string()
    .min(1, 'Hasło jest wymagane')
    .max(128, 'Hasło jest zbyt długie'),
  rememberMe: z.boolean().default(false),
  deviceFingerprint: z.string().optional(),
});

// Login response schema
export const loginResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    profileCompleted: z.boolean(),
  }).optional(),
  session: z.object({
    id: z.string().uuid(),
    expiresAt: z.string().datetime(),
    isRemembered: z.boolean(),
  }).optional(),
  requiresMfa: z.boolean().default(false),
  mfaChallenge: z.object({
    challengeId: z.string().uuid(),
    method: z.enum(['totp', 'backup_code']),
    expiresAt: z.string().datetime(),
  }).optional(),
  redirectTo: z.string().optional(),
});

// Rate limit error schema
export const rateLimitErrorSchema = z.object({
  error: z.literal('RATE_LIMITED'),
  message: z.string(),
  retryAfter: z.number(), // seconds
  lockoutUntil: z.string().datetime().optional(),
});

// Session info schema
export const sessionInfoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  ipAddress: z.string(),
  userAgent: z.string(),
  deviceType: z.string(),
  location: z.string().nullable(),
  isCurrent: z.boolean(),
  isRemembered: z.boolean(),
});

// Device schema
export const deviceSchema = z.object({
  id: z.string().uuid(),
  deviceName: z.string().nullable(),
  deviceType: z.string(),
  browser: z.string(),
  os: z.string(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  isTrusted: z.boolean(),
  isCurrentDevice: z.boolean(),
});
```

### Implementation

```typescript
// src/modules/aim/services/auth.service.ts
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { HashService } from './hash.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { AuditService } from './audit.service';
import { EmailService } from '@/infrastructure/email/email.service';
import { GeoLocationService } from './geolocation.service';
import { DeviceService } from './device.service';
import { LoginDto, LoginResponse } from '../dto/auth.dto';
import * as argon2 from 'argon2';

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil?: Date;
  retryAfter?: number;
}

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;
  private readonly ACCOUNT_LOCKOUT_ATTEMPTS = 10;
  private readonly ACCOUNT_LOCKOUT_HOURS = 1;
  private readonly IP_RATE_LIMIT = 20;
  private readonly SESSION_DURATION_HOURS = 24;
  private readonly REMEMBERED_SESSION_DAYS = 30;
  private readonly MAX_CONCURRENT_SESSIONS = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly hashService: HashService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly geoService: GeoLocationService,
    private readonly deviceService: DeviceService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<LoginResponse> {
    const startTime = Date.now();

    // Check rate limits before any database operations
    const rateLimitResult = await this.checkRateLimits(dto.email, metadata.ipAddress);
    if (!rateLimitResult.allowed) {
      await this.recordLoginAttempt({
        email: dto.email,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'RATE_LIMITED',
      });

      throw new ForbiddenException({
        error: 'RATE_LIMITED',
        message: 'Zbyt wiele nieudanych prób. Spróbuj ponownie później.',
        retryAfter: rateLimitResult.retryAfter,
        lockoutUntil: rateLimitResult.lockedUntil?.toISOString(),
      });
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        profile: true,
        mfaSettings: true,
      },
    });

    // Constant-time comparison to prevent timing attacks
    const isValidPassword = user
      ? await this.hashService.verify(user.passwordHash, dto.password)
      : await this.hashService.verify('dummy-hash', dto.password);

    // Ensure consistent response time
    const elapsed = Date.now() - startTime;
    const minResponseTime = 200; // milliseconds
    if (elapsed < minResponseTime) {
      await this.delay(minResponseTime - elapsed);
    }

    if (!user || !isValidPassword) {
      await this.handleFailedLogin(dto.email, metadata, user?.id);
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      await this.recordLoginAttempt({
        email: dto.email,
        userId: user.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'EMAIL_NOT_VERIFIED',
      });

      throw new UnauthorizedException({
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Proszę zweryfikować adres email przed zalogowaniem',
        canResendVerification: true,
      });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginAttempt({
        email: dto.email,
        userId: user.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'ACCOUNT_LOCKED',
      });

      throw new ForbiddenException({
        error: 'ACCOUNT_LOCKED',
        message: 'Konto tymczasowo zablokowane. Sprawdź email.',
        lockedUntil: user.lockedUntil.toISOString(),
      });
    }

    // Check if MFA is required
    if (user.mfaSettings?.enabled) {
      const mfaChallenge = await this.createMfaChallenge(user.id);

      await this.recordLoginAttempt({
        email: dto.email,
        userId: user.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: true,
        failureReason: null,
        note: 'MFA_REQUIRED',
      });

      return {
        success: true,
        requiresMfa: true,
        mfaChallenge: {
          challengeId: mfaChallenge.id,
          method: user.mfaSettings.method,
          expiresAt: mfaChallenge.expiresAt.toISOString(),
        },
      };
    }

    // Complete login
    return this.completeLogin(user, dto, metadata);
  }

  private async completeLogin(
    user: any,
    dto: LoginDto,
    metadata: RequestMetadata,
  ): Promise<LoginResponse> {
    // Handle device tracking
    const device = await this.deviceService.findOrCreateDevice(
      user.id,
      dto.deviceFingerprint,
      metadata,
    );

    const isNewDevice = device.firstSeenAt.getTime() === device.lastSeenAt.getTime();
    const isNewLocation = await this.checkNewLocation(user.id, metadata.ipAddress);

    // Enforce max concurrent sessions
    await this.enforceSessionLimit(user.id);

    // Create session
    const sessionDuration = dto.rememberMe
      ? this.REMEMBERED_SESSION_DAYS * 24 * 60 * 60 * 1000
      : this.SESSION_DURATION_HOURS * 60 * 60 * 1000;

    const session = await this.sessionService.create({
      userId: user.id,
      deviceId: device.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt: new Date(Date.now() + sessionDuration),
      isRemembered: dto.rememberMe,
      geoLocation: await this.geoService.lookup(metadata.ipAddress),
    });

    // Generate tokens
    const tokens = await this.tokenService.generatePair(user.id, session.id);

    // Reset failed attempts
    await this.resetFailedAttempts(dto.email, metadata.ipAddress);

    // Record successful login
    await this.recordLoginAttempt({
      email: dto.email,
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: true,
      deviceFingerprint: dto.deviceFingerprint,
      geoLocation: session.geoLocation,
    });

    // Send security alerts if needed
    if (isNewDevice) {
      await this.sendNewDeviceAlert(user, device, metadata);
    }

    if (isNewLocation) {
      await this.sendNewLocationAlert(user, metadata);
    }

    // Audit log
    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      resource: 'session',
      resourceId: session.id,
      details: {
        deviceId: device.id,
        isNewDevice,
        isNewLocation,
        rememberMe: dto.rememberMe,
      },
      ipAddress: metadata.ipAddress,
    });

    // Determine redirect
    const redirectTo = user.profile?.profileCompletedAt
      ? '/dashboard'
      : '/profile/setup';

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.profile?.firstName || null,
        lastName: user.profile?.lastName || null,
        profileCompleted: !!user.profile?.profileCompletedAt,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt.toISOString(),
        isRemembered: dto.rememberMe,
      },
      tokens,
      requiresMfa: false,
      redirectTo,
    };
  }

  private async checkRateLimits(
    email: string,
    ipAddress: string,
  ): Promise<RateLimitResult> {
    // Check email-based rate limit
    const emailKey = `ratelimit:login:email:${email}`;
    const emailAttempts = await this.redis.incr(emailKey);
    await this.redis.expire(emailKey, 15 * 60); // 15 minutes

    if (emailAttempts > this.MAX_FAILED_ATTEMPTS) {
      const ttl = await this.redis.ttl(emailKey);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter: ttl,
        lockedUntil: new Date(Date.now() + ttl * 1000),
      };
    }

    // Check IP-based rate limit
    const ipKey = `ratelimit:login:ip:${ipAddress}`;
    const ipAttempts = await this.redis.incr(ipKey);
    await this.redis.expire(ipKey, 60 * 60); // 1 hour

    if (ipAttempts > this.IP_RATE_LIMIT) {
      const ttl = await this.redis.ttl(ipKey);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter: ttl,
      };
    }

    // Check account lockout
    const lockoutKey = `ratelimit:lockout:${email}`;
    const lockoutAttempts = await this.redis.get(lockoutKey);

    if (lockoutAttempts && parseInt(lockoutAttempts) >= this.ACCOUNT_LOCKOUT_ATTEMPTS) {
      const ttl = await this.redis.ttl(lockoutKey);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter: ttl,
        lockedUntil: new Date(Date.now() + ttl * 1000),
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.MAX_FAILED_ATTEMPTS - emailAttempts,
    };
  }

  private async handleFailedLogin(
    email: string,
    metadata: RequestMetadata,
    userId?: string,
  ): Promise<void> {
    // Track for account lockout
    const lockoutKey = `ratelimit:lockout:${email}`;
    const lockoutAttempts = await this.redis.incr(lockoutKey);
    await this.redis.expire(lockoutKey, this.ACCOUNT_LOCKOUT_HOURS * 60 * 60);

    // Record attempt
    await this.recordLoginAttempt({
      email,
      userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'INVALID_CREDENTIALS',
    });

    // Check if account should be locked
    if (lockoutAttempts >= this.ACCOUNT_LOCKOUT_ATTEMPTS && userId) {
      const lockedUntil = new Date(
        Date.now() + this.ACCOUNT_LOCKOUT_HOURS * 60 * 60 * 1000,
      );

      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil },
      });

      // Send security alert
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        await this.emailService.sendSecurityAlert({
          to: user.email,
          type: 'ACCOUNT_LOCKED',
          details: {
            reason: 'Multiple failed login attempts',
            lockedUntil: lockedUntil.toISOString(),
            ipAddress: metadata.ipAddress,
          },
        });
      }

      await this.auditService.log({
        userId,
        action: 'ACCOUNT_LOCKED',
        resource: 'user',
        resourceId: userId,
        details: {
          reason: 'EXCESSIVE_FAILED_LOGINS',
          attempts: lockoutAttempts,
          lockedUntil: lockedUntil.toISOString(),
        },
        ipAddress: metadata.ipAddress,
        severity: 'HIGH',
      });
    }
  }

  private async resetFailedAttempts(email: string, ipAddress: string): Promise<void> {
    await this.redis.del(`ratelimit:login:email:${email}`);
    // Note: IP rate limit is not reset to prevent abuse
    await this.redis.del(`ratelimit:lockout:${email}`);
  }

  private async recordLoginAttempt(data: {
    email: string;
    userId?: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
    deviceFingerprint?: string;
    geoLocation?: any;
    note?: string;
  }): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        email: data.email,
        userId: data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success,
        failureReason: data.failureReason,
        deviceFingerprint: data.deviceFingerprint,
        geoLocation: data.geoLocation,
      },
    });
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    if (sessions.length >= this.MAX_CONCURRENT_SESSIONS) {
      // Revoke oldest sessions beyond limit
      const sessionsToRevoke = sessions.slice(this.MAX_CONCURRENT_SESSIONS - 1);

      await this.prisma.session.updateMany({
        where: {
          id: { in: sessionsToRevoke.map(s => s.id) },
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'SESSION_LIMIT_EXCEEDED',
        },
      });

      // Clear from Redis cache
      for (const session of sessionsToRevoke) {
        await this.redis.del(`session:${session.id}`);
      }
    }
  }

  private async checkNewLocation(
    userId: string,
    ipAddress: string,
  ): Promise<boolean> {
    const currentLocation = await this.geoService.lookup(ipAddress);
    if (!currentLocation?.country) return false;

    const recentLogins = await this.prisma.loginAttempt.findMany({
      where: {
        userId,
        success: true,
        createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const knownCountries = new Set(
      recentLogins
        .filter(l => l.geoLocation?.country)
        .map(l => l.geoLocation.country),
    );

    return knownCountries.size > 0 && !knownCountries.has(currentLocation.country);
  }

  private async createMfaChallenge(userId: string): Promise<any> {
    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    // Store in Redis for quick lookup
    await this.redis.set(
      `mfa:challenge:${challenge.id}`,
      JSON.stringify({ userId, expiresAt: challenge.expiresAt }),
      'EX',
      300,
    );

    return challenge;
  }

  private async sendNewDeviceAlert(
    user: any,
    device: any,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.emailService.sendSecurityAlert({
      to: user.email,
      type: 'NEW_DEVICE_LOGIN',
      details: {
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        ipAddress: metadata.ipAddress,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async sendNewLocationAlert(
    user: any,
    metadata: RequestMetadata,
  ): Promise<void> {
    const location = await this.geoService.lookup(metadata.ipAddress);

    await this.emailService.sendSecurityAlert({
      to: user.email,
      type: 'NEW_LOCATION_LOGIN',
      details: {
        location: location ? `${location.city}, ${location.country}` : 'Unknown',
        ipAddress: metadata.ipAddress,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.sessionService.revoke(sessionId, 'USER_LOGOUT');

    await this.auditService.log({
      userId,
      action: 'USER_LOGOUT',
      resource: 'session',
      resourceId: sessionId,
    });
  }

  async logoutAll(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'USER_LOGOUT_ALL',
      },
    });

    // Clear all sessions from Redis
    const keys = await this.redis.keys(`session:*:${userId}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    await this.auditService.log({
      userId,
      action: 'USER_LOGOUT_ALL',
      resource: 'user',
      resourceId: userId,
      details: { revokedCount: result.count },
    });

    return result.count;
  }
}

interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
  origin?: string;
}
```

### tRPC Router

```typescript
// src/modules/aim/routers/auth.router.ts
import { router, publicProcedure, protectedProcedure } from '@/infrastructure/trpc';
import { TRPCError } from '@trpc/server';
import { loginSchema, sessionInfoSchema, deviceSchema } from '../schemas/auth.schema';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { DeviceService } from '../services/device.service';
import { z } from 'zod';

export const authRouter = router({
  // User login
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const authService = ctx.container.get(AuthService);

      const metadata = {
        ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString() || 'unknown',
        userAgent: ctx.req.headers['user-agent'] || 'unknown',
        origin: ctx.req.headers.origin,
      };

      try {
        const result = await authService.login(input, metadata);

        // Set HTTP-only cookies for tokens
        if (result.tokens) {
          ctx.res.cookie('access_token', result.tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000, // 15 minutes
          });

          ctx.res.cookie('refresh_token', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/v1/auth/refresh',
            maxAge: result.session?.isRemembered
              ? 30 * 24 * 60 * 60 * 1000 // 30 days
              : 7 * 24 * 60 * 60 * 1000, // 7 days
          });
        }

        // Don't send tokens in response body
        const { tokens, ...responseWithoutTokens } = result;
        return responseWithoutTokens;
      } catch (error) {
        if (error.response?.error === 'RATE_LIMITED') {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: error.response.message,
            cause: error.response,
          });
        }

        if (error.response?.error === 'EMAIL_NOT_VERIFIED') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error.response.message,
            cause: error.response,
          });
        }

        if (error.response?.error === 'ACCOUNT_LOCKED') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error.response.message,
            cause: error.response,
          });
        }

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: error.message || 'Nieprawidłowy email lub hasło',
        });
      }
    }),

  // User logout
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      const authService = ctx.container.get(AuthService);
      await authService.logout(ctx.session.id, ctx.user.id);

      // Clear cookies
      ctx.res.clearCookie('access_token');
      ctx.res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });

      return { success: true };
    }),

  // Logout from all devices
  logoutAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      const authService = ctx.container.get(AuthService);
      const count = await authService.logoutAll(ctx.user.id);

      ctx.res.clearCookie('access_token');
      ctx.res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });

      return { success: true, revokedSessions: count };
    }),

  // Get current session info
  getSession: protectedProcedure
    .query(async ({ ctx }) => {
      const sessionService = ctx.container.get(SessionService);
      const session = await sessionService.get(ctx.session.id);

      return {
        ...session,
        isCurrent: true,
      };
    }),

  // List all active sessions
  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      const sessionService = ctx.container.get(SessionService);
      const sessions = await sessionService.listActive(ctx.user.id);

      return sessions.map(s => ({
        ...s,
        isCurrent: s.id === ctx.session.id,
      }));
    }),

  // Revoke a specific session
  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sessionService = ctx.container.get(SessionService);

      // Verify session belongs to user
      const session = await sessionService.get(input.sessionId);
      if (session.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot revoke session belonging to another user',
        });
      }

      await sessionService.revoke(input.sessionId, 'USER_REVOKED');

      return { success: true };
    }),

  // List user's devices
  getDevices: protectedProcedure
    .query(async ({ ctx }) => {
      const deviceService = ctx.container.get(DeviceService);
      const devices = await deviceService.listUserDevices(ctx.user.id);

      return devices.map(d => ({
        ...d,
        isCurrentDevice: d.id === ctx.session.deviceId,
      }));
    }),

  // Remove a device
  removeDevice: protectedProcedure
    .input(z.object({ deviceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deviceService = ctx.container.get(DeviceService);
      await deviceService.removeDevice(ctx.user.id, input.deviceId);
      return { success: true };
    }),

  // Trust a device
  trustDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string().uuid(),
      trustDays: z.number().min(1).max(365).default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const deviceService = ctx.container.get(DeviceService);
      await deviceService.trustDevice(
        ctx.user.id,
        input.deviceId,
        input.trustDays,
      );
      return { success: true };
    }),
});
```

### Email Templates

```typescript
// src/infrastructure/email/templates/security-alert.template.ts
export const securityAlertTemplates = {
  NEW_DEVICE_LOGIN: {
    subject: 'Nowe logowanie do Twojego konta KsięgowaCRM',
    html: (data: any) => `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #721c24; margin: 0 0 10px 0;">
            🔐 Nowe logowanie do konta
          </h2>
          <p style="margin: 0; color: #721c24;">
            Wykryliśmy logowanie z nowego urządzenia.
          </p>
        </div>

        <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
          <h3 style="margin-top: 0;">Szczegóły logowania:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Urządzenie:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.deviceType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Przeglądarka:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.browser}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>System:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.os}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Adres IP:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.ipAddress}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Czas:</strong></td>
              <td style="padding: 8px 0;">${new Date(data.timestamp).toLocaleString('pl-PL')}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <p style="margin-bottom: 15px;">Jeśli to nie Ty, natychmiast zmień hasło:</p>
          <a href="${process.env.FRONTEND_URL}/settings/security"
             style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            To nie ja - Zabezpiecz konto
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">

        <p style="color: #666; font-size: 12px; text-align: center;">
          Ta wiadomość została wysłana automatycznie w celach bezpieczeństwa.<br>
          © ${new Date().getFullYear()} KsięgowaCRM
        </p>
      </body>
      </html>
    `,
  },

  NEW_LOCATION_LOGIN: {
    subject: 'Logowanie z nowej lokalizacji - KsięgowaCRM',
    html: (data: any) => `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #856404; margin: 0 0 10px 0;">
            🌍 Logowanie z nowej lokalizacji
          </h2>
          <p style="margin: 0; color: #856404;">
            Wykryliśmy logowanie z nietypowej lokalizacji.
          </p>
        </div>

        <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
          <p><strong>Lokalizacja:</strong> ${data.location}</p>
          <p><strong>Adres IP:</strong> ${data.ipAddress}</p>
          <p><strong>Czas:</strong> ${new Date(data.timestamp).toLocaleString('pl-PL')}</p>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <p>Jeśli to Ty, zignoruj tę wiadomość. Jeśli nie:</p>
          <a href="${process.env.FRONTEND_URL}/settings/security"
             style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Zabezpiecz moje konto
          </a>
        </div>
      </body>
      </html>
    `,
  },

  ACCOUNT_LOCKED: {
    subject: 'Twoje konto zostało tymczasowo zablokowane - KsięgowaCRM',
    html: (data: any) => `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #721c24; margin: 0 0 10px 0;">
            🔒 Konto tymczasowo zablokowane
          </h2>
        </div>

        <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
          <p>Z powodu wielokrotnych nieudanych prób logowania, Twoje konto zostało tymczasowo zablokowane.</p>

          <p><strong>Powód:</strong> ${data.reason}</p>
          <p><strong>Blokada do:</strong> ${new Date(data.lockedUntil).toLocaleString('pl-PL')}</p>
          <p><strong>Adres IP prób:</strong> ${data.ipAddress}</p>
        </div>

        <div style="margin-top: 20px;">
          <p>Jeśli nie próbowałeś się logować, możliwe że ktoś próbuje uzyskać dostęp do Twojego konta. Zalecamy:</p>
          <ul>
            <li>Zmianę hasła po odblokowaniu konta</li>
            <li>Włączenie weryfikacji dwuetapowej</li>
            <li>Sprawdzenie aktywnych sesji</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <a href="${process.env.FRONTEND_URL}/auth/reset-password"
             style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Zresetuj hasło
          </a>
        </div>
      </body>
      </html>
    `,
  },
};
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/aim/services/__tests__/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { HashService } from '../hash.service';
import { TokenService } from '../token.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;
  let hashService: jest.Mocked<HashService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    emailVerifiedAt: new Date(),
    lockedUntil: null,
    profile: { firstName: 'Jan', lastName: 'Kowalski', profileCompletedAt: new Date() },
    mfaSettings: null,
  };

  const mockMetadata = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Chrome/120',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            session: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
            loginAttempt: { create: jest.fn() },
          },
        },
        {
          provide: RedisService,
          useValue: {
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn(),
            ttl: jest.fn().mockResolvedValue(900),
            get: jest.fn(),
            del: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: HashService,
          useValue: {
            verify: jest.fn(),
          },
        },
        // ... other mocked providers
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    hashService = module.get(HashService);
  });

  describe('login', () => {
    it('should successfully log in with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      hashService.verify.mockResolvedValue(true);
      redis.incr.mockResolvedValue(1);

      const result = await service.login(
        { email: 'test@example.com', password: 'password123', rememberMe: false },
        mockMetadata,
      );

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('test@example.com');
      expect(result.requiresMfa).toBe(false);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      hashService.verify.mockResolvedValue(false);

      await expect(
        service.login(
          { email: 'test@example.com', password: 'wrong', rememberMe: false },
          mockMetadata,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      hashService.verify.mockResolvedValue(false);

      await expect(
        service.login(
          { email: 'nonexistent@example.com', password: 'password', rememberMe: false },
          mockMetadata,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should block unverified email users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
      });
      hashService.verify.mockResolvedValue(true);

      await expect(
        service.login(
          { email: 'test@example.com', password: 'password123', rememberMe: false },
          mockMetadata,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should block locked accounts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 3600000),
      });
      hashService.verify.mockResolvedValue(true);

      await expect(
        service.login(
          { email: 'test@example.com', password: 'password123', rememberMe: false },
          mockMetadata,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should enforce rate limiting', async () => {
      redis.incr.mockResolvedValue(6); // Over limit

      await expect(
        service.login(
          { email: 'test@example.com', password: 'password', rememberMe: false },
          mockMetadata,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return MFA challenge when MFA is enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        mfaSettings: { enabled: true, method: 'totp' },
      });
      hashService.verify.mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@example.com', password: 'password123', rememberMe: false },
        mockMetadata,
      );

      expect(result.requiresMfa).toBe(true);
      expect(result.mfaChallenge).toBeDefined();
    });

    it('should create extended session with rememberMe', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      hashService.verify.mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@example.com', password: 'password123', rememberMe: true },
        mockMetadata,
      );

      expect(result.session.isRemembered).toBe(true);
    });
  });

  describe('logout', () => {
    it('should revoke session on logout', async () => {
      await service.logout('session-123', 'user-123');

      expect(redis.del).toHaveBeenCalledWith('session:session-123');
    });
  });

  describe('logoutAll', () => {
    it('should revoke all user sessions', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 3 });
      redis.keys.mockResolvedValue(['session:1', 'session:2', 'session:3']);

      const count = await service.logoutAll('user-123');

      expect(count).toBe(3);
      expect(redis.del).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/aim/routers/__tests__/auth.router.integration.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData, createTestUser } from '@/test/helpers';
import { authRouter } from '../auth.router';
import * as argon2 from 'argon2';

describe('Auth Router Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let testUser: any;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  beforeEach(async () => {
    testUser = await createTestUser(ctx, {
      email: `test-${Date.now()}@example.com`,
      password: 'Test123!@#',
      emailVerified: true,
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const caller = authRouter.createCaller(ctx);

      const result = await caller.login({
        email: testUser.email,
        password: 'Test123!@#',
        rememberMe: false,
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe(testUser.email);
    });

    it('should reject invalid password', async () => {
      const caller = authRouter.createCaller(ctx);

      await expect(
        caller.login({
          email: testUser.email,
          password: 'wrongpassword',
          rememberMe: false,
        }),
      ).rejects.toThrow('Nieprawidłowy email lub hasło');
    });

    it('should enforce rate limiting', async () => {
      const caller = authRouter.createCaller(ctx);

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await caller.login({
            email: testUser.email,
            password: 'wrong',
            rememberMe: false,
          });
        } catch {}
      }

      // 6th attempt should be rate limited
      await expect(
        caller.login({
          email: testUser.email,
          password: 'wrong',
          rememberMe: false,
        }),
      ).rejects.toThrow(/Zbyt wiele nieudanych prób/);
    });
  });

  describe('getSessions', () => {
    it('should list active sessions', async () => {
      // Login to create session
      const loginCaller = authRouter.createCaller(ctx);
      await loginCaller.login({
        email: testUser.email,
        password: 'Test123!@#',
        rememberMe: false,
      });

      // Get sessions
      ctx.user = { id: testUser.id };
      const caller = authRouter.createCaller(ctx);
      const sessions = await caller.getSessions();

      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].userId).toBe(testUser.id);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';
import { createTestUser, cleanupUser } from './helpers';

test.describe('User Login', () => {
  let testUser: { email: string; password: string };

  test.beforeAll(async () => {
    testUser = await createTestUser({ emailVerified: true });
  });

  test.afterAll(async () => {
    await cleanupUser(testUser.email);
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Witaj ponownie')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Nieprawidłowy email lub hasło')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('[name="email"]', 'invalid-email');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Nieprawidłowy format adresu email')).toBeVisible();
  });

  test('should remember me for extended session', async ({ page, context }) => {
    await page.goto('/auth/login');

    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.check('[name="rememberMe"]');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);

    // Check cookie expiration
    const cookies = await context.cookies();
    const refreshToken = cookies.find(c => c.name === 'refresh_token');
    expect(refreshToken).toBeDefined();

    // Remember me should set 30-day expiration
    const expirationDate = new Date(refreshToken!.expires * 1000);
    const daysUntilExpiration = (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiration).toBeGreaterThan(25);
  });

  test('should show rate limit message after many failures', async ({ page }) => {
    await page.goto('/auth/login');

    // Make multiple failed attempts
    for (let i = 0; i < 6; i++) {
      await page.fill('[name="email"]', testUser.email);
      await page.fill('[name="password"]', 'wrong');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    await expect(page.getByText(/Zbyt wiele nieudanych prób/)).toBeVisible();
  });

  test('should navigate to password reset', async ({ page }) => {
    await page.goto('/auth/login');

    await page.click('a:has-text("Zapomniałeś hasła?")');

    await expect(page).toHaveURL(/\/auth\/reset-password/);
  });

  test('should redirect unverified users to verification notice', async ({ page }) => {
    const unverifiedUser = await createTestUser({ emailVerified: false });

    await page.goto('/auth/login');

    await page.fill('[name="email"]', unverifiedUser.email);
    await page.fill('[name="password"]', unverifiedUser.password);
    await page.click('button[type="submit"]');

    await expect(page.getByText('Proszę zweryfikować adres email')).toBeVisible();
    await expect(page.getByText('Wyślij ponownie')).toBeVisible();
  });
});
```

---

## Security Checklist

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Password not logged | Excluded from all logging | ✅ |
| Constant-time comparison | Argon2 verify + timing normalization | ✅ |
| Rate limiting | 5 attempts/15min (email), 20/hour (IP) | ✅ |
| Account lockout | 10 failures → 1 hour lock | ✅ |
| Session tokens | Cryptographically secure UUID v4 | ✅ |
| HTTP-only cookies | Access/refresh tokens in cookies | ✅ |
| Secure cookies | SameSite=Strict, Secure in production | ✅ |
| Session binding | Tied to device fingerprint | ✅ |
| Concurrent session limit | Max 5 sessions per user | ✅ |
| New device alerts | Email notification | ✅ |
| New location alerts | Email notification | ✅ |
| Timing attack prevention | Consistent response times | ✅ |
| User enumeration prevention | Same error for invalid email/password | ✅ |
| Audit logging | All login attempts logged | ✅ |
| MFA integration | Challenge creation for MFA users | ✅ |

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| USER_LOGIN | Successful login | Session ID, device, location |
| USER_LOGIN_FAILED | Failed attempt | Email, IP, failure reason |
| USER_LOGOUT | User logout | Session ID |
| USER_LOGOUT_ALL | Logout all sessions | Session count |
| SESSION_CREATED | New session | Device, IP, expiration |
| SESSION_REVOKED | Session terminated | Reason |
| ACCOUNT_LOCKED | Excessive failures | Lock duration, attempt count |
| NEW_DEVICE_DETECTED | Unknown device | Device info |
| NEW_LOCATION_DETECTED | Unknown location | Location info |
| RATE_LIMIT_EXCEEDED | Too many attempts | IP, email |

---

## Implementation Notes

### Timing Attack Prevention
```typescript
// Ensure consistent response time to prevent timing attacks
const minResponseTime = 200; // ms
const startTime = Date.now();

// ... do authentication

const elapsed = Date.now() - startTime;
if (elapsed < minResponseTime) {
  await new Promise(resolve => setTimeout(resolve, minResponseTime - elapsed));
}
```

### Device Fingerprinting
Use client-side fingerprinting library (e.g., FingerprintJS) to generate consistent device identifiers. The fingerprint should include:
- Screen resolution
- Timezone
- Language
- Installed plugins
- Canvas fingerprint
- WebGL renderer

### GeoLocation Service
```typescript
// Use MaxMind GeoIP2 or similar service
interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
```

### Redis Keys Structure
```
ratelimit:login:email:{email}     → attempt count (TTL: 15min)
ratelimit:login:ip:{ip}           → attempt count (TTL: 1hour)
ratelimit:lockout:{email}         → lockout attempt count (TTL: 1hour)
session:{sessionId}               → session data (TTL: session expiry)
mfa:challenge:{challengeId}       → MFA challenge data (TTL: 5min)
```

---

*Last updated: December 2024*
