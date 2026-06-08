import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;

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

/**
 * AES-256-GCM encrypt — returns iv_hex:auth_tag_hex:ciphertext_hex
 * per docs/09-Security-And-Privacy.md
 */
export function encrypt(plaintext: string, keyHex: string): string {
  try {
    const key = resolveKey(keyHex);
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    if (err instanceof EncryptionError) throw err;
    throw new EncryptionError('Encryption failed');
  }
}

export function decrypt(stored: string, keyHex: string): string {
  try {
    const parts = stored.split(':');
    if (parts.length !== 3) {
      throw new EncryptionError('Invalid encrypted value format — expected iv:tag:ciphertext');
    }
    const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
    const key = resolveKey(keyHex);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encryptedData).toString('utf8') + decipher.final('utf8');
  } catch {
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
