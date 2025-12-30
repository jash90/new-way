# AIM-010: MFA Backup Codes Management

> **Story ID**: AIM-010
> **Epic**: [Authentication & Identity Management (AIM)](./epic.md)
> **Priority**: P1 (High)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Dependencies**: AIM-009 (TOTP MFA Setup)

---

## User Story

**As a** user with MFA enabled
**I want** to manage my backup codes for account recovery
**So that** I can regain access to my account if I lose my authenticator device

---

## Acceptance Criteria

### Scenario 1: Viewing Backup Codes Status
```gherkin
Given I am logged in and have MFA enabled
When I navigate to security settings
Then I should see the number of remaining backup codes
And I should see when backup codes were last generated
And I should see how many codes have been used
And I should have an option to view or regenerate codes
```

### Scenario 2: Viewing Remaining Backup Codes
```gherkin
Given I am on the security settings page
And I have backup codes remaining
When I click "View Backup Codes"
Then I should be prompted to enter my password
When I enter my correct password
Then I should see a masked list of backup codes
And I should see which codes have been used (marked as "Wykorzystany")
And I should see which codes are still available
And I should have an option to download codes as PDF
And I should have an option to print codes
```

### Scenario 3: Regenerating Backup Codes
```gherkin
Given I am viewing my backup codes
When I click "Regenerate Codes"
Then I should see a warning that existing codes will be invalidated
And I should be prompted for my password
And I should be prompted for a current TOTP code
When I confirm regeneration with valid credentials
Then 10 new backup codes should be generated
And all previous codes should be invalidated
And I should see the new codes displayed
And I should be prompted to save them securely
And the audit log should record "MFA_BACKUP_CODES_REGENERATED"
```

### Scenario 4: Using Backup Code for Login
```gherkin
Given I am on the MFA verification page during login
And I have lost access to my authenticator app
When I click "Use Backup Code Instead"
Then I should see an input field for backup code (format XXXX-XXXX)
When I enter a valid unused backup code
Then the code should be verified
And the code should be marked as used
And I should be fully authenticated
And the remaining codes count should decrease by 1
And the audit log should record "MFA_BACKUP_CODE_USED"
```

### Scenario 5: Backup Code Already Used
```gherkin
Given I am trying to use a backup code for login
When I enter a backup code that has already been used
Then I should see an error: "Ten kod został już wykorzystany"
And the attempt should be logged
And I should still be able to try another code
```

### Scenario 6: All Backup Codes Exhausted
```gherkin
Given I have MFA enabled
And all my backup codes have been used
When I view my security settings
Then I should see a warning: "Brak dostępnych kodów zapasowych"
And I should see a prominent button to regenerate codes
And if I try to use backup code for login, I should be directed to account recovery
```

### Scenario 7: Low Backup Codes Warning
```gherkin
Given I have MFA enabled
And I have 3 or fewer backup codes remaining
When I use a backup code for login
Then I should see a warning notification after login
And the warning should say: "Pozostało Ci tylko X kodów zapasowych. Rozważ wygenerowanie nowych."
And I should be offered a link to security settings
```

### Scenario 8: Downloading Backup Codes as PDF
```gherkin
Given I am viewing my backup codes
When I click "Download as PDF"
Then a PDF file should be generated
And the PDF should contain:
  - All 10 backup codes (unused marked clearly)
  - Account email for identification
  - Generation date
  - Warning about keeping codes secure
  - Instructions for use
And the PDF should be downloaded to my device
And the audit log should record "MFA_BACKUP_CODES_DOWNLOADED"
```

### Scenario 9: Printing Backup Codes
```gherkin
Given I am viewing my backup codes
When I click "Print"
Then a print-friendly version should be displayed
And the print layout should show:
  - All 10 backup codes in large, clear font
  - Account email
  - Generation date
  - Security instructions
And the browser print dialog should open
```

### Scenario 10: Account Recovery Without Backup Codes
```gherkin
Given I have MFA enabled
And I have lost my authenticator device
And I have no backup codes remaining
When I click "I don't have access to codes"
Then I should see account recovery options:
  - Contact support with identity verification
  - Wait for administrator approval
And I should see estimated recovery time
And I should be able to submit a recovery request
```

