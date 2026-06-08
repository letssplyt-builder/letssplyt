import { decrypt } from './crypto';
import { supabaseAdmin } from '../supabase';

export class CurrencyFormatError extends Error {
  readonly code = 'CURRENCY_FORMAT_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CurrencyFormatError';
  }
}

const SUPPORTED_CURRENCIES: Record<string, string> = {
  USD: 'en-US',
  INR: 'en-IN',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AUD: 'en-AU',
  CAD: 'en-CA',
  SGD: 'en-SG',
  JPY: 'ja-JP',
};

export function sanitizePromptInput(input: string, maxLength = 200): string {
  if (input == null) return '';
  return input
    .replace(/[\n\r]/g, ' ')
    .replace(/[|`]/g, '')
    .replace(/-{3,}/g, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}

export function formatCurrency(amount: number, currency: string, locale?: string): string {
  const upper = currency.toUpperCase();
  const resolvedLocale = locale ?? SUPPORTED_CURRENCIES[upper];
  if (!resolvedLocale) {
    throw new CurrencyFormatError(
      `Unsupported currency: ${upper}. Supported: USD, INR, EUR, GBP, AUD, CAD, SGD, JPY`,
    );
  }
  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency: upper,
  }).format(amount);
}

export async function resolveParticipantPhone(participant: {
  user_id: string | null;
  phone_encrypted: string | null;
}): Promise<string | null> {
  if (participant.user_id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(participant.user_id);
    if (error || !data.user?.phone) return null;
    return data.user.phone;
  }

  if (participant.phone_encrypted) {
    const key = process.env.PHONE_ENCRYPTION_KEY;
    if (!key) return null;
    return decrypt(participant.phone_encrypted, key);
  }

  return null;
}
