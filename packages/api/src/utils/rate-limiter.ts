import type Redis from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  total: number;
}

/**
 * Rate limiter using Redis sliding window
 */
export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  /**
   * Check rate limit for a key
   */
  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const fullKey = `${this.config.keyPrefix}:${key}`;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(fullKey, 0, windowStart);

    // Count current entries in window
    pipeline.zcard(fullKey);

    // Add current request
    pipeline.zadd(fullKey, now, `${now}-${Math.random()}`);

    // Set expiry on the key
    pipeline.pexpire(fullKey, this.config.windowMs);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Rate limiter pipeline failed');
    }

    const count = (results[1]?.[1] as number) || 0;
    const allowed = count < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - count - 1);
    const resetAt = new Date(now + this.config.windowMs);

    // If not allowed, remove the request we just added
    if (!allowed) {
      await this.redis.zremrangebyscore(fullKey, now, now + 1);
    }

    return {
      allowed,
      remaining: allowed ? remaining : 0,
      resetAt,
      total: this.config.maxRequests,
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    await this.redis.del(fullKey);
  }
}

/**
 * Pre-configured rate limiters for AIM module
 */
export const rateLimitConfigs = {
  // Registration: 3 per IP per hour
  registration: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'rl:registration',
  },

  // Login by email: 5 per 15 minutes
  loginByEmail: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'rl:login:email',
  },

  // Login by IP: 20 per hour
  loginByIp: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    keyPrefix: 'rl:login:ip',
  },

  // Password reset: 3 per email per hour
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'rl:reset:email',
  },

  // Password reset by IP: 10 per hour
  passwordResetByIp: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyPrefix: 'rl:reset:ip',
  },

  // MFA attempts: 5 per challenge
  mfaAttempts: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
    keyPrefix: 'rl:mfa',
  },

  // Email verification resend: 3 per hour
  emailVerification: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'rl:verify:email',
  },
};
