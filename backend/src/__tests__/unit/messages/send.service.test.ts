import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../modules/messages/messages.service', () => ({
  buildMessagePreviewsForEvent: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/opt-out', () => ({
  isPhoneOptedOut: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/outbound-messaging.service', () => ({
  sendOutboundMessage: jest.fn(),
}));

jest.mock('../../../modules/messages/participant-phone', () => ({
  resolveParticipantPhoneContext: jest.fn(),
}));

import { mockTwilio } from '../../mocks/twilio.mock';
import { mockSupabase } from '../../mocks/supabase.mock';
import { isPhoneOptedOut } from '../../../infrastructure/notification/opt-out';
import { sendOutboundMessage } from '../../../infrastructure/notification/outbound-messaging.service';
import { buildMessagePreviewsForEvent } from '../../../modules/messages/messages.service';
import { resolveParticipantPhoneContext } from '../../../modules/messages/participant-phone';
import { sendEventMessages } from '../../../modules/messages/send.service';

const EVENT_ID = 'event-eeee-eeee-eeee-eeee-eeee-eeee-eeee';
const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PARTICIPANT_ORGANISER = 'part-o-0000-0000-0000-000000000000';
const PARTICIPANT_A = 'part-a-1111-1111-1111-111111111111';
const PARTICIPANT_B = 'part-b-2222-2222-2222-222222222222';
const BREAKDOWN_URL = 'https://letssplyt.app/split/testtoken123';

