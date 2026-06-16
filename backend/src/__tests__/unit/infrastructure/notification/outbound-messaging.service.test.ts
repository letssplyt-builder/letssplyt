import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockTwilio } from '../../../mocks/twilio.mock';
import { resetSMSProvider } from '../../../../infrastructure/sms/factory';
import * as messagingDevBypass from '../../../../infrastructure/notification/messaging-dev-bypass';
import { sendOutboundMessage } from '../../../../infrastructure/notification/outbound-messaging.service';

describe('sendOutboundMessage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetSMSProvider();
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_PHONE_NUMBER = '+15005550006';
    process.env.TWILIO_WHATSAPP_NUMBER = '+15005550006';
    mockTwilio.messages.create.mockClear();
    mockTwilio.messages.create.mockResolvedValue({ sid: 'SMfacade123', status: 'queued' });
    jest.spyOn(messagingDevBypass, 'isMessagingDevBypassEnabled').mockReturnValue(false);
  });

  afterEach(() => {
    resetSMSProvider();
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns dev bypass sid without calling Twilio', async () => {
    jest.spyOn(messagingDevBypass, 'isMessagingDevBypassEnabled').mockReturnValue(true);

    const result = await sendOutboundMessage('+14155550123', 'sms', 'Test body');

    expect(mockTwilio.messages.create).not.toHaveBeenCalled();
    expect(result.messageId).toMatch(/^SMdev/);
    expect(result.channel).toBe('sms');
  });

  it('delegates to TwilioSMSProvider when bypass is disabled', async () => {
    const result = await sendOutboundMessage('+14155550123', 'sms', 'Live body');

    expect(mockTwilio.messages.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ messageId: 'SMfacade123', channel: 'sms' });
  });

  it('does not attach statusCallback when APP_URL is localhost', async () => {
    process.env.APP_URL = 'http://localhost:3000';

    await sendOutboundMessage('+14155550123', 'sms', 'Local body');

    expect(mockTwilio.messages.create).toHaveBeenCalledWith({
      from: '+15005550006',
      to: '+14155550123',
      body: 'Local body',
    });
  });

  it('attaches Twilio delivery callback when APP_URL is public HTTPS', async () => {
    process.env.APP_URL = 'https://staging.letssplyt.app';

    await sendOutboundMessage('+14155550123', 'sms', 'Staging body');

    expect(mockTwilio.messages.create).toHaveBeenCalledWith({
      from: '+15005550006',
      to: '+14155550123',
      body: 'Staging body',
      statusCallback: 'https://staging.letssplyt.app/api/v1/webhooks/twilio/delivery',
    });
  });
});
