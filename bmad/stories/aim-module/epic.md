# 🔐 AIM Module Epic: Authentication & Identity Management

> **Epic ID**: `AIM-EPIC-001`  
> **Module**: Authentication & Identity Management  
> **Priority**: P0 (Critical Path)  
> **Status**: 🟡 In Progress  

---

## 📋 Epic Overview

### Business Value
The AIM module is the foundational security layer that enables all other modules to function. Without robust authentication and authorization, the entire platform cannot be deployed or used safely.

### Success Criteria
- [ ] Users can register and login securely
- [ ] MFA provides additional security layer
- [ ] Session management prevents unauthorized access
- [ ] Role-based permissions control access to features
- [ ] All auth events are audit logged
- [ ] System passes security review

### Dependencies
- PostgreSQL database (Supabase)
- Redis cache for sessions
- Email service for notifications
- Environment configuration

### Consumers
- All other modules (CRM, Accounting, HR, etc.)
- API Gateway
- Admin Dashboard
- Client Portal

---

## 📊 Story Map

```
                        AIM Module Stories
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   Registration          Authentication         Session
        │                     │                     │
   ┌────┴────┐           ┌────┴────┐          ┌────┴────┐
   │         │           │         │          │         │
AIM-001  AIM-002     AIM-003  AIM-004     AIM-005  AIM-006
 Email   Profile      Login   Password    Session  Logout
  Reg    Setup        Flow    Reset       Mgmt
        
        │                     │                     │
   Authorization            MFA               Audit
        │                     │                     │
   ┌────┴────┐           ┌────┴────┐          ┌────┴────┐
   │         │           │         │          │         │
AIM-007  AIM-008     AIM-009  AIM-010     AIM-011  AIM-012
 RBAC    Permis-      TOTP   Backup       Audit   Security
 Setup   sions        Setup   Codes       Logs    Events
```

---

## 📝 User Stories

### Story AIM-001: User Registration

```yaml
id: AIM-001
title: "User Registration with Email Verification"
type: feature
priority: P0
points: 8
status: ready

# User Story
as_a: "New user"
i_want: "To register an account with my email"
so_that: "I can access the accounting platform"

# Acceptance Criteria
acceptance_criteria:
  - given: "I am on the registration page"
    when: "I enter valid email, password, and company details"
    then: "My account is created in pending state"
    and: "I receive a verification email"
    
  - given: "I have received a verification email"
    when: "I click the verification link within 24 hours"
    then: "My account is activated"
    and: "I am redirected to complete my profile"
    
  - given: "I try to register with an existing email"
    when: "I submit the registration form"
    then: "I see a generic message (security)"
    and: "An email is sent to existing user about attempt"
    
  - given: "I enter a weak password"
    when: "I submit the form"
    then: "I see password strength requirements"
    and: "The form is not submitted"

# Technical Details
technical_context:
  database_tables:
    - users
    - user_profiles
    - email_verifications
    
  api_endpoints:
    - "POST /api/v1/auth/register"
    - "POST /api/v1/auth/verify-email"
    
  validations:
    email: "RFC 5322 compliant, max 255 chars"
    password: "Min 12 chars, complexity requirements"
    company_name: "2-100 chars, sanitized"
    nip: "Valid Polish NIP (optional at registration)"
    
  security:
    - "Rate limit: 3 registrations per IP per hour"
    - "Email verification token: 32 bytes, expires 24h"
    - "Password stored as Argon2id hash"
    
  audit_events:
    - REGISTRATION_STARTED
    - REGISTRATION_COMPLETED
    - EMAIL_VERIFICATION_SENT
    - EMAIL_VERIFIED

# Implementation Notes
implementation_notes: |
  1. Use Supabase Auth for base registration
  2. Extend with custom profile table
  3. Implement custom email templates (Polish)
  4. Check password against HaveIBeenPwned API
  5. Create default "firm_owner" role for new registrations

# Test Scenarios
test_scenarios:
  unit:
    - "Password validation rejects weak passwords"
    - "Email validation accepts valid formats"
    - "NIP validation with checksum"
  integration:
    - "Full registration flow creates user"
    - "Duplicate email handled gracefully"
    - "Verification token expires correctly"
  e2e:
    - "User can register and verify email"
```

