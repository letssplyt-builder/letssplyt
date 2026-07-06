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

export function defaultLocaleForCurrency(currency: string): string {
  const upper = currency.toUpperCase();
  return SUPPORTED_CURRENCIES[upper] ?? 'en-US';
}

/**
 * Format a numeric amount in major units using ISO 4217 currency and optional locale.
 * Falls back to `${currency} ${amount}` when Intl cannot format the code.
 */
export function formatCurrency(amount: number, currency: string, locale?: string): string {
  const upper = currency.toUpperCase();
  const resolvedLocale = locale ?? defaultLocaleForCurrency(upper);
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency: upper,
    }).format(amount);
  } catch {
    return `${upper} ${amount}`;
  }
}
