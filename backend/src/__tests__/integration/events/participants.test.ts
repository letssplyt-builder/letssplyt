import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { hashPhone } from '../../../infrastructure/security';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

const USER_A = 'event-owner-a';
const USER_B = 'event-owner-b';
const EVENT_ID = 'event-33333333-3333-3333-3333-333333333333';
const PARTICIPANT_ID = 'participant-33333333-3333-3333-3333-333333333333';
const GUEST_PII_ID = 'guest-pii-33333333-3333-3333-3333-333333333333';
const AUTH_A = { Authorization: 'Bearer mock-token-a' };
const AUTH_B = { Authorization: 'Bearer mock-token-b' };
const PHONE = '+15005550008';

const EVENT_ROW = {
  id: EVENT_ID,
  payer_id: USER_A,
  title: 'Friday Dinner',
  event_date: null,
  total_amount: null,
  currency: 'USD',
  status: 'open',
  split_mode: null,
  ai_stage: 'none',
  locale: 'en-US',
  locked_at: null,
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

describe('Participants API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('POST manual participant with phone returns 201 and appears in GET /events/:id', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('guest_pii', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('guest_pii', { data: { id: GUEST_PII_ID }, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        display_name: 'Sam',
        join_method: 'manual_phone',
        payment_status: 'pending',
      },
      error: null,
    });

    const createResponse = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/participants/manual`)
      .set(AUTH_A)
      .send({
        display_name: 'Sam',
        phone_e164: PHONE,
        join_method: 'manual_phone',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      id: PARTICIPANT_ID,
      display_name: 'Sam',
      join_method: 'manual_phone',
      payment_status: 'pending',
    });

    const guestInsert = mockSupabase.from.mock.results
      .map((r) => (r.type === 'return' ? r.value : null))
      .flatMap((chain) => {
        if (!chain) return [];
        return (chain as { insert: jest.Mock }).insert.mock.calls;
      })
      .find((call) => (call[0] as { phone_hash?: string }).phone_hash !== undefined);

    expect(guestInsert).toBeTruthy();
    const guestPayload = guestInsert![0] as { phone_hash: string; phone_encrypted: string };
    expect(guestPayload.phone_hash).toBe(hashPhone(PHONE));
    expect(guestPayload.phone_encrypted).not.toContain(PHONE);

    mockAuth(USER_A);
    mockSupabase.__setMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__setMockResultForTable('users', {
      data: { id: USER_A, display_name: 'Alex', avatar_colour: '#6366F1' },
      error: null,
    });
    mockSupabase.__setMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ID,
          display_name: 'Sam',
          join_method: 'manual_phone',
          payment_status: 'pending',
          amount_owed: null,
        },
      ],
      error: null,
    });
    mockSupabase.__setMockResultForTable('event_join_tokens', {
      data: {
        token: 'join-token-abc',
        expires_at: '2026-01-02T00:00:00.000Z',
        is_active: true,
      },
      error: null,
    });

    const detailResponse = await request(app)
      .get(`/api/v1/events/${EVENT_ID}`)
      .set(AUTH_A);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.participants).toHaveLength(1);
    expect(detailResponse.body.participants[0].display_name).toBe('Sam');
    expect(detailResponse.body.participants[0]).not.toHaveProperty('phone_hash');
  });

  it('DELETE pending participant returns 204', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        payment_status: 'pending',
        guest_pii_token: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });

    const response = await request(app)
      .delete(`/api/v1/events/${EVENT_ID}/participants/${PARTICIPANT_ID}`)
      .set(AUTH_A);

    expect(response.status).toBe(204);
  });

  it('DELETE self_reported participant returns 400', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: PARTICIPANT_ID,
        payment_status: 'self_reported',
        guest_pii_token: null,
      },
      error: null,
    });

    const response = await request(app)
      .delete(`/api/v1/events/${EVENT_ID}/participants/${PARTICIPANT_ID}`)
      .set(AUTH_A);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANNOT_REMOVE_ACTIVE_PARTICIPANT');
  });

  it('POST manual participant on locked event returns 400 GROUP_IS_LOCKED', async () => {
    mockAuth(USER_A);
    mockSupabase.__setMockResultForTable('events', {
      data: { ...EVENT_ROW, status: 'locked', locked_at: '2026-01-01T01:00:00.000Z' },
      error: null,
    });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/participants/manual`)
      .set(AUTH_A)
      .send({
        display_name: 'Sam',
        join_method: 'manual_name_only',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GROUP_IS_LOCKED');
  });

  it('POST manual participant as non-owner returns 403', async () => {
    mockAuth(USER_B);
    mockSupabase.__setMockResultForTable('events', { data: EVENT_ROW, error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/participants/manual`)
      .set(AUTH_B)
      .send({
        display_name: 'Sam',
        join_method: 'manual_name_only',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
