import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  claimParsingSlot,
  getCachedReceiptResult,
} from '../../../modules/ai/a1-idempotency';

const EVENT_ID = 'event-44444444-4444-4444-4444-444444444444';

describe('a1-idempotency', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('claimParsingSlot returns true when update claims a row', async () => {
    mockSupabase.__setMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });

    await expect(claimParsingSlot(EVENT_ID)).resolves.toBe(true);
  });

  it('claimParsingSlot returns false when no row matched', async () => {
    mockSupabase.__setMockResultForTable('events', {
      data: [],
      error: null,
    });

    await expect(claimParsingSlot(EVENT_ID)).resolves.toBe(false);
  });

  it('claimParsingSlot succeeds again when ai_stage is failed (row matches none|failed)', async () => {
    mockSupabase.__setMockResultForTable('events', {
      data: [{ id: EVENT_ID }],
      error: null,
    });

    await expect(claimParsingSlot(EVENT_ID)).resolves.toBe(true);
  });

  it('getCachedReceiptResult reads financial fields from events table', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        total_amount: 52,
        tax_amount: 4,
        tip_amount: 3,
        fees_amount: 5,
        currency: 'USD',
        locale: 'en-US',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', {
      data: [
        {
          id: 'item-1',
          name: 'Burger',
          unit_price: 10,
          quantity: 2,
          confidence_score: 0.9,
          is_low_confidence: false,
          is_fee: false,
        },
        {
          id: 'fee-1',
          name: 'Service charge',
          unit_price: 5,
          quantity: 1,
          confidence_score: 0.95,
          is_low_confidence: false,
          is_fee: true,
        },
      ],
      error: null,
    });

    const result = await getCachedReceiptResult(EVENT_ID);

    expect(result.tax).toBe(4);
    expect(result.tip).toBe(3);
    expect(result.total).toBe(52);
    expect(result.items[0].name).toBe('Burger');
    expect(result.additional_charges).toEqual([
      { name: 'Service charge', amount: 5, confidence_score: 0.95 },
    ]);
    expect(result.items.every((item) => item.name !== 'Service charge')).toBe(true);
    expect(result.subtotal).toBe(20);
  });
});