---

### Story AIM-002: Profile Setup

```yaml
id: AIM-002
title: "Complete User Profile Setup"
type: feature
priority: P0
points: 5
status: ready
depends_on: [AIM-001]

as_a: "Newly registered user"
i_want: "To complete my profile with business details"
so_that: "The system knows my context and preferences"

acceptance_criteria:
  - given: "I have verified my email"
    when: "I access the platform for the first time"
    then: "I am prompted to complete my profile"
    
  - given: "I enter my company NIP"
    when: "The NIP is valid"
    then: "Company data is auto-filled from GUS"
    
  - given: "I complete all required fields"
    when: "I submit the profile form"
    then: "My profile is saved"
    and: "I am redirected to the dashboard"
    and: "A default workspace is created"

technical_context:
  database_tables:
    - user_profiles
    - companies
    - workspaces
    
  api_endpoints:
    - "PUT /api/v1/users/profile"
    - "GET /api/v1/companies/lookup?nip={nip}"
    
  integrations:
    - "GUS REGON API for company lookup"
    
  fields:
    required:
      - first_name
      - last_name
      - phone_number
      - company_name
    optional:
      - nip
      - regon
      - company_address

implementation_notes: |
  1. GUS API call should be cached (24h)
  2. Allow manual entry if GUS unavailable
  3. Create workspace with default settings
  4. Send welcome email after profile complete
```

---

### Story AIM-003: User Login

```yaml
id: AIM-003
title: "Secure User Login"
type: feature
priority: P0
points: 8
status: ready
depends_on: [AIM-001]

as_a: "Registered user"
i_want: "To login to my account securely"
so_that: "I can access my data and features"

acceptance_criteria:
  - given: "I am on the login page"
    when: "I enter valid credentials"
    then: "I am authenticated"
    and: "I receive access and refresh tokens"
    and: "I am redirected to dashboard"
    
  - given: "I enter invalid credentials"
    when: "I submit the login form"
    then: "I see a generic error message"
    and: "Failed attempt is logged"
    and: "Counter is incremented"
    
  - given: "I have failed 5 login attempts"
    when: "I try to login again"
    then: "I am temporarily blocked (15 min)"
    and: "I am notified via email"
    
  - given: "I have MFA enabled"
    when: "I enter valid credentials"
    then: "I am prompted for MFA code"
    and: "Session is not created until MFA verified"
    
  - given: "My account is locked"
    when: "I try to login"
    then: "I see account locked message"
    and: "I am directed to support"

technical_context:
  api_endpoints:
    - "POST /api/v1/auth/login"
    - "POST /api/v1/auth/mfa/verify"
    
  response_structure:
    success:
      access_token: "JWT, 15min expiry"
      refresh_token: "opaque, 7d expiry"
      user: "basic user info"
    mfa_required:
      challenge_id: "UUID"
      methods: ["totp", "backup_code"]
      
  security:
    rate_limiting:
      window: 900  # 15 minutes
      max_attempts: 5
      key: "email"
    session_binding:
      - ip_address
      - user_agent
    lockout:
      threshold: 10
      duration: 3600  # 1 hour
      
  audit_events:
    - LOGIN_SUCCESS
    - LOGIN_FAILED
    - LOGIN_BLOCKED
    - ACCOUNT_LOCKED

implementation_notes: |
  1. Never reveal if email exists (timing attack prevention)
  2. Use constant-time comparison for passwords
  3. Log all attempts with IP and user agent
  4. Implement device fingerprinting for anomaly detection
  5. Send notification for login from new device/location
```

---

### Story AIM-004: Password Reset

