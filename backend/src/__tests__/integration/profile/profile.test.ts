import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';
import * as security from '../../../infrastructure/security';

const USER_ID = 'integration-profile-user';
const AUTH_HEADER = { Authorization: 'Bearer mock-access-token' };

const PUBLIC_USER = {
  id: USER_ID,
  display_name: 'Integration User',
  avatar_colour: '#6366F1',
  avatar_url: null,
  total_events_created: 0,
  total_events_joined: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  push_notifications_enabled: true,
  payment_alert_notifications_enabled: true,
  share_alert_notifications_enabled: true,
};

function mockAuth(): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: USER_ID, email: `${USER_ID}@letssplyt.internal` } },
    error: null,
  });
}

describe('Profile API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('GET /users/me/balance includes guest outstanding in owed_to_you', async () => {
    mockAuth();
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: 'event-balance-1', currency: 'USD' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        { amount_owed: 20, user_id: 'member-other' },
        { amount_owed: 12, user_id: null },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });

    const response = await request(app).get('/api/v1/users/me/balance').set(AUTH_HEADER);

    expect(response.status).toBe(200);
    expect(response.body.owed_to_you).toBe(32);
    expect(response.body.you_owe).toBe(0);
    expect(response.body.net_balance).toBe(32);
    expect(response.body.currency).toBe('USD');
  });

  it('GET /users/me returns user without phone fields', async () => {
    mockAuth();
    mockSupabase.__setMockResultForTable('users', { data: PUBLIC_USER, error: null });

    const response = await request(app).get('/api/v1/users/me').set(AUTH_HEADER);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(PUBLIC_USER);
    expect(response.body).not.toHaveProperty('phone_hash');
    expect(response.body).not.toHaveProperty('phone_encrypted');
  });

  it('runs full handle CRUD cycle with decrypted values', async () => {
    jest.spyOn(security, 'encryptHandle').mockReturnValue('encrypted-blob');
    jest.spyOn(security, 'decryptHandle').mockReturnValue('@myhandle');

    mockAuth();
    mockSupabase.__pushMockResultForTable('user_payment_handles', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('user_payment_handles', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('user_payment_handles', {
      data: { id: 'handle-crud-1', provider: 'venmo', display_order: 0 },
      error: null,
    });

    const createResponse = await request(app)
      .post('/api/v1/users/me/handles')
      .set(AUTH_HEADER)
      .send({ provider: 'venmo', handle_value: '@myhandle' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.id).toBe('handle-crud-1');

    mockAuth();
    mockSupabase.__setMockResultForTable('user_payment_handles', {
      data: [
        {
          id: 'handle-crud-1',
          provider: 'venmo',
          handle_encrypted: 'encrypted-blob',
          display_order: 0,
        },
      ],
      error: null,
    });

    const listResponse = await request(app)
      .get('/api/v1/users/me/handles')
      .set(AUTH_HEADER);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toEqual([
      { id: 'handle-crud-1', provider: 'venmo', handle_value: '@myhandle', display_order: 0 },
    ]);

    mockAuth();
    mockSupabase.__pushMockResultForTable('user_payment_handles', {
      data: { user_id: USER_ID },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('user_payment_handles', { data: null, error: null });

    const deleteResponse = await request(app)
      .delete('/api/v1/users/me/handles/handle-crud-1')
      .set(AUTH_HEADER);

    expect(deleteResponse.status).toBe(204);

    mockAuth();
    mockSupabase.__setMockResultForTable('user_payment_handles', { data: [], error: null });

    const emptyList = await request(app)
      .get('/api/v1/users/me/handles')
      .set(AUTH_HEADER);

    expect(emptyList.status).toBe(200);
    expect(emptyList.body.data).toEqual([]);
  });

  it('DELETE another user handle returns 403', async () => {
    mockAuth();
    mockSupabase.__setMockResultForTable('user_payment_handles', {
      data: { user_id: 'someone-else' },
      error: null,
    });

    const response = await request(app)
      .delete('/api/v1/users/me/handles/other-handle-id')
      .set(AUTH_HEADER);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /users/me/delete returns 409 when you_owe is greater than zero', async () => {
    mockAuth();
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ amount_owed: 1500, event_id: 'owe-event-1' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: 'owe-event-1', payer_id: 'other-payer-id' }],
      error: null,
    });

    const response = await request(app)
      .post('/api/v1/users/me/delete')
      .set(AUTH_HEADER)
      .send({ confirm: true });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('OUTSTANDING_BALANCE');
  });

  it('POST /users/me/delete returns 400 when confirm is missing', async () => {
    mockAuth();

    const response = await request(app)
      .post('/api/v1/users/me/delete')
      .set(AUTH_HEADER)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
