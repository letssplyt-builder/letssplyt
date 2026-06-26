import { describe, expect, it } from '@jest/globals';
import {
  extractDiscountsFromNegativeLines,
  mergeParsedDiscounts,
} from '../../../modules/ai/receipt-parser/receipt-parser.discounts';

describe('receipt-parser.discounts', () => {
  it('maps a negative line after a positive item to item-scoped discount', () => {
    const discounts = extractDiscountsFromNegativeLines(
      [
        { name: 'CERAVE CREAM', unit_price: 25.99, quantity: 1 },
        { name: 'INST SAV', unit_price: -2.5, quantity: 1 },
      ],
      [],
    );

    expect(discounts).toEqual([
      {
        name: 'INST SAV',
        type: 'amount',
        value: 2.5,
        scope: 'item',
        item_index: 0,
      },
    ]);
  });

  it('maps standalone negative line to bill-scoped discount', () => {
    const discounts = extractDiscountsFromNegativeLines(
      [{ name: 'Coupon', unit_price: -5, quantity: 1 }],
      [],
    );

    expect(discounts[0]).toMatchObject({
      scope: 'bill',
      value: 5,
    });
  });

  it('merges model discounts with negative-line extraction', () => {
    const merged = mergeParsedDiscounts(
      [{ name: 'Member', type: 'amount', value: 3, scope: 'bill' }],
      [
        {
          name: 'Item savings',
          type: 'amount',
          value: 1,
          scope: 'item',
          item_index: 0,
        },
      ],
      2,
    );

    expect(merged).toHaveLength(2);
  });
});
