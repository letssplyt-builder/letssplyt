import { describe, expect, it } from '@jest/globals';
import {
  AdditionalChargeSchema,
  ReceiptParseResultSchema,
  sumAdditionalCharges,
} from '../../../modules/ai/receipt-parser/receipt-parser.schema';

describe('receipt-parser.schema', () => {
  it('defaults additional_charges to empty array when omitted', () => {
    const parsed = ReceiptParseResultSchema.parse({
      items: [
        {
          name: 'Burger',
          unit_price: 10,
          quantity: 1,
          confidence_score: 0.95,
        },
      ],
      subtotal: 10,
      tax: 1,
      tip: 2,
      total: 13,
      currency: 'USD',
      parse_confidence: 0.95,
    });

    expect(parsed.additional_charges).toEqual([]);
  });

  it('accepts additional_charges array from A1', () => {
    const parsed = ReceiptParseResultSchema.parse({
      items: [
        {
          name: 'Burger',
          unit_price: 10,
          quantity: 1,
          confidence_score: 0.95,
        },
      ],
      additional_charges: [
        { name: 'SVC Fee', amount: 3.5, confidence_score: 0.9 },
        { name: 'City Fee', amount: 1 },
      ],
      subtotal: 10,
      tax: 1,
      tip: 2,
      total: 16.5,
      currency: 'USD',
      parse_confidence: 0.9,
    });

    expect(parsed.additional_charges).toHaveLength(2);
    expect(parsed.additional_charges[0].name).toBe('SVC Fee');
  });

  it('AdditionalChargeSchema requires positive amount', () => {
    expect(() =>
      AdditionalChargeSchema.parse({ name: 'Fee', amount: 0 }),
    ).toThrow();
  });

  it('sumAdditionalCharges totals fee rows', () => {
    expect(
      sumAdditionalCharges([
        { name: 'Service charge', amount: 5 },
        { name: 'City fee', amount: 1.25 },
      ]),
    ).toBe(6.25);
  });

  it('sumAdditionalCharges returns 0 for empty array', () => {
    expect(sumAdditionalCharges([])).toBe(0);
  });
});
