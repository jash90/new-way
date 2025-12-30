# Story: Password Reset Flow (AIM-004)

> **Story ID**: AIM-004
> **Epic**: Authentication & Identity Management (AIM)
> **Priority**: P0 (Core)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Dependencies**: AIM-001 (User Registration)

---

## User Story

**As a** user who has forgotten my password,
**I want to** securely reset it via email verification,
**So that** I can regain access to my account without compromising security.

---

## Acceptance Criteria

### Scenario 1: Request Password Reset
```gherkin
Feature: Password Reset Request
  As a user who forgot my password
  I need to request a password reset
  So that I can regain access to my account

  Scenario: Request reset with valid email
    Given I am on the password reset page
    When I enter "jan@example.com" as email
    And I click "Wyślij link do resetowania"
    Then I should see "Jeśli konto istnieje, wysłaliśmy link do resetowania hasła"
    And if the email exists, a reset email should be sent
    And the response message should be the same regardless of email existence

  Scenario: Request reset with non-existent email
    Given I am on the password reset page
    When I enter "nieistnieje@example.com" as email
    And I click "Wyślij link do resetowania"
    Then I should see "Jeśli konto istnieje, wysłaliśmy link do resetowania hasła"
    And no email should be sent
    And response time should be similar to valid email request

  Scenario: Request reset with invalid email format
    Given I am on the password reset page
    When I enter "nieprawidlowy-email" as email
    And I click "Wyślij link do resetowania"
    Then I should see error "Nieprawidłowy format adresu email"
    And no reset request should be processed
```

### Scenario 2: Rate Limiting for Reset Requests
```gherkin
Feature: Password Reset Rate Limiting
  As a security measure
  The system should limit password reset requests

  Scenario: Rate limit reset requests per email
    Given I request password reset for "jan@example.com"
    When I request reset 3 more times within 1 hour
    Then the 4th request should see "Zbyt wiele próśb. Spróbuj ponownie za godzinę."
    And only 3 reset emails should be sent total

  Scenario: Rate limit reset requests per IP
    Given I am from IP address 192.168.1.100
    When I request reset for 10 different emails within 1 hour
    Then the 11th request should be blocked
    And I should see "Zbyt wiele próśb z tego adresu IP"

  Scenario: Different IPs can request for same email
    Given user "jan@example.com" received reset request from IP 1
    When I request reset for same email from IP 2
    Then the request should be processed normally
    And a new reset token should be generated
```

### Scenario 3: Reset Token Handling
```gherkin
Feature: Password Reset Token
  As a secure system
  Reset tokens must be properly managed

  Scenario: Generate secure reset token
    Given a valid reset request is made
    Then a cryptographically secure token should be generated
    And the token should be 64 characters long (hex encoded)
    And the token should expire in 1 hour
    And any previous active tokens for this user should be invalidated

  Scenario: Access reset page with valid token
    Given I received a password reset email
    When I click the reset link with valid token
    Then I should see the password reset form
    And I should see the user's email (masked: j***@example.com)
    And the token should be validated server-side

  Scenario: Access reset page with expired token
    Given I received a password reset email 2 hours ago
    When I click the reset link
    Then I should see error "Link do resetowania hasła wygasł"
    And I should see option to request new reset link
    And I should not see the password reset form

  Scenario: Access reset page with invalid token
    Given I have a malformed or tampered token
    When I try to access the reset page
    Then I should see error "Nieprawidłowy link do resetowania hasła"
    And the incident should be logged

  Scenario: Access reset page with already used token
    Given I have already used a reset token to change password
    When I try to use the same token again
    Then I should see error "Ten link został już wykorzystany"
    And the attempt should be logged
```

