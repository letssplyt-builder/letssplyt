import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

jest.mock('../../../infrastructure/notification/opt-out', () => ({
  isPhoneOptedOut: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/twilio-messaging', () => ({
  sendTwilioMessage: jest.fn(),
}));

jest.mock('../../../modules/messages/participant-phone', () => ({
  resolveParticipantPhoneContext: jest.fn(),
}));

import { isPhoneOptedOut } from '../../../infrastructure/notification/opt-out';
import { sendTwilioMessage } from '../../../infrastructure/notification/twilio-messaging';
import { resolveParticipantPhoneContext } from '../../../modules/messages/participant-phone';

const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PARTICIPANT_USER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EVENT_ID = 'event-settle-1111-1111-1111-111111111111';
const PARTICIPANT_ID = 'part-settle-1111-1111-1111-111111111111';
const PARTICIPANT_ID_OPTED = 'part-settle-2222-2222-2222-222222222222';
const AUTH_PAYER = { Authorization: 'Bearer mock-token-payer' };
const AUTH_PARTICIPANT = { Authorization: 'Bearer mock-token-participant' };

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

describe('Settlement API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    jest.mocked(isPhoneOptedOut).mockResolvedValue(false);
    jest.mocked(sendTwilioMessage).mockResolvedValue({ sid: 'SMtest', channel: 'sms' });
    jest.mocked(resolveParticipantPhoneContext).mockResolvedValue({
      phoneE164: '+15005550002',
      resolvedCountry: 'US',
      channel: 'sms',
    });
  });

  it('full lifecycle: pending → self_reported → confirmed', async () => {
    mockAuth(PARTICIPANT_USER);
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        event_id: EVENT_ID,
        user_id: PARTICIPANT_USER,
        display_name: 'Jordan',
        amount_owed: 30,
        payment_status: 'pending',
        disputed_count: 0,
        last_nudged_at: null,
        nudge_count: 0,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'manual_phone',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 30 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const selfReport = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/self-report`)
      .set(AUTH_PARTICIPANT)
      .send({ payment_method: 'venmo' });

    expect(selfReport.status).toBe(200);
    expect(selfReport.body.payment_status).toBe('self_reported');

    mockAuth(PAYER_ID);
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        payer_id: PAYER_ID,
        title: 'Dinner',
        status: 'sent',
        currency: 'USD',
        locale: 'en-US',
        deleted_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        event_id: EVENT_ID,
        user_id: PARTICIPANT_USER,
        display_name: 'Jordan',
        amount_owed: 30,
        payment_status: 'self_reported',
        disputed_count: 0,
        last_nudged_at: null,
        nudge_count: 0,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'manual_phone',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 30 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ id: PARTICIPANT_ID, payment_status: 'confirmed', amount_owed: 30 }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const confirm = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/confirm`)
      .set(AUTH_PAYER)
      .send();

    expect(confirm.status).toBe(200);
    expect(confirm.body.payment_status).toBe('confirmed');
    expect(confirm.body.event_fully_settled).toBe(true);
  });

  it('full lifecycle: pending → self_reported → disputed → pending', async () => {
    mockAuth(PARTICIPANT_USER);
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        event_id: EVENT_ID,
        user_id: PARTICIPANT_USER,
        display_name: 'Jordan',
        amount_owed: 20,
        payment_status: 'pending',
        disputed_count: 0,
        last_nudged_at: null,
        nudge_count: 0,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'manual_phone',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 20 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    await request(app)
      .post(`/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/self-report`)
      .set(AUTH_PARTICIPANT)
      .send({ payment_method: 'cash' });

    mockAuth(PAYER_ID);
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        payer_id: PAYER_ID,
        title: 'Dinner',
        status: 'sent',
        currency: 'USD',
        locale: 'en-US',
        deleted_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        event_id: EVENT_ID,
        user_id: PARTICIPANT_USER,
        display_name: 'Jordan',
        amount_owed: 20,
        payment_status: 'self_reported',
        disputed_count: 0,
        last_nudged_at: null,
        nudge_count: 0,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'manual_phone',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const dispute = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/dispute`)
      .set(AUTH_PAYER)
      .send({ note: 'Amount looks wrong' });

    expect(dispute.status).toBe(200);
    expect(dispute.body.payment_status).toBe('pending');
    expect(dispute.body.disputed_count).toBe(1);
  });

  it('returns 429 on second nudge within 48h', async () => {
    mockAuth(PAYER_ID);
    const recent = new Date().toISOString();
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        payer_id: PAYER_ID,
        title: 'Dinner',
        status: 'sent',
        currency: 'USD',
        locale: 'en-US',
        deleted_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        event_id: EVENT_ID,
        user_id: PARTICIPANT_USER,
        display_name: 'Jordan',
        amount_owed: 15,
        payment_status: 'pending',
        disputed_count: 0,
        last_nudged_at: recent,
        nudge_count: 1,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'manual_phone',
      },
      error: null,
    });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/messages/nudge/${PARTICIPANT_ID}`)
      .set(AUTH_PAYER)
      .send();

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('NUDGE_COOLDOWN');
    expect(response.body.error.details.next_nudge_available_at).toBeTruthy();
  });

  it('event settles when all owing participants are confirmed or opted_out', async () => {
    mockAuth(PAYER_ID);
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        payer_id: PAYER_ID,
        title: 'Dinner',
        status: 'sent',
        currency: 'USD',
        locale: 'en-US',
        deleted_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        event_id: EVENT_ID,
        user_id: PARTICIPANT_USER,
        display_name: 'Jordan',
        amount_owed: 25,
        payment_status: 'self_reported',
        disputed_count: 0,
        last_nudged_at: null,
        nudge_count: 0,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'manual_phone',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 25 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        { id: PARTICIPANT_ID, payment_status: 'confirmed', amount_owed: 25 },
        { id: PARTICIPANT_ID_OPTED, payment_status: 'opted_out', amount_owed: 10 },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const confirm = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/confirm`)
      .set(AUTH_PAYER)
      .send();

    expect(confirm.status).toBe(200);
    expect(confirm.body.event_fully_settled).toBe(true);
  });

  it('participant cannot confirm own payment (403)', async () => {
    mockAuth(PARTICIPANT_USER);
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        payer_id: PAYER_ID,
        title: 'Dinner',
        status: 'sent',
        currency: 'USD',
        locale: 'en-US',
        deleted_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        event_id: EVENT_ID,
        user_id: PARTICIPANT_USER,
        display_name: 'Jordan',
        amount_owed: 30,
        payment_status: 'self_reported',
        disputed_count: 0,
        last_nudged_at: null,
        nudge_count: 0,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'manual_phone',
      },
      error: null,
    });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/settlement/${PARTICIPANT_ID}/confirm`)
      .set(AUTH_PARTICIPANT)
      .send();

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