describe('sendEventMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();
    jest.mocked(isPhoneOptedOut).mockResolvedValue(false);
    jest.mocked(sendOutboundMessage).mockResolvedValue({ messageId: 'SMtest123', channel: 'sms' });
    jest.mocked(buildMessagePreviewsForEvent).mockResolvedValue([
      {
        participant_id: PARTICIPANT_A,
        display_name: 'Alex',
        amount_owed: 20,
        message_text: `Hi Alex — your share is $20.00.\n\nSee full split: ${BREAKDOWN_URL}`,
        channel: 'sms',
        payment_links: [],
        breakdown_url: BREAKDOWN_URL,
      },
      {
        participant_id: PARTICIPANT_B,
        display_name: 'Jordan',
        amount_owed: 20,
        message_text: 'Hi Jordan — your share is $20.00.',
        channel: 'whatsapp',
        payment_links: [],
        breakdown_url: BREAKDOWN_URL,
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

    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ORGANISER,
          user_id: PAYER_ID,
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
          display_name: 'Payer',
          amount_owed: 20,
        },
        {
          id: PARTICIPANT_A,
          user_id: MEMBER_USER_ID,
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

  it('calls outbound messaging for each participant with a phone', async () => {
    const result = await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(sendOutboundMessage).toHaveBeenCalledTimes(1);
    expect(mockTwilio.messages.create).not.toHaveBeenCalled();
    expect(result.sent_count).toBe(1);
    expect(result.skipped_count).toBe(1);
    expect(result.event_status).toBe('sent');
    expect(result.results).toEqual(
      expect.arrayContaining([
        { participant_id: PARTICIPANT_B, status: 'skipped_no_phone' },
      ]),
    );
  });

  it('records skipped_no_phone when preview is missing for name-only members', async () => {
    jest.mocked(buildMessagePreviewsForEvent).mockResolvedValue([
      {
        participant_id: PARTICIPANT_A,
        display_name: 'Alex',
        amount_owed: 20,
        message_text: `Hi Alex — your share is $20.00.\n\nSee full split: ${BREAKDOWN_URL}`,
        channel: 'sms',
        payment_links: [],
        breakdown_url: BREAKDOWN_URL,
      },
    ]);

    const result = await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(result.results).toContainEqual({
      participant_id: PARTICIPANT_B,
      status: 'skipped_no_phone',
    });
    expect(sendOutboundMessage).toHaveBeenCalledTimes(1);
  });

  it('skips opted-out participants', async () => {
    jest.mocked(isPhoneOptedOut).mockResolvedValue(true);

    const result = await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(sendOutboundMessage).not.toHaveBeenCalled();
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

  it('sends SMS body without MMS mediaUrl', async () => {
    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(sendOutboundMessage).toHaveBeenCalledWith(
      '+15005550001',
      'sms',
      expect.stringContaining('Alex'),
    );
    expect(sendOutboundMessage).toHaveBeenCalledWith(
      '+15005550001',
      'sms',
      expect.stringContaining('See full split'),
    );
    expect(jest.mocked(sendOutboundMessage).mock.calls[0]?.length).toBe(3);
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
        breakdown_url: BREAKDOWN_URL,
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
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ORGANISER,
          user_id: PAYER_ID,
          guest_pii_token: null,
          country_code: 'GB',
          join_method: 'qr_app',
          display_name: 'Payer',
          amount_owed: 0,
        },
        {
          id: PARTICIPANT_A,
          user_id: MEMBER_USER_ID,
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

    expect(sendOutboundMessage).toHaveBeenCalledWith(
      '+447700900123',
      'whatsapp',
      expect.stringContaining('Alex'),
    );
  });

  it('updates ai_stage to complete via events update', async () => {
    await sendEventMessages(PAYER_ID, EVENT_ID);

    expect(mockSupabase.from).toHaveBeenCalledWith('events');
  });

  describe('regression: manual_name_only members must never receive SMS', () => {
    it('does not send SMS when a stale preview exists for a name-only member', async () => {
      const result = await sendEventMessages(PAYER_ID, EVENT_ID);

      expect(sendOutboundMessage).toHaveBeenCalledTimes(1);
      expect(
        jest.mocked(sendOutboundMessage).mock.calls.some(
          ([phone, , body]) =>
            phone === '+15005550001' && typeof body === 'string' && body.includes('Jordan'),
        ),
      ).toBe(false);
      expect(result.results).toContainEqual({
        participant_id: PARTICIPANT_B,
        status: 'skipped_no_phone',
      });
    });

    it('only attempts outbound delivery for the phone-backed participant', async () => {
      await sendEventMessages(PAYER_ID, EVENT_ID);

      expect(sendOutboundMessage).toHaveBeenCalledTimes(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_log');
      expect(
        jest.mocked(sendOutboundMessage).mock.calls.every(([phone]) => phone === '+15005550001'),
      ).toBe(true);
    });

    it('still completes the event when every non-organiser is name-only', async () => {
      mockSupabase.__resetMock();
      jest.mocked(buildMessagePreviewsForEvent).mockResolvedValue([]);
      jest.mocked(resolveParticipantPhoneContext).mockResolvedValue({
        phoneE164: null,
        resolvedCountry: undefined,
        channel: 'sms',
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
          total_amount: 20,
        },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', {
        data: [
          {
            id: PARTICIPANT_ORGANISER,
            user_id: PAYER_ID,
            guest_pii_token: null,
            country_code: 'US',
            join_method: 'qr_app',
            display_name: 'Payer',
            amount_owed: 0,
          },
          {
            id: PARTICIPANT_B,
            user_id: null,
            guest_pii_token: null,
            country_code: null,
            join_method: 'manual_name_only',
            display_name: 'Raj',
            amount_owed: 20,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('events', {
        data: [{ id: EVENT_ID }],
        error: null,
      });

      const result = await sendEventMessages(PAYER_ID, EVENT_ID);

      expect(sendOutboundMessage).not.toHaveBeenCalled();
      expect(result.sent_count).toBe(0);
      expect(result.skipped_count).toBe(1);
      expect(result.results).toEqual([
        { participant_id: PARTICIPANT_B, status: 'skipped_no_phone' },
      ]);
      expect(result.event_status).toBe('sent');
    });
  });
});