### Scenario 4: Set New Password
```gherkin
Feature: Set New Password
  As a user resetting my password
  I need to set a new secure password

  Scenario: Set valid new password
    Given I am on the password reset form with valid token
    When I enter "NoweHaslo123!@#" as new password
    And I enter "NoweHaslo123!@#" as password confirmation
    And I click "Ustaw nowe hasło"
    Then my password should be updated
    And the reset token should be invalidated
    And all my active sessions should be terminated
    And I should receive confirmation email
    And I should be redirected to login page
    And I should see "Hasło zostało zmienione. Możesz się teraz zalogować."

  Scenario: Password mismatch
    Given I am on the password reset form
    When I enter "NoweHaslo123!@#" as new password
    And I enter "InneHaslo123!@#" as password confirmation
    And I click "Ustaw nowe hasło"
    Then I should see error "Hasła nie są identyczne"
    And the password should not be changed

  Scenario: Password too weak
    Given I am on the password reset form
    When I enter "slabe123" as new password
    And I enter "slabe123" as password confirmation
    Then I should see password strength indicator as "Słabe"
    And I should see hint about missing uppercase and special characters
    When I click "Ustaw nowe hasło"
    Then I should see error "Hasło nie spełnia wymagań bezpieczeństwa"

  Scenario: Password same as current
    Given I am on the password reset form
    When I enter my current password as new password
    And I click "Ustaw nowe hasło"
    Then I should see error "Nowe hasło musi być inne niż obecne"

  Scenario: Password in recent history
    Given I have changed my password 3 times before
    And my password history contains "Haslo1!", "Haslo2!", "Haslo3!"
    When I try to set "Haslo2!" as new password
    Then I should see error "To hasło było już używane. Wybierz inne."
```

### Scenario 5: Password Strength Requirements
```gherkin
Feature: Password Strength Validation
  As a secure system
  Passwords must meet complexity requirements

  Scenario Outline: Validate password requirements
    Given I am on the password reset form
    When I enter "<password>" as new password
    Then I should see strength indicator as "<strength>"
    And validation message should include "<message>"

    Examples:
      | password        | strength    | message                               |
      | abc             | Bardzo słabe| Minimum 8 znaków                      |
      | abcdefgh        | Słabe       | Dodaj wielką literę                   |
      | Abcdefgh        | Średnie     | Dodaj cyfrę                           |
      | Abcdefgh1       | Dobre       | Dodaj znak specjalny                  |
      | Abcdefgh1!      | Silne       | Hasło spełnia wszystkie wymagania     |
      | Abcdefgh1!@#$%  | Bardzo silne| Doskonałe hasło                       |

  Scenario: Check password against breach database
    Given I am on the password reset form
    When I enter "Password123!" as new password (known breached password)
    Then I should see warning "To hasło wyciekło w znanych wyciekach danych"
    And I should be recommended to choose different password
    But I should still be allowed to use it (with warning)
```

### Scenario 6: Security Notifications
```gherkin
Feature: Password Reset Notifications
  As a security-conscious user
  I should be notified of password changes

  Scenario: Send password changed confirmation
    Given I successfully reset my password
    Then I should receive email "Hasło zostało zmienione"
    And email should contain change timestamp
    And email should contain "To nie ja" link
    And email should contain device/location info

  Scenario: Alert on suspicious reset request
    Given someone requests password reset for my account
    And the request comes from unusual location
    Then I should receive email "Próba resetowania hasła"
    And email should contain request details
    And email should contain "Zignoruj jeśli to nie Ty" notice
```

---

## Technical Specification

### Database Schema

```sql
-- Password reset tokens table
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    requested_ip INET NOT NULL,
    requested_user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_active_token UNIQUE (user_id, token_hash)
);

-- Password history table
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by VARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'system'
    change_reason VARCHAR(100), -- 'reset', 'change', 'forced'
    ip_address INET
);

-- Indexes
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_history_user ON password_history(user_id);
CREATE INDEX idx_password_history_changed ON password_history(user_id, changed_at DESC);

-- Rate limiting table
CREATE TABLE password_reset_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL, -- 'email', 'ip'
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(identifier, identifier_type)
);

-- Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

### API Endpoints

```typescript
// Password Reset Endpoints
POST   /api/v1/auth/forgot-password      // Request password reset
POST   /api/v1/auth/reset-password       // Reset password with token
GET    /api/v1/auth/validate-reset-token // Validate token (check before showing form)
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Forgot password request schema
export const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Nieprawidłowy format adresu email')
    .max(255)
    .transform(val => val.toLowerCase().trim()),
});

