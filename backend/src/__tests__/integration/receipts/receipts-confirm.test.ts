import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

const USER_A = 'receipt-payer-a';
const USER_B = 'receipt-payer-b';
const EVENT_ID = '44444444-4444-4444-4444-444444444444';
const AUTH_A = { Authorization: 'Bearer mock-token-a' };
const AUTH_B = { Authorization: 'Bearer mock-token-b' };

const LOCKED_PARSED_EVENT = {
  id: EVENT_ID,
  payer_id: USER_A,
  title: 'Receipt Confirm Dinner',
  event_date: null,
  total_amount: 22,
  currency: 'USD',
  status: 'locked',
  split_mode: null,
  ai_stage: 'parsed',
  locale: 'en-US',
  locked_at: '2026-01-02T00:00:00.000Z',
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  tax_amount: 1,
  tip_amount: 2,
  fees_amount: 2,
  discount_amount: null,
  receipt_scan_attempted: true,
};

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

function queueSuccessfulConfirmMocks(): void {
  mockSupabase.__pushMockResultForTable('events', {
    data: [{ id: EVENT_ID }],
    error: null,
  });
  mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
  mockSupabase.__pushMockResultForTable('receipt_discounts', { data: null, error: null });
  mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
  mockSupabase.__pushMockResultForTable('receipt_discounts', { data: null, error: null });
  mockSupabase.__pushMockResultForTable('events', { data: null, error: null });
}

describe('POST /api/v1/receipts/confirm', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('returns 200 with stacked percent and amount discounts', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_PARSED_EVENT, error: null });
    queueSuccessfulConfirmMocks();

    const response = await request(app)
      .post('/api/v1/receipts/confirm')
      .set(AUTH_A)
      .send({
        event_id: EVENT_ID,
        items: [
          { name: 'Burger', price: 12, quantity: 1 },
          { name: 'Fries', price: 5, quantity: 2 },
        ],
        additional_charges: [{ name: 'City Fee', amount: 1.5 }],
        discounts: [
          { name: 'Happy hour', type: 'percent', value: 10 },
          { name: 'Manager comp', type: 'amount', value: 3 },
        ],
        tax: 2,
        fees: 1.5,
        tip: 3,
        discount_total: 5.2,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      confirmed: true,
      total_amount: 23.3,
    });
  });

  it('returns 400 when discount_total does not match resolved discounts', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_PARSED_EVENT, error: null });

    const response = await request(app)
      .post('/api/v1/receipts/confirm')
      .set(AUTH_A)
      .send({
        event_id: EVENT_ID,
        items: [{ name: 'Burger', price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [{ name: '10% off', type: 'percent', value: 10 }],
        tax: 0,
        fees: 0,
        tip: 0,
        discount_total: 5,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 for non-owner payer', async () => {
    mockAuth(USER_B);
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_PARSED_EVENT, error: null });

    const response = await request(app)
      .post('/api/v1/receipts/confirm')
      .set(AUTH_B)
      .send({
        event_id: EVENT_ID,
        items: [{ name: 'Burger', price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax: 0,
        fees: 0,
        tip: 0,
        discount_total: 0,
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when event is not locked', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', {
      data: { ...LOCKED_PARSED_EVENT, status: 'open' },
      error: null,
    });

    const response = await request(app)
      .post('/api/v1/receipts/confirm')
      .set(AUTH_A)
      .send({
        event_id: EVENT_ID,
        items: [{ name: 'Burger', price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax: 0,
        fees: 0,
        tip: 0,
        discount_total: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('EVENT_NOT_LOCKED');
  });
});

describe('GET /api/v1/events/:id receipt_review with discounts', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('includes discount lines on receipt_review for payer', async () => {
    mockAuth(USER_A);
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_PARSED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('users', {
      data: { id: USER_A, display_name: 'Alex', avatar_colour: '#6366F1' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: 'p1',
          user_id: USER_A,
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: null,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: [{ id: USER_A, display_name: 'Alex' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', {
      data: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Burger',
          unit_price: 10,
          quantity: 1,
          confidence_score: 0.95,
          is_low_confidence: false,
          is_fee: false,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_discounts', {
      data: [
        {
          name: 'Happy hour',
          discount_type: 'percent',
          value: 10,
          resolved_amount: 1,
        },
        {
          name: 'Comp',
          discount_type: 'amount',
          value: 2,
          resolved_amount: 2,
        },
      ],
      error: null,
    });

    const response = await request(app).get(`/api/v1/events/${EVENT_ID}`).set(AUTH_A);

    expect(response.status).toBe(200);
    expect(response.body.receipt_review).toEqual({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Burger',
          unit_price: 10,
          quantity: 1,
          confidence: 'high',
        },
      ],
      additional_charges: [],
      discounts: [
        { name: 'Happy hour', type: 'percent', value: 10 },
        { name: 'Comp', type: 'amount', value: 2 },
      ],
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 2,
      discount_amount: 0,
      currency: 'USD',
    });
  });
});
