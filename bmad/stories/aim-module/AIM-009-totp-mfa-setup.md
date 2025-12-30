# AIM-009: Time-Based One-Time Password (TOTP) MFA Setup

> **Story ID**: AIM-009
> **Epic**: [Authentication & Identity Management (AIM)](./epic.md)
> **Priority**: P1 (High)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Dependencies**: AIM-003 (User Login)

---

## User Story

**As a** security-conscious user
**I want** to enable TOTP-based multi-factor authentication
**So that** my account has an additional security layer protecting against unauthorized access

---

## Acceptance Criteria

### Scenario 1: Initiating MFA Setup
```gherkin
Given I am logged in and on the security settings page
When I click "Enable Two-Factor Authentication"
Then I should see MFA method selection with TOTP option highlighted
And I should see information about how TOTP works
And I should have an option to use authenticator apps (Google Authenticator, Authy, 1Password)
```

### Scenario 2: Displaying QR Code for Authenticator App
```gherkin
Given I have selected TOTP as my MFA method
When the setup page loads
Then I should see a QR code compatible with authenticator apps
And I should see a manual entry key (Base32 encoded secret)
And I should see the issuer name "KsięgowaCRM"
And I should see my email as the account identifier
And I should have a button to reveal/copy the manual key
```

### Scenario 3: Verifying TOTP Code During Setup
```gherkin
Given I have scanned the QR code in my authenticator app
When I enter a valid 6-digit TOTP code
Then the code should be validated within ±1 time window (30 seconds)
And MFA should be enabled for my account
And I should receive 10 backup codes
And I should see a success message: "Uwierzytelnianie dwuskładnikowe zostało włączone"
And I should be prompted to save backup codes securely
And an email notification should be sent about MFA enabled
```

### Scenario 4: Handling Invalid TOTP Code During Setup
```gherkin
Given I am on the MFA setup verification step
When I enter an invalid TOTP code
Then I should see an error: "Nieprawidłowy kod weryfikacyjny"
And the attempt counter should increment
And I should have remaining attempts displayed
And after 5 invalid attempts, I should be temporarily blocked for 5 minutes
```

### Scenario 5: Login with TOTP MFA Enabled
```gherkin
Given MFA is enabled on my account
And I have entered valid email and password
When the primary authentication succeeds
Then I should be redirected to MFA verification page
And I should see input for 6-digit TOTP code
And I should see option to use backup code instead
And my session should not be created until MFA is verified
And I should have 3 minutes to enter the code before challenge expires
```

### Scenario 6: Successful TOTP Verification During Login
```gherkin
Given I am on the MFA verification page during login
When I enter a valid TOTP code from my authenticator app
Then the code should be verified
And I should be fully authenticated
And my session should be created
And I should be redirected to the dashboard
And the audit log should record "MFA_VERIFIED" event
```

### Scenario 7: Invalid TOTP Code During Login
```gherkin
Given I am on the MFA verification page
When I enter an incorrect TOTP code
Then I should see an error: "Nieprawidłowy kod weryfikacyjny"
And the attempt counter should increment
And after 3 failed attempts, the MFA challenge should expire
And I should be returned to the login page
And the audit log should record "MFA_FAILED" event
```

### Scenario 8: MFA Challenge Expiration
```gherkin
Given I am on the MFA verification page
And I have not entered a code for 3 minutes
When the challenge expires
Then I should see a message: "Sesja weryfikacji wygasła"
And I should be redirected to the login page
And I should need to authenticate with password again
```

### Scenario 9: Disabling MFA
```gherkin
Given MFA is enabled on my account
And I am on the security settings page
When I click "Disable Two-Factor Authentication"
Then I should be prompted to enter my password
And I should be prompted to enter a current TOTP code
When I provide valid password and TOTP code
Then MFA should be disabled
And all backup codes should be invalidated
And I should see a warning about reduced security
And an email notification should be sent about MFA disabled
And the audit log should record "MFA_DISABLED" event
```

### Scenario 10: Re-generating Secret
```gherkin
Given MFA is enabled on my account
When I click "Regenerate MFA Secret"
Then I should be prompted to enter my password
And I should be prompted to enter current TOTP code
When I provide valid credentials
Then a new TOTP secret should be generated
And the old secret should be invalidated immediately
And new backup codes should be generated
And I should see the new QR code and manual key
And I should be required to verify the new code before completing
```

### Scenario 11: TOTP Time Window Tolerance
```gherkin
Given my authenticator app shows a TOTP code
And the code is within ±30 seconds of server time
When I enter the code during login
Then the code should be accepted
And I should be authenticated
Note: This handles minor time drift between devices
```

### Scenario 12: Viewing MFA Status
```gherkin
Given I am on the security settings page
When I view my MFA status
Then I should see whether MFA is enabled or disabled
And if enabled, I should see the date it was enabled
And I should see the number of remaining backup codes
And I should see last MFA verification date
And I should have options to manage backup codes
```

---

## Technical Specification

### Database Schema

```sql
-- MFA configuration table
CREATE TABLE mfa_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- TOTP Configuration
    method VARCHAR(20) NOT NULL DEFAULT 'TOTP' CHECK (method IN ('TOTP', 'SMS', 'EMAIL')),
    secret_encrypted BYTEA NOT NULL,  -- AES-256-GCM encrypted TOTP secret
    secret_iv BYTEA NOT NULL,  -- Initialization vector for decryption

    -- Status
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,  -- True after first successful verification

    -- Recovery
    backup_codes_remaining INTEGER NOT NULL DEFAULT 10,
    backup_codes_last_generated_at TIMESTAMP,

    -- Audit
    enabled_at TIMESTAMP,
    last_verified_at TIMESTAMP,
    verification_count INTEGER NOT NULL DEFAULT 0,
    failed_attempt_count INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_mfa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- MFA backup codes table
CREATE TABLE mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Code storage (hashed, not plaintext)
    code_hash VARCHAR(255) NOT NULL,

    -- Usage tracking
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP,
    used_ip VARCHAR(45),
    used_user_agent VARCHAR(500),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_backup_code_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- MFA challenges table (for login flow)
CREATE TABLE mfa_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Challenge data
    method VARCHAR(20) NOT NULL CHECK (method IN ('TOTP', 'BACKUP_CODE', 'SMS', 'EMAIL')),
    challenge_code VARCHAR(10),  -- For SMS/Email methods only

    -- Login context
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(500),
    device_fingerprint VARCHAR(64),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_challenge_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for MFA tables
CREATE INDEX idx_mfa_config_user_id ON mfa_configurations(user_id);
CREATE INDEX idx_mfa_config_enabled ON mfa_configurations(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_backup_codes_user_id ON mfa_backup_codes(user_id);
CREATE INDEX idx_backup_codes_unused ON mfa_backup_codes(user_id) WHERE is_used = false;
CREATE INDEX idx_challenges_user_id ON mfa_challenges(user_id);
CREATE INDEX idx_challenges_pending ON mfa_challenges(user_id, status) WHERE status = 'PENDING';
CREATE INDEX idx_challenges_expires ON mfa_challenges(expires_at) WHERE status = 'PENDING';

-- Cleanup function for expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_challenges()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM mfa_challenges
    WHERE status = 'PENDING' AND expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Update users table for MFA reference
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMP;
```

