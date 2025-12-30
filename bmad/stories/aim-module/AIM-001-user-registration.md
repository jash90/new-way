# 📋 Story: AIM-001 - User Registration with Email Verification

> **Story ID**: `AIM-001`  
> **Epic**: AIM-EPIC-001  
> **Status**: 🟢 Ready for Development  
> **Points**: 8  
> **Priority**: P0  

---

## 📖 User Story

**As a** new user  
**I want** to register an account with my email  
**So that** I can access the accounting platform  

---

## ✅ Acceptance Criteria

### AC1: Successful Registration
```gherkin
Given I am on the registration page
When I enter a valid email address
And I enter a password meeting complexity requirements
And I enter my company name
And I submit the registration form
Then my account is created in "pending_verification" state
And I receive a verification email within 60 seconds
And I see a confirmation message with instructions
```

### AC2: Email Verification
```gherkin
Given I have received a verification email
When I click the verification link within 24 hours
Then my account status changes to "active"
And I am redirected to the profile completion page
And I can now login to the platform
```

### AC3: Duplicate Email Handling
```gherkin
Given an account already exists with email "test@example.com"
When I try to register with the same email
Then I see a generic message "If this email is not registered, you will receive a verification email"
And no new account is created
And the existing user receives an email about the registration attempt
```

### AC4: Password Validation
```gherkin
Given I am filling the registration form
When I enter a password that does not meet requirements
Then I see real-time validation feedback
And the submit button is disabled
And I see specific requirements not met
```

### AC5: Expired Verification Link
```gherkin
Given I have received a verification email
When I click the link after 24 hours
Then I see "Verification link expired" message
And I can request a new verification email
```

### AC6: Rate Limiting
```gherkin
Given I have submitted 3 registration attempts in the last hour
When I try to submit another registration from the same IP
Then I see "Too many requests. Please try again later."
And no registration is processed
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  status user_status NOT NULL DEFAULT 'pending_verification',
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User status enum
CREATE TYPE user_status AS ENUM (
  'pending_verification',
  'active',
  'suspended',
  'deleted'
);

-- Email verification tokens
CREATE TABLE public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_active_token UNIQUE (user_id, used_at)
);

-- Indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_email_verifications_user ON public.email_verifications(user_id);
CREATE INDEX idx_email_verifications_expires ON public.email_verifications(expires_at);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage users"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role');
```

### API Endpoints

#### POST /api/v1/auth/register

```typescript
// Request
interface RegisterRequest {
  email: string;        // RFC 5322 compliant
  password: string;     // Min 12 chars, complexity requirements
  companyName: string;  // 2-100 chars
  nip?: string;         // Optional, validated if provided
  acceptTerms: boolean; // Must be true
  acceptPrivacy: boolean; // Must be true
}

// Response - Success (201)
interface RegisterResponse {
  success: true;
  message: "If this email is not registered, you will receive a verification email.";
  // Note: Same message for both new and existing emails (security)
}

// Response - Error (400)
interface RegisterErrorResponse {
  success: false;
  error: {
    code: "VALIDATION_ERROR" | "RATE_LIMITED";
    message: string;
    details?: Record<string, string[]>;
  };
}
```

#### POST /api/v1/auth/verify-email

```typescript
// Request
interface VerifyEmailRequest {
  token: string;  // From email link
}

// Response - Success (200)
interface VerifyEmailResponse {
  success: true;
  message: "Email verified successfully";
  redirectUrl: "/onboarding/profile";
}

// Response - Error (400)
interface VerifyEmailErrorResponse {
  success: false;
  error: {
    code: "INVALID_TOKEN" | "EXPIRED_TOKEN" | "ALREADY_VERIFIED";
    message: string;
  };
}
```

#### POST /api/v1/auth/resend-verification

```typescript
// Request
interface ResendVerificationRequest {
  email: string;
}

// Response - Always 200 (security)
interface ResendVerificationResponse {
  success: true;
  message: "If this email is registered and unverified, a new verification email has been sent.";
}
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Password validation schema
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'Password must contain at least one special character')
  .refine(
    (password) => !/(.)\1{2,}/.test(password),
    'Password cannot contain 3 or more repeated characters'
  );

// Email validation schema  
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .toLowerCase()
  .trim();

// NIP validation schema
export const nipSchema = z
  .string()
  .optional()
  .refine(
    (nip) => {
      if (!nip) return true;
      return validateNIPChecksum(nip);
    },
    'Invalid NIP number'
  );

// Full registration schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().min(2).max(100).trim(),
  nip: nipSchema,
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms of service' })
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the privacy policy' })
  })
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

### Implementation Code

```typescript
// src/modules/aim/services/registration.service.ts

