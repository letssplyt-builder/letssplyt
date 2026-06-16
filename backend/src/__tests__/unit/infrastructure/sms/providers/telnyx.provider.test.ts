import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mockTelnyxMessages } from '../../../../mocks/telnyx.mock';
import { TelnyxSMSProvider } from '../../../../../infrastructure/sms/providers/telnyx.provider';

describe('TelnyxSMSProvider', () => {
  const originalEnv = { ...process.env };
  let provider: TelnyxSMSProvider;

  beforeEach(() => {
    process.env.TELNYX_API_KEY = 'KEYtest_telnyx_api_key';
    process.env.TELNYX_FROM_NUMBER = '+14155550001';
    provider = new TelnyxSMSProvider();
    mockTelnyxMessages.send.mockClear();
    mockTelnyxMessages.send.mockResolvedValue({ data: { id: 'telnyx-msg-test-123' } });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sends SMS with from, to, and text', async () => {
    const result = await provider.sendOutboundMessage({
      toE164: '+14155550002',
      body: 'Your code is 123456',
      preferredChannel: 'sms',
    });

    expect(mockTelnyxMessages.send).toHaveBeenCalledWith({
      from: '+14155550001',
      to: '+14155550002',
      text: 'Your code is 123456',
    });
    expect(result).toEqual({ messageId: 'telnyx-msg-test-123', channel: 'sms' });
  });

  it('sends SMS when preferredChannel is whatsapp (Telnyx has no WhatsApp)', async () => {
    const result = await provider.sendOutboundMessage({
      toE164: '+442071234567',
      body: 'Pay your share',
      preferredChannel: 'whatsapp',
    });

    expect(mockTelnyxMessages.send).toHaveBeenCalledWith({
      from: '+14155550001',
      to: '+442071234567',
      text: 'Pay your share',
    });
    expect(result.channel).toBe('sms');
  });

  it('throws when TELNYX_API_KEY is missing', () => {
    delete process.env.TELNYX_API_KEY;

    expect(() => new TelnyxSMSProvider()).toThrow('TELNYX_API_KEY is not configured');
  });

  it('throws when TELNYX_FROM_NUMBER is missing', () => {
    delete process.env.TELNYX_FROM_NUMBER;

    expect(() => new TelnyxSMSProvider()).toThrow('TELNYX_FROM_NUMBER is not configured');
  });

  it('throws when Telnyx returns no message id', async () => {
    mockTelnyxMessages.send.mockResolvedValueOnce({ data: {} });

    await expect(
      provider.sendOutboundMessage({
        toE164: '+14155550002',
        body: 'Hello',
        preferredChannel: 'sms',
      }),
    ).rejects.toThrow('Telnyx messages.send returned no message id');
  });
});
