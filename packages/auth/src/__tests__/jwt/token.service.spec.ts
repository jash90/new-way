import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenService, TokenPayload, TokenPair } from '../../jwt/token.service';

describe('TokenService', () => {
  let tokenService: TokenService;

  // Test RS256 key pair (DO NOT USE IN PRODUCTION - generated for testing only)
  const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC/hu30dOhY9rHV
MZrhoOebE3580g7srOwxg4UFir/2qqrc63KyRXoBMsZ2BUibiXV1T5dODHq6Lok3
zD9mvBVFalUDBqzIuqHNGh6K/FbFUHSBbAHdO/Wxp+kep1x22DsoxMHIHsca1RmR
Ru/mnNlqzT4jWzoOceFBDdv3D20Lk3pBeFK+dJ60eFb8fg072Gb/k4Fd5qumXY8Z
mSPBcuJ9AIezfRNxV85ljb+ttsozO/AVbBd32OBwKpbuxPpxhHooiha+nE5O6ieO
nS/NAwOIduTbz/s9LMTeWrH/29EZn09oz9Mtj/gPrMhRf21jyB3bXrePUdcKxtPI
b2RJXn5xAgMBAAECggEAL7ArA5kwWSZjtQ+63r8vq984uV+cM7YCwXlb37tifMqV
7Jf7YQQHktDPtYcvQvsA8gq1Q8u7qyv3IpuKlcvzB+un6y74SqqdqvH79ONLv6l+
uNLpy+ooDOogE2/ciALjCA2lqmxvavDwgsnE5gjb4cnk1OzcEcitK4OF54hBwIWz
gzQ/MdAilp2yxU0rV+HXmI/maEmeKS8bskcu6irIGvYGP0kLVTuPFLl7wvqO2107
HriCgEhzG/e9aeYoxx0gTklBAd6n16sNs12sOO9KqJry3s8KrSGfsM4Z1/ZsN3hV
959B28Xen3emDleTXNlLTzIr3Zd6+kKII4HeimJWGQKBgQDsfng319NuMNjxA3aJ
SuVjhDlP67QXocLhcmzgUqvSGbWgLBzJfoQkTQsfNmAer//YqJjeg05VjbBRKFji
pCzmC6BBn2nBHQ8T49kH0rGrxJ0WlZzLBWBr+ylyi+64NAbH+z6wk4ygVkRWqzYe
YsAm8MFHzK4O2XMMfxdOS+JJEwKBgQDPUv2OrclAONEbsGzh5aKapZ/NWjnBoG5M
XUyP+E4ajs9DMKmzLj1d2L6cYUajo2zv3DeTjs3Sst3G3P0SmuPvLSxcjl6LtwjV
YNpwmsjEjHI9kfGmsUhtjssLdg46WITVXhxMMMfo2biuTN6SHIm0E7no4H0uG3cy
N3WcPuwu6wKBgQCLF4L7TRvUNjSR4/iGnR83HaBbqgRc1c35rMPuV5Eo2+gf0XII
7Dkp5IpDDEcSJW9zbQ2j6VRcKx5lTTah7e9eSb4yemDHrKCekSanXDsVDGlbzBjQ
q1PfjnP9I+H+QtMuMU3Yqp9N+g7tbntA+dGL1ZPH99DzeN8anXEGosjvMwKBgQCC
xxricYVNWYmuKa/FHxFe87LF2nAsT4LD8OZmun6qCgN7oqqpODXFiP9TrZjdiC0j
cIouLhpvGh0DYErS/ZliOeCN0dCZ2S9dSecAuOKD+QPnCrSgLZw+X6B87k8zRrsj
zGWVOgAgRZZVfG+5Qv8p9HeFCnZsKy8ZIhqyII7jWQKBgQDazm+4BQRlN3WXn2/K
ITLKnAGH2gQlnK/v572N600br8ukmqosXM1D8h8BCqKYP7/1fc2CDw/DAjzBsaR+
m5/HJ/XhlgVPbddm9VVvHh3UIvYi4lZaE5YLOtLwg/x8EvEbozs0UDu3OU38KfbY
mimQkCNdWxh4PD0sRL9F266rCQ==
-----END PRIVATE KEY-----`;

  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv4bt9HToWPax1TGa4aDn
mxN+fNIO7KzsMYOFBYq/9qqq3OtyskV6ATLGdgVIm4l1dU+XTgx6ui6JN8w/ZrwV
RWpVAwasyLqhzRoeivxWxVB0gWwB3Tv1safpHqdcdtg7KMTByB7HGtUZkUbv5pzZ
as0+I1s6DnHhQQ3b9w9tC5N6QXhSvnSetHhW/H4NO9hm/5OBXearpl2PGZkjwXLi
fQCHs30TcVfOZY2/rbbKMzvwFWwXd9jgcCqW7sT6cYR6KIoWvpxOTuonjp0vzQMD
iHbk28/7PSzE3lqx/9vRGZ9PaM/TLY/4D6zIUX9tY8gd2163j1HXCsbTyG9kSV5+
cQIDAQAB
-----END PUBLIC KEY-----`;

  beforeEach(() => {
    vi.useFakeTimers();
    tokenService = new TokenService({
      privateKey: testPrivateKey,
      publicKey: testPublicKey,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'ksiegowacrm',
      audience: 'ksiegowacrm-api',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });

    it('should set correct expiry times', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);

      // Access token should expire in 15 minutes
      expect(tokens.accessTokenExpiresAt).toBeGreaterThan(Date.now());
      expect(tokens.accessTokenExpiresAt).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);

      // Refresh token should expire in 7 days
      expect(tokens.refreshTokenExpiresAt).toBeGreaterThan(Date.now());
      expect(tokens.refreshTokenExpiresAt).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000);
    });

    it('should include required claims in token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER', 'ACCOUNTANT'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);
      const decoded = await tokenService.verifyAccessToken(tokens.accessToken);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.roles).toEqual(payload.roles);
      expect(decoded.organizationId).toBe(payload.organizationId);
      expect(decoded.sessionId).toBe(payload.sessionId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);
      const verified = await tokenService.verifyAccessToken(tokens.accessToken);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
    });

    it('should reject expired access token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);

      // Advance time by 16 minutes (past 15 min expiry)
      vi.advanceTimersByTime(16 * 60 * 1000);

      await expect(tokenService.verifyAccessToken(tokens.accessToken)).rejects.toThrow('Token expired');
    });

    it('should reject tampered token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);
      const tamperedToken = tokens.accessToken.slice(0, -5) + 'xxxxx';

      await expect(tokenService.verifyAccessToken(tamperedToken)).rejects.toThrow();
    });

    it('should reject token with wrong issuer', async () => {
      const wrongIssuerService = new TokenService({
        privateKey: testPrivateKey,
        publicKey: testPublicKey,
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        issuer: 'wrong-issuer',
        audience: 'ksiegowacrm-api',
      });

      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await wrongIssuerService.generateTokenPair(payload);

      await expect(tokenService.verifyAccessToken(tokens.accessToken)).rejects.toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);
      const verified = await tokenService.verifyRefreshToken(tokens.refreshToken);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.sessionId).toBe(payload.sessionId);
    });

    it('should reject expired refresh token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);

      // Advance time by 8 days (past 7 day expiry)
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

      await expect(tokenService.verifyRefreshToken(tokens.refreshToken)).rejects.toThrow('Token expired');
    });
  });

  describe('refreshTokens', () => {
    it('should generate new token pair from valid refresh token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const originalTokens = await tokenService.generateTokenPair(payload);

      // Advance time by 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000);

      const newTokens = await tokenService.refreshTokens(originalTokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(originalTokens.accessToken);
    });
  });

  describe('getTokenHash', () => {
    it('should generate consistent hash for same token', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);
      const hash1 = tokenService.getTokenHash(tokens.accessToken);
      const hash2 = tokenService.getTokenHash(tokens.accessToken);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different tokens', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);
      const hashAccess = tokenService.getTokenHash(tokens.accessToken);
      const hashRefresh = tokenService.getTokenHash(tokens.refreshToken);

      expect(hashAccess).not.toBe(hashRefresh);
    });
  });

  describe('security requirements (Constitution compliance)', () => {
    it('should use RS256 algorithm (required by Constitution)', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);

      // Parse JWT header
      const header = JSON.parse(Buffer.from(tokens.accessToken.split('.')[0], 'base64url').toString());

      expect(header.alg).toBe('RS256');
    });

    it('should include jti claim for token identification', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: 'org-456',
        sessionId: 'session-789',
      };

      const tokens = await tokenService.generateTokenPair(payload);
      const decoded = await tokenService.verifyAccessToken(tokens.accessToken);

      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.jti).toBe('string');
    });
  });
});
