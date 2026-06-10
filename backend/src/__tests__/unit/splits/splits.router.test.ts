import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';
import { createLLMProvider, mockLLMProvider } from '../../mocks/llm.mock';

const USER_A = 'split-owner-a';
const EVENT_ID = 'event-66666666-6666-6666-6666-666666666666';
const PARTICIPANT_ALEX = '00000000-0000-0000-0000-000000000101';
const PARTICIPANT_JORDAN = '00000000-0000-0000-0000-000000000102';
const ITEM_BURGER = '00000000-0000-0000-0000-000000000201';
const AUTH_A = { Authorization: 'Bearer mock-token-a' };

const EVENT_ROW = {
  id: EVENT_ID,
  payer_id: USER_A,
  title: 'Split Dinner',
  event_date: null,
  total_amount: 35.4,
  currency: 'USD',
  status: 'locked',
  split_mode: null,
  ai_stage: 'parsed_confirmed',
  locale: 'en-US',
  locked_at: '2026-01-01T00:00:00.000Z',
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  tax_amount: 2.4,
  tip_amount: 3,
  fees_amount: 0,
  receipt_scan_attempted: true,
};

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockImplementation(() =>
    Promise.resolve({
      data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
      error: null,
    }),
  );
}

describe('Splits API', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
    createLLMProvider.mockReturnValue(mockLLMProvider);
    process.env.APP_DOMAIN = 'http://localhost:3000';
  });

  it('POST /events/:id/split/calculate equal mode returns even splits', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        { id: PARTICIPANT_ALEX, display_name: 'Alex' },
        { id: PARTICIPANT_JORDAN, display_name: 'Jordan' },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/split/calculate`)
      .set(AUTH_A)
      .send({ split_mode: 'equal' });

    expect(response.status).toBe(200);
    expect(response.body.splits).toHaveLength(2);
    expect(response.body.total_check).toBeCloseTo(35.4, 1);
    expect(response.body.unassigned_item_ids).toEqual([]);
  });

  it('POST /events/:id/splits/assign runs NLP and returns assignments', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        { id: PARTICIPANT_ALEX, display_name: 'Alex' },
        { id: PARTICIPANT_JORDAN, display_name: 'Jordan' },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', {
      data: [
        {
          id: ITEM_BURGER,
          name: 'Burger',
          unit_price: 30,
          quantity: 1,
          is_fee: false,
        },
      ],
      error: null,
    });

    mockLLMProvider.complete.mockResolvedValue({
      text: JSON.stringify({
        assignments: [{ item_id: ITEM_BURGER, assigned_to: ['Alex'] }],
        unassigned_item_ids: [],
        confidence: 0.92,
      }),
      usage: { inputTokens: 30, outputTokens: 40 },
      modelUsed: 'mock-a2',
    });

    mockSupabase.__pushMockResultForTable('item_assignments', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('item_assignments', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/splits/assign`)
      .set(AUTH_A)
      .send({ instruction: 'Alex had the burger' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('complete');
    expect(response.body.assignments).toEqual([
      { item_id: ITEM_BURGER, participant_ids: [PARTICIPANT_ALEX] },
    ]);
    expect(createLLMProvider).toHaveBeenCalledWith('A2');
  });

  it('POST /events/:id/split/calculate itemised returns 409 when receipt not confirmed', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', {
      data: { ...EVENT_ROW, ai_stage: 'parsed' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ id: PARTICIPANT_ALEX, display_name: 'Alex' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [], error: null });

    const response = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/split/calculate`)
      .set(AUTH_A)
      .send({
        split_mode: 'itemised',
        assignments: [{ item_id: ITEM_BURGER, participant_ids: [PARTICIPANT_ALEX] }],
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RECEIPT_NOT_CONFIRMED');
  });
});
