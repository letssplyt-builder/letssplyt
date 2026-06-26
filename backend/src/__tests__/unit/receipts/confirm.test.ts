import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { confirmReceipt } from '../../../modules/receipts/receipts.confirm';

const USER_ID = 'receipt-payer-1';
const EVENT_ID = 'event-44444444-4444-4444-4444-444444444444';

const PARSED_EVENT_ROW = {
  id: EVENT_ID,
  payer_id: USER_ID,
  title: 'Dinner',
  event_date: null,
  total_amount: 20,
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
  fees_amount: 3,
  discount_amount: 0,
  receipt_scan_attempted: true,
};

describe('confirmReceipt', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  it('updates ai_stage to parsed_confirmed and totals', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: PARSED_EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_discounts', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });

    const result = await confirmReceipt(USER_ID, {
      event_id: EVENT_ID,
      items: [{ name: 'Burger', price: 10, quantity: 1 }],
      additional_charges: [{ name: 'SVC Fee', amount: 3 }],
      discounts: [],
      tax: 1,
      fees: 3,
      tip: 2,
      discount_total: 0,
    });

    expect(result.confirmed).toBe(true);
    expect(result.total_amount).toBe(16);
  });

  it('rejects when ai_stage is not parsed', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: { ...PARSED_EVENT_ROW, ai_stage: 'none' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', { data: [], error: null });

    await expect(
      confirmReceipt(USER_ID, {
        event_id: EVENT_ID,
        items: [{ name: 'Burger', price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax: 0,
        fees: 0,
        tip: 0,
        discount_total: 0,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_AI_STAGE',
      statusCode: 400,
    });
  });

  it('calculates total_amount from items tax fees tip and discounts', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: PARSED_EVENT_ROW, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_discounts', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_discounts', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });

    const result = await confirmReceipt(USER_ID, {
      event_id: EVENT_ID,
      items: [
        { name: 'Burger', price: 12, quantity: 1 },
        { name: 'Fries', price: 5, quantity: 2 },
      ],
      additional_charges: [{ name: 'City Fee', amount: 1.5 }],
      discounts: [{ name: 'Happy hour', type: 'percent', value: 10 }],
      tax: 2,
      fees: 1.5,
      tip: 3,
      discount_total: 2.2,
    });

    expect(result.total_amount).toBe(26.3);
  });

  it('rejects when discount_total does not match resolved discounts', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: PARSED_EVENT_ROW, error: null });

    await expect(
      confirmReceipt(USER_ID, {
        event_id: EVENT_ID,
        items: [{ name: 'Burger', price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [{ name: '10% off', type: 'percent', value: 10 }],
        tax: 0,
        fees: 0,
        tip: 0,
        discount_total: 5,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('allows re-confirm when ai_stage is already parsed_confirmed', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: { ...PARSED_EVENT_ROW, ai_stage: 'parsed_confirmed' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_discounts', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });

    const result = await confirmReceipt(USER_ID, {
      event_id: EVENT_ID,
      items: [{ name: 'Pasta', price: 15, quantity: 1 }],
      additional_charges: [],
      discounts: [],
      tax: 0,
      fees: 0,
      tip: 0,
      discount_total: 0,
    });

    expect(result.confirmed).toBe(true);
    expect(result.total_amount).toBe(15);
  });

  it('allows re-confirm when ai_stage is calculated and updates items in place', async () => {
    const ITEM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    mockSupabase.__pushMockResultForTable('events', {
      data: { ...PARSED_EVENT_ROW, ai_stage: 'calculated' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', {
      data: [{ id: ITEM_ID, is_fee: false }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_discounts', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });

    const result = await confirmReceipt(USER_ID, {
      event_id: EVENT_ID,
      items: [{ id: ITEM_ID, name: 'Pasta (updated)', price: 16, quantity: 1 }],
      additional_charges: [],
      discounts: [],
      tax: 0,
      fees: 0,
      tip: 0,
      discount_total: 0,
    });

    expect(result.confirmed).toBe(true);
    expect(result.total_amount).toBe(16);
  });
});