// Password strength validation
const passwordRequirements = z.string()
  .min(8, 'Hasło musi mieć minimum 8 znaków')
  .max(128, 'Hasło może mieć maksimum 128 znaków')
  .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
  .regex(/[a-z]/, 'Hasło musi zawierać małą literę')
  .regex(/[0-9]/, 'Hasło musi zawierać cyfrę')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Hasło musi zawierać znak specjalny');

// Reset password request schema
export const resetPasswordSchema = z.object({
  token: z.string()
    .min(64, 'Nieprawidłowy token')
    .max(64, 'Nieprawidłowy token')
    .regex(/^[a-f0-9]+$/, 'Nieprawidłowy format tokenu'),
  newPassword: passwordRequirements,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Hasła nie są identyczne',
  path: ['confirmPassword'],
});

// Validate token schema
export const validateTokenSchema = z.object({
  token: z.string().min(64).max(64),
});

// Password strength response
export const passwordStrengthSchema = z.object({
  score: z.number().min(0).max(5),
  strength: z.enum(['bardzo_slabe', 'slabe', 'srednie', 'dobre', 'silne', 'bardzo_silne']),
  feedback: z.array(z.string()),
  isBreached: z.boolean(),
  meetsRequirements: z.boolean(),
});
```

### Implementation

```typescript
// src/modules/aim/services/password-reset.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { HashService } from './hash.service';
import { AuditService } from './audit.service';
import { EmailService } from '@/infrastructure/email/email.service';
import { SessionService } from './session.service';
import * as crypto from 'crypto';

interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
}

interface ResetTokenValidation {
  isValid: boolean;
  error?: string;
  userId?: string;
  email?: string;
}

