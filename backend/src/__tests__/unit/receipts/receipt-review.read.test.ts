import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { fetchReceiptReviewSnapshot } from '../../../modules/receipts/receipt-review.read';

const EVENT_ID = 'event-44444444-4444-4444-4444-444444444444';

describe('fetchReceiptReviewSnapshot', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('maps food and fee rows into review snapshot', async () => {
    mockSupabase.__setMockResultForTable('receipt_items', {
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
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'SVC Fee',
          unit_price: 2,
          quantity: 1,
          confidence_score: 0.9,
          is_low_confidence: false,
          is_fee: true,
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Salad',
          unit_price: 8,
          quantity: 1,
          confidence_score: 0.4,
          is_low_confidence: true,
          is_fee: false,
        },
      ],
      error: null,
    });

    const snapshot = await fetchReceiptReviewSnapshot(EVENT_ID, {
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 2,
      currency: 'USD',
    });

    expect(snapshot.items).toEqual([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Burger',
        unit_price: 10,
        quantity: 1,
        confidence: 'high',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Salad',
        unit_price: 8,
        quantity: 1,
        confidence: 'low',
      },
    ]);
    expect(snapshot.additional_charges).toEqual([
      { name: 'SVC Fee', amount: 2, confidence: 'high' },
    ]);
    expect(snapshot.tax_amount).toBe(1);
    expect(snapshot.tip_amount).toBe(2);
    expect(snapshot.fees_amount).toBe(2);
    expect(snapshot.currency).toBe('USD');
  });
});
