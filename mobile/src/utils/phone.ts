import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export type AuthCountryCode = 'US' | 'IN';

export const AUTH_COUNTRIES: Record<
  AuthCountryCode,
  { dial: string; label: string; flag: string; placeholder: string; iso: CountryCode }
> = {
  US: {
    dial: '+1',
    label: 'United States',
    flag: '🇺🇸',
    placeholder: '(555) 000-0000',
    iso: 'US',
  },
  IN: {
    dial: '+91',
    label: 'India',
    flag: '🇮🇳',
    placeholder: '98765 43210',
    iso: 'IN',
  },
};

/** MVP: US only. Append 'IN' (then others) when expanding geos. */
export const SUPPORTED_AUTH_REGIONS: readonly AuthCountryCode[] = ['US'];

export const DEFAULT_AUTH_REGION: AuthCountryCode = 'US';

export function isSupportedAuthRegion(code: string): code is AuthCountryCode {
  return (SUPPORTED_AUTH_REGIONS as readonly string[]).includes(code);
}

export function countryFromE164(e164: string): AuthCountryCode {
  const trimmed = e164.trim();
  if (trimmed.startsWith('+91') && isSupportedAuthRegion('IN')) return 'IN';
  return DEFAULT_AUTH_REGION;
}

/**
 * Strips a leading country code for display in the national-number phone field.
 */
export function nationalFromE164(
  e164: string,
  defaultCountry: AuthCountryCode = DEFAULT_AUTH_REGION,
): string {
  const trimmed = e164.trim();
  if (!trimmed) return '';

  const country = trimmed.startsWith('+') ? countryFromE164(trimmed) : defaultCountry;
  const parsed = parsePhoneNumberFromString(trimmed, AUTH_COUNTRIES[country].iso);
  if (parsed?.isValid()) {
    return parsed.nationalNumber.toString();
  }

  if (trimmed.startsWith('+91')) {
    return trimmed.slice(3).replace(/\D/g, '');
  }
  if (trimmed.startsWith('+1')) {
    return trimmed.slice(2).replace(/\D/g, '');
  }

  return trimmed.replace(/^\+/, '').replace(/\D/g, '');
}

/**
 * Builds E.164 from national digits and region.
 */
export function toE164FromNational(
  nationalDigits: string,
  country: AuthCountryCode = DEFAULT_AUTH_REGION,
): string | null {
  const digits = nationalDigits.replace(/\D/g, '');
  if (!digits) return null;

  const parsed = parsePhoneNumberFromString(digits, AUTH_COUNTRIES[country].iso);
  if (parsed?.isValid()) {
    return parsed.format('E.164');
  }

  return null;
}

/**
 * @deprecated Prefer toE164FromNational — kept for legacy call sites.
 */
export function toE164FromPhoneInput(
  formattedNumber: string,
  defaultCountry: AuthCountryCode = DEFAULT_AUTH_REGION,
): string | null {
  let candidate = formattedNumber.trim();

  const secondPlus = candidate.indexOf('+', 1);
  if (secondPlus !== -1) {
    candidate = candidate.slice(secondPlus);
  }

  const parsed = parsePhoneNumberFromString(candidate, AUTH_COUNTRIES[defaultCountry].iso);
  if (parsed?.isValid()) {
    return parsed.format('E.164');
  }

  if (/^\+[1-9]\d{7,14}$/.test(candidate)) {
    return candidate;
  }

  return null;
}

export function isValidNationalNumber(
  nationalDigits: string,
  country: AuthCountryCode = DEFAULT_AUTH_REGION,
): boolean {
  return toE164FromNational(nationalDigits, country) !== null;
}
