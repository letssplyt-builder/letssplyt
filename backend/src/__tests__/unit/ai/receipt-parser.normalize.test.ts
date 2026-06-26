import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  preprocessReceiptParseOutput,
  UNREADABLE_RECEIPT_ITEM_LABEL,
} from '../../../modules/ai/receipt-parser/receipt-parser.normalize';
import { ReceiptParseOutputSchema } from '../../../modules/ai/receipt-parser/receipt-parser.schema';

describe('preprocessReceiptParseOutput', () => {
  it('drops items with zero or negative unit_price', () => {
    const result = preprocessReceiptParseOutput({
      items: [
        { name: 'Burger', unit_price: 10, quantity: 1, confidence_score: 0.9 },
        { name: 'Free chips', unit_price: 0, quantity: 1, confidence_score: 0.9 },
      ],
      additional_charges: [],
      subtotal: 10,
      tax: 0,
      tip: 0,
      total: 10,
      currency: 'USD',
      parse_confidence: 0.9,
    }) as { items: unknown[] };

    expect(result.items).toHaveLength(1);
  });

  it('strips invalid item ids and marks garbage names as unreadable', () => {
    const result = preprocessReceiptParseOutput({
      items: [
        {
          id: 'not-a-uuid',
          name: '***',
          unit_price: 12,
          quantity: 1,
          confidence_score: 0.9,
        },
      ],
      additional_charges: [],
      subtotal: 12,
      tax: 0,
      tip: 0,
      total: 12,
      currency: 'USD',
      parse_confidence: 0.9,
    }) as { items: Array<Record<string, unknown>> };

    expect(result.items[0].id).toBeUndefined();
    expect(result.items[0].name).toBe(UNREADABLE_RECEIPT_ITEM_LABEL);
    expect(result.items[0].confidence_score).toBeLessThan(0.75);
  });

  it('passes through unreadable receipt errors', () => {
    const raw = { error: 'unreadable', reason: 'too blurry' };
    expect(preprocessReceiptParseOutput(raw)).toEqual(raw);
  });
});

describe('ReceiptParseOutputSchema with preprocess', () => {
  it('accepts model output with invalid uuid and zero-price lines', () => {
    const validated = ReceiptParseOutputSchema.parse({
      items: [
        {
          id: 'item-4',
          name: 'Burger',
          unit_price: 10,
          quantity: 1,
          confidence_score: 0.95,
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          name: '***',
          unit_price: 8,
          quantity: 1,
          confidence_score: 0.9,
        },
        {
          name: 'Promo',
          unit_price: 0,
          quantity: 1,
          confidence_score: 0.5,
        },
      ],
      additional_charges: [],
      subtotal: 18,
      tax: 0,
      tip: 0,
      total: 18,
      currency: 'USD',
      parse_confidence: 0.9,
    });

    if ('error' in validated) {
      throw new Error('expected success payload');
    }

    expect(validated.items).toHaveLength(2);
    expect(validated.items[1].name).toBe(UNREADABLE_RECEIPT_ITEM_LABEL);
    expect(validated.items[1].confidence_score).toBeLessThan(0.75);
  });
});