import { TRPCError } from '@trpc/server';
import { hash } from 'argon2';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redis } from '@/lib/redis';
import { emailService } from '@/lib/email';
import { auditLogger } from '@/lib/audit';
import { RegisterInput } from '../schemas/register.schema';

const RATE_LIMIT_WINDOW = 3600; // 1 hour
const RATE_LIMIT_MAX = 3;
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60; // 24 hours

export class RegistrationService {
  
  async register(input: RegisterInput, clientIp: string): Promise<void> {
    // 1. Check rate limit
    await this.checkRateLimit(clientIp);
    
    // 2. Check if email already exists
    const existingUser = await this.findUserByEmail(input.email);
    
    if (existingUser) {
      // Send notification to existing user but return same response
      await this.notifyExistingUser(existingUser, clientIp);
      await auditLogger.log({
        eventType: 'REGISTRATION_DUPLICATE_ATTEMPT',
        metadata: { email: input.email, ip: clientIp }
      });
      return; // Return silently - same response as success
    }
    
    // 3. Check password against breach database
    const isBreached = await this.checkPasswordBreach(input.password);
    if (isBreached) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This password has been found in a data breach. Please choose a different password.'
      });
    }
    
    // 4. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: false,
      user_metadata: {
        company_name: input.companyName,
        nip: input.nip
      }
    });
    
    if (authError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create account'
      });
    }
    
    // 5. Create user record in public schema
    await supabaseAdmin.from('users').insert({
      id: authUser.user.id,
      email: input.email,
      status: 'pending_verification'
    });
    
    // 6. Generate and store verification token
    const token = randomBytes(32).toString('hex');
    const tokenHash = await hash(token);
    
    await supabaseAdmin.from('email_verifications').insert({
      user_id: authUser.user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY * 1000)
    });
    
    // 7. Send verification email
    await emailService.sendVerificationEmail({
      to: input.email,
      token: token,
      companyName: input.companyName
    });
    
    // 8. Log audit event
    await auditLogger.log({
      eventType: 'REGISTRATION_STARTED',
      actorId: authUser.user.id,
      metadata: {
        email: input.email,
        ip: clientIp,
        companyName: input.companyName
      }
    });
  }
  
  async verifyEmail(token: string): Promise<{ redirectUrl: string }> {
    // 1. Find verification record
    const tokenHash = await hash(token);
    
    const { data: verification, error } = await supabaseAdmin
      .from('email_verifications')
      .select('*, users(*)')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !verification) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid or expired verification link'
      });
    }
    
    // 2. Mark token as used
    await supabaseAdmin
      .from('email_verifications')
      .update({ used_at: new Date().toISOString() })
      .eq('id', verification.id);
    
    // 3. Update user status
    await supabaseAdmin
      .from('users')
      .update({
        status: 'active',
        email_verified_at: new Date().toISOString()
      })
      .eq('id', verification.user_id);
    
    // 4. Confirm email in Supabase Auth
    await supabaseAdmin.auth.admin.updateUserById(verification.user_id, {
      email_confirm: true
    });
    
    // 5. Log audit event
    await auditLogger.log({
      eventType: 'EMAIL_VERIFIED',
      actorId: verification.user_id,
      metadata: { email: verification.users.email }
    });
    
    return { redirectUrl: '/onboarding/profile' };
  }
  
  private async checkRateLimit(ip: string): Promise<void> {
    const key = `ratelimit:register:${ip}`;
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }
    
    if (count > RATE_LIMIT_MAX) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many registration attempts. Please try again later.'
      });
    }
  }
  
  private async findUserByEmail(email: string) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    return data;
  }
  
  private async notifyExistingUser(user: any, attemptIp: string): Promise<void> {
    await emailService.sendRegistrationAttemptNotification({
      to: user.email,
      attemptIp,
      timestamp: new Date()
    });
  }
  
  private async checkPasswordBreach(password: string): Promise<boolean> {
    // Check against HaveIBeenPwned API using k-anonymity
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await response.text();
    
    return text.includes(suffix);
  }
}

export const registrationService = new RegistrationService();
```

### tRPC Router

```typescript
// src/modules/aim/routers/auth.router.ts

