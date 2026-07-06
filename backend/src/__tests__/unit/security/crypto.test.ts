import { describe, it, expect, beforeEach } from '@jest/globals';
import { createCipheriv, randomBytes } from 'crypto';
import {
  encrypt,
  decrypt,
  encryptPhone,
  encryptHandle,
  decryptHandle,
  EncryptionError,
  CURRENT_CIPHER_VERSION,
} from '../../../infrastructure/security/crypto';

const TEST_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const OTHER_KEY =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

function encryptLegacy(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

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

  it('new ciphertext uses v1 prefix and 12-byte IV', () => {
    const encrypted = encrypt('versioned', TEST_KEY);
    expect(encrypted.startsWith(`${CURRENT_CIPHER_VERSION}:`)).toBe(true);
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[1]).toHaveLength(24);
  });

  it('decrypts legacy 16-byte IV ciphertext without v1 prefix', () => {
    const plaintext = 'legacy-row-from-db';
    const legacy = encryptLegacy(plaintext, TEST_KEY);
    expect(legacy.split(':')).toHaveLength(3);
    expect(decrypt(legacy, TEST_KEY)).toBe(plaintext);
  });

  it('the encrypted output never contains the plaintext as a substring', () => {
    const plaintext = 'super-secret-value';
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(encrypted).not.toContain(plaintext);
    expect(encrypted.split(':')).toHaveLength(4);
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
    expect(() => decrypt('v1:only:two', TEST_KEY)).toThrow(EncryptionError);
    expect(() => decrypt('v2:aa:bb:cc', TEST_KEY)).toThrow(EncryptionError);
    try {
      decrypt('v2:aa:bb:cc', TEST_KEY);
    } catch (err) {
      expect((err as EncryptionError).message).toContain('Unsupported encrypted value version: v2');
    }
  });

  it('wraps GCM auth failures as Decryption failed without leaking plaintext', () => {
    const encrypted = encrypt('tamper-me', TEST_KEY);
    const parts = encrypted.split(':');
    parts[3] = `${parts[3]!.slice(0, -2)}ff`;
    expect(() => decrypt(parts.join(':'), TEST_KEY)).toThrow(EncryptionError);
    try {
      decrypt(parts.join(':'), TEST_KEY);
    } catch (err) {
      expect((err as EncryptionError).message).toBe('Decryption failed');
      expect((err as EncryptionError).message).not.toContain('tamper-me');
    }
  });

  it('wraps unexpected cipher failures as EncryptionError without leaking details', () => {
    jest.isolateModules(() => {
      jest.doMock('crypto', () => {
        const actual = jest.requireActual<typeof import('crypto')>('crypto');
        return {
          ...actual,
          createCipheriv: () => {
            throw new Error('unexpected cipher failure');
          },
        };
      });

      const { encrypt: encryptWithMockedCipher, EncryptionError: MockedEncryptionError } =
        require('../../../infrastructure/security/crypto') as typeof import('../../../infrastructure/security/crypto');

      expect(() => encryptWithMockedCipher('secret', TEST_KEY)).toThrow(MockedEncryptionError);
      try {
        encryptWithMockedCipher('secret', TEST_KEY);
      } catch (err) {
        expect(err).toBeInstanceOf(MockedEncryptionError);
        expect((err as InstanceType<typeof MockedEncryptionError>).message).toBe('Encryption failed');
        expect((err as InstanceType<typeof MockedEncryptionError>).message).not.toContain('secret');
      }
    });
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
