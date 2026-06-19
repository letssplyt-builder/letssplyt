import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

jest.mock('../../../modules/messages/messages.service', () => ({
  buildMessagePreviewsForEvent: jest.fn(),
  loadParticipantItemNames: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/opt-out', () => ({
  isPhoneOptedOut: jest.fn<() => Promise<boolean>>(),
}));

jest.mock('../../../modules/messages/participant-phone', () => ({
  resolveParticipantPhoneContext: jest.fn<
    () => Promise<{
      phoneE164: string;
      resolvedCountry: string;
      channel: 'sms' | 'whatsapp';
    }>
  >(),
}));

import { isPhoneOptedOut } from '../../../infrastructure/notification/opt-out';
import {
  buildMessagePreviewsForEvent,
  loadParticipantItemNames,
} from '../../../modules/messages/messages.service';
import { resolveParticipantPhoneContext } from '../../../modules/messages/participant-phone';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_USER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EVENT_ID = 'event-eeee-eeee-eeee-eeee-eeee-eeee-eeee';
const PARTICIPANT_MEMBER = 'part-m-1111-1111-1111-111111111111';
const PARTICIPANT_ORGANISER = 'part-o-0000-0000-0000-000000000000';
const AUTH_A = { Authorization: 'Bearer mock-token-a' };

const EVENT_ROW = {
  id: EVENT_ID,
  payer_id: USER_A,
  title: 'Friday Dinner',
  event_date: '2026-06-07',
  total_amount: 40,
  currency: 'USD',
  status: 'locked',
  split_mode: 'equal',
  ai_stage: 'messaging',
  locale: 'en-US',
  locked_at: '2026-06-07T12:00:00.000Z',
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  deleted_at: null,
  tax_amount: 4,
  tip_amount: 6,
  fees_amount: 0,
  receipt_scan_attempted: false,
};

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

describe('Messages send API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    process.env.APP_ENV = 'test';

    jest.mocked(buildMessagePreviewsForEvent).mockResolvedValue([
      {
        participant_id: PARTICIPANT_MEMBER,
        display_name: 'Jordan',
        amount_owed: 40,
        message_text: 'Hi Jordan — your share is $40.00.',
        channel: 'sms',
        payment_links: [],
        breakdown_url: 'https://letssplyt.app/split/testtoken',
      },
    ]);
    jest.mocked(loadParticipantItemNames).mockResolvedValue(
      new Map([[PARTICIPANT_MEMBER, ['Pasta', 'Wine']]]),
    );
    jest.mocked(isPhoneOptedOut).mockResolvedValue(false);
    jest.mocked(resolveParticipantPhoneContext).mockResolvedValue({
      phoneE164: '+15005550001',
      resolvedCountry: 'US',
      channel: 'sms',
    });

    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex Payer' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ORGANISER,
          user_id: USER_A,
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
          display_name: 'Payer',
          amount_owed: 0,
        },
        {
          id: PARTICIPANT_MEMBER,
          user_id: MEMBER_USER,
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
          display_name: 'Jordan',
          amount_owed: 40,
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

  it('POST /events/:id/messages/send returns sent_count without MMS upload', async () => {
    mockAuth(USER_A);

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/messages/send`)
      .set(AUTH_A)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.sent_count).toBe(1);
    expect(response.body.event_status).toBe('sent');

    const receiptsBucket = mockSupabase.storage.from('receipts');
    expect(receiptsBucket.upload).not.toHaveBeenCalled();
  });

  it('POST /events/:id/messages/send returns 401 without auth', async () => {
    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/messages/send`)
      .send({});

    expect(response.status).toBe(401);
  });

  it('POST /events/:id/messages/send skips manual_name_only members', async () => {
    mockAuth(USER_A);

    jest.mocked(buildMessagePreviewsForEvent).mockResolvedValue([
      {
        participant_id: PARTICIPANT_MEMBER,
        display_name: 'Jordan',
        amount_owed: 40,
        message_text: 'Hi Jordan — your share is $40.00.',
        channel: 'sms',
        payment_links: [],
        breakdown_url: 'https://letssplyt.app/split/testtoken',
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

    mockSupabase.__resetMock();
    jest.clearAllMocks();
    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex Payer' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ORGANISER,
          user_id: USER_A,
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
          display_name: 'Payer',
          amount_owed: 0,
        },
        {
          id: PARTICIPANT_MEMBER,
          user_id: MEMBER_USER,
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
          display_name: 'Jordan',
          amount_owed: 40,
        },
        {
          id: 'part-cash-3333-3333-3333-333333333333',
          user_id: null,
          guest_pii_token: null,
          country_code: null,
          join_method: 'manual_name_only',
          display_name: 'Raj',
          amount_owed: 0,
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

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/messages/send`)
      .set(AUTH_A)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.sent_count).toBe(1);
    expect(response.body.skipped_count).toBe(1);
    expect(response.body.results).toEqual(
      expect.arrayContaining([
        {
          participant_id: 'part-cash-3333-3333-3333-333333333333',
          status: 'skipped_no_phone',
        },
      ]),
    );
  });
});
