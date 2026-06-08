import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  sanitizePromptInput,
  formatCurrency,
  CurrencyFormatError,
  resolveParticipantPhone,
} from '../../../infrastructure/security/sanitize';
import { encrypt } from '../../../infrastructure/security/crypto';

const PHONE_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('sanitizePromptInput', () => {
  it('strips newline characters (\\n and \\r)', () => {
    expect(sanitizePromptInput('line1\nline2\rline3')).not.toMatch(/[\n\r]/);
  });

  it('strips pipe characters', () => {
    expect(sanitizePromptInput('a|b|c')).not.toContain('|');
  });

  it('strips backtick characters', () => {
    expect(sanitizePromptInput('`code`')).not.toContain('`');
  });

  it('strips triple-dash sequences', () => {
    expect(sanitizePromptInput('item --- note')).not.toContain('---');
  });

  it('strips XML-like tags', () => {
    const result = sanitizePromptInput('<script>alert(1)</script>safe');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
    expect(result).toContain('safe');
  });

  it('truncates to maxLength', () => {
    expect(sanitizePromptInput('abcdefghij', 5)).toBe('abcde');
  });

  it('returns empty string for null input', () => {
    expect(sanitizePromptInput(null as unknown as string)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(sanitizePromptInput(undefined as unknown as string)).toBe('');
  });

  it('removes injected characters from adversarial prompt input', () => {
    const result = sanitizePromptInput('item\n| DROP TABLE users; --\n<script>');
    expect(result).not.toMatch(/[\n\r|`<]/);
    expect(result).not.toContain('<script>');
  });
});

describe('formatCurrency', () => {
  it('formats USD with correct symbol and separator', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('formats INR with correct symbol and separator', () => {
    expect(formatCurrency(1234.56, 'INR', 'en-IN')).toBe('₹1,234.56');
  });

  it('formats EUR with correct symbol and separator', () => {
    expect(formatCurrency(12.34, 'EUR', 'de-DE')).toMatch(/12,34/);
    expect(formatCurrency(12.34, 'EUR', 'de-DE')).toMatch(/€/);
  });

  it('formats GBP with correct symbol and separator', () => {
    expect(formatCurrency(12.34, 'GBP', 'en-GB')).toBe('£12.34');
  });

  it('throws CurrencyFormatError for unknown currency code', () => {
    expect(() => formatCurrency(100, 'XYZ')).toThrow(CurrencyFormatError);
    expect(() => formatCurrency(100, 'XYZ')).toThrow(/Unsupported currency: XYZ/);
  });

  it('handles zero correctly ($0.00)', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles negative amounts (-$12.50)', () => {
    expect(formatCurrency(-12.5, 'USD')).toBe('-$12.50');
  });
});

type GetUserByIdResult = {
  data: { user: { phone: string | null } | null };
  error: { message: string } | null;
};

const mockGetUserById = jest.fn<(id: string) => Promise<GetUserByIdResult>>();

jest.mock('../../../infrastructure/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: (id: string) => mockGetUserById(id),
      },
    },
  },
}));

describe('resolveParticipantPhone', () => {
  beforeEach(() => {
    process.env.PHONE_ENCRYPTION_KEY = PHONE_KEY;
    mockGetUserById.mockReset();
  });

  it('returns null for a name-only participant with no phone_encrypted and no user_id', async () => {
    const result = await resolveParticipantPhone({
      user_id: null,
      phone_encrypted: null,
    });
    expect(result).toBeNull();
  });

  it('decrypts guest phone_encrypted when user_id is null', async () => {
    const phone = '+15005550006';
    const phone_encrypted = encrypt(phone, PHONE_KEY);
    const result = await resolveParticipantPhone({
      user_id: null,
      phone_encrypted,
    });
    expect(result).toBe(phone);
  });

  it('returns phone from Supabase Auth for app members', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { phone: '+15005550002' } },
      error: null,
    });
    const result = await resolveParticipantPhone({
      user_id: 'user-123',
      phone_encrypted: null,
    });
    expect(result).toBe('+15005550002');
    expect(mockGetUserById).toHaveBeenCalledWith('user-123');
  });

  it('returns null when getUserById fails or has no phone', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { phone: null } }, error: null });
    expect(
      await resolveParticipantPhone({ user_id: 'user-123', phone_encrypted: null }),
    ).toBeNull();

    mockGetUserById.mockResolvedValue({ data: { user: null }, error: { message: 'not found' } });
    expect(
      await resolveParticipantPhone({ user_id: 'user-456', phone_encrypted: null }),
    ).toBeNull();
  });

  it('returns null when guest phone_encrypted cannot be decrypted (missing key)', async () => {
    delete process.env.PHONE_ENCRYPTION_KEY;
    const phone_encrypted = encrypt('+15005550006', PHONE_KEY);
    const result = await resolveParticipantPhone({
      user_id: null,
      phone_encrypted,
    });
    expect(result).toBeNull();
  });
});