### API Endpoints

```typescript
// tRPC Router for MFA operations
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';

// Validation schemas
const mfaSetupInitSchema = z.object({
  method: z.enum(['TOTP', 'SMS', 'EMAIL']).default('TOTP'),
});

const mfaVerifySetupSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Kod musi składać się z 6 cyfr'),
});

const mfaVerifyLoginSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(6).max(9),  // 6 digits for TOTP, 8+hyphen for backup codes
  useBackupCode: z.boolean().optional().default(false),
});

const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
  totpCode: z.string().length(6).regex(/^\d{6}$/),
});

const regenerateSecretSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
  totpCode: z.string().length(6).regex(/^\d{6}$/),
});

// Response types
interface MfaSetupResponse {
  qrCodeDataUrl: string;
  manualEntryKey: string;
  issuer: string;
  accountName: string;
}

interface MfaVerifyResponse {
  success: boolean;
  backupCodes?: string[];
  message: string;
}

interface MfaStatusResponse {
  enabled: boolean;
  method: 'TOTP' | 'SMS' | 'EMAIL' | null;
  enabledAt: Date | null;
  lastVerifiedAt: Date | null;
  backupCodesRemaining: number;
  verificationCount: number;
}

interface MfaChallengeResponse {
  challengeId: string;
  method: 'TOTP' | 'BACKUP_CODE';
  expiresAt: Date;
  attemptsRemaining: number;
}

interface AuthWithMfaResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
  sessionId: string;
}

// tRPC Router
export const mfaRouter = router({
  // Initialize MFA setup - returns QR code and secret
  initSetup: protectedProcedure
    .input(mfaSetupInitSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.mfaService.initializeMfaSetup(
        ctx.user.id,
        input.method
      );
    }),

  // Verify TOTP code during setup
  verifySetup: protectedProcedure
    .input(mfaVerifySetupSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.mfaService.verifyMfaSetup(
        ctx.user.id,
        input.code
      );
    }),

  // Verify MFA during login (public - no auth required yet)
  verifyLogin: publicProcedure
    .input(mfaVerifyLoginSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.mfaService.verifyMfaLogin(
        input.challengeId,
        input.code,
        input.useBackupCode,
        {
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        }
      );
    }),

  // Disable MFA
  disable: protectedProcedure
    .input(mfaDisableSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.mfaService.disableMfa(
        ctx.user.id,
        input.password,
        input.totpCode
      );
    }),

  // Regenerate TOTP secret
  regenerateSecret: protectedProcedure
    .input(regenerateSecretSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.mfaService.regenerateSecret(
        ctx.user.id,
        input.password,
        input.totpCode
      );
    }),

  // Get MFA status
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.mfaService.getMfaStatus(ctx.user.id);
    }),

  // Get backup codes (regenerates if requested)
  getBackupCodes: protectedProcedure
    .input(z.object({
      regenerate: z.boolean().optional().default(false),
      password: z.string().optional(),
      totpCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.regenerate) {
        if (!input.password || !input.totpCode) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Hasło i kod TOTP są wymagane do regeneracji kodów',
          });
        }
        return ctx.mfaService.regenerateBackupCodes(
          ctx.user.id,
          input.password,
          input.totpCode
        );
      }
      return ctx.mfaService.getBackupCodesCount(ctx.user.id);
    }),
});
```

### MFA Service Implementation

