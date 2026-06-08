import type { PaymentProvider } from '../types/profile.types';

export interface PaymentHandleValidationResult {
  valid: boolean;
  normalized: string;
  error: string | null;
}

/** Normalized Venmo: @username (5–30 chars). */
const VENMO_NORMALIZED = /^@[a-zA-Z][a-zA-Z0-9_-]{4,29}$/;

/** Normalized PayPal: paypal.me/username (3–64 chars). */
const PAYPAL_NORMALIZED = /^paypal\.me\/[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/i;

/** Normalized Cash App: $cashtag. */
const CASHAPP_NORMALIZED = /^\$[a-zA-Z][a-zA-Z0-9]{0,20}$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROR_MESSAGES: Partial<Record<PaymentProvider, string>> = {
  venmo: 'Venmo usernames are 5–30 characters: letters, numbers, - or _. Example: @alex-chen',
  paypal:
    'Use your PayPal.me username or full link. Examples: alexchen or paypal.me/alexchen',
  cashapp: 'Cash App cashtags start with $. Example: $alexchen',
  zelle: 'Enter the email or 10-digit US phone number linked to your Zelle',
};

export function normalizePaymentHandle(provider: PaymentProvider, raw: string): string {
  const trimmed = raw.trim();

  switch (provider) {
    case 'venmo': {
      const withoutAt = trimmed.replace(/^@+/, '');
      return `@${withoutAt}`;
    }
    case 'paypal': {
      const slug = trimmed
        .replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')
        .replace(/^paypal\.me\//i, '')
        .replace(/\/+$/, '');
      return `paypal.me/${slug}`;
    }
    case 'cashapp': {
      const tag = trimmed.replace(/^\$+/, '');
      return `$${tag}`;
    }
    default:
      return trimmed;
  }
}

export function validatePaymentHandle(
  provider: PaymentProvider,
  raw: string,
): PaymentHandleValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, normalized: trimmed, error: 'Enter your payment handle' };
  }

  const normalized = normalizePaymentHandle(provider, trimmed);

  switch (provider) {
    case 'venmo':
      if (!VENMO_NORMALIZED.test(normalized)) {
        return { valid: false, normalized, error: ERROR_MESSAGES.venmo ?? 'Invalid handle' };
      }
      return { valid: true, normalized, error: null };

    case 'paypal':
      if (!PAYPAL_NORMALIZED.test(normalized)) {
        return { valid: false, normalized, error: ERROR_MESSAGES.paypal ?? 'Invalid handle' };
      }
      return { valid: true, normalized, error: null };

    case 'cashapp':
      if (!CASHAPP_NORMALIZED.test(normalized)) {
        return { valid: false, normalized, error: ERROR_MESSAGES.cashapp ?? 'Invalid handle' };
      }
      return { valid: true, normalized, error: null };

    case 'zelle': {
      const digits = trimmed.replace(/\D/g, '');
      const phoneCandidate =
        digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
      if (EMAIL.test(trimmed) || phoneCandidate.length === 10) {
        return { valid: true, normalized: trimmed, error: null };
      }
      return { valid: false, normalized: trimmed, error: ERROR_MESSAGES.zelle ?? 'Invalid handle' };
    }

    default:
      return { valid: true, normalized: trimmed, error: null };
  }
}

export function paymentHandleHint(provider: PaymentProvider): string {
  switch (provider) {
    case 'venmo':
      return '5–30 characters. Example: @alex-chen';
    case 'paypal':
      return 'Username or link. Example: paypal.me/alexchen';
    case 'cashapp':
      return 'Starts with $. Example: $alexchen';
    case 'zelle':
      return 'Example: alex@email.com or 5551234567';
    default:
      return '';
  }
}
