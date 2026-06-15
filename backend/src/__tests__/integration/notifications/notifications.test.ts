import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

const USER_ID = 'integration-notifications-user';
const AUTH_HEADER = { Authorization: 'Bearer mock-access-token' };
const NOTIFICATION_ID = 'notif-integration-001';
const EVENT_ID = 'event-integration-001';

function mockAuth(): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: USER_ID, email: `${USER_ID}@letssplyt.internal` } },
    error: null,
  });
}

const SAMPLE_ROWS = [
  {
    id: NOTIFICATION_ID,
    type: 'share_ready',
    title: 'Your share is ready',
    body: 'Your share for Dinner is ready to view.',
    event_id: EVENT_ID,
    read_at: null,
    created_at: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'notif-integration-002',
    type: 'nudge',
    title: 'Friendly reminder',
    body: 'Your share for Lunch is $12.00.',
    event_id: EVENT_ID,
    read_at: null,
    created_at: '2026-06-01T11:00:00.000Z',
  },
];

describe('Notifications inbox API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('GET /users/me/notifications returns visible rows with is_read and unread_count', async () => {
    mockAuth();
    mockSupabase.__setMockResultForTable('user_notifications', {
      data: SAMPLE_ROWS,
      error: null,
    });

    const response = await request(app)
      .get('/api/v1/users/me/notifications')
      .set(AUTH_HEADER);

    expect(response.status).toBe(200);
    expect(response.body.unread_count).toBe(2);
    expect(response.body.notifications).toHaveLength(2);
    expect(response.body.notifications[0]).toMatchObject({
      id: NOTIFICATION_ID,
      is_read: false,
      event_id: EVENT_ID,
    });
  });

  it('GET /users/me/notifications/unread-count returns badge count', async () => {
    mockAuth();
    mockSupabase.__setMockResultForTable('user_notifications', {
      data: null,
      error: null,
      count: 3,
    });

    const response = await request(app)
      .get('/api/v1/users/me/notifications/unread-count')
      .set(AUTH_HEADER);

    expect(response.status).toBe(200);
    expect(response.body.unread_count).toBe(3);
  });

  it('PATCH /users/me/notifications/:id/read marks read and returns updated unread_count', async () => {
    mockAuth();
    mockSupabase.__pushMockResultForTable('user_notifications', {
      data: { id: NOTIFICATION_ID },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('user_notifications', {
      data: null,
      error: null,
      count: 1,
    });

    const response = await request(app)
      .patch(`/api/v1/users/me/notifications/${NOTIFICATION_ID}/read`)
      .set(AUTH_HEADER)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.unread_count).toBe(1);
  });

  it('PATCH /users/me/notifications/:id/read returns 404 when already read', async () => {
    mockAuth();
    mockSupabase.__setMockResultForTable('user_notifications', {
      data: null,
      error: null,
    });

    const response = await request(app)
      .patch(`/api/v1/users/me/notifications/${NOTIFICATION_ID}/read`)
      .set(AUTH_HEADER)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.error?.code).toBe('NOT_FOUND');
  });
});
