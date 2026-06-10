import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../modules/messages/messages.service', () => ({
  buildMessagePreviewsForEvent: jest.fn(),
  loadParticipantItemNames: jest.fn(),
}));

jest.mock('../../../modules/messages/split-image.service', () => ({
  prepareSplitImageMediaUrl: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/opt-out', () => ({
  isPhoneOptedOut: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/twilio-messaging', () => ({
  sendTwilioMessage: jest.fn(),
}));

jest.mock('../../../modules/messages/participant-phone', () => ({
  resolveParticipantPhoneContext: jest.fn(),
}));

import { mockTwilio } from '../../mocks/twilio.mock';
import { mockSupabase } from '../../mocks/supabase.mock';
import { isPhoneOptedOut } from '../../../infrastructure/notification/opt-out';
import { sendTwilioMessage } from '../../../infrastructure/notification/twilio-messaging';
import {
  buildMessagePreviewsForEvent,
  loadParticipantItemNames,
} from '../../../modules/messages/messages.service';
import { resolveParticipantPhoneContext } from '../../../modules/messages/participant-phone';
import { prepareSplitImageMediaUrl } from '../../../modules/messages/split-image.service';
import { sendEventMessages } from '../../../modules/messages/send.service';

const EVENT_ID = 'event-eeee-eeee-eeee-eeee-eeee-eeee-eeee';
const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PARTICIPANT_A = 'part-a-1111-1111-1111-111111111111';
const PARTICIPANT_B = 'part-b-2222-2222-2222-222222222222';
const MEDIA_URL = 'https://test.supabase.co/object/receipts/event/split-part-a.png';

describe('sendEventMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();
    jest.mocked(isPhoneOptedOut).mockResolvedValue(false);
    jest.mocked(sendTwilioMessage).mockResolvedValue({ sid: 'SMtest123', channel: 'sms' });
    jest.mocked(loadParticipantItemNames).mockResolvedValue(new Map());
    jest.mocked(prepareSplitImageMediaUrl).mockResolvedValue(MEDIA_URL);
    jest.mocked(buildMessagePreviewsForEvent).mockResolvedValue([
      {
        participant_id: PARTICIPANT_A,
        display_name: 'Alex',
        amount_owed: 20,
        message_text: 'Hi Alex — your share is $20.00.',
        channel: 'sms',
        payment_links: [],
      },
      {
        participant_id: PARTICIPANT_B,
        display_name: 'Jordan',
        amount_owed: 20,
        message_text: 'Hi Jordan — your share is $20.00.',
        channel: 'whatsapp',
        payment_links: [],
      },
    ]);
    jest.mocked(resolveParticipantPhoneContext).mockImplementation(async (participant) => {
      if (participant.join_method === 'manual_name_only') {
        return { phoneE164: null, resolvedCountry: undefined, channel: 'sms' };
      }
      return {
        phoneE164: '+15005550001',
        resolvedCountry: 'US',
        channel: 'sms',
      };
    });

    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        payer_id: PAYER_ID,
        title: 'Dinner',
        status: 'locked',
        ai_stage: 'messaging',
        currency: 'USD',
        locale: 'en-US',
        total_amount: 40,
      },
      error: null,
    });

    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex Payer' },
      error: null,
    });

    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_A,
          user_id: PAYER_ID,
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
          display_name: 'Alex',
          amount_owed: 20,
        },
        {
          id: PARTICIPANT_B,
          user_id: null,
          guest_pii_token: null,
          country_code: null,
          join_method: 'manual_name_only',
          display_name: 'Jordan',
          amount_owed: 20,
        },
      ],
      error: null,
    });

    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });
  });

  it('calls Twilio for each participant with a phone', async () => {
    const result = await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(sendTwilioMessage).toHaveBeenCalledTimes(1);
    expect(mockTwilio.messages.create).not.toHaveBeenCalled();
    expect(result.sent_count).toBe(1);
    expect(result.skipped_count).toBe(1);
    expect(result.event_status).toBe('sent');
  });

  it('skips opted-out participants', async () => {
    jest.mocked(isPhoneOptedOut).mockResolvedValue(true);

    const result = await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(sendTwilioMessage).not.toHaveBeenCalled();
    expect(result.skipped_count).toBe(2);
    expect(result.results).toEqual(
      expect.arrayContaining([
        { participant_id: PARTICIPANT_A, status: 'skipped_opt_out' },
        { participant_id: PARTICIPANT_B, status: 'skipped_no_phone' },
      ]),
    );
  });

  it('writes notification_log for sent messages', async () => {
    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(mockSupabase.from).toHaveBeenCalledWith('notification_log');
  });

  it('uses SMS channel for US numbers', async () => {
    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(sendTwilioMessage).toHaveBeenCalledWith(
      '+15005550001',
      'sms',
      expect.stringContaining('Alex'),
      MEDIA_URL,
    );
  });

  it('passes mediaUrl to Twilio when split image is available', async () => {
    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(prepareSplitImageMediaUrl).toHaveBeenCalled();
    expect(sendTwilioMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      MEDIA_URL,
    );
  });

  it('uploads split image before Twilio send', async () => {
    const callOrder: string[] = [];
    jest.mocked(prepareSplitImageMediaUrl).mockImplementation(async () => {
      callOrder.push('split-image');
      return MEDIA_URL;
    });
    jest.mocked(sendTwilioMessage).mockImplementation(async () => {
      callOrder.push('twilio');
      return { sid: 'SMtest123', channel: 'sms' };
    });

    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(callOrder).toEqual(['split-image', 'twilio']);
  });

  it('still sends message when split image preparation fails', async () => {
    jest.mocked(prepareSplitImageMediaUrl).mockResolvedValue(undefined);

    const result = await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(result.sent_count).toBe(1);
    expect(sendTwilioMessage).toHaveBeenCalledWith(
      '+15005550001',
      'sms',
      expect.stringContaining('Alex'),
      undefined,
    );
  });

  it('uses WhatsApp channel for international numbers', async () => {
    mockSupabase.__resetMock();
    jest.mocked(buildMessagePreviewsForEvent).mockResolvedValue([
      {
        participant_id: PARTICIPANT_A,
        display_name: 'Alex',
        amount_owed: 20,
        message_text: 'Hi Alex — your share is £20.00.',
        channel: 'whatsapp',
        payment_links: [],
      },
    ]);
    jest.mocked(resolveParticipantPhoneContext).mockResolvedValue({
      phoneE164: '+447700900123',
      resolvedCountry: 'GB',
      channel: 'whatsapp',
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        payer_id: PAYER_ID,
        title: 'Dinner',
        status: 'locked',
        ai_stage: 'messaging',
        currency: 'GBP',
        locale: 'en-GB',
        total_amount: 20,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex Payer' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_A,
          user_id: PAYER_ID,
          guest_pii_token: null,
          country_code: 'GB',
          join_method: 'qr_app',
          display_name: 'Alex',
          amount_owed: 20,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });

    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(sendTwilioMessage).toHaveBeenCalledWith(
      '+447700900123',
      'whatsapp',
      expect.stringContaining('Alex'),
      MEDIA_URL,
    );
  });

  it('updates ai_stage to complete via events update', async () => {
    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(mockSupabase.from).toHaveBeenCalledWith('events');
  });
});
