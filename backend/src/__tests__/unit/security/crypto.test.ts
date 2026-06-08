import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  encrypt,
  decrypt,
  encryptPhone,
  encryptHandle,
  decryptHandle,
  EncryptionError,
} from '../../../infrastructure/security/crypto';

const TEST_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const OTHER_KEY =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('encrypt / decrypt', () => {
  it('round trip returns the original plaintext exactly', () => {
    const plaintext = 'hello world';
    expect(decrypt(encrypt(plaintext, TEST_KEY), TEST_KEY)).toBe(plaintext);
  });

  it('encrypting the same string twice produces different ciphertexts (random IV)', () => {
    const plaintext = 'same input';
    const first = encrypt(plaintext, TEST_KEY);
    const second = encrypt(plaintext, TEST_KEY);
    expect(first).not.toBe(second);
  });

  it('decrypting with the wrong key throws EncryptionError', () => {
    const encrypted = encrypt('secret data', TEST_KEY);
    expect(() => decrypt(encrypted, OTHER_KEY)).toThrow(EncryptionError);
  });

  it('the encrypted output never contains the plaintext as a substring', () => {
    const plaintext = 'super-secret-value';
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(encrypted).not.toContain(plaintext);
    expect(encrypted.split(':')).toHaveLength(3);
  });

  it('encrypting an empty string works without error', () => {
    const encrypted = encrypt('', TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe('');
  });

  it('encrypting a 10,000 character string works without error', () => {
    const plaintext = 'a'.repeat(10_000);
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('error messages from EncryptionError never include the plaintext value', () => {
    const plaintext = 'do-not-leak-me';
    try {
      decrypt('invalid:format:here', TEST_KEY);
    } catch (err) {
      expect(err).toBeInstanceOf(EncryptionError);
      expect((err as EncryptionError).message).not.toContain(plaintext);
      expect((err as EncryptionError).message).toBe('Decryption failed');
    }

    try {
      decrypt(encrypt(plaintext, TEST_KEY), OTHER_KEY);
    } catch (err) {
      expect(err).toBeInstanceOf(EncryptionError);
      expect((err as EncryptionError).message).not.toContain(plaintext);
      expect((err as EncryptionError).message).not.toContain(TEST_KEY);
      expect((err as EncryptionError).message).not.toContain(OTHER_KEY);
    }
  });

  it('throws EncryptionError when key is not 32 bytes', () => {
    expect(() => encrypt('data', 'short-key')).toThrow(EncryptionError);
  });

  it('throws EncryptionError for malformed encrypted string format', () => {
    expect(() => decrypt('only-two:parts', TEST_KEY)).toThrow(EncryptionError);
  });

});

describe('encryptPhone / encryptHandle / decryptHandle', () => {
  beforeEach(() => {
    process.env.PHONE_ENCRYPTION_KEY = TEST_KEY;
    process.env.HANDLE_ENCRYPTION_KEY = TEST_KEY;
  });

  it('encryptPhone and decrypt round-trip via env key', () => {
    const phone = '+15005550001';
    const encrypted = encryptPhone(phone);
    expect(decrypt(encrypted, TEST_KEY)).toBe(phone);
  });

  it('encryptHandle and decryptHandle round-trip via env key', () => {
    const handle = '@venmo-user';
    const encrypted = encryptHandle(handle);
    expect(decryptHandle(encrypted)).toBe(handle);
  });

  it('throws when PHONE_ENCRYPTION_KEY is missing', () => {
    delete process.env.PHONE_ENCRYPTION_KEY;
    expect(() => encryptPhone('+15005550001')).toThrow(EncryptionError);
  });

  it('throws when HANDLE_ENCRYPTION_KEY is missing', () => {
    delete process.env.HANDLE_ENCRYPTION_KEY;
    expect(() => encryptHandle('@user')).toThrow(EncryptionError);
    expect(() => decryptHandle('a:b:c')).toThrow(EncryptionError);
  });
});
