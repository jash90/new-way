import * as jose from 'jose';
import { createHash, randomUUID } from 'crypto';

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  organizationId: string;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export interface DecodedToken extends TokenPayload {
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  type: 'access' | 'refresh';
}

export interface TokenServiceConfig {
  privateKey: string;
  publicKey: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
}

export class TokenService {
  private privateKey: jose.KeyLike | null = null;
  private publicKey: jose.KeyLike | null = null;
  private config: TokenServiceConfig;

  constructor(config: TokenServiceConfig) {
    this.config = config;
  }

  private async getPrivateKey(): Promise<jose.KeyLike> {
    if (!this.privateKey) {
      this.privateKey = await jose.importPKCS8(this.config.privateKey, 'RS256');
    }
    return this.privateKey;
  }

  private async getPublicKey(): Promise<jose.KeyLike> {
    if (!this.publicKey) {
      this.publicKey = await jose.importSPKI(this.config.publicKey, 'RS256');
    }
    return this.publicKey;
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const [, value, unit] = match;
    if (!value || !unit) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }
    const num = parseInt(value, 10);

    switch (unit) {
      case 's':
        return num * 1000;
      case 'm':
        return num * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      case 'd':
        return num * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid expiry unit: ${unit}`);
    }
  }

  /**
   * Generate a new access and refresh token pair
   * Uses RS256 algorithm as required by Constitution
   */
  async generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const privateKey = await this.getPrivateKey();
    const now = Date.now();

    const accessTokenExpiresAt = now + this.parseExpiry(this.config.accessTokenExpiry);
    const refreshTokenExpiresAt = now + this.parseExpiry(this.config.refreshTokenExpiry);

    // Generate access token
    const accessToken = await new jose.SignJWT({
      ...payload,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(accessTokenExpiresAt / 1000))
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setJti(randomUUID())
      .sign(privateKey);

    // Generate refresh token
    const refreshToken = await new jose.SignJWT({
      userId: payload.userId,
      sessionId: payload.sessionId,
      type: 'refresh',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(refreshTokenExpiresAt / 1000))
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setJti(randomUUID())
      .sign(privateKey);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Verify an access token and return its payload
   */
  async verifyAccessToken(token: string): Promise<DecodedToken> {
    const publicKey = await this.getPublicKey();

    try {
      const { payload } = await jose.jwtVerify(token, publicKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload as unknown as DecodedToken;
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  /**
   * Verify a refresh token and return its payload
   */
  async verifyRefreshToken(token: string): Promise<DecodedToken> {
    const publicKey = await this.getPublicKey();

    try {
      const { payload } = await jose.jwtVerify(token, publicKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload as unknown as DecodedToken;
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  /**
   * Refresh tokens using a valid refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);

    // Generate new token pair with same session
    return this.generateTokenPair({
      userId: payload.userId,
      email: '', // Will be fetched from database in actual implementation
      roles: [], // Will be fetched from database in actual implementation
      organizationId: '', // Will be fetched from database in actual implementation
      sessionId: payload.sessionId,
    });
  }

  /**
   * Generate SHA-256 hash of a token for storage/blacklisting
   */
  getTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