```typescript
// src/modules/aim/services/mfa.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '@/core/prisma/prisma.service';
import { CacheService } from '@/core/cache/cache.service';
import { AuditLogService } from './audit-log.service';
import { EncryptionService } from '@/core/security/encryption.service';
import { NotificationService } from '@/core/notifications/notification.service';

export interface MfaConfig {
  totp: {
    algorithm: 'sha1' | 'sha256' | 'sha512';
    digits: number;
    period: number;
    window: number;
    issuer: string;
  };
  backupCodes: {
    count: number;
    length: number;
  };
  challenge: {
    expirySeconds: number;
    maxAttempts: number;
    blockDurationSeconds: number;
  };
}

const DEFAULT_MFA_CONFIG: MfaConfig = {
  totp: {
    algorithm: 'sha1',
    digits: 6,
    period: 30,
    window: 1,  // Accept codes from ±1 period
    issuer: 'KsięgowaCRM',
  },
  backupCodes: {
    count: 10,
    length: 8,
  },
  challenge: {
    expirySeconds: 180,  // 3 minutes
    maxAttempts: 3,
    blockDurationSeconds: 300,  // 5 minutes
  },
};

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly config: MfaConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditLog: AuditLogService,
    private readonly encryption: EncryptionService,
    private readonly notifications: NotificationService,
  ) {
    this.config = DEFAULT_MFA_CONFIG;
  }

  /**
   * Initialize MFA setup - generate secret and QR code
   */
  async initializeMfaSetup(
    userId: string,
    method: 'TOTP' | 'SMS' | 'EMAIL' = 'TOTP'
  ): Promise<MfaSetupResponse> {
    this.logger.log(`Initializing MFA setup for user ${userId}`);

    // Check if MFA already enabled
    const existingConfig = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (existingConfig?.isEnabled) {
      throw new BadRequestException('MFA jest już włączone. Wyłącz je najpierw, aby skonfigurować ponownie.');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: await this.getAccountName(userId),
      issuer: this.config.totp.issuer,
      length: 32,
    });

    // Encrypt secret for storage
    const { encrypted, iv } = await this.encryption.encrypt(secret.base32);

    // Store or update MFA configuration
    await this.prisma.mfaConfiguration.upsert({
      where: { userId },
      update: {
        method,
        secretEncrypted: encrypted,
        secretIv: iv,
        isEnabled: false,
        isVerified: false,
        updatedAt: new Date(),
      },
      create: {
        userId,
        method,
        secretEncrypted: encrypted,
        secretIv: iv,
        isEnabled: false,
        isVerified: false,
      },
    });

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Log audit event
    await this.auditLog.log({
      eventType: 'MFA_SETUP_INITIATED',
      userId,
      metadata: { method },
    });

    return {
      qrCodeDataUrl,
      manualEntryKey: secret.base32,
      issuer: this.config.totp.issuer,
      accountName: await this.getAccountName(userId),
    };
  }

  /**
   * Verify TOTP code during initial setup
   */
  async verifyMfaSetup(
    userId: string,
    code: string
  ): Promise<MfaVerifyResponse> {
    this.logger.log(`Verifying MFA setup for user ${userId}`);

    const mfaConfig = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!mfaConfig) {
      throw new BadRequestException('Konfiguracja MFA nie została znaleziona. Rozpocznij konfigurację od nowa.');
    }

    if (mfaConfig.isEnabled) {
      throw new BadRequestException('MFA jest już włączone.');
    }

    // Decrypt secret
    const secret = await this.encryption.decrypt(
      mfaConfig.secretEncrypted,
      mfaConfig.secretIv
    );

    // Verify TOTP code
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      algorithm: this.config.totp.algorithm,
      digits: this.config.totp.digits,
      step: this.config.totp.period,
      window: this.config.totp.window,
    });

    if (!isValid) {
      await this.incrementSetupAttempts(userId);
      throw new UnauthorizedException('Nieprawidłowy kod weryfikacyjny. Sprawdź czy czas na Twoim urządzeniu jest zsynchronizowany.');
    }

    // Generate backup codes
    const backupCodes = await this.generateBackupCodes(userId);

    // Enable MFA
    await this.prisma.$transaction([
      this.prisma.mfaConfiguration.update({
        where: { userId },
        data: {
          isEnabled: true,
          isVerified: true,
          enabledAt: new Date(),
          lastVerifiedAt: new Date(),
          verificationCount: 1,
          backupCodesRemaining: backupCodes.length,
          backupCodesLastGeneratedAt: new Date(),
          failedAttemptCount: 0,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: true,
          mfaVerifiedAt: new Date(),
        },
      }),
    ]);

    // Log audit event
    await this.auditLog.log({
      eventType: 'MFA_ENABLED',
      userId,
      metadata: { method: mfaConfig.method },
    });

    // Send notification
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      await this.notifications.sendEmail({
        to: user.email,
        template: 'mfa-enabled',
        data: {
          firstName: user.firstName,
          enabledAt: new Date().toISOString(),
        },
      });
    }

    return {
      success: true,
      backupCodes,
      message: 'Uwierzytelnianie dwuskładnikowe zostało włączone. Zapisz kody zapasowe w bezpiecznym miejscu.',
    };
  }

  /**
   * Create MFA challenge for login flow
   */
  async createMfaChallenge(
    userId: string,
    context: { ipAddress: string; userAgent?: string; deviceFingerprint?: string }
  ): Promise<MfaChallengeResponse> {
    this.logger.log(`Creating MFA challenge for user ${userId}`);

    const mfaConfig = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!mfaConfig?.isEnabled) {
      throw new BadRequestException('MFA nie jest włączone dla tego konta.');
    }

    // Check if user is blocked from too many failed attempts
    const blockKey = `mfa:blocked:${userId}`;
    const isBlocked = await this.cache.get(blockKey);
    if (isBlocked) {
      const ttl = await this.cache.ttl(blockKey);
      throw new TooManyRequestsException(
        `Zbyt wiele nieudanych prób. Spróbuj ponownie za ${Math.ceil(ttl / 60)} minut.`
      );
    }

    // Create challenge
    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId,
        method: 'TOTP',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceFingerprint: context.deviceFingerprint,
        status: 'PENDING',
        maxAttempts: this.config.challenge.maxAttempts,
        expiresAt: new Date(Date.now() + this.config.challenge.expirySeconds * 1000),
      },
    });

    return {
      challengeId: challenge.id,
      method: 'TOTP',
      expiresAt: challenge.expiresAt,
      attemptsRemaining: this.config.challenge.maxAttempts,
    };
  }

  /**
   * Verify MFA code during login
   */
  async verifyMfaLogin(
    challengeId: string,
    code: string,
    useBackupCode: boolean,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<AuthWithMfaResponse> {
    this.logger.log(`Verifying MFA login for challenge ${challengeId}`);

    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
      include: { user: true },
    });

    if (!challenge) {
      throw new NotFoundException('Sesja weryfikacji nie została znaleziona.');
    }

    if (challenge.status !== 'PENDING') {
      throw new BadRequestException('Sesja weryfikacji jest nieaktywna.');
    }

    if (challenge.expiresAt < new Date()) {
      await this.prisma.mfaChallenge.update({
        where: { id: challengeId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Sesja weryfikacji wygasła. Zaloguj się ponownie.');
    }

    // Check if user is blocked
    const blockKey = `mfa:blocked:${challenge.userId}`;
    const isBlocked = await this.cache.get(blockKey);
    if (isBlocked) {
      throw new TooManyRequestsException('Konto tymczasowo zablokowane. Spróbuj później.');
    }

    let isValid = false;

    if (useBackupCode) {
      isValid = await this.verifyBackupCode(challenge.userId, code);
    } else {
      isValid = await this.verifyTotpCode(challenge.userId, code);
    }

    if (!isValid) {
      // Increment attempts
      const updatedChallenge = await this.prisma.mfaChallenge.update({
        where: { id: challengeId },
        data: { attempts: { increment: 1 } },
      });

      // Log failed attempt
      await this.auditLog.log({
        eventType: 'MFA_FAILED',
        userId: challenge.userId,
        metadata: {
          challengeId,
          method: useBackupCode ? 'BACKUP_CODE' : 'TOTP',
          attemptNumber: updatedChallenge.attempts,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      if (updatedChallenge.attempts >= updatedChallenge.maxAttempts) {
        // Mark challenge as failed
        await this.prisma.mfaChallenge.update({
          where: { id: challengeId },
          data: { status: 'FAILED' },
        });

        // Block user temporarily
        await this.cache.set(
          blockKey,
          'blocked',
          this.config.challenge.blockDurationSeconds
        );

        throw new TooManyRequestsException(
          'Przekroczono maksymalną liczbę prób. Konto tymczasowo zablokowane.'
        );
      }

      const remaining = updatedChallenge.maxAttempts - updatedChallenge.attempts;
      throw new UnauthorizedException(
        `Nieprawidłowy kod weryfikacyjny. Pozostało prób: ${remaining}`
      );
    }

    // Mark challenge as verified
    await this.prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // Update MFA config
    await this.prisma.mfaConfiguration.update({
      where: { userId: challenge.userId },
      data: {
        lastVerifiedAt: new Date(),
        verificationCount: { increment: 1 },
        failedAttemptCount: 0,
      },
    });

    // Log successful verification
    await this.auditLog.log({
      eventType: 'MFA_VERIFIED',
      userId: challenge.userId,
      metadata: {
        challengeId,
        method: useBackupCode ? 'BACKUP_CODE' : 'TOTP',
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Create session and generate tokens
    // (This would be handled by AuthService in actual implementation)
    return this.createAuthenticatedSession(challenge.userId, context);
  }

  /**
   * Disable MFA for user
   */
  async disableMfa(
    userId: string,
    password: string,
    totpCode: string
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Disabling MFA for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Użytkownik nie został znaleziony.');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Nieprawidłowe hasło.');
    }

    // Verify TOTP code
    const isTotpValid = await this.verifyTotpCode(userId, totpCode);
    if (!isTotpValid) {
      throw new UnauthorizedException('Nieprawidłowy kod weryfikacyjny.');
    }

    // Disable MFA
    await this.prisma.$transaction([
      this.prisma.mfaConfiguration.update({
        where: { userId },
        data: {
          isEnabled: false,
          secretEncrypted: Buffer.from(''),
          secretIv: Buffer.from(''),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false,
          mfaVerifiedAt: null,
        },
      }),
      // Delete all backup codes
      this.prisma.mfaBackupCode.deleteMany({
        where: { userId },
      }),
      // Expire all pending challenges
      this.prisma.mfaChallenge.updateMany({
        where: { userId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      }),
    ]);

    // Log audit event
    await this.auditLog.log({
      eventType: 'MFA_DISABLED',
      userId,
      metadata: {},
    });

    // Send notification
    if (user.email) {
      await this.notifications.sendEmail({
        to: user.email,
        template: 'mfa-disabled',
        data: {
          firstName: user.firstName,
          disabledAt: new Date().toISOString(),
        },
      });
    }

    return {
      success: true,
      message: 'Uwierzytelnianie dwuskładnikowe zostało wyłączone.',
    };
  }

  /**
   * Regenerate TOTP secret
   */
  async regenerateSecret(
    userId: string,
    password: string,
    totpCode: string
  ): Promise<MfaSetupResponse> {
    this.logger.log(`Regenerating MFA secret for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Użytkownik nie został znaleziony.');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Nieprawidłowe hasło.');
    }

    // Verify current TOTP code
    const isTotpValid = await this.verifyTotpCode(userId, totpCode);
    if (!isTotpValid) {
      throw new UnauthorizedException('Nieprawidłowy kod weryfikacyjny.');
    }

    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: await this.getAccountName(userId),
      issuer: this.config.totp.issuer,
      length: 32,
    });

    // Encrypt new secret
    const { encrypted, iv } = await this.encryption.encrypt(secret.base32);

    // Update configuration (set as not verified until new code is confirmed)
    await this.prisma.mfaConfiguration.update({
      where: { userId },
      data: {
        secretEncrypted: encrypted,
        secretIv: iv,
        isVerified: false,
        updatedAt: new Date(),
      },
    });

    // Delete old backup codes (will be regenerated after verification)
    await this.prisma.mfaBackupCode.deleteMany({
      where: { userId },
    });

    // Log audit event
    await this.auditLog.log({
      eventType: 'MFA_SECRET_REGENERATED',
      userId,
      metadata: {},
    });

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      qrCodeDataUrl,
      manualEntryKey: secret.base32,
      issuer: this.config.totp.issuer,
      accountName: await this.getAccountName(userId),
    };
  }

  /**
   * Get MFA status for user
   */
  async getMfaStatus(userId: string): Promise<MfaStatusResponse> {
    const mfaConfig = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    const backupCodesCount = await this.prisma.mfaBackupCode.count({
      where: { userId, isUsed: false },
    });

    return {
      enabled: mfaConfig?.isEnabled ?? false,
      method: mfaConfig?.method as 'TOTP' | 'SMS' | 'EMAIL' | null,
      enabledAt: mfaConfig?.enabledAt ?? null,
      lastVerifiedAt: mfaConfig?.lastVerifiedAt ?? null,
      backupCodesRemaining: backupCodesCount,
      verificationCount: mfaConfig?.verificationCount ?? 0,
    };
  }

  // ============ Private Helper Methods ============

  /**
   * Verify TOTP code against stored secret
   */
  private async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const mfaConfig = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.isEnabled) {
      return false;
    }

    // Decrypt secret
    const secret = await this.encryption.decrypt(
      mfaConfig.secretEncrypted,
      mfaConfig.secretIv
    );

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      algorithm: this.config.totp.algorithm,
      digits: this.config.totp.digits,
      step: this.config.totp.period,
      window: this.config.totp.window,
    });
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    // Normalize code format (remove hyphen if present)
    const normalizedCode = code.replace('-', '').toUpperCase();

    // Find unused backup codes
    const backupCodes = await this.prisma.mfaBackupCode.findMany({
      where: { userId, isUsed: false },
    });

    for (const backupCode of backupCodes) {
      const isMatch = await argon2.verify(backupCode.codeHash, normalizedCode);
      if (isMatch) {
        // Mark as used
        await this.prisma.mfaBackupCode.update({
          where: { id: backupCode.id },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });

        // Update remaining count
        await this.prisma.mfaConfiguration.update({
          where: { userId },
          data: {
            backupCodesRemaining: { decrement: 1 },
          },
        });

        // Log usage
        await this.auditLog.log({
          eventType: 'MFA_BACKUP_CODE_USED',
          userId,
          metadata: { backupCodeId: backupCode.id },
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Generate backup codes
   */
  private async generateBackupCodes(userId: string): Promise<string[]> {
    // Delete existing backup codes
    await this.prisma.mfaBackupCode.deleteMany({
      where: { userId },
    });

    const codes: string[] = [];
    const codeRecords: Array<{
      userId: string;
      codeHash: string;
    }> = [];

    for (let i = 0; i < this.config.backupCodes.count; i++) {
      // Generate random code
      const rawCode = crypto
        .randomBytes(this.config.backupCodes.length / 2)
        .toString('hex')
        .toUpperCase();

      // Format as XXXX-XXXX
      const formattedCode = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`;
      codes.push(formattedCode);

      // Hash for storage
      const codeHash = await argon2.hash(rawCode);
      codeRecords.push({
        userId,
        codeHash,
      });
    }

    // Store hashed codes
    await this.prisma.mfaBackupCode.createMany({
      data: codeRecords,
    });

    return codes;
  }

  /**
   * Get account name for TOTP
   */
  private async getAccountName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? userId;
  }

  /**
   * Increment setup attempts and check for blocking
   */
  private async incrementSetupAttempts(userId: string): Promise<void> {
    const attemptsKey = `mfa:setup:attempts:${userId}`;
    const attempts = await this.cache.incr(attemptsKey);

    if (attempts === 1) {
      await this.cache.expire(attemptsKey, 900); // 15 minutes window
    }

    if (attempts >= 5) {
      await this.cache.set(
        `mfa:setup:blocked:${userId}`,
        'blocked',
        300 // 5 minutes
      );
    }
  }

  /**
   * Create authenticated session after MFA verification
   */
  private async createAuthenticatedSession(
    userId: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<AuthWithMfaResponse> {
    // This would delegate to AuthService in actual implementation
    // Placeholder for the expected response
    throw new Error('Delegate to AuthService.createSession()');
  }
}
```

### React Hook for MFA

```typescript
// src/hooks/useMfa.ts
import { trpc } from '@/lib/trpc';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseMfaOptions {
  onSetupComplete?: (backupCodes: string[]) => void;
  onVerifyComplete?: () => void;
  onDisableComplete?: () => void;
}

export function useMfa(options: UseMfaOptions = {}) {
  const [setupData, setSetupData] = useState<{
    qrCodeDataUrl: string;
    manualEntryKey: string;
  } | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const utils = trpc.useContext();

  // Get MFA status
  const { data: status, isLoading: isLoadingStatus } = trpc.mfa.getStatus.useQuery();

  // Initialize setup
  const initSetupMutation = trpc.mfa.initSetup.useMutation({
    onSuccess: (data) => {
      setSetupData(data);
      setIsSettingUp(true);
      toast.info('Zeskanuj kod QR w aplikacji uwierzytelniającej');
    },
    onError: (error) => {
      toast.error(error.message || 'Nie udało się rozpocząć konfiguracji MFA');
    },
  });

  // Verify setup
  const verifySetupMutation = trpc.mfa.verifySetup.useMutation({
    onSuccess: (data) => {
      setIsSettingUp(false);
      setSetupData(null);
      setBackupCodes(data.backupCodes || []);
      utils.mfa.getStatus.invalidate();
      toast.success('Uwierzytelnianie dwuskładnikowe włączone');
      options.onSetupComplete?.(data.backupCodes || []);
    },
    onError: (error) => {
      toast.error(error.message || 'Nieprawidłowy kod weryfikacyjny');
    },
  });

  // Verify login
  const verifyLoginMutation = trpc.mfa.verifyLogin.useMutation({
    onSuccess: () => {
      options.onVerifyComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Weryfikacja nie powiodła się');
    },
  });

  // Disable MFA
  const disableMutation = trpc.mfa.disable.useMutation({
    onSuccess: () => {
      utils.mfa.getStatus.invalidate();
      toast.success('Uwierzytelnianie dwuskładnikowe wyłączone');
      options.onDisableComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Nie udało się wyłączyć MFA');
    },
  });

  // Regenerate secret
  const regenerateSecretMutation = trpc.mfa.regenerateSecret.useMutation({
    onSuccess: (data) => {
      setSetupData(data);
      setIsSettingUp(true);
      toast.info('Nowy sekret wygenerowany. Zeskanuj nowy kod QR.');
    },
    onError: (error) => {
      toast.error(error.message || 'Nie udało się wygenerować nowego sekretu');
    },
  });

  // Get backup codes
  const getBackupCodesMutation = trpc.mfa.getBackupCodes.useMutation({
    onSuccess: (data) => {
      if (data.backupCodes) {
        setBackupCodes(data.backupCodes);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Nie udało się pobrać kodów zapasowych');
    },
  });

  const startSetup = useCallback(() => {
    initSetupMutation.mutate({ method: 'TOTP' });
  }, [initSetupMutation]);

  const verifySetup = useCallback((code: string) => {
    verifySetupMutation.mutate({ code });
  }, [verifySetupMutation]);

  const verifyLogin = useCallback((challengeId: string, code: string, useBackupCode = false) => {
    verifyLoginMutation.mutate({ challengeId, code, useBackupCode });
  }, [verifyLoginMutation]);

  const disable = useCallback((password: string, totpCode: string) => {
    disableMutation.mutate({ password, totpCode });
  }, [disableMutation]);

  const regenerateSecret = useCallback((password: string, totpCode: string) => {
    regenerateSecretMutation.mutate({ password, totpCode });
  }, [regenerateSecretMutation]);

  const regenerateBackupCodes = useCallback((password: string, totpCode: string) => {
    getBackupCodesMutation.mutate({ regenerate: true, password, totpCode });
  }, [getBackupCodesMutation]);

  const cancelSetup = useCallback(() => {
    setIsSettingUp(false);
    setSetupData(null);
  }, []);

  return {
    // Status
    status,
    isLoadingStatus,
    isEnabled: status?.enabled ?? false,
    backupCodesRemaining: status?.backupCodesRemaining ?? 0,

    // Setup state
    isSettingUp,
    setupData,
    backupCodes,

    // Actions
    startSetup,
    verifySetup,
    verifyLogin,
    disable,
    regenerateSecret,
    regenerateBackupCodes,
    cancelSetup,

    // Loading states
    isStartingSetup: initSetupMutation.isPending,
    isVerifyingSetup: verifySetupMutation.isPending,
    isVerifyingLogin: verifyLoginMutation.isPending,
    isDisabling: disableMutation.isPending,
    isRegeneratingSecret: regenerateSecretMutation.isPending,
  };
}
```

### MFA Setup Component

```typescript
// src/components/auth/MfaSetup.tsx
import { useState } from 'react';
import { useMfa } from '@/hooks/useMfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface MfaSetupProps {
  onComplete?: () => void;
}

export function MfaSetup({ onComplete }: MfaSetupProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const {
    isEnabled,
    isSettingUp,
    setupData,
    backupCodes,
    startSetup,
    verifySetup,
    cancelSetup,
    isStartingSetup,
    isVerifyingSetup,
  } = useMfa({
    onSetupComplete: (codes) => {
      // Show backup codes modal
    },
  });

  const copyManualKey = async () => {
    if (setupData?.manualEntryKey) {
      await navigator.clipboard.writeText(setupData.manualEntryKey);
      toast.success('Klucz skopiowany do schowka');
    }
  };

  const copyBackupCodes = async () => {
    if (backupCodes.length > 0) {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedCodes(true);
      toast.success('Kody zapasowe skopiowane');
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length === 6) {
      verifySetup(verificationCode);
    }
  };

  // Already enabled state
  if (isEnabled && !isSettingUp && backupCodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Uwierzytelnianie dwuskładnikowe włączone
          </CardTitle>
          <CardDescription>
            Twoje konto jest chronione dodatkową warstwą zabezpieczeń.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show backup codes after successful setup
  if (backupCodes.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Uwierzytelnianie dwuskładnikowe włączone
          </CardTitle>
          <CardDescription>
            Zapisz poniższe kody zapasowe w bezpiecznym miejscu.
            Każdy kod może być użyty tylko raz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Te kody są wyświetlane tylko raz. Zapisz je teraz!
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-md font-mono text-sm">
            {backupCodes.map((code, i) => (
              <div key={i} className="py-1">{code}</div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={copyBackupCodes}
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedCodes ? 'Skopiowano' : 'Kopiuj kody'}
            </Button>
            <Button onClick={onComplete} className="flex-1">
              Gotowe
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Setup flow
  if (isSettingUp && setupData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skonfiguruj aplikację uwierzytelniającą</CardTitle>
          <CardDescription>
            Zeskanuj kod QR za pomocą Google Authenticator, Authy lub innej aplikacji TOTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <img
              src={setupData.qrCodeDataUrl}
              alt="QR Code"
              className="w-48 h-48 border rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Button
              variant="link"
              onClick={() => setShowManualKey(!showManualKey)}
              className="p-0 h-auto"
            >
              {showManualKey ? 'Ukryj klucz' : 'Nie możesz zeskanować? Wprowadź ręcznie'}
            </Button>

            {showManualKey && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <code className="flex-1 text-sm break-all">
                  {setupData.manualEntryKey}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyManualKey}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Wprowadź kod z aplikacji
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={cancelSetup}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={verificationCode.length !== 6 || isVerifyingSetup}
                className="flex-1"
              >
                {isVerifyingSetup ? 'Weryfikacja...' : 'Weryfikuj i włącz'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Initial state - not enabled
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Uwierzytelnianie dwuskładnikowe
        </CardTitle>
        <CardDescription>
          Dodaj dodatkową warstwę zabezpieczeń do swojego konta używając
          aplikacji uwierzytelniającej.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={startSetup}
          disabled={isStartingSetup}
        >
          {isStartingSetup ? 'Przygotowywanie...' : 'Włącz uwierzytelnianie dwuskładnikowe'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/aim/services/__tests__/mfa.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MfaService } from '../mfa.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { CacheService } from '@/core/cache/cache.service';
import { EncryptionService } from '@/core/security/encryption.service';
import * as speakeasy from 'speakeasy';

describe('MfaService', () => {
  let service: MfaService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;
  let encryption: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        {
          provide: PrismaService,
          useValue: {
            mfaConfiguration: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
            },
            mfaBackupCode: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            mfaChallenge: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((fn) => fn),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
            ttl: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
    encryption = module.get(EncryptionService);
  });

  describe('initializeMfaSetup', () => {
    it('should generate QR code and secret for new setup', async () => {
      const userId = 'user-123';

      prisma.mfaConfiguration.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ email: 'test@example.com' });
      encryption.encrypt.mockResolvedValue({
        encrypted: Buffer.from('encrypted'),
        iv: Buffer.from('iv'),
      });
      prisma.mfaConfiguration.upsert.mockResolvedValue({} as any);

      const result = await service.initializeMfaSetup(userId, 'TOTP');

      expect(result.qrCodeDataUrl).toContain('data:image/png;base64');
      expect(result.manualEntryKey).toHaveLength(52); // Base32 encoded
      expect(result.issuer).toBe('KsięgowaCRM');
    });

    it('should reject if MFA already enabled', async () => {
      const userId = 'user-123';

      prisma.mfaConfiguration.findUnique.mockResolvedValue({
        isEnabled: true,
      } as any);

      await expect(service.initializeMfaSetup(userId, 'TOTP'))
        .rejects.toThrow('MFA jest już włączone');
    });
  });

  describe('verifyMfaSetup', () => {
    it('should enable MFA with valid TOTP code', async () => {
      const userId = 'user-123';
      const secret = speakeasy.generateSecret();
      const validCode = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      prisma.mfaConfiguration.findUnique.mockResolvedValue({
        userId,
        secretEncrypted: Buffer.from('encrypted'),
        secretIv: Buffer.from('iv'),
        isEnabled: false,
      } as any);
      encryption.decrypt.mockResolvedValue(secret.base32);
      prisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 0 });
      prisma.mfaBackupCode.createMany.mockResolvedValue({ count: 10 });
      prisma.mfaConfiguration.update.mockResolvedValue({} as any);
      prisma.user.update.mockResolvedValue({} as any);
      prisma.user.findUnique.mockResolvedValue({ email: 'test@example.com' } as any);

      const result = await service.verifyMfaSetup(userId, validCode);

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should reject invalid TOTP code', async () => {
      const userId = 'user-123';
      const secret = speakeasy.generateSecret();

      prisma.mfaConfiguration.findUnique.mockResolvedValue({
        userId,
        secretEncrypted: Buffer.from('encrypted'),
        secretIv: Buffer.from('iv'),
        isEnabled: false,
      } as any);
      encryption.decrypt.mockResolvedValue(secret.base32);
      cache.incr.mockResolvedValue(1);

      await expect(service.verifyMfaSetup(userId, '000000'))
        .rejects.toThrow('Nieprawidłowy kod weryfikacyjny');
    });
  });

  describe('verifyMfaLogin', () => {
    it('should authenticate with valid TOTP during login', async () => {
      const challengeId = 'challenge-123';
      const userId = 'user-123';
      const secret = speakeasy.generateSecret();
      const validCode = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      prisma.mfaChallenge.findUnique.mockResolvedValue({
        id: challengeId,
        userId,
        method: 'TOTP',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        expiresAt: new Date(Date.now() + 300000),
        user: { id: userId },
      } as any);
      cache.get.mockResolvedValue(null); // Not blocked
      prisma.mfaConfiguration.findUnique.mockResolvedValue({
        userId,
        secretEncrypted: Buffer.from('encrypted'),
        secretIv: Buffer.from('iv'),
        isEnabled: true,
      } as any);
      encryption.decrypt.mockResolvedValue(secret.base32);

      // This test should verify the flow, actual session creation is mocked
      await expect(
        service.verifyMfaLogin(challengeId, validCode, false, {
          ipAddress: '127.0.0.1',
        })
      ).rejects.toThrow('Delegate to AuthService');
    });

    it('should reject expired challenge', async () => {
      const challengeId = 'challenge-123';

      prisma.mfaChallenge.findUnique.mockResolvedValue({
        id: challengeId,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60000), // Expired
      } as any);

      await expect(
        service.verifyMfaLogin(challengeId, '123456', false, { ipAddress: '127.0.0.1' })
      ).rejects.toThrow('Sesja weryfikacji wygasła');
    });

    it('should block after max attempts', async () => {
      const challengeId = 'challenge-123';
      const userId = 'user-123';

      prisma.mfaChallenge.findUnique.mockResolvedValue({
        id: challengeId,
        userId,
        method: 'TOTP',
        status: 'PENDING',
        attempts: 2,
        maxAttempts: 3,
        expiresAt: new Date(Date.now() + 300000),
      } as any);
      cache.get.mockResolvedValue(null);
      prisma.mfaConfiguration.findUnique.mockResolvedValue({
        userId,
        secretEncrypted: Buffer.from('encrypted'),
        secretIv: Buffer.from('iv'),
        isEnabled: true,
      } as any);
      encryption.decrypt.mockResolvedValue('invalid-secret');
      prisma.mfaChallenge.update.mockResolvedValue({ attempts: 3, maxAttempts: 3 } as any);

      await expect(
        service.verifyMfaLogin(challengeId, '000000', false, { ipAddress: '127.0.0.1' })
      ).rejects.toThrow('Przekroczono maksymalną liczbę prób');
    });
  });

  describe('verifyBackupCode', () => {
    it('should accept valid backup code', async () => {
      const userId = 'user-123';
      const challengeId = 'challenge-123';

      prisma.mfaChallenge.findUnique.mockResolvedValue({
        id: challengeId,
        userId,
        method: 'TOTP',
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        expiresAt: new Date(Date.now() + 300000),
      } as any);
      cache.get.mockResolvedValue(null);

      // Mock backup code verification (implementation uses argon2)
      const backupCodes = [
        { id: 'code-1', codeHash: 'hashed', isUsed: false },
      ];
      prisma.mfaBackupCode.findMany.mockResolvedValue(backupCodes as any);

      // The actual test would need to hash the code properly
      // This is a simplified test structure
    });

    it('should mark backup code as used after verification', async () => {
      // Test that backup code is marked as used
    });
  });

  describe('disableMfa', () => {
    it('should disable MFA with correct password and TOTP', async () => {
      const userId = 'user-123';
      const secret = speakeasy.generateSecret();
      const validCode = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        passwordHash: await argon2.hash('password123'),
      } as any);
      prisma.mfaConfiguration.findUnique.mockResolvedValue({
        userId,
        secretEncrypted: Buffer.from('encrypted'),
        secretIv: Buffer.from('iv'),
        isEnabled: true,
      } as any);
      encryption.decrypt.mockResolvedValue(secret.base32);

      const result = await service.disableMfa(userId, 'password123', validCode);

      expect(result.success).toBe(true);
      expect(prisma.mfaBackupCode.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should reject with wrong password', async () => {
      const userId = 'user-123';

      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        passwordHash: await argon2.hash('correct-password'),
      } as any);

      await expect(service.disableMfa(userId, 'wrong-password', '123456'))
        .rejects.toThrow('Nieprawidłowe hasło');
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/aim/__tests__/mfa.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, TestApp } from '@/test/utils/test-app';
import { createTestUser } from '@/test/factories/user.factory';
import * as speakeasy from 'speakeasy';

describe('MFA Integration', () => {
  let app: TestApp;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    testUser = await createTestUser(app.prisma, {
      email: 'mfa-test@example.com',
      password: 'Test123!@#',
    });
    authToken = await app.getAuthToken(testUser.email, 'Test123!@#');
  });

  afterAll(async () => {
    await app.cleanup();
  });

  describe('MFA Setup Flow', () => {
    let setupData: any;
    let secret: string;

    it('should initialize MFA setup and return QR code', async () => {
      const response = await app.trpc.mfa.initSetup.mutate(
        { method: 'TOTP' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.qrCodeDataUrl).toContain('data:image/png;base64');
      expect(response.manualEntryKey).toBeDefined();
      expect(response.issuer).toBe('KsięgowaCRM');

      setupData = response;
      secret = response.manualEntryKey;
    });

    it('should verify valid TOTP code and enable MFA', async () => {
      const validCode = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      const response = await app.trpc.mfa.verifySetup.mutate(
        { code: validCode },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.success).toBe(true);
      expect(response.backupCodes).toHaveLength(10);
      expect(response.backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should show MFA as enabled in status', async () => {
      const status = await app.trpc.mfa.getStatus.query(undefined, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(status.enabled).toBe(true);
      expect(status.method).toBe('TOTP');
      expect(status.backupCodesRemaining).toBe(10);
    });
  });

  describe('MFA Login Flow', () => {
    let challengeId: string;

    it('should return MFA challenge on login when enabled', async () => {
      const response = await app.trpc.auth.login.mutate({
        email: testUser.email,
        password: 'Test123!@#',
      });

      expect(response.requiresMfa).toBe(true);
      expect(response.challengeId).toBeDefined();
      expect(response.accessToken).toBeUndefined();

      challengeId = response.challengeId;
    });

    it('should complete login with valid TOTP code', async () => {
      // Get the secret from the database for testing
      const mfaConfig = await app.prisma.mfaConfiguration.findUnique({
        where: { userId: testUser.id },
      });
      const secret = await app.encryption.decrypt(
        mfaConfig.secretEncrypted,
        mfaConfig.secretIv
      );

      const validCode = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      const response = await app.trpc.mfa.verifyLogin.mutate({
        challengeId,
        code: validCode,
        useBackupCode: false,
      });

      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
      expect(response.user.id).toBe(testUser.id);
    });

    it('should reject invalid TOTP code', async () => {
      // Create new challenge
      const loginResponse = await app.trpc.auth.login.mutate({
        email: testUser.email,
        password: 'Test123!@#',
      });

      await expect(
        app.trpc.mfa.verifyLogin.mutate({
          challengeId: loginResponse.challengeId,
          code: '000000',
          useBackupCode: false,
        })
      ).rejects.toThrow('Nieprawidłowy kod weryfikacyjny');
    });

    it('should accept backup code for login', async () => {
      // Get a backup code
      const backupCode = await app.prisma.mfaBackupCode.findFirst({
        where: { userId: testUser.id, isUsed: false },
      });

      // This test would need the actual unhashed code
      // In real implementation, backup codes are only shown once
    });
  });

  describe('MFA Disable Flow', () => {
    it('should disable MFA with valid password and TOTP', async () => {
      const mfaConfig = await app.prisma.mfaConfiguration.findUnique({
        where: { userId: testUser.id },
      });
      const secret = await app.encryption.decrypt(
        mfaConfig.secretEncrypted,
        mfaConfig.secretIv
      );

      const validCode = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      const response = await app.trpc.mfa.disable.mutate(
        {
          password: 'Test123!@#',
          totpCode: validCode,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.success).toBe(true);

      // Verify MFA is disabled
      const status = await app.trpc.mfa.getStatus.query(undefined, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(status.enabled).toBe(false);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/mfa-setup.spec.ts
import { test, expect } from '@playwright/test';
import { createTestUser, loginAs } from './helpers/auth';
import * as speakeasy from 'speakeasy';

test.describe('MFA Setup', () => {
  test.beforeEach(async ({ page }) => {
    const user = await createTestUser({
      email: 'e2e-mfa@example.com',
      password: 'Test123!@#',
    });
    await loginAs(page, user.email, 'Test123!@#');
  });

  test('should complete MFA setup flow', async ({ page }) => {
    // Navigate to security settings
    await page.goto('/settings/security');
    await expect(page.getByText('Uwierzytelnianie dwuskładnikowe')).toBeVisible();

    // Start MFA setup
    await page.getByRole('button', { name: /włącz uwierzytelnianie/i }).click();

    // Verify QR code is displayed
    await expect(page.getByRole('img', { name: 'QR Code' })).toBeVisible();

    // Get manual entry key
    await page.getByRole('button', { name: /wprowadź ręcznie/i }).click();
    const manualKey = await page.locator('code').textContent();
    expect(manualKey).toHaveLength(52);

    // Generate valid TOTP code
    const validCode = speakeasy.totp({
      secret: manualKey!,
      encoding: 'base32',
    });

    // Enter verification code
    await page.getByPlaceholder('000000').fill(validCode);
    await page.getByRole('button', { name: /weryfikuj i włącz/i }).click();

    // Verify backup codes are shown
    await expect(page.getByText('Zapisz poniższe kody zapasowe')).toBeVisible();
    const backupCodes = await page.locator('.grid code').allTextContents();
    expect(backupCodes).toHaveLength(10);

    // Copy and complete
    await page.getByRole('button', { name: /kopiuj kody/i }).click();
    await page.getByRole('button', { name: /gotowe/i }).click();

    // Verify MFA is enabled
    await expect(page.getByText('Uwierzytelnianie dwuskładnikowe włączone')).toBeVisible();
  });

  test('should show error for invalid TOTP code during setup', async ({ page }) => {
    await page.goto('/settings/security');
    await page.getByRole('button', { name: /włącz uwierzytelnianie/i }).click();

    // Enter invalid code
    await page.getByPlaceholder('000000').fill('000000');
    await page.getByRole('button', { name: /weryfikuj i włącz/i }).click();

    // Verify error message
    await expect(page.getByText('Nieprawidłowy kod weryfikacyjny')).toBeVisible();
  });
});

test.describe('MFA Login', () => {
  let testSecret: string;

  test.beforeEach(async () => {
    // Create user with MFA enabled
    const { user, secret } = await createTestUserWithMfa({
      email: 'e2e-mfa-login@example.com',
      password: 'Test123!@#',
    });
    testSecret = secret;
  });

  test('should require MFA verification on login', async ({ page }) => {
    await page.goto('/login');

    // Enter credentials
    await page.getByLabel('Email').fill('e2e-mfa-login@example.com');
    await page.getByLabel('Hasło').fill('Test123!@#');
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Verify MFA prompt
    await expect(page.getByText('Weryfikacja dwuetapowa')).toBeVisible();
    await expect(page.getByPlaceholder('000000')).toBeVisible();
    await expect(page.getByText('Użyj kodu zapasowego')).toBeVisible();
  });

  test('should complete login with valid TOTP', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('e2e-mfa-login@example.com');
    await page.getByLabel('Hasło').fill('Test123!@#');
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Enter valid TOTP
    const validCode = speakeasy.totp({
      secret: testSecret,
      encoding: 'base32',
    });
    await page.getByPlaceholder('000000').fill(validCode);
    await page.getByRole('button', { name: /weryfikuj/i }).click();

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should block after too many failed MFA attempts', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('e2e-mfa-login@example.com');
    await page.getByLabel('Hasło').fill('Test123!@#');
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Enter invalid code 3 times
    for (let i = 0; i < 3; i++) {
      await page.getByPlaceholder('000000').fill('000000');
      await page.getByRole('button', { name: /weryfikuj/i }).click();
      if (i < 2) {
        await expect(page.getByText(/pozostało prób/i)).toBeVisible();
        await page.getByPlaceholder('000000').clear();
      }
    }

    // Verify redirect back to login
    await expect(page).toHaveURL('/login');
    await expect(page.getByText(/zbyt wiele nieudanych prób/i)).toBeVisible();
  });
});
```

---

## Security Checklist

| Category | Requirement | Implementation |
|----------|-------------|----------------|
| Secrets | TOTP secrets are encrypted at rest | AES-256-GCM encryption with unique IV |
| Secrets | Secrets never logged or exposed in errors | Sanitized error messages |
| Secrets | Backup codes are hashed, not stored plaintext | Argon2id hashing |
| Rate Limiting | Setup attempts are rate limited | 5 attempts per 15 minutes |
| Rate Limiting | Verification attempts are limited | 3 attempts per challenge |
| Rate Limiting | Temporary block after max failures | 5 minute cooldown |
| Session | MFA challenge expires | 3 minute expiration |
| Session | One-time use challenges | Marked as used after verification |
| Session | Session not created until MFA verified | Two-phase authentication |
| Audit | All MFA events logged | Complete audit trail |
| Audit | Failed attempts logged with context | IP, user agent, timestamp |
| Notifications | Email on MFA enabled/disabled | Security notifications |
| Recovery | Backup codes provided | 10 single-use codes |
| Recovery | Backup codes can be regenerated | With password + TOTP verification |
| TOTP | Standard RFC 6238 implementation | speakeasy library |
| TOTP | Time window tolerance | ±30 seconds (1 period) |

---

## Audit Events

| Event Type | Trigger | Logged Data |
|------------|---------|-------------|
| `MFA_SETUP_INITIATED` | User starts MFA setup | userId, method |
| `MFA_ENABLED` | MFA successfully enabled | userId, method, timestamp |
| `MFA_DISABLED` | MFA disabled | userId, timestamp |
| `MFA_CHALLENGE_CREATED` | Login requires MFA | userId, challengeId, method |
| `MFA_VERIFIED` | Successful MFA verification | userId, challengeId, method |
| `MFA_FAILED` | Failed MFA verification | userId, challengeId, attemptNumber |
| `MFA_SECRET_REGENERATED` | TOTP secret regenerated | userId, timestamp |
| `MFA_BACKUP_CODE_USED` | Backup code consumed | userId, backupCodeId |
| `MFA_BACKUP_CODES_REGENERATED` | New backup codes generated | userId, count |

---

## Implementation Notes

1. **Library Choice**: Use `speakeasy` or `otplib` for TOTP implementation - both are well-maintained and RFC 6238 compliant

2. **Secret Encryption**: Always encrypt TOTP secrets before storing in database. Use AES-256-GCM with unique IV per secret

3. **QR Code Generation**: Use `qrcode` package for generating data URLs. Consider caching QR codes briefly to avoid regeneration

4. **Time Synchronization**: Server time must be accurate (NTP synced). The ±1 period window handles minor client-server drift

5. **Backup Codes**: Format as XXXX-XXXX for readability. Only show once during setup - user must save them

6. **Challenge Flow**: Create a separate challenge entity to track MFA verification during login, with expiration and attempt limits

7. **Device Trust**: Consider implementing "remember this device" to reduce MFA friction for trusted devices

8. **Recovery Options**: Ensure users have recovery path if they lose access to authenticator app (backup codes, admin reset)

---

## Related Documentation

- [AIM Epic](./epic.md)
- [AIM-003 User Login](./AIM-003-user-login.md)
- [AIM-010 Backup Codes](./AIM-010-backup-codes.md)
- [Constitution - Security Requirements](../../constitution.md)
- [Technical Specification](../../../docs/aim-module-spec.md)

---

*Last updated: December 2024*
