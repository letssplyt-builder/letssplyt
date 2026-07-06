import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
export const CURRENT_CIPHER_VERSION = 'v1';
const CIPHER_VERSION_PREFIX = /^v\d+:/;
const V1_IV_BYTE_LENGTH = 12;

export class EncryptionError extends Error {
  readonly code = 'ENCRYPTION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class HashError extends Error {
  readonly code = 'HASH_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'HashError';
  }
}

function resolveKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new EncryptionError('Encryption key must be exactly 32 bytes (64 hex chars)');
  }
  return key;
}

function sealAesGcm(plaintext: string, key: Buffer, ivByteLength: number): string {
  const iv = randomBytes(ivByteLength);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function openAesGcm(
  ivHex: string,
  authTagHex: string,
  encryptedHex: string,
  key: Buffer,
): string {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encryptedData).toString('utf8') + decipher.final('utf8');
}

/**
 * AES-256-GCM encrypt — returns v1:iv_hex:auth_tag_hex:ciphertext_hex
 * (12-byte IV per NIST SP 800-38D). Legacy iv:tag:ciphertext (16-byte IV) still decrypts.
 */
export function encrypt(plaintext: string, keyHex: string): string {
  try {
    const key = resolveKey(keyHex);
    const payload = sealAesGcm(plaintext, key, V1_IV_BYTE_LENGTH);
    return `${CURRENT_CIPHER_VERSION}:${payload}`;
  } catch (err) {
    if (err instanceof EncryptionError) throw err;
    throw new EncryptionError('Encryption failed');
  }
}

function decryptLegacy(stored: string, key: Buffer): string {
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new EncryptionError('Invalid encrypted value format — expected iv:tag:ciphertext');
  }
  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
  return openAesGcm(ivHex, authTagHex, encryptedHex, key);
}

function decryptVersioned(stored: string, key: Buffer): string {
  const parts = stored.split(':');
  const version = parts[0];
  if (version !== CURRENT_CIPHER_VERSION) {
    throw new EncryptionError(`Unsupported encrypted value version: ${version}`);
  }
  if (parts.length !== 4) {
    throw new EncryptionError('Invalid encrypted value format — expected v1:iv:tag:ciphertext');
  }
  const [, ivHex, authTagHex, encryptedHex] = parts as [string, string, string, string];
  return openAesGcm(ivHex, authTagHex, encryptedHex, key);
}

export function decrypt(stored: string, keyHex: string): string {
  try {
    const key = resolveKey(keyHex);
    if (CIPHER_VERSION_PREFIX.test(stored)) {
      return decryptVersioned(stored, key);
    }
    return decryptLegacy(stored, key);
  } catch (err) {
    if (err instanceof EncryptionError) throw err;
    throw new EncryptionError('Decryption failed');
  }
}

export function hashPhone(phoneE164: string): string {
  const salt = process.env.PII_HMAC_SALT;
  if (!salt) {
    throw new HashError('PII_HMAC_SALT is not set — cannot hash phone number');
  }
  return createHmac('sha256', salt).update(phoneE164).digest('hex');
}

export function encryptPhone(phoneE164: string): string {
  const key = process.env.PHONE_ENCRYPTION_KEY;
  if (!key) throw new EncryptionError('PHONE_ENCRYPTION_KEY is not set');
  return encrypt(phoneE164, key);
}

export function encryptHandle(handle: string): string {
  const key = process.env.HANDLE_ENCRYPTION_KEY;
  if (!key) throw new EncryptionError('HANDLE_ENCRYPTION_KEY is not set');
  return encrypt(handle, key);
}

export function decryptHandle(stored: string): string {
  const key = process.env.HANDLE_ENCRYPTION_KEY;
  if (!key) throw new EncryptionError('HANDLE_ENCRYPTION_KEY is not set');
  return decrypt(stored, key);
}