import { router, publicProcedure } from '@/lib/trpc';
import { registerSchema, verifyEmailSchema, resendVerificationSchema } from '../schemas';
import { registrationService } from '../services/registration.service';

export const authRouter = router({
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      await registrationService.register(input, ctx.clientIp);
      return {
        success: true,
        message: "If this email is not registered, you will receive a verification email."
      };
    }),
    
  verifyEmail: publicProcedure
    .input(verifyEmailSchema)
    .mutation(async ({ input }) => {
      const result = await registrationService.verifyEmail(input.token);
      return {
        success: true,
        message: "Email verified successfully",
        redirectUrl: result.redirectUrl
      };
    }),
    
  resendVerification: publicProcedure
    .input(resendVerificationSchema)
    .mutation(async ({ input, ctx }) => {
      await registrationService.resendVerification(input.email, ctx.clientIp);
      return {
        success: true,
        message: "If this email is registered and unverified, a new verification email has been sent."
      };
    })
});
```

### Email Templates

```typescript
// src/lib/email/templates/verification.tsx

import { Html, Head, Body, Container, Text, Button, Link } from '@react-email/components';

interface VerificationEmailProps {
  companyName: string;
  verificationUrl: string;
}

export function VerificationEmail({ companyName, verificationUrl }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif' }}>
        <Container>
          <Text style={{ fontSize: '24px', fontWeight: 'bold' }}>
            Witaj w KsięgowaCRM!
          </Text>
          
          <Text>
            Dziękujemy za rejestrację firmy <strong>{companyName}</strong>.
          </Text>
          
          <Text>
            Kliknij poniższy przycisk, aby zweryfikować swój adres email:
          </Text>
          
          <Button
            href={verificationUrl}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '6px',
              textDecoration: 'none'
            }}
          >
            Zweryfikuj email
          </Button>
          
          <Text style={{ fontSize: '14px', color: '#666' }}>
            Link wygasa za 24 godziny.
          </Text>
          
          <Text style={{ fontSize: '12px', color: '#999' }}>
            Jeśli to nie Ty rejestrowałeś konto, zignoruj tę wiadomość.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
// src/modules/aim/__tests__/registration.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registrationService } from '../services/registration.service';

