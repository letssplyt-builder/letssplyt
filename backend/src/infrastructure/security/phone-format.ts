import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalize a phone string to E.164 for SMS providers.
 * Supabase Auth often stores `user.phone` without a leading `+`.
 */
export function formatPhoneE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  let parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid() && !trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits) {
      parsed = parsePhoneNumberFromString(`+${digits}`);
    }
  }
  if (!parsed?.isValid()) {
    parsed = parsePhoneNumberFromString(trimmed, 'US');
  }
  if (!parsed?.isValid()) {
    return null;
  }

  return parsed.format('E.164');
}
