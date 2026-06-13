import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

const USER_A = 'event-owner-a';
const USER_B = 'event-owner-b';
const EVENT_ID = 'event-22222222-2222-2222-2222-222222222222';
const AUTH_A = { Authorization: 'Bearer mock-token-a' };
const AUTH_B = { Authorization: 'Bearer mock-token-b' };

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

describe('Events API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
    process.env.APP_DOMAIN = 'http://localhost:3000';
  });

  it('POST /events returns 201 with join_url containing token', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', {
      data: { id: EVENT_ID, title: 'Friday Dinner', status: 'open' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: { id: USER_A, display_name: 'Alex' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('event_join_tokens', { data: null, error: null });

    const response = await request(app)
      .post('/api/v1/events')
      .set(AUTH_A)
      .send({ title: 'Friday Dinner' });

    expect(response.status).toBe(201);
    expect(response.body.join_url).toMatch(/\/join\/.+/);
    expect(response.body.id).toBe(EVENT_ID);
    expect(response.body.token_expires_at).toBeTruthy();
  });

  it('GET /events returns paginated list for auth user', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: [
        {
          id: EVENT_ID,
          title: 'Friday Dinner',
          status: 'open',
          total_amount: null,
          created_at: '2026-01-01T00:00:00.000Z',
          payer_id: USER_A,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });

    const response = await request(app).get('/api/v1/events').set(AUTH_A);

    expect(response.status).toBe(200);
    expect(response.body.events).toHaveLength(1);
    expect(response.body.events[0].title).toBe('Friday Dinner');
    expect(response.body.has_more).toBe(false);
  });

  it('GET /events/:id returns participants with display_name only', async () => {
    mockAuth(USER_A);
    mockSupabase.__setMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__setMockResultForTable('users', {
      data: { id: USER_A, display_name: 'Alex', avatar_colour: '#6366F1' },
      error: null,
    });
    mockSupabase.__setMockResultForTable('participants', {
      data: [
        {
          id: 'participant-1',
          display_name: 'Jordan',
          join_method: 'qr_app',
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

    const response = await request(app).get(`/api/v1/events/${EVENT_ID}`).set(AUTH_A);

    expect(response.status).toBe(200);
    expect(response.body.participants[0].display_name).toBe('Jordan');
    expect(response.body.participants[0]).not.toHaveProperty('phone_hash');
    expect(response.body.join_token.join_url).toContain('join-token-abc');
  });

  it('GET /events/:id returns live profile display_name for linked participants', async () => {
    mockAuth(USER_A);
    mockSupabase.__setMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('users', {
      data: { id: USER_A, display_name: 'Alex', avatar_colour: '#6366F1' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: [{ id: USER_B, display_name: 'PQR' }],
      error: null,
    });
    mockSupabase.__setMockResultForTable('participants', {
      data: [
        {
          id: 'participant-1',
          user_id: USER_B,
          display_name: 'xyz',
          join_method: 'qr_app',
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

    const response = await request(app).get(`/api/v1/events/${EVENT_ID}`).set(AUTH_A);

    expect(response.status).toBe(200);
    expect(response.body.participants[0].display_name).toBe('PQR');
  });

  it('POST /events/:id/lock returns 400 when fewer than 2 participants', async () => {
    mockAuth(USER_A);
    mockSupabase.__setMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__setMockResultForTable('participants', {
      data: [{ id: 'participant-1' }],
      error: null,
    });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/lock`)
      .set(AUTH_A);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MINIMUM_PARTICIPANTS_REQUIRED');
  });

  it('POST /events/:id/lock returns 403 for non-owner', async () => {
    mockAuth(USER_B);
    mockSupabase.__setMockResultForTable('events', { data: EVENT_ROW, error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/lock`)
      .set(AUTH_B);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('DELETE /events/:id returns 204 when messages not sent', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: { id: EVENT_ID }, error: null });

    const response = await request(app).delete(`/api/v1/events/${EVENT_ID}`).set(AUTH_A);

    expect(response.status).toBe(204);
  });

  it('DELETE /events/:id returns 409 after messages sent', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        ...EVENT_ROW,
        status: 'sent',
        messages_sent_at: '2026-01-02T00:00:00.000Z',
      },
      error: null,
    });

    const response = await request(app).delete(`/api/v1/events/${EVENT_ID}`).set(AUTH_A);

    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe('EVENT_MESSAGES_ALREADY_SENT');
  });
});
