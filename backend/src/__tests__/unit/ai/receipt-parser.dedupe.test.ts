import { describe, expect, it } from '@jest/globals';
import {
  amountsRoughlyEqual,
  dedupeFeeLineItems,
  feeNamesLikelyMatch,
  itemDuplicatesAdditionalCharge,
  itemLineTotal,
  normalizeFeeLabel,
} from '../../../modules/ai/receipt-parser/receipt-parser.dedupe';
import type { ReceiptParseResult } from '../../../modules/ai/receipt-parser/receipt-parser.schema';

function baseResult(
  overrides: Partial<ReceiptParseResult> = {},
): ReceiptParseResult {
  return {
    items: [
      {
        name: 'Burger',
        unit_price: 10,
        quantity: 1,
        confidence_score: 0.95,
      },
    ],
    additional_charges: [],
    subtotal: 10,
    tax: 1,
    tip: 0,
    total: 11,
    currency: 'USD',
    parse_confidence: 0.95,
    ...overrides,
  };
}

describe('receipt-parser.dedupe', () => {
  it('normalizeFeeLabel strips punctuation and case', () => {
    expect(normalizeFeeLabel('SVC Fee')).toBe('svcfee');
    expect(normalizeFeeLabel('City-Fee')).toBe('cityfee');
  });

  it('feeNamesLikelyMatch treats SVC Fee and SVC Fees as the same', () => {
    expect(feeNamesLikelyMatch('SVC Fee', 'SVC Fees')).toBe(true);
    expect(feeNamesLikelyMatch('City Fee', 'City Fees')).toBe(true);
  });

  it('feeNamesLikelyMatch returns false for unrelated labels', () => {
    expect(feeNamesLikelyMatch('Burger', 'SVC Fee')).toBe(false);
  });

  it('amountsRoughlyEqual allows two-cent tolerance', () => {
    expect(amountsRoughlyEqual(3.5, 3.51)).toBe(true);
    expect(amountsRoughlyEqual(3.5, 3.53)).toBe(false);
  });

  it('itemLineTotal multiplies unit_price by quantity', () => {
    expect(itemLineTotal({ unit_price: 5, quantity: 2 })).toBe(10);
  });

  it('itemDuplicatesAdditionalCharge matches amount and label', () => {
    expect(
      itemDuplicatesAdditionalCharge(
        { name: 'SVC Fees', unit_price: 3.5, quantity: 1 },
        [{ name: 'SVC Fee', amount: 3.5 }],
      ),
    ).toBe(true);
  });

  it('itemDuplicatesAdditionalCharge matches when quantity spreads line total', () => {
    expect(
      itemDuplicatesAdditionalCharge(
        { name: 'Service Charge', unit_price: 1.75, quantity: 2 },
        [{ name: 'Service Charge', amount: 3.5 }],
      ),
    ).toBe(true);
  });

  it('dedupeFeeLineItems removes duplicate fee rows from items', () => {
    const result = dedupeFeeLineItems(
      baseResult({
        items: [
          {
            name: 'Burger',
            unit_price: 10,
            quantity: 1,
            confidence_score: 0.95,
          },
          {
            name: 'SVC Fees',
            unit_price: 3.5,
            quantity: 1,
            confidence_score: 0.9,
          },
        ],
        additional_charges: [{ name: 'SVC Fee', amount: 3.5 }],
        subtotal: 13.5,
        tax: 1,
        total: 14.5,
      }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Burger');
    expect(result.subtotal).toBe(10);
    expect(result.additional_charges).toHaveLength(1);
  });

  it('dedupeFeeLineItems removes only the matching duplicate when multiple fees exist', () => {
    const result = dedupeFeeLineItems(
      baseResult({
        items: [
          {
            name: 'Burger',
            unit_price: 10,
            quantity: 1,
            confidence_score: 0.95,
          },
          {
            name: 'SVC Fees',
            unit_price: 3.5,
            quantity: 1,
            confidence_score: 0.9,
          },
          {
            name: 'City Fee',
            unit_price: 1,
            quantity: 1,
            confidence_score: 0.9,
          },
        ],
        additional_charges: [
          { name: 'SVC Fee', amount: 3.5 },
          { name: 'City Fee', amount: 1 },
        ],
        subtotal: 14.5,
        tax: 1,
        total: 15.5,
      }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Burger');
    expect(result.subtotal).toBe(10);
  });

  it('dedupeFeeLineItems keeps items when amounts differ', () => {
    const result = dedupeFeeLineItems(
      baseResult({
        items: [
          {
            name: 'Burger',
            unit_price: 10,
            quantity: 1,
            confidence_score: 0.95,
          },
          {
            name: 'SVC Fees',
            unit_price: 3.5,
            quantity: 1,
            confidence_score: 0.9,
          },
        ],
        additional_charges: [{ name: 'SVC Fee', amount: 2 }],
        subtotal: 13.5,
      }),
    );

    expect(result.items).toHaveLength(2);
  });

  it('dedupeFeeLineItems is a no-op without additional_charges', () => {
    const input = baseResult();
    expect(dedupeFeeLineItems(input)).toEqual(input);
  });
});
