# 🔒 Security Review Checklist

> **Checklist ID**: `security-review`  
> **Version**: 1.0.0  
> **Required For**: All features touching authentication, data, or external APIs  

---

## 📋 Usage Instructions

1. Copy this checklist to your story file or PR
2. Review each item applicable to your feature
3. Mark as ✅ (pass), ⚠️ (warning/noted), or ❌ (fail)
4. All ❌ items must be resolved before merge
5. ⚠️ items require documented justification

---

## 🔐 Authentication

### Password Security
- [ ] Passwords hashed with Argon2id
- [ ] Salt is unique per user (automatic with Argon2)
- [ ] Memory cost: 64MB minimum
- [ ] Time cost: 3 iterations minimum
- [ ] Passwords checked against breach database
- [ ] Password history prevents reuse (last 12)

### Token Security
- [ ] JWTs signed with RS256
- [ ] Access token expiry ≤ 15 minutes
- [ ] Refresh token expiry ≤ 7 days
- [ ] Refresh tokens are rotated on use
- [ ] Tokens can be revoked immediately
- [ ] No sensitive data in JWT payload

### Session Security
- [ ] Sessions stored server-side (Redis)
- [ ] Session bound to IP address
- [ ] Session bound to user agent
- [ ] Maximum concurrent sessions enforced (≤5)
- [ ] Idle timeout implemented (1 hour)
- [ ] Session regeneration after privilege change

### MFA (if applicable)
- [ ] TOTP uses SHA1 with 6 digits, 30s period
- [ ] Rate limiting on MFA attempts (5/5min)
- [ ] Backup codes are single-use
- [ ] Backup codes stored as Argon2 hash
- [ ] MFA bypass requires password confirmation

---

## 🛡️ Authorization

### Access Control
- [ ] Authentication required for protected routes
- [ ] Permission check before data access
- [ ] Role hierarchy properly enforced
- [ ] No privilege escalation possible
- [ ] Admin functions require admin role

### Row-Level Security
- [ ] RLS enabled on all user data tables
- [ ] RLS policies are restrictive (default deny)
- [ ] No RLS bypass without service role
- [ ] Cross-tenant data access prevented
- [ ] RLS tested with different user contexts

### API Security
- [ ] All endpoints check authentication
- [ ] All endpoints check authorization
- [ ] GraphQL/tRPC resolvers have auth guards
- [ ] Batch operations respect permissions
- [ ] Export functions filter by access level

---

## 📥 Input Validation

### Schema Validation
- [ ] Zod schema defined for all inputs
- [ ] Schema validates types correctly
- [ ] Schema enforces length limits
- [ ] Schema validates formats (email, NIP, etc.)
- [ ] Schema rejects unexpected fields

### Sanitization
- [ ] HTML content sanitized (if allowed)
- [ ] SQL injection prevented (parameterized queries)
- [ ] Path traversal prevented
- [ ] Command injection prevented
- [ ] SSRF prevented for URL inputs

### File Uploads (if applicable)
- [ ] File type validated by content, not extension
- [ ] Maximum file size enforced
- [ ] Files stored outside web root
- [ ] File names sanitized
- [ ] Virus scanning enabled (if available)

---

## 📤 Output Security

### Data Exposure
- [ ] Sensitive fields excluded from responses
- [ ] Password hashes never returned
- [ ] API keys never returned in full
- [ ] Personal data filtered by permission
- [ ] Error messages don't leak internal details

### Response Headers
- [ ] Content-Type set correctly
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY (or appropriate)
- [ ] Referrer-Policy configured
- [ ] Content-Security-Policy defined

---

## 🔄 Rate Limiting

### Endpoint Protection
- [ ] Authentication endpoints rate limited
- [ ] Password reset rate limited (3/hour/email)
- [ ] Registration rate limited (3/hour/IP)
- [ ] API endpoints rate limited
- [ ] Rate limit key is appropriate (IP, user, etc.)

### Brute Force Protection
- [ ] Account lockout after failed attempts (10)
- [ ] Lockout duration appropriate (1 hour)
- [ ] Lockout notification sent to user
- [ ] CAPTCHA triggered after threshold
- [ ] Timing attacks mitigated

---

## 📊 Audit Logging

### Event Coverage
- [ ] All authentication events logged
- [ ] All authorization failures logged
- [ ] All data modifications logged
- [ ] All admin actions logged
- [ ] Sensitive data access logged

### Log Quality
- [ ] Log entries have timestamp
- [ ] Log entries have actor ID
- [ ] Log entries have IP address
- [ ] Log entries have correlation ID
- [ ] Before/after values captured for changes

### Log Security
- [ ] Logs don't contain passwords
- [ ] Logs don't contain tokens
- [ ] Logs don't contain PII unnecessarily
- [ ] Logs are immutable (no UPDATE/DELETE)
- [ ] Log retention policy compliant

---

## 🔒 Data Protection

### Encryption
- [ ] Data at rest encrypted (AES-256)
- [ ] Data in transit encrypted (TLS 1.3)
- [ ] Sensitive fields encrypted in DB
- [ ] Encryption keys properly managed
- [ ] Key rotation plan exists

### Personal Data (RODO/GDPR)
- [ ] Data minimization practiced
- [ ] Purpose limitation documented
- [ ] Consent recorded where required
- [ ] Data deletion possible
- [ ] Data export possible
- [ ] Retention policy enforced

### Secrets Management
- [ ] No secrets in code
- [ ] No secrets in logs
- [ ] Secrets in environment variables
- [ ] Secrets in secure vault (production)
- [ ] Secrets rotatable without downtime

---

## 🌐 External Integrations

### API Calls
- [ ] HTTPS required
- [ ] Certificate validation enabled
- [ ] Timeouts configured
- [ ] Retry with backoff implemented
- [ ] Circuit breaker implemented

### Third-Party Data
- [ ] Input from external APIs validated
- [ ] Untrusted data sanitized
- [ ] Webhook signatures verified
- [ ] OAuth state parameter validated
- [ ] CORS properly configured

---

## 🧪 Security Testing

### Automated Tests
- [ ] Authentication flows tested
- [ ] Authorization checked in tests
- [ ] Invalid inputs tested
- [ ] Rate limiting tested
- [ ] Error handling tested

### Manual Review
- [ ] Code reviewed for security issues
- [ ] No obvious vulnerabilities
- [ ] Dependencies checked for CVEs
- [ ] OWASP Top 10 considered
- [ ] Business logic flaws checked

---

## 📝 Documentation

### Security Documentation
- [ ] Authentication method documented
- [ ] Authorization model documented
- [ ] Data handling documented
- [ ] Incident response plan exists
- [ ] Security contact documented

---

## 🏷️ Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | | ⬜ |
| Security Reviewer | | | ⬜ |
| Approver | | | ⬜ |

---

## 📎 Notes

```markdown
<!-- Add any security notes, exceptions, or justifications here -->


```

---

## 🔗 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Constitution Security Requirements](../constitution.md#security-requirements)

---

*Checklist version 1.0.0 - December 2024*