```yaml
id: AIM-004
title: "Secure Password Reset Flow"
type: feature
priority: P0
points: 5
status: ready

as_a: "User who forgot password"
i_want: "To reset my password securely"
so_that: "I can regain access to my account"

acceptance_criteria:
  - given: "I am on the password reset page"
    when: "I enter my email address"
    then: "I see a confirmation message (always)"
    and: "If email exists, reset link is sent"
    
  - given: "I have received a reset link"
    when: "I click the link within 1 hour"
    then: "I can enter a new password"
    
  - given: "I enter a valid new password"
    when: "I submit the reset form"
    then: "My password is updated"
    and: "All my sessions are invalidated"
    and: "I receive confirmation email"
    and: "I am redirected to login"
    
  - given: "I try to reuse a reset link"
    when: "I access the link after using it"
    then: "I see link expired message"

technical_context:
  api_endpoints:
    - "POST /api/v1/auth/password/forgot"
    - "POST /api/v1/auth/password/reset"
    
  token_spec:
    length: 32  # bytes
    expiry: 3600  # 1 hour
    single_use: true
    
  security:
    rate_limit:
      window: 3600
      max_requests: 3
      key: "email"
    password_history: 12  # Can't reuse last 12

  audit_events:
    - PASSWORD_RESET_REQUESTED
    - PASSWORD_RESET_COMPLETED
    - PASSWORD_RESET_FAILED

implementation_notes: |
  1. Use cryptographically secure random tokens
  2. Hash token before storing in DB
  3. Invalidate all refresh tokens on password change
  4. Notify user of password change via email
  5. Check new password against history
```

---

### Story AIM-005: Session Management

```yaml
id: AIM-005
title: "Session Management and Token Refresh"
type: feature
priority: P0
points: 8
status: ready
depends_on: [AIM-003]

as_a: "Authenticated user"
i_want: "My session to be managed securely"
so_that: "I stay logged in safely and can see my active sessions"

acceptance_criteria:
  - given: "I am logged in"
    when: "My access token is about to expire"
    then: "The system automatically refreshes it"
    
  - given: "I am logged in on multiple devices"
    when: "I view my sessions"
    then: "I see all active sessions with device info"
    
  - given: "I want to log out another device"
    when: "I revoke a specific session"
    then: "That session is immediately invalidated"
    
  - given: "I suspect unauthorized access"
    when: "I click 'Log out all devices'"
    then: "All sessions except current are invalidated"
    
  - given: "I am inactive for 1 hour"
    when: "I try to perform an action"
    then: "I am prompted to re-authenticate"

technical_context:
  api_endpoints:
    - "POST /api/v1/auth/refresh"
    - "GET /api/v1/auth/sessions"
    - "DELETE /api/v1/auth/sessions/:id"
    - "DELETE /api/v1/auth/sessions"
    
  token_management:
    access_token:
      type: JWT
      expiry: 900  # 15 minutes
      storage: memory
    refresh_token:
      type: opaque
      expiry: 604800  # 7 days
      rotation: true
      storage: httpOnly cookie
      
  session_storage:
    location: Redis
    key_pattern: "session:{userId}:{sessionId}"
    data:
      - user_id
      - device_id
      - ip_address
      - user_agent
      - created_at
      - last_activity
      - expires_at

implementation_notes: |
  1. Implement refresh token rotation
  2. Store sessions in Redis with TTL
  3. Use device fingerprinting for session identification
  4. Implement activity-based session extension
  5. Notify user when new session created
```

---

### Story AIM-009: TOTP MFA Setup