@Injectable()
export class PasswordResetService {
  private readonly TOKEN_EXPIRY_HOURS = 1;
  private readonly MAX_REQUESTS_PER_EMAIL = 3;
  private readonly MAX_REQUESTS_PER_IP = 10;
  private readonly RATE_LIMIT_WINDOW_HOURS = 1;
  private readonly PASSWORD_HISTORY_COUNT = 5;
  private readonly MIN_RESPONSE_TIME_MS = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly hashService: HashService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly config: ConfigService,
  ) {}

  async requestPasswordReset(
    email: string,
    metadata: RequestMetadata,
  ): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();

    // Always return same message to prevent email enumeration
    const successMessage = 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła';

    try {
      // Check rate limits
      await this.checkRateLimits(email, metadata.ipAddress);

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, email: true, emailVerifiedAt: true },
      });

      if (user && user.emailVerifiedAt) {
        // Invalidate any existing tokens
        await this.invalidateExistingTokens(user.id);

        // Generate new token
        const token = this.generateSecureToken();
        const tokenHash = await this.hashToken(token);
        const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        // Store token
        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
            requestedIp: metadata.ipAddress,
            requestedUserAgent: metadata.userAgent,
          },
        });

        // Send email
        await this.emailService.sendPasswordResetEmail({
          to: user.email,
          resetUrl: `${this.config.get('FRONTEND_URL')}/auth/reset-password?token=${token}`,
          expiresInHours: this.TOKEN_EXPIRY_HOURS,
          ipAddress: metadata.ipAddress,
        });

        // Audit log
        await this.auditService.log({
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          resource: 'password_reset_token',
          details: { expiresAt: expiresAt.toISOString() },
          ipAddress: metadata.ipAddress,
        });
      } else {
        // Log attempt for non-existent user (security monitoring)
        await this.auditService.log({
          action: 'PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL',
          resource: 'password_reset_token',
          details: { email },
          ipAddress: metadata.ipAddress,
          severity: 'LOW',
        });
      }

      // Update rate limit counters
      await this.incrementRateLimitCounters(email, metadata.ipAddress);

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error; // Re-throw rate limit errors
      }
      // Log error but return success message
      console.error('Password reset request error:', error);
    }

    // Ensure consistent response time
    await this.ensureMinResponseTime(startTime);

    return { success: true, message: successMessage };
  }

  async validateToken(token: string): Promise<ResetTokenValidation> {
    const tokenHash = await this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!resetToken) {
      // Check if token exists but is expired/used
      const expiredToken = await this.prisma.passwordResetToken.findFirst({
        where: { tokenHash },
      });

      if (expiredToken) {
        if (expiredToken.usedAt) {
          return { isValid: false, error: 'TOKEN_ALREADY_USED' };
        }
        if (expiredToken.expiresAt < new Date()) {
          return { isValid: false, error: 'TOKEN_EXPIRED' };
        }
        if (expiredToken.invalidatedAt) {
          return { isValid: false, error: 'TOKEN_INVALIDATED' };
        }
      }

      return { isValid: false, error: 'TOKEN_INVALID' };
    }

    // Mask email for display
    const maskedEmail = this.maskEmail(resetToken.user.email);

    return {
      isValid: true,
      userId: resetToken.user.id,
      email: maskedEmail,
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    // Validate token
    const tokenHash = await this.hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      await this.auditService.log({
        action: 'PASSWORD_RESET_INVALID_TOKEN',
        resource: 'password_reset_token',
        details: { tokenHash: tokenHash.substring(0, 16) + '...' },
        ipAddress: metadata.ipAddress,
        severity: 'MEDIUM',
      });

      throw new BadRequestException('Nieprawidłowy lub wygasły link do resetowania hasła');
    }

    const user = resetToken.user;

    // Check if new password is same as current
    const isSameAsCurrent = await this.hashService.verify(
      user.passwordHash,
      newPassword,
    );

    if (isSameAsCurrent) {
      throw new BadRequestException('Nowe hasło musi być inne niż obecne');
    }

    // Check password history
    await this.checkPasswordHistory(user.id, newPassword);

    // Check if password is breached
    const isBreached = await this.checkPasswordBreach(newPassword);
    // Note: We allow breached passwords with warning, logged for security

    // Hash new password
    const newPasswordHash = await this.hashService.hash(newPassword);

    // Update password in transaction
    await this.prisma.$transaction(async (tx) => {
      // Store old password in history
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash: user.passwordHash,
          changeReason: 'reset',
          ipAddress: metadata.ipAddress,
        },
      });

      // Update user password
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          lockedUntil: null, // Unlock account if locked
        },
      });

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
    });

    // Revoke all sessions
    await this.sessionService.revokeAllForUser(user.id, 'PASSWORD_RESET');

    // Clear rate limits
    await this.clearRateLimits(user.email);

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail({
      to: user.email,
      changedAt: new Date(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    // Audit log
    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      resource: 'user',
      resourceId: user.id,
      details: {
        tokenId: resetToken.id,
        isBreachedPassword: isBreached,
      },
      ipAddress: metadata.ipAddress,
    });
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex'); // 64 hex characters
  }

  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.charAt(0) +
      '*'.repeat(Math.max(localPart.length - 2, 1)) +
      localPart.charAt(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
  }

  private async invalidateExistingTokens(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });
  }

  private async checkRateLimits(email: string, ipAddress: string): Promise<void> {
    // Check email rate limit
    const emailKey = `password_reset:email:${email}`;
    const emailCount = await this.redis.incr(emailKey);
    if (emailCount === 1) {
      await this.redis.expire(emailKey, this.RATE_LIMIT_WINDOW_HOURS * 60 * 60);
    }

    if (emailCount > this.MAX_REQUESTS_PER_EMAIL) {
      throw new ForbiddenException('Zbyt wiele próśb. Spróbuj ponownie za godzinę.');
    }

    // Check IP rate limit
    const ipKey = `password_reset:ip:${ipAddress}`;
    const ipCount = await this.redis.incr(ipKey);
    if (ipCount === 1) {
      await this.redis.expire(ipKey, this.RATE_LIMIT_WINDOW_HOURS * 60 * 60);
    }

    if (ipCount > this.MAX_REQUESTS_PER_IP) {
      throw new ForbiddenException('Zbyt wiele próśb z tego adresu IP.');
    }
  }

  private async incrementRateLimitCounters(email: string, ipAddress: string): Promise<void> {
    // Already incremented in checkRateLimits
  }

  private async clearRateLimits(email: string): Promise<void> {
    await this.redis.del(`password_reset:email:${email}`);
  }

  private async checkPasswordHistory(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const recentPasswords = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { changedAt: 'desc' },
      take: this.PASSWORD_HISTORY_COUNT,
    });

    for (const historyEntry of recentPasswords) {
      const isMatch = await this.hashService.verify(
        historyEntry.passwordHash,
        newPassword,
      );

      if (isMatch) {
        throw new BadRequestException('To hasło było już używane. Wybierz inne.');
      }
    }
  }

  private async checkPasswordBreach(password: string): Promise<boolean> {
    try {
      // Use Have I Been Pwned API (k-Anonymity model)
      const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.substring(0, 5);
      const suffix = sha1.substring(5);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'User-Agent': 'KsiegowaCRM-PasswordCheck' },
      });

      if (!response.ok) return false;

      const text = await response.text();
      const lines = text.split('\n');

      for (const line of lines) {
        const [hashSuffix] = line.split(':');
        if (hashSuffix === suffix) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // If API fails, don't block the user
      console.error('Password breach check failed:', error);
      return false;
    }
  }

  private async ensureMinResponseTime(startTime: number): Promise<void> {
    const elapsed = Date.now() - startTime;
    if (elapsed < this.MIN_RESPONSE_TIME_MS) {
      await new Promise(resolve =>
        setTimeout(resolve, this.MIN_RESPONSE_TIME_MS - elapsed)
      );
    }
  }

  // Password strength calculation
  calculatePasswordStrength(password: string): {
    score: number;
    strength: string;
    feedback: string[];
    meetsRequirements: boolean;
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 1;
    else feedback.push('Minimum 8 znaków');

    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 0.5;

    // Character variety
    if (/[a-z]/.test(password)) score += 0.5;
    else feedback.push('Dodaj małą literę');

    if (/[A-Z]/.test(password)) score += 0.5;
    else feedback.push('Dodaj wielką literę');

    if (/[0-9]/.test(password)) score += 0.5;
    else feedback.push('Dodaj cyfrę');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('Dodaj znak specjalny');

    // Pattern detection (reduces score)
    if (/(.)\1{2,}/.test(password)) {
      score -= 0.5;
      feedback.push('Unikaj powtórzeń znaków');
    }

    if (/^[0-9]+$/.test(password)) {
      score -= 1;
      feedback.push('Nie używaj samych cyfr');
    }

    // Common patterns
    const commonPatterns = ['123456', 'password', 'qwerty', 'abc123'];
    for (const pattern of commonPatterns) {
      if (password.toLowerCase().includes(pattern)) {
        score -= 1;
        feedback.push('Unikaj popularnych wzorców');
        break;
      }
    }

    // Normalize score
    score = Math.max(0, Math.min(5, score));

    const strengthMap: Record<number, string> = {
      0: 'bardzo_slabe',
      1: 'slabe',
      2: 'srednie',
      3: 'dobre',
      4: 'silne',
      5: 'bardzo_silne',
    };

    const meetsRequirements =
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      score: Math.floor(score),
      strength: strengthMap[Math.floor(score)] || 'bardzo_slabe',
      feedback: feedback.length > 0 ? feedback : ['Hasło spełnia wszystkie wymagania'],
      meetsRequirements,
    };
  }
}
```

### tRPC Router

```typescript
// src/modules/aim/routers/password-reset.router.ts
import { router, publicProcedure } from '@/infrastructure/trpc';
import { TRPCError } from '@trpc/server';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  validateTokenSchema
} from '../schemas/password-reset.schema';
import { PasswordResetService } from '../services/password-reset.service';

