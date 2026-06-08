import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { isOtpDevBypassEnabled } from '../../../modules/auth/otp-dev-bypass';

describe('isOtpDevBypassEnabled', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_ENV = 'development';
    delete process.env.OTP_DEV_BYPASS;
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns false in production even with OTP_DEV_BYPASS', () => {
    process.env.APP_ENV = 'production';
    process.env.OTP_DEV_BYPASS = 'true';
    expect(isOtpDevBypassEnabled()).toBe(false);
  });

  it('returns true when OTP_DEV_BYPASS=true in development', () => {
    process.env.OTP_DEV_BYPASS = 'true';
    expect(isOtpDevBypassEnabled()).toBe(true);
  });

  it('returns true for placeholder ACtest credentials in development', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    expect(isOtpDevBypassEnabled()).toBe(true);
  });

  it('defaults to bypass in development (Twilio Verify rejects test credentials)', () => {
    expect(isOtpDevBypassEnabled()).toBe(true);
  });

  it('returns false when OTP_DEV_BYPASS=false in development', () => {
    process.env.OTP_DEV_BYPASS = 'false';
    expect(isOtpDevBypassEnabled()).toBe(false);
  });

  it('returns false when TWILIO_USE_LIVE_VERIFY=true in development', () => {
    process.env.TWILIO_USE_LIVE_VERIFY = 'true';
    expect(isOtpDevBypassEnabled()).toBe(false);
  });

  it('returns false in staging', () => {
    process.env.APP_ENV = 'staging';
    expect(isOtpDevBypassEnabled()).toBe(false);
  });
});
