import { describe, it, expect, beforeEach } from 'vitest';
import { Argon2Service } from '../../hash/argon2';

describe('Argon2Service', () => {
  let argon2Service: Argon2Service;

  beforeEach(() => {
    argon2Service = new Argon2Service();
  });

  describe('hash', () => {
    it('should hash a password using Argon2id', async () => {
      const password = 'SecureP@ssw0rd123!';
      const hash = await argon2Service.hash(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should generate different hashes for same password (salt)', async () => {
      const password = 'SecureP@ssw0rd123!';
      const hash1 = await argon2Service.hash(password);
      const hash2 = await argon2Service.hash(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      await expect(argon2Service.hash('')).rejects.toThrow('Password cannot be empty');
    });

    it('should handle very long passwords (up to 72 bytes)', async () => {
      const longPassword = 'A'.repeat(72);
      const hash = await argon2Service.hash(longPassword);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should handle unicode passwords', async () => {
      const unicodePassword = 'Пароль123!密码@#$';
      const hash = await argon2Service.hash(unicodePassword);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$argon2id\$/);
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'SecureP@ssw0rd123!';
      const hash = await argon2Service.hash(password);

      const isValid = await argon2Service.verify(hash, password);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecureP@ssw0rd123!';
      const wrongPassword = 'WrongP@ssw0rd456!';
      const hash = await argon2Service.hash(password);

      const isValid = await argon2Service.verify(hash, wrongPassword);

      expect(isValid).toBe(false);
    });

    it('should reject similar passwords with different case', async () => {
      const password = 'SecureP@ssw0rd123!';
      const similarPassword = 'securep@ssw0rd123!';
      const hash = await argon2Service.hash(password);

      const isValid = await argon2Service.verify(hash, similarPassword);

      expect(isValid).toBe(false);
    });

    it('should handle empty password verification', async () => {
      const password = 'SecureP@ssw0rd123!';
      const hash = await argon2Service.hash(password);

      const isValid = await argon2Service.verify(hash, '');

      expect(isValid).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const invalidHash = 'not-a-valid-hash';

      await expect(argon2Service.verify(invalidHash, 'password')).rejects.toThrow();
    });
  });

  describe('needsRehash', () => {
    it('should not need rehash for recently hashed password', async () => {
      const password = 'SecureP@ssw0rd123!';
      const hash = await argon2Service.hash(password);

      const needsRehash = await argon2Service.needsRehash(hash);

      expect(needsRehash).toBe(false);
    });

    it('should detect hash with outdated parameters', async () => {
      // Hash with weaker parameters (simulating old hash)
      const weakService = new Argon2Service({
        memoryCost: 16384, // Lower than default 65536
        timeCost: 2,
        parallelism: 1,
      });
      const password = 'SecureP@ssw0rd123!';
      const weakHash = await weakService.hash(password);

      const needsRehash = await argon2Service.needsRehash(weakHash);

      expect(needsRehash).toBe(true);
    });
  });

  describe('security parameters (Constitution compliance)', () => {
    it('should use Argon2id variant (required by Constitution)', async () => {
      const password = 'SecureP@ssw0rd123!';
      const hash = await argon2Service.hash(password);

      // Argon2id is the required variant per Constitution
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should use minimum 64KB memory cost', async () => {
      // Default memory cost should be at least 65536 (64KB)
      const config = argon2Service.getConfig();
      expect(config.memoryCost).toBeGreaterThanOrEqual(65536);
    });

    it('should use minimum 3 iterations', async () => {
      const config = argon2Service.getConfig();
      expect(config.timeCost).toBeGreaterThanOrEqual(3);
    });

    it('should use 16-byte salt minimum', async () => {
      const config = argon2Service.getConfig();
      expect(config.saltLength).toBeGreaterThanOrEqual(16);
    });
  });
});
