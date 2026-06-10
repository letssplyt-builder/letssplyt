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
          name: 'Burger',
          unit_price: 10,
          quantity: 1,
          confidence_score: 0.95,
          is_low_confidence: false,
          is_fee: false,
        },
        {
          name: 'SVC Fee',
          unit_price: 2,
          quantity: 1,
          confidence_score: 0.9,
          is_low_confidence: false,
          is_fee: true,
        },
        {
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
      { name: 'Burger', unit_price: 10, quantity: 1, confidence: 'high' },
      { name: 'Salad', unit_price: 8, quantity: 1, confidence: 'low' },
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
