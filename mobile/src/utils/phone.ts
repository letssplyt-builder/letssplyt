import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Strips a leading country code for display in the national-number phone field.
 */
export function nationalFromE164(e164: string, defaultCountry: 'US' = 'US'): string {
  const trimmed = e164.trim();
  if (!trimmed) return '';

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (parsed?.isValid()) {
    return parsed.nationalNumber.toString();
  }

  if (trimmed.startsWith('+1')) {
    return trimmed.slice(2).replace(/\D/g, '');
  }

  return trimmed.replace(/^\+/, '').replace(/\D/g, '');
}

/**
 * Normalises phone input from react-native-phone-number-input to strict E.164.
 * Fixes double-prefix bugs when an E.164 value was pasted into the national field.
 */
export function toE164FromPhoneInput(
  formattedNumber: string,
  defaultCountry: 'US' = 'US',
): string | null {
  let candidate = formattedNumber.trim();

  // e.g. +1+15551234567 when E.164 was stored in the national field
  const secondPlus = candidate.indexOf('+', 1);
  if (secondPlus !== -1) {
    candidate = candidate.slice(secondPlus);
  }

  const parsed = parsePhoneNumberFromString(candidate, defaultCountry);
  if (parsed?.isValid()) {
    return parsed.format('E.164');
  }

  // Phone input uses google-libphonenumber; fall back to E.164 shape for backend validation.
  if (/^\+[1-9]\d{7,14}$/.test(candidate)) {
    return candidate;
  }

  return null;
}
