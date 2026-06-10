import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { isMessagingDevBypassEnabled } from '../../../infrastructure/notification/messaging-dev-bypass';

describe('isMessagingDevBypassEnabled', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.MESSAGING_DEV_BYPASS;
    delete process.env.TWILIO_USE_LIVE_MESSAGING;
    delete process.env.TWILIO_ACCOUNT_SID;
    process.env.APP_ENV = 'development';
  });

  afterEach(() => {
    process.env = env;
  });

  it('defaults to bypass in development', () => {
    expect(isMessagingDevBypassEnabled()).toBe(true);
  });

  it('returns false when TWILIO_USE_LIVE_MESSAGING=true', () => {
    process.env.TWILIO_USE_LIVE_MESSAGING = 'true';
    expect(isMessagingDevBypassEnabled()).toBe(false);
  });

  it('returns false in production', () => {
    process.env.APP_ENV = 'production';
    expect(isMessagingDevBypassEnabled()).toBe(false);
  });
});