### Scenario 11: Security Notification on Backup Code Use
```gherkin
Given I have used a backup code for login
When the login succeeds
Then an email notification should be sent to my registered email
And the notification should include:
  - Alert about backup code usage
  - Time and location of login
  - Device information
  - Warning about authenticator access
  - Recommendation to check authenticator or regenerate codes
```

### Scenario 12: Rate Limiting Backup Code Attempts
```gherkin
Given I am on the MFA verification page
And I have chosen to use a backup code
When I enter 5 invalid backup codes
Then I should be temporarily blocked from further attempts
And I should see: "Zbyt wiele nieudanych prób. Spróbuj ponownie za 15 minut."
And the audit log should record "MFA_BACKUP_CODE_LOCKOUT"
```

---

## Technical Specification

### Database Schema

```sql
-- Backup codes table (existing from AIM-009, extended)
CREATE TABLE mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Code storage (hashed, not plaintext)
    code_hash VARCHAR(255) NOT NULL,

    -- Code identification for display (last 4 chars visible)
    code_suffix VARCHAR(4) NOT NULL,

    -- Status tracking
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP,
    used_ip VARCHAR(45),
    used_user_agent VARCHAR(500),
    used_for VARCHAR(50), -- 'login' | 'recovery' | 'mfa_disable'

    -- Generation batch tracking
    batch_id UUID NOT NULL, -- Groups codes generated together
    code_index INTEGER NOT NULL, -- 1-10 for ordering

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration

    -- Constraints
    CONSTRAINT fk_backup_code_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_batch_index UNIQUE (user_id, batch_id, code_index)
);

-- Backup codes audit table
CREATE TABLE mfa_backup_codes_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Action tracking
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'GENERATED',
        'VIEWED',
        'DOWNLOADED',
        'PRINTED',
        'USED_FOR_LOGIN',
        'USED_FOR_RECOVERY',
        'REGENERATED',
        'EXPIRED'
    )),

    -- Context
    batch_id UUID, -- For generation/regeneration
    code_id UUID REFERENCES mfa_backup_codes(id), -- For specific code actions
    codes_count INTEGER, -- For generation

    -- Request context
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    device_fingerprint VARCHAR(64),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_backup_codes_user_unused ON mfa_backup_codes(user_id, is_used) WHERE is_used = false;
CREATE INDEX idx_backup_codes_batch ON mfa_backup_codes(batch_id);
CREATE INDEX idx_backup_codes_audit_user ON mfa_backup_codes_audit(user_id);
CREATE INDEX idx_backup_codes_audit_action ON mfa_backup_codes_audit(action);

-- View for backup code statistics
CREATE VIEW v_backup_codes_stats AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE is_used = false) AS remaining_count,
    COUNT(*) FILTER (WHERE is_used = true) AS used_count,
    MAX(created_at) AS last_generated_at,
    MAX(used_at) AS last_used_at
FROM mfa_backup_codes
GROUP BY user_id;
```

### API Endpoints

```typescript
// tRPC Router for Backup Codes
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';

// Validation schemas
const viewBackupCodesSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
});

const regenerateCodesSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
  totpCode: z.string().length(6).regex(/^\d{6}$/, 'Kod musi składać się z 6 cyfr'),
  confirmRegeneration: z.boolean().refine((v) => v === true, {
    message: 'Musisz potwierdzić regenerację kodów',
  }),
});

const useBackupCodeSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i, 'Nieprawidłowy format kodu'),
});

// Response types
interface BackupCodeDisplay {
  id: string;
  codeSuffix: string; // Last 4 chars for identification
  isUsed: boolean;
  usedAt: Date | null;
}

interface BackupCodesListResponse {
  codes: BackupCodeDisplay[];
  remainingCount: number;
  usedCount: number;
  lastGeneratedAt: Date;
  lastUsedAt: Date | null;
}

interface BackupCodesFullResponse {
  codes: string[]; // Full codes shown only during generation
  downloadToken: string; // Token to download PDF within time window
  expiresAt: Date;
}

interface BackupCodesStatsResponse {
  remainingCount: number;
  usedCount: number;
  totalCount: number;
  lastGeneratedAt: Date | null;
  needsRegeneration: boolean;
}

// tRPC Router
export const backupCodesRouter = router({
  // Get backup codes statistics (no password required)
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.backupCodesService.getStats(ctx.user.id);
    }),

  // View backup codes (requires password)
  viewCodes: protectedProcedure
    .input(viewBackupCodesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.backupCodesService.viewCodes(
        ctx.user.id,
        input.password,
        {
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        }
      );
    }),

  // Regenerate backup codes
  regenerate: protectedProcedure
    .input(regenerateCodesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.backupCodesService.regenerateCodes(
        ctx.user.id,
        input.password,
        input.totpCode,
        {
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        }
      );
    }),

  // Use backup code for login (public - during MFA challenge)
  useForLogin: publicProcedure
    .input(useBackupCodeSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.backupCodesService.useForLogin(
        input.challengeId,
        input.code,
        {
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        }
      );
    }),

  // Generate PDF download token
  getDownloadToken: protectedProcedure
    .input(viewBackupCodesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.backupCodesService.generateDownloadToken(
        ctx.user.id,
        input.password,
        {
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        }
      );
    }),

  // Download PDF (uses token, no auth required)
  downloadPdf: publicProcedure
    .input(z.object({
      token: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.backupCodesService.generatePdf(input.token);
    }),
});
```

