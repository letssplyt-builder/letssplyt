import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { fetchReceiptReviewSnapshot } from '../../../modules/receipts/receipt-review.read';

const EVENT_ID = 'event-44444444-4444-4444-4444-444444444444';

describe('fetchReceiptReviewSnapshot', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('maps food, fee, and discount rows into review snapshot', async () => {
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
      ],
      error: null,
    });
    mockSupabase.__setMockResultForTable('receipt_discounts', {
      data: [
        {
          name: 'Happy hour',
          discount_type: 'percent',
          value: 10,
          resolved_amount: 1,
        },
      ],
      error: null,
    });

    const snapshot = await fetchReceiptReviewSnapshot(EVENT_ID, {
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 2,
      discount_amount: 1,
      currency: 'USD',
    });

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.additional_charges).toEqual([
      { name: 'SVC Fee', amount: 2, confidence: 'high' },
    ]);
    expect(snapshot.discounts).toEqual([
      { name: 'Happy hour', type: 'percent', value: 10 },
    ]);
    expect(snapshot.discount_amount).toBe(1);
  });
});
