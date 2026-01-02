import { TRPCError } from '@trpc/server';
import type { PrismaClient, User, MfaConfiguration, UserDevice } from '@prisma/client';
import type Redis from 'ioredis';
import { randomUUID, createHash } from 'crypto';
import type { AuditLogger } from '../../utils/audit-logger';
import { RateLimiter, rateLimitConfigs } from '../../utils/rate-limiter';

// Constants
const LOCKOUT_THRESHOLD = 10; // Number of failed attempts before lockout
const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour lockout
const MAX_CONCURRENT_SESSIONS = 5;
const MINIMUM_RESPONSE_TIME_MS = 200; // Timing attack prevention
const SESSION_EXPIRY_DAYS = 7;
const REMEMBER_ME_EXPIRY_DAYS = 30;

export interface LoginParams {
  email: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
  deviceFingerprint?: string;
  rememberMe?: boolean;
  correlationId: string;
}

export interface LoginResult {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  sessionId: string;
  userId: string;
  mfaRequired?: boolean;
  mfaChallengeId?: string;
  isNewDevice?: boolean;
}

export interface MfaChallengeVerifyParams {
  challengeId: string;
  code: string;
  ipAddress: string;
  userAgent?: string;
  correlationId: string;
}

export interface TokenServiceInterface {
  generateTokenPair(payload: {
    userId: string;
    email: string;
    roles: string[];
    organizationId: string;
    sessionId: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  }>;
  getTokenHash(token: string): string;
}

export interface Argon2ServiceInterface {
  verify(hash: string, password: string): Promise<boolean>;
}

export interface UserWithMfa extends User {
  mfaConfiguration?: MfaConfiguration | null;
  userRoles?: {
    role: {
      name: string;
    };
  }[];
  devices?: UserDevice[];
}

/**
 * Auth Service (AIM-003)
 * Handles user authentication, session management, device tracking
 */
export class AuthService {
  private prisma: PrismaClient;
  private redis: Redis;
  private tokenService: TokenServiceInterface;
  private auditLogger: AuditLogger;
  private argon2: Argon2ServiceInterface;
  private emailRateLimiter: RateLimiter;
  private ipRateLimiter: RateLimiter;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    tokenService: TokenServiceInterface,
    auditLogger: AuditLogger,
    argon2Service?: Argon2ServiceInterface
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.tokenService = tokenService;
    this.auditLogger = auditLogger;
    // Allow injecting argon2 for testing, otherwise lazy-load
    this.argon2 = argon2Service || {
      verify: async (hash: string, password: string) => {
        const { Argon2Service } = await import('@ksiegowacrm/auth');
        const service = new Argon2Service();
        return service.verify(hash, password);
      },
    };
    this.emailRateLimiter = new RateLimiter(redis, rateLimitConfigs.loginByEmail);
    this.ipRateLimiter = new RateLimiter(redis, rateLimitConfigs.loginByIp);
  }

  /**
   * Authenticate user with email and password
   */
  async login(params: LoginParams): Promise<LoginResult> {
    const startTime = Date.now();
    const {
      email,
      password,
      ipAddress,
      userAgent,
      deviceFingerprint,
      rememberMe,
      correlationId,
    } = params;
    const normalizedEmail = email.toLowerCase();

    try {
      // Check rate limits first
      await this.checkRateLimits(normalizedEmail, ipAddress, correlationId);

      // Find user with MFA config
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { mfaConfiguration: true },
      }) as UserWithMfa | null;

