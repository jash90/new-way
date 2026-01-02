import * as argon2 from 'argon2';

export interface Argon2Config {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  saltLength: number;
  hashLength: number;
}

const DEFAULT_CONFIG: Argon2Config = {
  memoryCost: 65536, // 64 KB (minimum per Constitution)
  timeCost: 3, // 3 iterations (minimum per Constitution)
  parallelism: 4,
  saltLength: 16, // 16 bytes (128 bits)
  hashLength: 32, // 32 bytes (256 bits)
};

export class Argon2Service {
  private config: Argon2Config;

  constructor(config: Partial<Argon2Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Hash a password using Argon2id algorithm
   * Required by Constitution for all password storage
   */
  async hash(password: string): Promise<string> {
    if (!password) {
      throw new Error('Password cannot be empty');
    }

    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.config.memoryCost,
      timeCost: this.config.timeCost,
      parallelism: this.config.parallelism,
    });
  }

  /**
   * Verify a password against a hash
   */
  async verify(hash: string, password: string): Promise<boolean> {
    if (!password) {
      return false;
    }

    try {
      return await argon2.verify(hash, password);
    } catch {
      throw new Error('Invalid hash format');
    }
  }

  /**
   * Check if a hash needs to be rehashed with updated parameters
   */
  async needsRehash(hash: string): Promise<boolean> {
    return argon2.needsRehash(hash, {
      memoryCost: this.config.memoryCost,
      timeCost: this.config.timeCost,
      parallelism: this.config.parallelism,
    });
  }

  /**
   * Get the current configuration
   */
  getConfig(): Argon2Config {
    return { ...this.config };
  }
}

// Singleton instance with default configuration
export const argon2Service = new Argon2Service();
