import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

const TOKEN = 'join-token-app-valid';
const LOCKED_TOKEN = 'join-token-app-locked';
const EVENT_ID = 'event-33333333-3333-3333-3333-333333333333';
const PAYER_ID = 'payer-33333333-3333-3333-3333-333333333333';
const MEMBER_ID = 'member-33333333-3333-3333-3333-333333333333';
const OTHER_USER_ID = 'other-33333333-3333-3333-3333-333333333333';
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const AUTH_MEMBER = { Authorization: 'Bearer mock-token-member' };
const AUTH_OTHER = { Authorization: 'Bearer mock-token-other' };

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

function mockOpenJoinToken(token: string, status: 'open' | 'locked' = 'open'): void {
  mockSupabase.__setMockResultForTable('event_join_tokens', {
    data: {
      id: 'token-row-app',
      event_id: EVENT_ID,
      token,
      expires_at: FUTURE,
      is_active: true,
    },
    error: null,
  });
  mockSupabase.__setMockResultForTable('events', {
    data: {
      id: EVENT_ID,
      title: 'Friday Dinner',
      status,
      payer_id: PAYER_ID,
    },
    error: null,
  });
  mockSupabase.__setMockResultForTable('users', {
    data: { display_name: 'Alex' },
    error: null,
  });
}

describe('App join API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    process.env.APP_ENV = 'test';
  });

  it('GET /api/v1/join/:token/preview → event name and creator', async () => {
    mockOpenJoinToken(TOKEN);

    const response = await request(app).get(`/api/v1/join/${TOKEN}/preview`);

    expect(response.status).toBe(200);
    expect(response.body.eventName).toBe('Friday Dinner');
    expect(response.body.creatorName).toBe('Alex');
    expect(response.body.joinable).toBe(true);
  });

  it('authenticated user joins valid event → 201 participant created', async () => {
    mockAuth(MEMBER_ID);
    mockOpenJoinToken(TOKEN);
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: 'participant-new-1' },
      error: null,
    });
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });

    const response = await request(app)
      .post(`/api/v1/join/${TOKEN}/app-join`)
      .set(AUTH_MEMBER);

    expect(response.status).toBe(201);
    expect(response.body.eventId).toBe(EVENT_ID);
    expect(response.body.eventName).toBe('Friday Dinner');
    expect(response.body.amount_owed).toBeNull();
    expect(response.body.participantId).toBe('participant-new-1');
  });

  it('join locked event → 400 GROUP_IS_LOCKED', async () => {
    mockAuth(MEMBER_ID);
    mockOpenJoinToken(LOCKED_TOKEN, 'locked');
    mockSupabase.__setMockResultForTable('participants', {
      data: null,
      error: null,
    });

    const response = await request(app)
      .post(`/api/v1/join/${LOCKED_TOKEN}/app-join`)
      .set(AUTH_MEMBER);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GROUP_IS_LOCKED');
  });

  it('join twice with same token → 409 ALREADY_JOINED', async () => {
    mockAuth(MEMBER_ID);
    mockOpenJoinToken(TOKEN);
    mockSupabase.__setMockResultForTable('participants', {
      data: { id: 'participant-existing' },
      error: null,
    });

    const response = await request(app)
      .post(`/api/v1/join/${TOKEN}/app-join`)
      .set(AUTH_MEMBER);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ALREADY_JOINED');
  });

  it('join another user event → 201 (any authenticated user can join)', async () => {
    mockAuth(OTHER_USER_ID);
    mockOpenJoinToken(TOKEN);
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: 'participant-other-1' },
      error: null,
    });
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });

    const response = await request(app)
      .post(`/api/v1/join/${TOKEN}/app-join`)
      .set(AUTH_OTHER);

    expect(response.status).toBe(201);
    expect(response.body.participantId).toBe('participant-other-1');
  });
});
