import { describe, expect, it } from '@jest/globals';
import { nationalFromE164, toE164FromPhoneInput } from './phone';

describe('phone utils', () => {
  it('extracts national digits from E.164 for the phone input field', () => {
    expect(nationalFromE164('+15005550006')).toBe('5005550006');
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
});