export const passwordResetRouter = router({
  // Request password reset
  requestReset: publicProcedure
    .input(forgotPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.container.get(PasswordResetService);

      const metadata = {
        ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString() || 'unknown',
        userAgent: ctx.req.headers['user-agent'] || 'unknown',
      };

      try {
        return await service.requestPasswordReset(input.email, metadata);
      } catch (error) {
        if (error.status === 403) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // Validate reset token
  validateToken: publicProcedure
    .input(validateTokenSchema)
    .query(async ({ ctx, input }) => {
      const service = ctx.container.get(PasswordResetService);
      const result = await service.validateToken(input.token);

      if (!result.isValid) {
        const errorMessages: Record<string, string> = {
          TOKEN_EXPIRED: 'Link do resetowania hasła wygasł',
          TOKEN_ALREADY_USED: 'Ten link został już wykorzystany',
          TOKEN_INVALIDATED: 'Link do resetowania hasła został unieważniony',
          TOKEN_INVALID: 'Nieprawidłowy link do resetowania hasła',
        };

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: errorMessages[result.error!] || 'Nieprawidłowy token',
        });
      }

      return {
        isValid: true,
        email: result.email, // Masked email
      };
    }),

  // Reset password
  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.container.get(PasswordResetService);

      const metadata = {
        ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString() || 'unknown',
        userAgent: ctx.req.headers['user-agent'] || 'unknown',
      };

      try {
        await service.resetPassword(input.token, input.newPassword, metadata);
        return {
          success: true,
          message: 'Hasło zostało zmienione. Możesz się teraz zalogować.',
        };
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas resetowania hasła',
        });
      }
    }),

  // Check password strength (client-side helper)
  checkPasswordStrength: publicProcedure
    .input(z.object({ password: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = ctx.container.get(PasswordResetService);
      const strength = service.calculatePasswordStrength(input.password);

      // Check breach status
      const isBreached = await service.checkPasswordBreach(input.password);

      return {
        ...strength,
        isBreached,
      };
    }),
});
```

### Email Templates

```typescript
// src/infrastructure/email/templates/password-reset.template.ts
export const passwordResetEmailTemplate = {
  subject: 'Resetowanie hasła - KsięgowaCRM',

  html: (data: { resetUrl: string; expiresInHours: number; ipAddress: string }) => `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">🔑 Resetowanie hasła</h1>
      </div>

      <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta KsięgowaCRM.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}"
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Zresetuj hasło
          </a>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            ⏰ Link wygaśnie za <strong>${data.expiresInHours} godzinę</strong><br>
            🌐 Prośba wysłana z IP: ${data.ipAddress}
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">

        <p style="color: #666; font-size: 14px;">
          <strong>Nie prosiłeś o reset hasła?</strong><br>
          Jeśli nie wysyłałeś tej prośby, zignoruj tę wiadomość. Twoje hasło pozostanie bez zmian.
          Jeśli masz obawy dotyczące bezpieczeństwa konta, skontaktuj się z nami.
        </p>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          © ${new Date().getFullYear()} KsięgowaCRM. Wszelkie prawa zastrzeżone.
        </p>
      </div>
    </body>
    </html>
  `,

  text: (data: { resetUrl: string; expiresInHours: number; ipAddress: string }) => `
Resetowanie hasła - KsięgowaCRM

Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta.

Kliknij poniższy link, aby zresetować hasło:
${data.resetUrl}

Link wygaśnie za ${data.expiresInHours} godzinę.
Prośba wysłana z IP: ${data.ipAddress}

Nie prosiłeś o reset hasła?
Jeśli nie wysyłałeś tej prośby, zignoruj tę wiadomość.

© ${new Date().getFullYear()} KsięgowaCRM
  `,
};

