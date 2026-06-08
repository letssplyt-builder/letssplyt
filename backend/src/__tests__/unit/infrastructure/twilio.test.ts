import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getVerifyServiceSid,
  TWILIO_TEST_VERIFY_SERVICE_SID,
} from '../../../infrastructure/twilio';

describe('getVerifyServiceSid', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VAlivefromdopplerxxxxxxxxxxxxxxx';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns magic test SID in development by default', () => {
    process.env.APP_ENV = 'development';
    delete process.env.TWILIO_USE_LIVE_VERIFY;
    expect(getVerifyServiceSid()).toBe(TWILIO_TEST_VERIFY_SERVICE_SID);
  });

  it('returns Doppler SID in staging', () => {
    process.env.APP_ENV = 'staging';
    expect(getVerifyServiceSid()).toBe('VAlivefromdopplerxxxxxxxxxxxxxxx');
  });

  it('returns magic test SID when APP_ENV is unset (local dev default)', () => {
    delete process.env.APP_ENV;
    delete process.env.TWILIO_USE_LIVE_VERIFY;
    expect(getVerifyServiceSid()).toBe(TWILIO_TEST_VERIFY_SERVICE_SID);
  });

  it('returns Doppler SID when TWILIO_USE_LIVE_VERIFY=true in development', () => {
    process.env.APP_ENV = 'development';
    process.env.TWILIO_USE_LIVE_VERIFY = 'true';
    expect(getVerifyServiceSid()).toBe('VAlivefromdopplerxxxxxxxxxxxxxxx');
  });
});
