import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mockTwilio } from '../../../../mocks/twilio.mock';
import { TwilioSMSProvider } from '../../../../../infrastructure/sms/providers/twilio.provider';

describe('TwilioSMSProvider', () => {
  const originalEnv = { ...process.env };
  let provider: TwilioSMSProvider;

  beforeEach(() => {
    process.env.TWILIO_PHONE_NUMBER = '+15005550006';
    process.env.TWILIO_WHATSAPP_NUMBER = '+15005550006';
    provider = new TwilioSMSProvider();
    mockTwilio.messages.create.mockClear();
    mockTwilio.messages.create.mockResolvedValue({ sid: 'SMtest123', status: 'queued' });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sends SMS for preferredChannel sms', async () => {
    const result = await provider.sendOutboundMessage({
      toE164: '+14155550123',
      body: 'Hello',
      preferredChannel: 'sms',
      statusCallbackUrl: 'https://api.example.com/delivery',
    });

    expect(mockTwilio.messages.create).toHaveBeenCalledWith({
      from: '+15005550006',
      to: '+14155550123',
      body: 'Hello',
      statusCallback: 'https://api.example.com/delivery',
    });
    expect(result).toEqual({ messageId: 'SMtest123', channel: 'sms' });
  });

  it('sends WhatsApp when preferredChannel is whatsapp', async () => {
    const result = await provider.sendOutboundMessage({
      toE164: '+442071234567',
      body: 'Pay your share',
      preferredChannel: 'whatsapp',
    });

    expect(mockTwilio.messages.create).toHaveBeenCalledWith({
      from: 'whatsapp:+15005550006',
      to: 'whatsapp:+442071234567',
      body: 'Pay your share',
    });
    expect(result).toEqual({ messageId: 'SMtest123', channel: 'whatsapp' });
  });

  it('falls back to SMS when WhatsApp send fails', async () => {
    mockTwilio.messages.create
      .mockRejectedValueOnce(new Error('WhatsApp unavailable'))
      .mockResolvedValueOnce({ sid: 'SMfallback', status: 'queued' });

    const result = await provider.sendOutboundMessage({
      toE164: '+442071234567',
      body: 'Fallback body',
      preferredChannel: 'whatsapp',
    });

    expect(mockTwilio.messages.create).toHaveBeenCalledTimes(2);
    expect(mockTwilio.messages.create).toHaveBeenLastCalledWith({
      from: '+15005550006',
      to: '+442071234567',
      body: 'Fallback body',
    });
    expect(result).toEqual({ messageId: 'SMfallback', channel: 'sms' });
  });

  it('omits statusCallback when statusCallbackUrl is not provided', async () => {
    await provider.sendOutboundMessage({
      toE164: '+14155550123',
      body: 'No callback',
      preferredChannel: 'sms',
    });

    expect(mockTwilio.messages.create).toHaveBeenCalledWith({
      from: '+15005550006',
      to: '+14155550123',
      body: 'No callback',
    });
  });

  it('throws when TWILIO_PHONE_NUMBER is missing for SMS', async () => {
    delete process.env.TWILIO_PHONE_NUMBER;

    await expect(
      provider.sendOutboundMessage({
        toE164: '+14155550123',
        body: 'Hello',
        preferredChannel: 'sms',
      }),
    ).rejects.toThrow('TWILIO_PHONE_NUMBER is not configured');
  });
});