### Backup Codes Service Implementation

```typescript
// src/modules/aim/services/backup-codes.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '@/core/prisma/prisma.service';
import { CacheService } from '@/core/cache/cache.service';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from '@/core/notifications/notification.service';

export interface BackupCodesConfig {
  count: number;
  length: number;
  format: 'XXXX-XXXX';
  downloadTokenExpiry: number; // seconds
  viewTimeout: number; // seconds
  maxLoginAttempts: number;
  lockoutDuration: number; // seconds
}

const DEFAULT_CONFIG: BackupCodesConfig = {
  count: 10,
  length: 8,
  format: 'XXXX-XXXX',
  downloadTokenExpiry: 300, // 5 minutes
  viewTimeout: 60, // 1 minute display
  maxLoginAttempts: 5,
  lockoutDuration: 900, // 15 minutes
};

@Injectable()
export class BackupCodesService {
  private readonly logger = new Logger(BackupCodesService.name);
  private readonly config: BackupCodesConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationService,
  ) {
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Get backup codes statistics
   */
  async getStats(userId: string): Promise<BackupCodesStatsResponse> {
    const stats = await this.prisma.$queryRaw<Array<{
      remaining_count: number;
      used_count: number;
      last_generated_at: Date;
    }>>`
      SELECT
        COUNT(*) FILTER (WHERE is_used = false)::int AS remaining_count,
        COUNT(*) FILTER (WHERE is_used = true)::int AS used_count,
        MAX(created_at) AS last_generated_at
      FROM mfa_backup_codes
      WHERE user_id = ${userId}::uuid
    `;

    const data = stats[0] || { remaining_count: 0, used_count: 0, last_generated_at: null };

    return {
      remainingCount: data.remaining_count,
      usedCount: data.used_count,
      totalCount: this.config.count,
      lastGeneratedAt: data.last_generated_at,
      needsRegeneration: data.remaining_count <= 3,
    };
  }

  /**
   * View backup codes (requires password verification)
   */
  async viewCodes(
    userId: string,
    password: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<BackupCodesListResponse> {
    // Verify password
    await this.verifyPassword(userId, password);

    // Get all codes
    const codes = await this.prisma.mfaBackupCode.findMany({
      where: { userId },
      orderBy: { codeIndex: 'asc' },
      select: {
        id: true,
        codeSuffix: true,
        isUsed: true,
        usedAt: true,
        createdAt: true,
      },
    });

    // Log the view action
    await this.logAction(userId, 'VIEWED', context);

    // Get statistics
    const stats = await this.getStats(userId);

    return {
      codes: codes.map(code => ({
        id: code.id,
        codeSuffix: code.codeSuffix,
        isUsed: code.isUsed,
        usedAt: code.usedAt,
      })),
      remainingCount: stats.remainingCount,
      usedCount: stats.usedCount,
      lastGeneratedAt: stats.lastGeneratedAt!,
      lastUsedAt: codes.find(c => c.usedAt)?.usedAt || null,
    };
  }

  /**
   * Generate new backup codes
   */
  async generateCodes(userId: string): Promise<string[]> {
    const batchId = crypto.randomUUID();
    const codes: string[] = [];
    const codeRecords: Array<{
      userId: string;
      codeHash: string;
      codeSuffix: string;
      batchId: string;
      codeIndex: number;
    }> = [];

    for (let i = 0; i < this.config.count; i++) {
      // Generate random 8-character code
      const rawCode = crypto
        .randomBytes(this.config.length / 2)
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
        codeSuffix: rawCode.slice(-4),
        batchId,
        codeIndex: i + 1,
      });
    }

    // Store hashed codes
    await this.prisma.mfaBackupCode.createMany({
      data: codeRecords,
    });

    return codes;
  }

  /**
   * Regenerate backup codes (invalidates existing ones)
   */
  async regenerateCodes(
    userId: string,
    password: string,
    totpCode: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<BackupCodesFullResponse> {
    // Verify password
    await this.verifyPassword(userId, password);

    // Verify TOTP code
    const mfaConfig = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!mfaConfig?.isEnabled) {
      throw new BadRequestException('MFA nie jest włączone.');
    }

    const isTotpValid = await this.verifyTotp(userId, totpCode);
    if (!isTotpValid) {
      throw new UnauthorizedException('Nieprawidłowy kod weryfikacyjny.');
    }

    // Delete all existing backup codes
    await this.prisma.mfaBackupCode.deleteMany({
      where: { userId },
    });

    // Generate new codes
    const codes = await this.generateCodes(userId);

    // Update MFA configuration
    await this.prisma.mfaConfiguration.update({
      where: { userId },
      data: {
        backupCodesRemaining: codes.length,
        backupCodesLastGeneratedAt: new Date(),
      },
    });

    // Log the action
    await this.logAction(userId, 'REGENERATED', context, { codesCount: codes.length });

    // Audit log
    await this.auditLog.log({
      eventType: 'MFA_BACKUP_CODES_REGENERATED',
      userId,
      metadata: { count: codes.length },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Generate download token
    const downloadToken = crypto.randomUUID();
    await this.cache.set(
      `backup_codes:download:${downloadToken}`,
      { userId, codes },
      this.config.downloadTokenExpiry
    );

    return {
      codes,
      downloadToken,
      expiresAt: new Date(Date.now() + this.config.downloadTokenExpiry * 1000),
    };
  }

  /**
   * Use backup code for login
   */
  async useForLogin(
    challengeId: string,
    code: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<AuthWithMfaResponse> {
    // Get challenge
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
      include: { user: true },
    });

    if (!challenge || challenge.status !== 'PENDING') {
      throw new NotFoundException('Sesja weryfikacji nie została znaleziona.');
    }

    if (challenge.expiresAt < new Date()) {
      throw new BadRequestException('Sesja weryfikacji wygasła.');
    }

    // Check lockout
    const lockoutKey = `backup_code:lockout:${challenge.userId}`;
    const isLocked = await this.cache.get(lockoutKey);
    if (isLocked) {
      throw new TooManyRequestsException(
        'Zbyt wiele nieudanych prób. Spróbuj ponownie za 15 minut.'
      );
    }

    // Normalize code (remove hyphen)
    const normalizedCode = code.replace('-', '').toUpperCase();

    // Find matching unused backup code
    const backupCodes = await this.prisma.mfaBackupCode.findMany({
      where: { userId: challenge.userId, isUsed: false },
    });

    let matchedCode: typeof backupCodes[0] | null = null;

    for (const backupCode of backupCodes) {
      const isMatch = await argon2.verify(backupCode.codeHash, normalizedCode);
      if (isMatch) {
        matchedCode = backupCode;
        break;
      }
    }

    if (!matchedCode) {
      // Increment attempts
      const attemptsKey = `backup_code:attempts:${challenge.userId}`;
      const attempts = await this.cache.incr(attemptsKey);

      if (attempts === 1) {
        await this.cache.expire(attemptsKey, this.config.lockoutDuration);
      }

      if (attempts >= this.config.maxLoginAttempts) {
        await this.cache.set(lockoutKey, 'locked', this.config.lockoutDuration);
        await this.auditLog.log({
          eventType: 'MFA_BACKUP_CODE_LOCKOUT',
          userId: challenge.userId,
          metadata: { attempts },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });
        throw new TooManyRequestsException(
          'Zbyt wiele nieudanych prób. Spróbuj ponownie za 15 minut.'
        );
      }

      throw new UnauthorizedException('Nieprawidłowy kod zapasowy.');
    }

    // Mark code as used
    await this.prisma.mfaBackupCode.update({
      where: { id: matchedCode.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedIp: context.ipAddress,
        usedUserAgent: context.userAgent,
        usedFor: 'login',
      },
    });

    // Update remaining count
    await this.prisma.mfaConfiguration.update({
      where: { userId: challenge.userId },
      data: {
        backupCodesRemaining: { decrement: 1 },
        lastVerifiedAt: new Date(),
      },
    });

    // Mark challenge as verified
    await this.prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // Log the action
    await this.logAction(challenge.userId, 'USED_FOR_LOGIN', context, {
      codeId: matchedCode.id,
    });

    // Audit log
    await this.auditLog.log({
      eventType: 'MFA_BACKUP_CODE_USED',
      userId: challenge.userId,
      metadata: { challengeId, codeId: matchedCode.id },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Send notification email
    const user = challenge.user;
    if (user.email) {
      await this.notifications.sendEmail({
        to: user.email,
        template: 'backup-code-used',
        data: {
          firstName: user.firstName,
          usedAt: new Date().toISOString(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          remainingCodes: backupCodes.length - 1,
        },
      });
    }

    // Check if low on codes
    const remainingCodes = backupCodes.length - 1;
    const lowCodesWarning = remainingCodes <= 3;

    // Create session and return auth response
    return this.createAuthenticatedSession(challenge.userId, context, {
      lowCodesWarning,
      remainingCodes,
    });
  }

  /**
   * Generate PDF download token
   */
  async generateDownloadToken(
    userId: string,
    password: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<{ token: string; expiresAt: Date }> {
    // Verify password
    await this.verifyPassword(userId, password);

    // Get current codes (for PDF generation)
    // Note: We don't show full codes here - they were only visible during generation
    // PDF will show masked codes with suffix

    const codes = await this.prisma.mfaBackupCode.findMany({
      where: { userId, isUsed: false },
      orderBy: { codeIndex: 'asc' },
    });

    const token = crypto.randomUUID();
    await this.cache.set(
      `backup_codes:pdf:${token}`,
      { userId, codesData: codes.map(c => ({ suffix: c.codeSuffix, index: c.codeIndex })) },
      this.config.downloadTokenExpiry
    );

    // Log download initiation
    await this.logAction(userId, 'DOWNLOADED', context);

    await this.auditLog.log({
      eventType: 'MFA_BACKUP_CODES_DOWNLOADED',
      userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      token,
      expiresAt: new Date(Date.now() + this.config.downloadTokenExpiry * 1000),
    };
  }

  /**
   * Generate PDF with backup codes
   */
  async generatePdf(token: string): Promise<Buffer> {
    const cached = await this.cache.get<{
      userId: string;
      codes?: string[];
      codesData?: Array<{ suffix: string; index: number }>;
    }>(`backup_codes:download:${token}`) ||
    await this.cache.get(`backup_codes:pdf:${token}`);

    if (!cached) {
      throw new BadRequestException('Token wygasł lub jest nieprawidłowy.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: cached.userId },
      select: { email: true, firstName: true },
    });

    if (!user) {
      throw new NotFoundException('Użytkownik nie został znaleziony.');
    }

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on('data', chunks.push.bind(chunks));

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('KsięgowaCRM', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text('Kody zapasowe MFA', { align: 'center' });
    doc.moveDown(2);

    // Account info
    doc.fontSize(12).font('Helvetica').text(`Konto: ${user.email}`);
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL', {
      dateStyle: 'full',
    })}`);
    doc.moveDown(2);

    // Codes grid
    doc.fontSize(14).font('Helvetica-Bold').text('Twoje kody zapasowe:');
    doc.moveDown();

    if (cached.codes) {
      // Full codes (from regeneration)
      doc.fontSize(16).font('Courier');
      cached.codes.forEach((code, i) => {
        doc.text(`${i + 1}. ${code}`, { indent: 20 });
      });
    } else if (cached.codesData) {
      // Masked codes
      doc.fontSize(16).font('Courier');
      cached.codesData.forEach((code) => {
        doc.text(`${code.index}. ****-${code.suffix}`, { indent: 20 });
      });
    }

    doc.moveDown(2);

    // Warning box
    doc.rect(50, doc.y, 495, 80).stroke();
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('red')
      .text('⚠️ WAŻNE:', 60, doc.y);
    doc.font('Helvetica').fillColor('black').text([
      '• Przechowuj te kody w bezpiecznym miejscu',
      '• Każdy kod może być użyty tylko raz',
      '• Nie udostępniaj tych kodów nikomu',
      '• Wygeneruj nowe kody jeśli podejrzewasz wyciek',
    ].join('\n'), 60, doc.y + 5, { width: 480 });

    doc.moveDown(4);

    // Instructions
    doc.fontSize(11).font('Helvetica-Bold').text('Jak używać kodów zapasowych:');
    doc.font('Helvetica').text([
      '1. Na stronie logowania wprowadź email i hasło',
      '2. Gdy pojawi się prośba o kod MFA, wybierz "Użyj kodu zapasowego"',
      '3. Wprowadź jeden z powyższych kodów',
      '4. Kod zostanie zużyty i nie będzie można go użyć ponownie',
    ].join('\n'), { indent: 20 });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  // ============ Private Helper Methods ============

  private async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('Użytkownik nie został znaleziony.');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      throw new UnauthorizedException('Nieprawidłowe hasło.');
    }
  }

  private async verifyTotp(userId: string, code: string): Promise<boolean> {
    // Delegate to MFA service
    // This would use the same verification logic as MfaService
    return true; // Placeholder
  }

  private async logAction(
    userId: string,
    action: string,
    context: { ipAddress: string; userAgent?: string },
    extra?: Record<string, any>
  ): Promise<void> {
    await this.prisma.mfaBackupCodesAudit.create({
      data: {
        userId,
        action,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        ...(extra?.codesCount && { codesCount: extra.codesCount }),
        ...(extra?.codeId && { codeId: extra.codeId }),
        ...(extra?.batchId && { batchId: extra.batchId }),
      },
    });
  }

  private async createAuthenticatedSession(
    userId: string,
    context: { ipAddress: string; userAgent?: string },
    warnings?: { lowCodesWarning: boolean; remainingCodes: number }
  ): Promise<AuthWithMfaResponse> {
    // Delegate to AuthService
    throw new Error('Delegate to AuthService.createSession()');
  }
}
```

### React Hook for Backup Codes

```typescript
// src/hooks/useBackupCodes.ts
import { trpc } from '@/lib/trpc';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseBackupCodesOptions {
  onRegenerateComplete?: (codes: string[]) => void;
  onDownloadComplete?: () => void;
}

