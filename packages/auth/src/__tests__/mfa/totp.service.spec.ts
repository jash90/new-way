import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TotpService, TotpSetupResult } from '../../mfa/totp.service';

describe('TotpService', () => {
  let totpService: TotpService;

  beforeEach(() => {
    totpService = new TotpService({
      issuer: 'KsięgowaCRM',
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });
  });

  describe('generateSecret', () => {
    it('should generate a secret with QR code data', async () => {
      const email = 'test@example.com';
      const result = await totpService.generateSecret(email);

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThanOrEqual(32);
      expect(result.qrCodeDataUrl).toBeDefined();
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.otpauthUrl).toBeDefined();
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain(encodeURIComponent(email));
    });

    it('should generate unique secrets for same email', async () => {
      const email = 'test@example.com';
      const result1 = await totpService.generateSecret(email);
      const result2 = await totpService.generateSecret(email);

      expect(result1.secret).not.toBe(result2.secret);
    });

    it('should include issuer in otpauth URL', async () => {
      const email = 'test@example.com';
      const result = await totpService.generateSecret(email);

      expect(result.otpauthUrl).toContain('issuer=Ksi%C4%99gowaCRM');
    });
  });

  describe('verifyToken', () => {
    it('should verify correct TOTP token', async () => {
      const email = 'test@example.com';
      const { secret } = await totpService.generateSecret(email);

      // Generate current valid token
      const validToken = totpService.generateToken(secret);
      const isValid = totpService.verifyToken(secret, validToken);

      expect(isValid).toBe(true);
    });

    it('should reject invalid TOTP token', async () => {
      const email = 'test@example.com';
      const { secret } = await totpService.generateSecret(email);

      const isValid = totpService.verifyToken(secret, '000000');

      expect(isValid).toBe(false);
    });

    it('should reject token with wrong length', async () => {
      const email = 'test@example.com';
      const { secret } = await totpService.generateSecret(email);

      const isValid = totpService.verifyToken(secret, '12345'); // 5 digits instead of 6

      expect(isValid).toBe(false);
    });

    it('should reject non-numeric token', async () => {
      const email = 'test@example.com';
      const { secret } = await totpService.generateSecret(email);

      const isValid = totpService.verifyToken(secret, 'abcdef');

      expect(isValid).toBe(false);
    });

    it('should allow token within time window', async () => {
      vi.useFakeTimers();
      const email = 'test@example.com';
      const { secret } = await totpService.generateSecret(email);

      // Generate token
      const token = totpService.generateToken(secret);

      // Advance time by 29 seconds (still within 30s window)
      vi.advanceTimersByTime(29 * 1000);

      const isValid = totpService.verifyToken(secret, token, { window: 1 });

      expect(isValid).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes by default', () => {
      const codes = totpService.generateBackupCodes();

      expect(codes.length).toBe(10);
    });

    it('should generate specified number of backup codes', () => {
      const codes = totpService.generateBackupCodes(5);

      expect(codes.length).toBe(5);
    });

    it('should generate 8-character codes', () => {
      const codes = totpService.generateBackupCodes();

      codes.forEach((code) => {
        expect(code.length).toBe(8);
      });
    });

    it('should generate unique codes', () => {
      const codes = totpService.generateBackupCodes(10);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(10);
    });

    it('should generate alphanumeric codes', () => {
      const codes = totpService.generateBackupCodes();

      codes.forEach((code) => {
        expect(code).toMatch(/^[A-Z0-9]{8}$/);
      });
    });
  });

  describe('hashBackupCode', () => {
    it('should hash backup code using Argon2id', async () => {
      const code = 'ABCD1234';
      const hash = await totpService.hashBackupCode(code);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(code);
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should generate different hashes for same code (salted)', async () => {
      const code = 'ABCD1234';
      const hash1 = await totpService.hashBackupCode(code);
      const hash2 = await totpService.hashBackupCode(code);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify correct backup code', async () => {
      const code = 'ABCD1234';
      const hash = await totpService.hashBackupCode(code);

      const isValid = await totpService.verifyBackupCode(hash, code);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect backup code', async () => {
      const code = 'ABCD1234';
      const hash = await totpService.hashBackupCode(code);

      const isValid = await totpService.verifyBackupCode(hash, 'WRONG123');

      expect(isValid).toBe(false);
    });

    it('should be case-insensitive', async () => {
      const code = 'ABCD1234';
      const hash = await totpService.hashBackupCode(code);

      const isValid = await totpService.verifyBackupCode(hash, 'abcd1234');

      expect(isValid).toBe(true);
    });
  });

  describe('generateToken', () => {
    it('should generate 6-digit token', () => {
      const secret = 'JBSWY3DPEHPK3PXP'; // Base32 encoded
      const token = totpService.generateToken(secret);

      expect(token.length).toBe(6);
      expect(token).toMatch(/^\d{6}$/);
    });

    it('should generate consistent token for same time', () => {
      vi.useFakeTimers();
      const secret = 'JBSWY3DPEHPK3PXP';

      const token1 = totpService.generateToken(secret);
      const token2 = totpService.generateToken(secret);

      expect(token1).toBe(token2);
      vi.useRealTimers();
    });

    it('should generate different token after time period', () => {
      vi.useFakeTimers();
      const secret = 'JBSWY3DPEHPK3PXP';

      const token1 = totpService.generateToken(secret);
      vi.advanceTimersByTime(31 * 1000); // Advance past 30s period
      const token2 = totpService.generateToken(secret);

      expect(token1).not.toBe(token2);
      vi.useRealTimers();
    });
  });

  describe('security requirements (Constitution compliance)', () => {
    it('should use SHA1 algorithm for Google Authenticator compatibility', () => {
      const config = totpService.getConfig();
      expect(config.algorithm).toBe('sha1');
    });

    it('should use 6-digit tokens', () => {
      const config = totpService.getConfig();
      expect(config.digits).toBe(6);
    });

    it('should use 30-second time period', () => {
      const config = totpService.getConfig();
      expect(config.period).toBe(30);
    });

    it('should generate minimum 20-byte (160-bit) secret', async () => {
      const { secret } = await totpService.generateSecret('test@example.com');
      // Base32 encoded 20 bytes = 32 characters
      expect(secret.length).toBeGreaterThanOrEqual(32);
    });
  });
});
