import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  checkOtpRequestRate,
  recordFailedOtpVerify,
  resetOtpRateLimitState,
} from '../../../infrastructure/otp-rate-counter';

describe('otp-rate-counter', () => {
  beforeEach(() => {
    resetOtpRateLimitState();
    process.env.APP_ENV = 'test';
    process.env.OTP_DEV_BYPASS = 'false';
    process.env.TWILIO_USE_LIVE_VERIFY = 'true';
  });

  afterEach(() => {
    resetOtpRateLimitState();
  });

  it('allows up to maxPerHour OTP requests per phone in test memory mode', async () => {
    const phoneHash = 'hash-request-limit';

    for (let i = 0; i < 5; i += 1) {
      await expect(checkOtpRequestRate(phoneHash)).resolves.toBeUndefined();
    }

    await expect(checkOtpRequestRate(phoneHash)).rejects.toMatchObject({
      message: 'OTP rate limited for this phone',
    });
  });

  it('prunes expired memory counters instead of growing unbounded', async () => {
    const phoneHash = 'hash-prune-test';
    const realNow = Date.now;
    let now = realNow();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    for (let i = 0; i < 5; i += 1) {
      await checkOtpRequestRate(phoneHash);
    }

    now += 61 * 60 * 1000;
    await expect(checkOtpRequestRate(phoneHash)).resolves.toBeUndefined();

    Date.now = realNow;
  });

  it('limits failed verify attempts per phone', async () => {
    const phoneHash = 'hash-verify-limit';

    for (let i = 0; i < 5; i += 1) {
      await expect(recordFailedOtpVerify(phoneHash)).resolves.toBeUndefined();
    }

    await expect(recordFailedOtpVerify(phoneHash)).rejects.toMatchObject({
      message: 'Too many verification attempts',
    });
  });

  it('skips counters when OTP dev bypass is enabled', async () => {
    process.env.OTP_DEV_BYPASS = 'true';
    const phoneHash = 'hash-bypass';

    for (let i = 0; i < 10; i += 1) {
      await expect(checkOtpRequestRate(phoneHash)).resolves.toBeUndefined();
      await expect(recordFailedOtpVerify(phoneHash)).resolves.toBeUndefined();
    }
  });
});
