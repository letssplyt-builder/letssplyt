import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createSMSProvider, resetSMSProvider } from '../../../../infrastructure/sms/factory';
import { TwilioSMSProvider } from '../../../../infrastructure/sms/providers/twilio.provider';

describe('createSMSProvider', () => {
  const originalSmsProvider = process.env.SMS_PROVIDER;

  beforeEach(() => {
    resetSMSProvider();
  });

  afterEach(() => {
    resetSMSProvider();
    if (originalSmsProvider === undefined) {
      delete process.env.SMS_PROVIDER;
    } else {
      process.env.SMS_PROVIDER = originalSmsProvider;
    }
  });

  it('returns TwilioSMSProvider when SMS_PROVIDER is not set', () => {
    delete process.env.SMS_PROVIDER;
    const provider = createSMSProvider();
    expect(provider).toBeInstanceOf(TwilioSMSProvider);
    expect(provider.name).toBe('twilio');
  });

  it('returns TwilioSMSProvider when SMS_PROVIDER=twilio', () => {
    process.env.SMS_PROVIDER = 'twilio';
    const provider = createSMSProvider();
    expect(provider).toBeInstanceOf(TwilioSMSProvider);
  });

  it('throws when SMS_PROVIDER=telnyx before E11-S05', () => {
    process.env.SMS_PROVIDER = 'telnyx';
    expect(() => createSMSProvider()).toThrow(/E11-S05/);
  });

  it('throws when SMS_PROVIDER is unknown', () => {
    process.env.SMS_PROVIDER = 'carrier-pigeon';
    expect(() => createSMSProvider()).toThrow(/Unknown SMS_PROVIDER/);
  });

  it('returns the same singleton on repeated calls', () => {
    const first = createSMSProvider();
    const second = createSMSProvider();
    expect(first).toBe(second);
  });

  it('returns a new instance after resetSMSProvider', () => {
    const first = createSMSProvider();
    resetSMSProvider();
    const second = createSMSProvider();
    expect(first).not.toBe(second);
  });
});