export const passwordChangedEmailTemplate = {
  subject: 'Hasło zostało zmienione - KsięgowaCRM',

  html: (data: { changedAt: Date; ipAddress: string; userAgent: string }) => `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: #155724; margin: 0 0 10px 0;">
          ✅ Hasło zostało zmienione
        </h2>
        <p style="margin: 0; color: #155724;">
          Twoje hasło do konta KsięgowaCRM zostało pomyślnie zmienione.
        </p>
      </div>

      <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
        <h3 style="margin-top: 0;">Szczegóły zmiany:</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0;"><strong>Data i czas:</strong></td>
            <td>${data.changedAt.toLocaleString('pl-PL')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Adres IP:</strong></td>
            <td>${data.ipAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Urządzenie:</strong></td>
            <td>${data.userAgent}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 20px; padding: 20px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px;">
        <p style="margin: 0; color: #856404;">
          <strong>⚠️ To nie Ty?</strong><br>
          Jeśli nie zmieniałeś hasła, natychmiast:
        </p>
        <ol style="color: #856404; margin: 10px 0; padding-left: 20px;">
          <li>Spróbuj zalogować się używając poprzedniego hasła</li>
          <li>Jeśli nie możesz się zalogować, użyj opcji "Zapomniałem hasła"</li>
          <li>Skontaktuj się z nami: <a href="mailto:security@ksiegowacrm.pl">security@ksiegowacrm.pl</a></li>
        </ol>
      </div>
    </body>
    </html>
  `,
};
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/aim/services/__tests__/password-reset.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetService } from '../password-reset.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { HashService } from '../hash.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;
  let hashService: jest.Mocked<HashService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'old-hash',
    emailVerifiedAt: new Date(),
  };

  const mockMetadata = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            passwordResetToken: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            passwordHistory: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: RedisService,
          useValue: {
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: HashService,
          useValue: {
            hash: jest.fn().mockResolvedValue('new-hash'),
            verify: jest.fn(),
          },
        },
        // ... other mocked providers
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    hashService = module.get(HashService);
  });

  describe('requestPasswordReset', () => {
    it('should send reset email for existing verified user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.requestPasswordReset(
        'test@example.com',
        mockMetadata,
      );

      expect(result.success).toBe(true);
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });

    it('should return success for non-existent user (prevent enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset(
        'nonexistent@example.com',
        mockMetadata,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Jeśli konto istnieje');
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should throw on rate limit exceeded', async () => {
      redis.incr.mockResolvedValue(4); // Over limit

      await expect(
        service.requestPasswordReset('test@example.com', mockMetadata),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should invalidate existing tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await service.requestPasswordReset('test@example.com', mockMetadata);

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: mockUser.id }),
        data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
      });
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      });

      const result = await service.validateToken('valid-token');

      expect(result.isValid).toBe(true);
      expect(result.email).toContain('***'); // Masked
    });

    it('should reject expired token', async () => {
      prisma.passwordResetToken.findFirst
        .mockResolvedValueOnce(null) // First query (active)
        .mockResolvedValueOnce({
          expiresAt: new Date(Date.now() - 3600000),
        }); // Second query (any)

      const result = await service.validateToken('expired-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('TOKEN_EXPIRED');
    });

    it('should reject used token', async () => {
      prisma.passwordResetToken.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          usedAt: new Date(),
        });

      const result = await service.validateToken('used-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('TOKEN_ALREADY_USED');
    });
  });

  describe('resetPassword', () => {
    const validToken = {
      id: 'token-123',
      userId: mockUser.id,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 3600000),
      user: mockUser,
    };

    it('should reset password successfully', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(validToken);
      prisma.passwordHistory.findMany.mockResolvedValue([]);
      hashService.verify.mockResolvedValue(false); // Not same as current

      await service.resetPassword('valid-token', 'NewPassword123!', mockMetadata);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should reject same password as current', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(validToken);
      hashService.verify.mockResolvedValue(true); // Same as current

      await expect(
        service.resetPassword('valid-token', 'SamePassword', mockMetadata),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject password from history', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(validToken);
      hashService.verify
        .mockResolvedValueOnce(false) // Not same as current
        .mockResolvedValueOnce(true); // Match in history

      prisma.passwordHistory.findMany.mockResolvedValue([
        { passwordHash: 'old-hash-1' },
      ]);

      await expect(
        service.resetPassword('valid-token', 'OldPassword123!', mockMetadata),
      ).rejects.toThrow('To hasło było już używane');
    });
  });

  describe('calculatePasswordStrength', () => {
    it.each([
      ['abc', 0, 'bardzo_slabe'],
      ['abcdefgh', 1, 'slabe'],
      ['Abcdefgh', 2, 'srednie'],
      ['Abcdefgh1', 3, 'dobre'],
      ['Abcdefgh1!', 4, 'silne'],
      ['Abcdefgh1!@#$', 5, 'bardzo_silne'],
    ])('should rate "%s" as score %i (%s)', (password, expectedScore, expectedStrength) => {
      const result = service.calculatePasswordStrength(password);
      expect(result.score).toBe(expectedScore);
      expect(result.strength).toBe(expectedStrength);
    });

    it('should detect common patterns', () => {
      const result = service.calculatePasswordStrength('Password123!');
      expect(result.feedback).toContain('Unikaj popularnych wzorców');
    });
  });
});
```

### E2E Tests

```typescript
// e2e/password-reset.spec.ts
import { test, expect } from '@playwright/test';
import { createTestUser, getResetToken } from './helpers';

