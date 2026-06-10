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
const EVENT_ID = 'event-eeee-eeee-eeee-eeee-eeee-eeee-eeee';
const PARTICIPANT_A = 'part-a-1111-1111-1111-111111111111';
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
        participant_id: PARTICIPANT_A,
        display_name: 'Alex',
        amount_owed: 40,
        message_text: 'Hi Alex — your share is $40.00.',
        channel: 'sms',
        payment_links: [],
      },
    ]);
    jest.mocked(loadParticipantItemNames).mockResolvedValue(
      new Map([[PARTICIPANT_A, ['Pasta', 'Wine']]]),
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
          id: PARTICIPANT_A,
          user_id: USER_A,
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
          display_name: 'Alex',
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

  it('POST /events/:id/messages/send uploads split image and returns sent_count', async () => {
    mockAuth(USER_A);

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/messages/send`)
      .set(AUTH_A)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.sent_count).toBe(1);
    expect(response.body.event_status).toBe('sent');

    const receiptsBucket = mockSupabase.storage.from('receipts');
    expect(receiptsBucket.upload).toHaveBeenCalledWith(
      `${EVENT_ID}/split-${PARTICIPANT_A}.png`,
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/png', upsert: true }),
    );
    expect(receiptsBucket.createSignedUrl).toHaveBeenCalledWith(
      `${EVENT_ID}/split-${PARTICIPANT_A}.png`,
      86400,
    );
  });

  it('POST /events/:id/messages/send returns 401 without auth', async () => {
    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/messages/send`)
      .send({});

    expect(response.status).toBe(401);
  });
});