```yaml
id: AIM-009
title: "Time-Based One-Time Password (TOTP) MFA Setup"
type: feature
priority: P1
points: 8
status: ready
depends_on: [AIM-003]

as_a: "Security-conscious user"
i_want: "To enable TOTP-based MFA"
so_that: "My account has an additional security layer"

acceptance_criteria:
  - given: "I am in security settings"
    when: "I choose to enable MFA"
    then: "I see a QR code for authenticator app"
    and: "I see a manual entry key"
    
  - given: "I have scanned the QR code"
    when: "I enter a valid TOTP code"
    then: "MFA is enabled for my account"
    and: "I receive backup codes"
    
  - given: "MFA is enabled"
    when: "I login with correct password"
    then: "I am prompted for TOTP code"
    
  - given: "I enter incorrect TOTP code 5 times"
    when: "I try again"
    then: "MFA verification is temporarily blocked"

technical_context:
  api_endpoints:
    - "POST /api/v1/auth/mfa/setup"
    - "POST /api/v1/auth/mfa/verify-setup"
    - "POST /api/v1/auth/mfa/verify"
    - "DELETE /api/v1/auth/mfa"
    
  totp_spec:
    algorithm: SHA1
    digits: 6
    period: 30
    window: 1  # Accept +/- 1 period
    issuer: "KsięgowaCRM"
    
  backup_codes:
    count: 10
    length: 8
    format: "XXXX-XXXX"
    single_use: true
    
  storage:
    secret: "Encrypted in DB"
    backup_codes: "Hashed with Argon2id"

implementation_notes: |
  1. Use speakeasy or otplib for TOTP
  2. Encrypt TOTP secret before storage
  3. Generate QR code server-side
  4. Require password confirmation to disable MFA
  5. Show recovery options when MFA fails
```

---

### Story AIM-011: Audit Logging

```yaml
id: AIM-011
title: "Comprehensive Security Audit Logging"
type: feature
priority: P0
points: 8
status: ready

as_a: "System administrator"
i_want: "All security events to be logged immutably"
so_that: "I can audit access and investigate incidents"

acceptance_criteria:
  - given: "Any authentication event occurs"
    when: "The event completes"
    then: "An audit log entry is created"
    and: "The entry cannot be modified or deleted"
    
  - given: "I am an admin"
    when: "I view the audit logs"
    then: "I can filter by user, event type, date range"
    and: "I can export logs for compliance"
    
  - given: "A suspicious event pattern occurs"
    when: "The system detects anomaly"
    then: "An alert is generated"

technical_context:
  logged_events:
    - LOGIN_SUCCESS
    - LOGIN_FAILED
    - LOGOUT
    - PASSWORD_CHANGED
    - PASSWORD_RESET_REQUESTED
    - PASSWORD_RESET_COMPLETED
    - MFA_ENABLED
    - MFA_DISABLED
    - MFA_VERIFIED
    - MFA_FAILED
    - SESSION_CREATED
    - SESSION_REVOKED
    - ACCOUNT_LOCKED
    - ACCOUNT_UNLOCKED
    - PERMISSION_CHANGED
    - ROLE_ASSIGNED
    - ROLE_REMOVED
    
  log_entry_structure:
    id: UUID
    timestamp: ISO8601
    event_type: string
    actor:
      user_id: UUID | null
      session_id: UUID | null
      ip_address: string
      user_agent: string
    target:
      type: string
      id: string
    result: success | failure
    metadata: JSON
    correlation_id: UUID
    
  retention:
    period: "10 years (Polish law)"
    archival: "After 2 years, move to cold storage"
    
  immutability:
    database: "No UPDATE/DELETE allowed"
    application: "Append-only pattern"

implementation_notes: |
  1. Use database triggers to enforce immutability
  2. Implement log shipping to external system
  3. Create materialized views for common queries
  4. Set up alerting for critical events
  5. Implement log rotation for performance
```

---

## 🗓️ Implementation Phases

### Phase 1: Core Authentication (Week 1-2)
- [ ] AIM-001: User Registration
- [ ] AIM-003: User Login  
- [ ] AIM-004: Password Reset
- [ ] AIM-005: Session Management

### Phase 2: Profile & Authorization (Week 3)
- [ ] AIM-002: Profile Setup
- [ ] AIM-007: RBAC Setup
- [ ] AIM-008: Permission Management

### Phase 3: MFA & Security (Week 4)
- [ ] AIM-009: TOTP MFA Setup
- [ ] AIM-010: Backup Codes
- [ ] AIM-011: Audit Logging
- [ ] AIM-012: Security Events & Alerts

---

## 📎 Related Documents

- [Constitution](../constitution.md) - Security requirements
- [Security Architect Agent](../agents/security-architect.md) - Security expertise
- [Polish Accounting Expert](../agents/polish-accounting-expert.md) - Compliance requirements
- [Technical Specification](../../../../docs/aim-module-spec.md) - Full technical spec

---

*Epic last updated: December 2024*
