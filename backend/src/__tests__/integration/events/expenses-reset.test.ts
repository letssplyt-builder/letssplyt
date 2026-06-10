import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

const USER_A = 'event-owner-a';
const USER_B = 'event-owner-b';
const EVENT_ID = 'event-22222222-2222-2222-2222-222222222222';
const AUTH_A = { Authorization: 'Bearer mock-token-a' };
const AUTH_B = { Authorization: 'Bearer mock-token-b' };

const LOCKED_CALCULATED_EVENT = {
  id: EVENT_ID,
  payer_id: USER_A,
  title: 'Friday Dinner',
  event_date: null,
  total_amount: 120,
  currency: 'USD',
  status: 'locked',
  split_mode: 'equal',
  ai_stage: 'calculated',
  locale: 'en-US',
  locked_at: '2026-01-01T01:00:00.000Z',
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  tax_amount: null,
  tip_amount: null,
  fees_amount: null,
  receipt_scan_attempted: false,
};

const RESET_EVENT = {
  ...LOCKED_CALCULATED_EVENT,
  ai_stage: 'none',
  split_mode: null,
  total_amount: null,
  receipt_scan_attempted: false,
};

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

describe('POST /events/:id/expenses/reset', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('returns 200 and clears expense flags when reset succeeds', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_CALCULATED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: RESET_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [], error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/expenses/reset`)
      .set(AUTH_A);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reset: true,
      event_id: EVENT_ID,
      ai_stage: 'none',
    });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('reset_event_expenses_data', {
      p_event_id: EVENT_ID,
    });
  });

  it('returns 403 for non-owner', async () => {
    mockAuth(USER_B);
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_CALCULATED_EVENT, error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/expenses/reset`)
      .set(AUTH_B);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 NOTHING_TO_RESET when no expense data exists', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        ...LOCKED_CALCULATED_EVENT,
        ai_stage: 'none',
        split_mode: null,
        total_amount: null,
        receipt_scan_attempted: false,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [], error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/expenses/reset`)
      .set(AUTH_A);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NOTHING_TO_RESET');
  });

  it('returns 409 when messages were already sent', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        ...LOCKED_CALCULATED_EVENT,
        messages_sent_at: '2026-01-02T00:00:00.000Z',
      },
      error: null,
    });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/expenses/reset`)
      .set(AUTH_A);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('MESSAGES_ALREADY_SENT');
  });
});