export function useBackupCodes(options: UseBackupCodesOptions = {}) {
  const [visibleCodes, setVisibleCodes] = useState<Array<{
    id: string;
    codeSuffix: string;
    isUsed: boolean;
    usedAt: Date | null;
  }> | null>(null);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);

  const utils = trpc.useContext();

  // Get stats (no password needed)
  const { data: stats, isLoading: isLoadingStats } = trpc.backupCodes.getStats.useQuery();

  // View codes mutation
  const viewCodesMutation = trpc.backupCodes.viewCodes.useMutation({
    onSuccess: (data) => {
      setVisibleCodes(data.codes);
      toast.info('Kody zapasowe wyświetlone');
    },
    onError: (error) => {
      toast.error(error.message || 'Nie udało się wyświetlić kodów');
    },
  });

  // Regenerate mutation
  const regenerateMutation = trpc.backupCodes.regenerate.useMutation({
    onSuccess: (data) => {
      setNewCodes(data.codes);
      setDownloadToken(data.downloadToken);
      utils.backupCodes.getStats.invalidate();
      toast.success('Nowe kody zapasowe wygenerowane');
      options.onRegenerateComplete?.(data.codes);
    },
    onError: (error) => {
      toast.error(error.message || 'Nie udało się wygenerować kodów');
    },
  });

  // Get download token
  const getDownloadTokenMutation = trpc.backupCodes.getDownloadToken.useMutation({
    onSuccess: (data) => {
      setDownloadToken(data.token);
    },
    onError: (error) => {
      toast.error(error.message || 'Nie udało się przygotować pobierania');
    },
  });

  const viewCodes = useCallback((password: string) => {
    viewCodesMutation.mutate({ password });
  }, [viewCodesMutation]);

  const regenerate = useCallback((
    password: string,
    totpCode: string,
    confirmRegeneration = true
  ) => {
    regenerateMutation.mutate({ password, totpCode, confirmRegeneration });
  }, [regenerateMutation]);

  const prepareDownload = useCallback((password: string) => {
    getDownloadTokenMutation.mutate({ password });
  }, [getDownloadTokenMutation]);

  const downloadPdf = useCallback(async () => {
    if (!downloadToken) {
      toast.error('Brak tokenu do pobrania');
      return;
    }

    try {
      const response = await fetch(`/api/backup-codes/download?token=${downloadToken}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kody-zapasowe-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      options.onDownloadComplete?.();
    } catch (error) {
      toast.error('Nie udało się pobrać PDF');
    }
  }, [downloadToken, options]);

  const clearVisibleCodes = useCallback(() => {
    setVisibleCodes(null);
    setNewCodes([]);
    setDownloadToken(null);
  }, []);

  const printCodes = useCallback(() => {
    if (!visibleCodes && !newCodes.length) {
      toast.error('Brak kodów do wydruku');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const codesToPrint = newCodes.length > 0 ? newCodes : visibleCodes?.map(c => `****-${c.codeSuffix}`);

    printWindow.document.write(`
      <html>
        <head>
          <title>Kody zapasowe - KsięgowaCRM</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { text-align: center; }
            .codes { font-family: monospace; font-size: 18px; }
            .warning { border: 2px solid red; padding: 15px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <h1>KsięgowaCRM - Kody zapasowe MFA</h1>
          <p>Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}</p>
          <div class="codes">
            ${codesToPrint?.map((c, i) => `<p>${i + 1}. ${c}</p>`).join('')}
          </div>
          <div class="warning">
            <strong>WAŻNE:</strong>
            <ul>
              <li>Przechowuj te kody w bezpiecznym miejscu</li>
              <li>Każdy kod może być użyty tylko raz</li>
              <li>Nie udostępniaj tych kodów nikomu</li>
            </ul>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [visibleCodes, newCodes]);

  return {
    // Stats
    stats,
    isLoadingStats,
    remainingCount: stats?.remainingCount ?? 0,
    needsRegeneration: stats?.needsRegeneration ?? false,

    // Visible codes
    visibleCodes,
    newCodes,
    downloadToken,

    // Actions
    viewCodes,
    regenerate,
    prepareDownload,
    downloadPdf,
    printCodes,
    clearVisibleCodes,

    // Loading states
    isViewingCodes: viewCodesMutation.isPending,
    isRegenerating: regenerateMutation.isPending,
    isPreparingDownload: getDownloadTokenMutation.isPending,
  };
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/aim/services/__tests__/backup-codes.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BackupCodesService } from '../backup-codes.service';
import * as argon2 from 'argon2';

describe('BackupCodesService', () => {
  let service: BackupCodesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    // Setup test module
  });

  describe('generateCodes', () => {
    it('should generate 10 unique codes', async () => {
      const codes = await service.generateCodes('user-123');

      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10); // All unique
      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      });
    });

    it('should store hashed codes in database', async () => {
      await service.generateCodes('user-123');

      expect(prisma.mfaBackupCode.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: 'user-123',
            codeHash: expect.any(String),
            codeSuffix: expect.stringMatching(/^[A-Z0-9]{4}$/),
          }),
        ]),
      });
    });
  });

  describe('useForLogin', () => {
    it('should accept valid backup code', async () => {
      const code = 'ABCD-1234';
      const codeHash = await argon2.hash('ABCD1234');

      prisma.mfaChallenge.findUnique.mockResolvedValue({
        id: 'challenge-123',
        userId: 'user-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 300000),
        user: { email: 'test@example.com', firstName: 'Test' },
      } as any);

      prisma.mfaBackupCode.findMany.mockResolvedValue([
        { id: 'code-1', codeHash, isUsed: false },
      ] as any);

      // Test would verify the code is accepted and marked as used
    });

    it('should reject already used backup code', async () => {
      // Test implementation
    });

    it('should block after max attempts', async () => {
      // Test implementation
    });
  });

  describe('regenerateCodes', () => {
    it('should delete old codes and generate new ones', async () => {
      await service.regenerateCodes('user-123', 'password', '123456', {
        ipAddress: '127.0.0.1',
      });

      expect(prisma.mfaBackupCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(prisma.mfaBackupCode.createMany).toHaveBeenCalled();
    });

    it('should require valid password and TOTP', async () => {
      // Test implementation
    });
  });
});
```

### E2E Tests

```typescript
// e2e/backup-codes.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Backup Codes Management', () => {
  test('should view remaining backup codes', async ({ page }) => {
    // Login with MFA-enabled user
    await page.goto('/settings/security');

    // Click view codes
    await page.getByRole('button', { name: /wyświetl kody/i }).click();

    // Enter password
    await page.getByLabel('Hasło').fill('Test123!@#');
    await page.getByRole('button', { name: /potwierdź/i }).click();

    // Verify codes are displayed
    await expect(page.getByText(/kody zapasowe/i)).toBeVisible();
    await expect(page.locator('.backup-code')).toHaveCount(10);
  });

  test('should regenerate backup codes', async ({ page }) => {
    await page.goto('/settings/security');

    await page.getByRole('button', { name: /regeneruj kody/i }).click();

    // Confirm warning
    await expect(page.getByText(/istniejące kody zostaną unieważnione/i)).toBeVisible();

    // Enter credentials
    await page.getByLabel('Hasło').fill('Test123!@#');
    await page.getByLabel('Kod TOTP').fill('123456');
    await page.getByRole('checkbox', { name: /potwierdzam/i }).check();
    await page.getByRole('button', { name: /regeneruj/i }).click();

    // Verify new codes shown
    await expect(page.getByText(/nowe kody wygenerowane/i)).toBeVisible();
  });

  test('should use backup code for login', async ({ page }) => {
    await page.goto('/login');

    // Login with password
    await page.getByLabel('Email').fill('mfa-user@example.com');
    await page.getByLabel('Hasło').fill('Test123!@#');
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Choose backup code
    await page.getByRole('button', { name: /użyj kodu zapasowego/i }).click();

    // Enter backup code
    await page.getByPlaceholder('XXXX-XXXX').fill('ABCD-1234');
    await page.getByRole('button', { name: /weryfikuj/i }).click();

    // Verify login successful
    await expect(page).toHaveURL('/dashboard');
  });
});
```

---

## Security Checklist

| Category | Requirement | Implementation |
|----------|-------------|----------------|
| Storage | Codes are hashed, never plaintext | Argon2id hashing |
| Storage | Only suffix visible for identification | Last 4 characters stored separately |
| Display | Full codes shown only once at generation | Not retrievable after generation |
| Rate Limiting | Login attempts are limited | 5 attempts, 15 min lockout |
| Authentication | Viewing requires password | Password verified each time |
| Authentication | Regeneration requires TOTP + password | Double verification |
| Audit | All actions are logged | Complete audit trail |
| Notifications | Email on backup code use | Security alert sent |
| PDF | Secure download token | 5-minute expiry, single use |
| One-time | Each code can be used only once | Marked as used in DB |

---

## Audit Events

| Event Type | Trigger | Logged Data |
|------------|---------|-------------|
| `MFA_BACKUP_CODES_GENERATED` | Initial generation with MFA setup | userId, count, batchId |
| `MFA_BACKUP_CODES_REGENERATED` | User regenerates codes | userId, count, batchId |
| `MFA_BACKUP_CODES_VIEWED` | User views their codes | userId, timestamp |
| `MFA_BACKUP_CODES_DOWNLOADED` | PDF download initiated | userId, format |
| `MFA_BACKUP_CODE_USED` | Code used for login | userId, codeId, remainingCount |
| `MFA_BACKUP_CODE_LOCKOUT` | Too many failed attempts | userId, attemptCount |

---

## Implementation Notes

1. **Code Generation**: Use cryptographically secure random bytes. Format as XXXX-XXXX for readability.

2. **Hashing**: Use Argon2id for code hashing. Store last 4 characters separately for identification purposes.

3. **Single View**: Full codes are only shown during generation. After that, only masked versions are available.

4. **PDF Generation**: Use PDFKit or similar library. Include security warnings and usage instructions.

5. **Lockout Strategy**: Implement exponential backoff for repeated failed attempts.

6. **Low Codes Warning**: Alert users when they have 3 or fewer codes remaining.

7. **Recovery Path**: Provide clear instructions for users who have exhausted all codes and lost authenticator access.

8. **Batch Tracking**: Group codes by generation batch for easier management and audit.

---

## Related Documentation

- [AIM Epic](./epic.md)
- [AIM-009 TOTP MFA Setup](./AIM-009-totp-mfa-setup.md)
- [Constitution - Security Requirements](../../constitution.md)

---

*Last updated: December 2024*
