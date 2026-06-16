import { describe, expect, it } from '@jest/globals';
import { formatPhoneE164 } from '../../../../infrastructure/security/phone-format';

describe('formatPhoneE164', () => {
  it('formats standard E.164 input', () => {
    expect(formatPhoneE164('+14155550123')).toBe('+14155550123');
  });

  it('adds + prefix when Supabase Auth omits it', () => {
    expect(formatPhoneE164('14155550123')).toBe('+14155550123');
  });

  it('normalizes spaced US numbers', () => {
    expect(formatPhoneE164('+1 415-555-0123')).toBe('+14155550123');
  });

  it('returns null for invalid numbers', () => {
    expect(formatPhoneE164('not-a-phone')).toBeNull();
    expect(formatPhoneE164('')).toBeNull();
  });
});