describe('RegistrationService', () => {
  describe('register', () => {
    it('should create user with valid input', async () => {
      const input = {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        companyName: 'Test Company',
        acceptTerms: true,
        acceptPrivacy: true
      };
      
      await expect(registrationService.register(input, '127.0.0.1'))
        .resolves.not.toThrow();
    });
    
    it('should reject weak passwords', async () => {
      const input = {
        email: 'test@example.com',
        password: 'weak',
        companyName: 'Test Company',
        acceptTerms: true,
        acceptPrivacy: true
      };
      
      await expect(registrationService.register(input, '127.0.0.1'))
        .rejects.toThrow('Password must be at least 12 characters');
    });
    
    it('should rate limit excessive attempts', async () => {
      const input = {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        companyName: 'Test Company',
        acceptTerms: true,
        acceptPrivacy: true
      };
      
      // Make 3 successful attempts
      for (let i = 0; i < 3; i++) {
        await registrationService.register(
          { ...input, email: `test${i}@example.com` },
          '127.0.0.1'
        );
      }
      
      // 4th attempt should be rate limited
      await expect(registrationService.register(input, '127.0.0.1'))
        .rejects.toThrow('Too many registration attempts');
    });
    
    it('should not reveal if email exists', async () => {
      // First registration
      await registrationService.register({
        email: 'existing@example.com',
        password: 'SecureP@ssw0rd123!',
        companyName: 'Test Company',
        acceptTerms: true,
        acceptPrivacy: true
      }, '127.0.0.1');
      
      // Second registration with same email should not throw
      await expect(registrationService.register({
        email: 'existing@example.com',
        password: 'SecureP@ssw0rd123!',
        companyName: 'Another Company',
        acceptTerms: true,
        acceptPrivacy: true
      }, '127.0.0.2')).resolves.not.toThrow();
    });
  });
  
  describe('verifyEmail', () => {
    it('should verify valid token', async () => {
      // Setup: create user and get token
      const token = 'valid-token';
      
      const result = await registrationService.verifyEmail(token);
      
      expect(result.redirectUrl).toBe('/onboarding/profile');
    });
    
    it('should reject expired token', async () => {
      const expiredToken = 'expired-token';
      
      await expect(registrationService.verifyEmail(expiredToken))
        .rejects.toThrow('Invalid or expired verification link');
    });
    
    it('should reject already used token', async () => {
      const usedToken = 'used-token';
      
      await expect(registrationService.verifyEmail(usedToken))
        .rejects.toThrow('Invalid or expired verification link');
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/aim/__tests__/registration.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient } from '@/test/utils';

describe('Registration Integration', () => {
  const client = createTestClient();
  
  it('should complete full registration flow', async () => {
    // 1. Register
    const registerResult = await client.auth.register({
      email: 'integration@test.com',
      password: 'SecureP@ssw0rd123!',
      companyName: 'Integration Test Co',
      acceptTerms: true,
      acceptPrivacy: true
    });
    
    expect(registerResult.success).toBe(true);
    
    // 2. Get verification token from DB (test only)
    const token = await getVerificationToken('integration@test.com');
    
    // 3. Verify email
    const verifyResult = await client.auth.verifyEmail({ token });
    
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.redirectUrl).toBe('/onboarding/profile');
    
    // 4. Verify user status changed
    const user = await getUser('integration@test.com');
    expect(user.status).toBe('active');
  });
});
```

### E2E Tests

```typescript
// e2e/registration.spec.ts

import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('should register new user and verify email', async ({ page }) => {
    // Go to registration page
    await page.goto('/auth/register');
    
    // Fill form
    await page.fill('[data-testid="email"]', 'e2e@test.com');
    await page.fill('[data-testid="password"]', 'SecureP@ssw0rd123!');
    await page.fill('[data-testid="company-name"]', 'E2E Test Company');
    await page.check('[data-testid="accept-terms"]');
    await page.check('[data-testid="accept-privacy"]');
    
    // Submit
    await page.click('[data-testid="submit-register"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('verification email');
    
    // Get verification link from email (using test email service)
    const verificationLink = await getEmailVerificationLink('e2e@test.com');
    
    // Click verification link
    await page.goto(verificationLink);
    
    // Verify redirect to profile
    await expect(page).toHaveURL('/onboarding/profile');
  });
  
  test('should show password requirements', async ({ page }) => {
    await page.goto('/auth/register');
    
    // Enter weak password
    await page.fill('[data-testid="password"]', 'weak');
    await page.blur('[data-testid="password"]');
    
    // Check requirements shown
    await expect(page.locator('[data-testid="password-requirements"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="req-length"]'))
      .toHaveClass(/invalid/);
  });
});
```

---

## 🔒 Security Checklist

- [x] Rate limiting implemented (3/hour per IP)
- [x] Password hashed with Argon2id
- [x] Verification token is cryptographically secure (32 bytes)
- [x] Token stored as hash, not plaintext
- [x] Generic error messages (no email enumeration)
- [x] Password checked against breach database
- [x] Input validation with Zod
- [x] Audit logging for all events
- [x] CSRF protection via SameSite cookies
- [x] RLS policies defined

---

## 📊 Audit Events

| Event | When | Data Logged |
|-------|------|-------------|
| REGISTRATION_STARTED | Account created | email, ip, company |
| REGISTRATION_DUPLICATE_ATTEMPT | Email exists | email, ip |
| EMAIL_VERIFICATION_SENT | Email sent | email, token_id |
| EMAIL_VERIFIED | Verification complete | email, user_id |
| EMAIL_VERIFICATION_FAILED | Invalid/expired token | token_prefix, ip |

---

## 📎 Related Stories

- **Next**: AIM-002 (Profile Setup) - depends on this
- **Related**: AIM-003 (Login) - uses same user table
- **Related**: AIM-004 (Password Reset) - similar email flow

---

## 📝 Implementation Notes

1. **Timing Attack Prevention**: Always return same response time for existing/new emails
2. **Token Security**: Use URL-safe base64 encoding for email links
3. **Email Templates**: Must be in Polish with professional formatting
4. **Error Messages**: Never reveal if email exists in system
5. **Supabase Integration**: Use admin client for user creation

---

## ✅ Definition of Done

- [ ] All acceptance criteria pass
- [ ] Unit tests: >90% coverage
- [ ] Integration tests pass
- [ ] E2E test passes
- [ ] Security checklist complete
- [ ] Audit logging verified
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Performance tested (<500ms response)

---

*Story created: December 2024*  
*Last updated: December 2024*
