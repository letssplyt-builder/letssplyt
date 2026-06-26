import { describe, expect, it } from '@jest/globals';
import {
  computeDiscountLineAmount,
  computeDiscountTotal,
  computeReviewTotal,
  parseAmountInput,
  receiptReviewToParseResult,
  snapshotToEditable,
} from '../../../screens/receipts/itemReview.utils';

const sampleItems = [
  {
    localId: 'food-1',
    name: 'Burger',
    unit_price: 10,
    quantity: 1,
    is_fee: false,
  },
];

describe('itemReview.utils', () => {
  it('computeReviewTotal sums food fees tax tip and subtracts discounts', () => {
    const snapshot = snapshotToEditable({
      items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
      additional_charges: [{ name: 'SVC Fee', amount: 3.5 }],
      discounts: [{ name: '10% off', type: 'percent', value: 10, scope: 'bill' }],
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 3.5,
      discount_amount: 1,
      currency: 'USD',
    });

    const total = computeReviewTotal(
      snapshot.items,
      snapshot.charges,
      snapshot.discounts,
      '1',
      '2',
    );

    expect(total).toBe(15.5);
  });

  it('computeDiscountTotal stacks percent then amount sequentially', () => {
    const discounts = [
      { localId: 'd1', name: '10%', type: 'percent' as const, value: 10, scope: 'bill' as const },
      { localId: 'd2', name: '$5', type: 'amount' as const, value: 5, scope: 'bill' as const },
    ];
    expect(computeDiscountTotal(discounts, sampleItems)).toBe(6);
  });

  it('computeDiscountTotal applies item-scoped discounts to the matching line only', () => {
    const items = [
      {
        localId: 'food-a',
        id: 'item-a',
        name: 'Burger',
        unit_price: 10,
        quantity: 1,
        is_fee: false,
      },
      {
        localId: 'food-b',
        id: 'item-b',
        name: 'Salad',
        unit_price: 8,
        quantity: 1,
        is_fee: false,
      },
    ];
    const discounts = [
      {
        localId: 'd1',
        name: 'Burger promo',
        type: 'amount' as const,
        value: 3,
        scope: 'item' as const,
        item_id: 'item-a',
      },
    ];
    expect(computeDiscountTotal(discounts, items)).toBe(3);
    expect(computeReviewTotal(items, [], discounts, '0', '0')).toBe(15);
  });

  it('computeDiscountLineAmount uses prior discounts when resolving a row', () => {
    const discounts = [
      { localId: 'd1', name: '10%', type: 'percent' as const, value: 10, scope: 'bill' as const },
      { localId: 'd2', name: '$5', type: 'amount' as const, value: 5, scope: 'bill' as const },
    ];
    expect(computeDiscountLineAmount(discounts[1], sampleItems, [discounts[0]])).toBe(5);
  });

  it('floors grand total at zero when discounts exceed subtotal plus surcharges', () => {
    const snapshot = snapshotToEditable({
      items: [{ name: 'Coffee', unit_price: 5, quantity: 1 }],
      additional_charges: [],
      discounts: [{ name: 'Comp', type: 'amount', value: 20, scope: 'bill' }],
      tax_amount: 0,
      tip_amount: 0,
      fees_amount: 0,
      discount_amount: 5,
      currency: 'USD',
    });

    expect(
      computeReviewTotal(snapshot.items, snapshot.charges, snapshot.discounts, '0', '0'),
    ).toBe(0);
  });

  it('parseAmountInput handles decimals', () => {
    expect(parseAmountInput('12.50')).toBe(12.5);
    expect(parseAmountInput('')).toBe(0);
  });

  it('receiptReviewToParseResult builds parse response with discounted total', () => {
    const result = receiptReviewToParseResult({
      items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
      additional_charges: [{ name: 'SVC Fee', amount: 2 }],
      discounts: [{ name: 'Comp', type: 'amount', value: 1, scope: 'bill' }],
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 2,
      discount_amount: 1,
      currency: 'USD',
    });

    expect(result.total_amount).toBe(14);
    expect(result.storage_path).toBe('');
    expect(result.items[0].name).toBe('Burger');
  });
});
