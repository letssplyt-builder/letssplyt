import { describe, it, expect, beforeEach } from '@jest/globals';
import { hashPhone, HashError } from '../../../infrastructure/security/crypto';

const TEST_SALT =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('hashPhone', () => {
  beforeEach(() => {
    process.env.PII_HMAC_SALT = TEST_SALT;
  });

  it('same input produces the same hash every time (deterministic)', () => {
    const phone = '+15005550001';
    expect(hashPhone(phone)).toBe(hashPhone(phone));
  });

  it('different inputs produce different hashes', () => {
    expect(hashPhone('+15005550001')).not.toBe(hashPhone('+15005550002'));
  });

  it('the hash output does not contain the original phone number as a substring', () => {
    const phone = '+15005550001';
    expect(hashPhone(phone)).not.toContain(phone);
  });

  it('the hash is a 64-character hex string (SHA-256 output length)', () => {
    const hash = hashPhone('+15005550001');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('throws HashError when PII_HMAC_SALT env var is not set', () => {
    delete process.env.PII_HMAC_SALT;
    expect(() => hashPhone('+15005550001')).toThrow(HashError);
  });
});
