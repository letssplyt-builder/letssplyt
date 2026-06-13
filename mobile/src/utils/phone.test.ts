import { describe, expect, it } from '@jest/globals';
import {
  countryFromE164,
  DEFAULT_AUTH_REGION,
  formatUsNationalDisplay,
  handleUsNationalPhoneInput,
  nationalFromE164,
  SUPPORTED_AUTH_REGIONS,
  toE164FromNational,
  toE164FromPhoneInput,
} from './phone';

describe('phone utils', () => {
  it('MVP supports US region only', () => {
    expect(SUPPORTED_AUTH_REGIONS).toEqual(['US']);
    expect(DEFAULT_AUTH_REGION).toBe('US');
  });

  it('maps unknown international numbers to default US region in MVP', () => {
    expect(countryFromE164('+919876543210')).toBe('US');
    expect(countryFromE164('+15005550006')).toBe('US');
  });

  it('extracts national digits from US E.164', () => {
    expect(nationalFromE164('+15005550006')).toBe('5005550006');
  });

  it('builds E.164 from US national digits', () => {
    expect(toE164FromNational('5005550006')).toBe('+15005550006');
  });

  it('normalises formatted output to E.164', () => {
    expect(toE164FromPhoneInput('+15005550006')).toBe('+15005550006');
  });

  it('fixes double country prefix from E.164 pasted into national field', () => {
    expect(toE164FromPhoneInput('+1+15005550006')).toBe('+15005550006');
  });

  it('falls back to E.164 regex when libphonenumber rejects but shape is valid', () => {
    expect(toE164FromPhoneInput('+15559999999')).toBe('+15559999999');
  });

  it('formats US national digits as (xxx) - xxx - xxxx', () => {
    expect(formatUsNationalDisplay('5005550006')).toBe('(500) - 555 - 0006');
    expect(handleUsNationalPhoneInput('5005550006123')).toBe('(500) - 555 - 0006');
  });
});
