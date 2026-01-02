import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';

export interface TotpConfig {
  issuer: string;
  algorithm: 'sha1' | 'sha256' | 'sha512';
  digits: number;
  period: number;
}

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

export interface VerifyOptions {
  window?: number;
}

const DEFAULT_CONFIG: TotpConfig = {
  issuer: 'KsięgowaCRM',
  algorithm: 'sha1', // Required for Google Authenticator compatibility
  digits: 6,
  period: 30,
};

export class TotpService {
  private config: TotpConfig;

  constructor(config: Partial<TotpConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a new TOTP secret with QR code
   */
  async generateSecret(email: string): Promise<TotpSetupResult> {
    const secret = speakeasy.generateSecret({
      length: 20, // 160-bit secret (minimum security requirement)
    });

    // Construct otpauth URL manually to ensure issuer is included
    const encodedIssuer = encodeURIComponent(this.config.issuer);
    const encodedEmail = encodeURIComponent(email);
    const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret.base32}&issuer=${encodedIssuer}&algorithm=${this.config.algorithm.toUpperCase()}&digits=${this.config.digits}&period=${this.config.period}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      otpauthUrl,
    };
  }

  /**
   * Generate current TOTP token for a secret
   */
  generateToken(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
      algorithm: this.config.algorithm,
      digits: this.config.digits,
      step: this.config.period,
    });
  }

  /**
   * Verify a TOTP token
   */
  verifyToken(secret: string, token: string, options: VerifyOptions = {}): boolean {
    // Validate token format
    if (!token || token.length !== this.config.digits || !/^\d+$/.test(token)) {
      return false;
    }

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      algorithm: this.config.algorithm,
      digits: this.config.digits,
      step: this.config.period,
      window: options.window ?? 1, // Allow 1 step before/after for clock drift
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    while (codes.length < count) {
      const bytes = randomBytes(8);
      let code = '';

      for (let i = 0; i < 8; i++) {
        const byteValue = bytes[i];
        if (byteValue !== undefined) {
          code += charset[byteValue % charset.length];
        }
      }

      // Ensure uniqueness
      if (code.length === 8 && !codes.includes(code)) {
        codes.push(code);
      }
    }

    return codes;
  }

  /**
   * Hash a backup code using Argon2id
   */
  async hashBackupCode(code: string): Promise<string> {
    return argon2.hash(code.toUpperCase(), {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify a backup code against its hash
   */
  async verifyBackupCode(hash: string, code: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, code.toUpperCase());
    } catch {
      return false;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): TotpConfig {
    return { ...this.config };
  }
}

// Singleton instance with default configuration
export const totpService = new TotpService();