test.describe('Password Reset Flow', () => {
  let testUser: { email: string; password: string };

  test.beforeAll(async () => {
    testUser = await createTestUser({ emailVerified: true });
  });

  test('should request password reset', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    await page.fill('[name="email"]', testUser.email);
    await page.click('button[type="submit"]');

    await expect(page.getByText('Jeśli konto istnieje')).toBeVisible();
  });

  test('should reset password with valid token', async ({ page }) => {
    // Request reset
    await page.goto('/auth/forgot-password');
    await page.fill('[name="email"]', testUser.email);
    await page.click('button[type="submit"]');

    // Get token from database/email (test helper)
    const token = await getResetToken(testUser.email);

    // Use reset link
    await page.goto(`/auth/reset-password?token=${token}`);

    // Fill new password
    await page.fill('[name="newPassword"]', 'NewSecurePass123!');
    await page.fill('[name="confirmPassword"]', 'NewSecurePass123!');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Hasło zostało zmienione')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should show password strength indicator', async ({ page }) => {
    const token = await getResetToken(testUser.email);
    await page.goto(`/auth/reset-password?token=${token}`);

    // Weak password
    await page.fill('[name="newPassword"]', 'weak');
    await expect(page.getByText('Bardzo słabe')).toBeVisible();

    // Strong password
    await page.fill('[name="newPassword"]', 'StrongPass123!@#');
    await expect(page.getByText('Bardzo silne')).toBeVisible();
  });

  test('should reject expired token', async ({ page }) => {
    const expiredToken = 'expired_token_from_test_setup';
    await page.goto(`/auth/reset-password?token=${expiredToken}`);

    await expect(page.getByText('Link do resetowania hasła wygasł')).toBeVisible();
    await expect(page.getByText('Wyślij nowy link')).toBeVisible();
  });

  test('should prevent password reuse', async ({ page }) => {
    const token = await getResetToken(testUser.email);
    await page.goto(`/auth/reset-password?token=${token}`);

    // Try to use current password
    await page.fill('[name="newPassword"]', testUser.password);
    await page.fill('[name="confirmPassword"]', testUser.password);
    await page.click('button[type="submit"]');

    await expect(page.getByText('Nowe hasło musi być inne')).toBeVisible();
  });
});
```

---

## Security Checklist

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Token entropy | 256-bit random (32 bytes hex) | ✅ |
| Token storage | SHA-256 hash stored, not plaintext | ✅ |
| Token expiration | 1 hour validity | ✅ |
| Single use | Token invalidated after use | ✅ |
| Rate limiting | 3/hour per email, 10/hour per IP | ✅ |
| User enumeration prevention | Same response for valid/invalid emails | ✅ |
| Timing attack prevention | Consistent response times | ✅ |
| Password history | Last 5 passwords checked | ✅ |
| Breach detection | HaveIBeenPwned API integration | ✅ |
| Session invalidation | All sessions revoked on reset | ✅ |
| Email confirmation | Confirmation email sent | ✅ |
| Audit logging | All actions logged | ✅ |
| HTTPS only | Reset links use HTTPS | ✅ |

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| PASSWORD_RESET_REQUESTED | Reset request made | IP, user agent |
| PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL | Request for non-existent email | Email, IP |
| PASSWORD_RESET_COMPLETED | Password successfully changed | Token ID, IP |
| PASSWORD_RESET_INVALID_TOKEN | Invalid/expired token used | Token hash prefix |
| PASSWORD_RESET_TOKEN_EXPIRED | Expired token access attempt | Token ID |
| PASSWORD_RESET_RATE_LIMITED | Rate limit exceeded | Email/IP, count |
| PASSWORD_HISTORY_VIOLATION | Reused password attempt | User ID |

---

## Implementation Notes

### Token Security
- Use `crypto.randomBytes(32)` for 256-bit entropy
- Store only SHA-256 hash of token in database
- Never log or expose the actual token

### Response Consistency
- Always return same message regardless of email existence
- Ensure consistent response times (minimum 200ms)
- Log unknown email attempts for security monitoring

### Password Breach Checking
- Use k-Anonymity model (send only first 5 chars of hash)
- Don't block users with breached passwords, just warn
- Cache results to reduce API calls

### Email Masking
```typescript
// j***@example.com
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
};
```

---

*Last updated: December 2024*