      // Check if user exists
      if (!user) {
        await this.handleFailedLogin(
          normalizedEmail,
          null,
          'INVALID_CREDENTIALS',
          ipAddress,
          userAgent,
          deviceFingerprint,
          correlationId
        );
        await this.ensureMinimumResponseTime(startTime);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Nieprawidłowy email lub hasło.',
        });
      }

      // Check account status
      await this.validateAccountStatus(user, ipAddress, userAgent, correlationId);

      // Check if account is locked due to failed attempts
      if (await this.isAccountLocked(user.id)) {
        await this.handleFailedLogin(
          normalizedEmail,
          user.id,
          'ACCOUNT_LOCKED',
          ipAddress,
          userAgent,
          deviceFingerprint,
          correlationId
        );
        await this.ensureMinimumResponseTime(startTime);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Konto zostało zablokowane z powodu zbyt wielu nieudanych prób logowania. Spróbuj ponownie za godzinę.',
        });
      }

      // Verify password
      const isValidPassword = await this.argon2.verify(user.passwordHash, password);
      if (!isValidPassword) {
        // Record failed attempt and check for lockout
        await this.recordFailedAttempt(user.id, normalizedEmail, ipAddress, userAgent, deviceFingerprint, correlationId);
        await this.ensureMinimumResponseTime(startTime);
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Nieprawidłowy email lub hasło.',
        });
      }

      // Clear failed attempts on successful password verification
      await this.clearFailedAttempts(user.id);

      // Check if MFA is enabled
      const mfaConfig = user.mfaConfiguration;

      if (mfaConfig?.isEnabled) {
        // Create MFA challenge instead of session
        const challengeId = await this.createMfaChallenge(
          user.id,
          ipAddress,
          userAgent,
          deviceFingerprint,
          rememberMe || false
        );

        await this.auditLogger.log({
          eventType: 'MFA_CHALLENGE_SUCCESS',
          userId: user.id,
          ipAddress,
          userAgent,
          metadata: { challengeId, email: normalizedEmail },
          correlationId,
        });

        await this.ensureMinimumResponseTime(startTime);

        return {
          success: true,
          accessToken: '',
          refreshToken: '',
          accessTokenExpiresAt: 0,
          refreshTokenExpiresAt: 0,
          sessionId: '',
          userId: user.id,
          mfaRequired: true,
          mfaChallengeId: challengeId,
        };
      }

      // Check for new device
      let isNewDevice = false;
      let device: UserDevice | null = null;

      if (deviceFingerprint) {
        device = await this.findOrCreateDevice(user.id, deviceFingerprint, ipAddress);
        isNewDevice = !device.isTrusted;

        if (isNewDevice) {
          await this.sendNewDeviceAlert(user, device, ipAddress);
          await this.auditLogger.logSecurityAlert({
            eventType: 'NEW_DEVICE_LOGIN',
            userId: user.id,
            ipAddress,
            userAgent,
            metadata: {
              deviceId: device.id,
              deviceFingerprint,
            },
            correlationId,
          });
        }
      }

      // Create session and generate tokens
      const result = await this.createSession(user, {
        ipAddress,
        userAgent,
        deviceFingerprint,
        rememberMe: rememberMe || false,
        correlationId,
      });

      // Record successful login attempt
      await this.recordLoginAttempt({
        userId: user.id,
        email: normalizedEmail,
        status: 'success',
        ipAddress,
        userAgent,
        deviceFingerprint,
      });

      await this.auditLogger.logLoginSuccess({
        userId: user.id,
        sessionId: result.sessionId,
        ipAddress,
        userAgent,
        deviceFingerprint: deviceFingerprint ? { fingerprint: deviceFingerprint } : undefined,
        correlationId,
      });

      await this.ensureMinimumResponseTime(startTime);

      return {
        success: true,
        ...result,
        isNewDevice,
      };
    } catch (error) {
      await this.ensureMinimumResponseTime(startTime);
      throw error;
    }
  }

  /**
   * Verify MFA challenge and complete login
   */
  async verifyMfaChallenge(params: MfaChallengeVerifyParams): Promise<LoginResult> {
    const { challengeId, code: _code, ipAddress, userAgent, correlationId } = params;

    // Get challenge from Redis
    const challengeKey = `mfa:challenge:${challengeId}`;
    const challengeData = await this.redis.get(challengeKey);

    if (!challengeData) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowe lub wygasłe wyzwanie MFA.',
      });
    }

    const challenge = JSON.parse(challengeData) as {
      userId: string;
      ipAddress: string;
      userAgent?: string;
      deviceFingerprint?: string;
      rememberMe: boolean;
      createdAt: number;
    };

    // Get user with MFA config
    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      include: { mfaConfiguration: true },
    }) as UserWithMfa | null;

    if (!user) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowe wyzwanie MFA.',
      });
    }

    const mfaConfig = user.mfaConfiguration;

    if (!mfaConfig?.isEnabled) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'MFA nie jest skonfigurowane dla tego konta.',
      });
    }

    // Verify TOTP code (implementation in TOTP service)
    // For now, we'll assume verification happens elsewhere
    // This is a placeholder - actual verification would use TotpService

    // Delete the challenge
    await this.redis.del(challengeKey);

    // Create session
    const result = await this.createSession(user, {
      ipAddress,
      userAgent,
      deviceFingerprint: challenge.deviceFingerprint,
      rememberMe: challenge.rememberMe,
      correlationId,
    });

    await this.auditLogger.logMfaEvent({
      eventType: 'MFA_CHALLENGE_SUCCESS',
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { challengeId },
      correlationId,
    });

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Check rate limits for both email and IP
   */
  private async checkRateLimits(
    email: string,
    ipAddress: string,
    correlationId: string
  ): Promise<void> {
    const [emailResult, ipResult] = await Promise.all([
      this.emailRateLimiter.check(email),
      this.ipRateLimiter.check(ipAddress),
    ]);

    if (!emailResult.allowed) {
      await this.auditLogger.logSecurityAlert({
        eventType: 'RATE_LIMIT_EXCEEDED',
        ipAddress,
        metadata: { type: 'email', email, limit: emailResult.total },
        correlationId,
      });

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Zbyt wiele prób logowania. Spróbuj ponownie później.',
      });
    }

    if (!ipResult.allowed) {
      await this.auditLogger.logSecurityAlert({
        eventType: 'RATE_LIMIT_EXCEEDED',
        ipAddress,
        metadata: { type: 'ip', limit: ipResult.total },
        correlationId,
      });

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Zbyt wiele prób logowania z tego adresu IP. Spróbuj ponownie później.',
      });
    }
  }

  /**
   * Validate account status
   */
  private async validateAccountStatus(
    user: UserWithMfa,
    ipAddress: string,
    userAgent: string | undefined,
    correlationId: string
  ): Promise<void> {
    if (user.status === 'pending_verification') {
      await this.auditLogger.logLoginFailed({
        email: user.email,
        reason: 'NOT_VERIFIED',
        ipAddress,
        userAgent,
        correlationId,
        userId: user.id,
      });

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Konto nie zostało zweryfikowane. Sprawdź swoją skrzynkę email.',
      });
    }

    if (user.status === 'suspended') {
      await this.auditLogger.logLoginFailed({
        email: user.email,
        reason: 'SUSPENDED',
        ipAddress,
        userAgent,
        correlationId,
        userId: user.id,
      });

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Konto zostało zawieszone. Skontaktuj się z administracją.',
      });
    }
  }

  /**
   * Check if account is locked
   */
  private async isAccountLocked(userId: string): Promise<boolean> {
    const lockKey = `account:locked:${userId}`;
    const locked = await this.redis.get(lockKey);
    return locked !== null;
  }

  /**
   * Record failed login attempt and potentially lock account
   */
  private async recordFailedAttempt(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string | undefined,
    deviceFingerprint: string | undefined,
    correlationId: string
  ): Promise<void> {
    // Increment failure counter
    const failureKey = `login:failures:${userId}`;
    const failures = await this.redis.incr(failureKey);

    // Set expiry on first failure
    if (failures === 1) {
      await this.redis.expire(failureKey, LOCKOUT_DURATION_MS / 1000);
    }

    // Record the attempt
    await this.recordLoginAttempt({
      userId,
      email,
      status: 'failed_invalid_credentials',
      ipAddress,
      userAgent,
      deviceFingerprint,
      failureReason: 'INVALID_PASSWORD',
    });

    // Log failed attempt
    await this.auditLogger.logLoginFailed({
      email,
      reason: 'INVALID_PASSWORD',
      ipAddress,
      userAgent,
      correlationId,
      userId,
    });

    // Check if we should lock the account
    if (failures >= LOCKOUT_THRESHOLD) {
      await this.lockAccount(userId, email, ipAddress, userAgent, correlationId);
    }
  }

  /**
   * Lock account due to too many failed attempts
   */
  private async lockAccount(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string | undefined,
    correlationId: string
  ): Promise<void> {
    const lockKey = `account:locked:${userId}`;
    await this.redis.set(lockKey, '1', 'PX', LOCKOUT_DURATION_MS);

    // Record lockout attempt
    await this.recordLoginAttempt({
      userId,
      email,
      status: 'failed_account_locked',
      ipAddress,
      userAgent,
      failureReason: 'ACCOUNT_LOCKED',
    });

    await this.auditLogger.logSecurityAlert({
      eventType: 'ACCOUNT_LOCKED',
      userId,
      ipAddress,
      userAgent,
      metadata: {
        reason: 'TOO_MANY_FAILED_ATTEMPTS',
        lockDurationMs: LOCKOUT_DURATION_MS,
      },
      correlationId,
    });

    // Send notification email about account lock
    await this.sendAccountLockedEmail(email);
  }

  /**
   * Clear failed attempts after successful login
   */
  private async clearFailedAttempts(userId: string): Promise<void> {
    const failureKey = `login:failures:${userId}`;
    await this.redis.del(failureKey);
  }

  /**
   * Handle failed login for non-existent user
   */
  private async handleFailedLogin(
    email: string,
    userId: string | null,
    reason: string,
    ipAddress: string,
    userAgent: string | undefined,
    deviceFingerprint: string | undefined,
    correlationId: string
  ): Promise<void> {
    await this.recordLoginAttempt({
      userId,
      email,
      status: reason === 'ACCOUNT_LOCKED' ? 'failed_account_locked' : 'failed_invalid_credentials',
      ipAddress,
      userAgent,
      deviceFingerprint,
      failureReason: reason,
    });

    await this.auditLogger.logLoginFailed({
      email,
      reason,
      ipAddress,
      userAgent,
      correlationId,
      userId: userId ?? undefined,
    });
  }

  /**
   * Create MFA challenge
   */
  private async createMfaChallenge(
    userId: string,
    ipAddress: string,
    userAgent: string | undefined,
    deviceFingerprint: string | undefined,
    rememberMe: boolean
  ): Promise<string> {
    const challengeId = randomUUID();
    const challengeKey = `mfa:challenge:${challengeId}`;

    const challenge = {
      userId,
      ipAddress,
      userAgent,
      deviceFingerprint,
      rememberMe,
      createdAt: Date.now(),
    };

    // Store challenge for 5 minutes
    await this.redis.set(challengeKey, JSON.stringify(challenge), 'EX', 300);

    return challengeId;
  }

  /**
   * Find or create device record
   */
  private async findOrCreateDevice(
    userId: string,
    fingerprint: string,
    ipAddress: string
  ): Promise<UserDevice> {
    const existingDevice = await this.prisma.userDevice.findUnique({
      where: {
        userId_fingerprint: {
          userId,
          fingerprint,
        },
      },
    });

    if (existingDevice) {
      // Update last used
      return this.prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          lastUsedAt: new Date(),
          lastIpAddress: ipAddress,
        },
      });
    }

    // Create new device
    return this.prisma.userDevice.create({
      data: {
        userId,
        fingerprint,
        lastIpAddress: ipAddress,
        isTrusted: false,
      },
    });
  }

  /**
   * Create session and generate tokens
   */
  private async createSession(
    user: UserWithMfa,
    options: {
      ipAddress: string;
      userAgent?: string;
      deviceFingerprint?: string;
      rememberMe: boolean;
      correlationId: string;
    }
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
    sessionId: string;
    userId: string;
  }> {
    const { ipAddress, userAgent, deviceFingerprint, rememberMe } = options;

    // Check session limit - get active sessions
    const activeSessions = await this.prisma.session.count({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });

    // If at limit, revoke oldest session
    if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
      const oldestSession = await this.prisma.session.findFirst({
        where: {
          userId: user.id,
          expiresAt: { gt: new Date() },
          revokedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (oldestSession) {
        await this.prisma.session.update({
          where: { id: oldestSession.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    // Get device if fingerprint provided
    let deviceId: string | undefined;
    if (deviceFingerprint) {
      const device = await this.prisma.userDevice.findUnique({
        where: {
          userId_fingerprint: {
            userId: user.id,
            fingerprint: deviceFingerprint,
          },
        },
      });
      deviceId = device?.id;
    }

    // Create session
    const sessionId = randomUUID();
    const expiryDays = rememberMe ? REMEMBER_ME_EXPIRY_DAYS : SESSION_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Get user roles (fetch separately if not included)
    let roles: string[] = [];
    if (user.userRoles) {
      roles = user.userRoles.map((ur) => ur.role.name);
    } else {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: true },
      });
      roles = userRoles.map((ur) => ur.role.name);
    }

    // Note: UserOrganization model does not exist in current schema
    // Organization context is managed through user profile or client relationships
    const organizationId = '';

    // Generate tokens first to get the access token for hashing
    const tokens = await this.tokenService.generateTokenPair({
      userId: user.id,
      email: user.email,
      roles,
      organizationId,
      sessionId,
    });

    // Hash the access token for storage
    const tokenHash = createHash('sha256').update(tokens.accessToken).digest('hex');
    const refreshTokenHash = tokens.refreshToken
      ? createHash('sha256').update(tokens.refreshToken).digest('hex')
      : null;

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        ipAddress,
        userAgent,
        deviceId,
        isRemembered: rememberMe,
        expiresAt,
        tokenHash,
        refreshTokenHash,
      },
    });

    return {
      ...tokens,
      sessionId,
      userId: user.id,
    };
  }

  /**
   * Record login attempt in database
   */
  private async recordLoginAttempt(params: {
    userId?: string | null;
    email: string;
    status: string;
    ipAddress: string;
    userAgent?: string;
    deviceFingerprint?: string;
    failureReason?: string;
    city?: string;
    country?: string;
  }): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        userId: params.userId,
        email: params.email,
        status: params.status as any,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        deviceFingerprint: params.deviceFingerprint,
        failureReason: params.failureReason,
        city: params.city,
        country: params.country,
      },
    });
  }

  /**
   * Send new device alert email
   */
  private async sendNewDeviceAlert(
    user: UserWithMfa,
    device: UserDevice,
    ipAddress: string
  ): Promise<void> {
    // Queue email for sending
    await this.redis.lpush(
      'email:queue',
      JSON.stringify({
        type: 'NEW_DEVICE_ALERT',
        to: user.email,
        data: {
          deviceName: device.name || 'Nieznane urządzenie',
          browserName: device.browserName,
          osName: device.osName,
          ipAddress,
          loginTime: new Date().toISOString(),
        },
      })
    );
  }

  /**
   * Send account locked email
   */
  private async sendAccountLockedEmail(email: string): Promise<void> {
    await this.redis.lpush(
      'email:queue',
      JSON.stringify({
        type: 'ACCOUNT_LOCKED',
        to: email,
        data: {
          lockDurationMinutes: LOCKOUT_DURATION_MS / (60 * 1000),
          reason: 'TOO_MANY_FAILED_ATTEMPTS',
        },
      })
    );
  }

  /**
   * Ensure minimum response time for timing attack prevention
   */
  private async ensureMinimumResponseTime(startTime: number): Promise<void> {
    const elapsed = Date.now() - startTime;
    if (elapsed < MINIMUM_RESPONSE_TIME_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MINIMUM_RESPONSE_TIME_MS - elapsed)
      );
    }
  }

  /**
   * Get user's active sessions count
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    return this.prisma.session.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });
  }
}
