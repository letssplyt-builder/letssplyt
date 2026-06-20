import { describe, expect, it } from '@jest/globals';
import {
  computeDiscountLineAmount,
  computeDiscountTotal,
  computeReviewTotal,
  parseAmountInput,
  receiptReviewToParseResult,
  snapshotToEditable,
} from '../../../screens/receipts/itemReview.utils';

describe('itemReview.utils', () => {
  it('computeReviewTotal sums food fees tax tip and subtracts discounts', () => {
    const snapshot = snapshotToEditable({
      items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
      additional_charges: [{ name: 'SVC Fee', amount: 3.5 }],
      discounts: [{ name: '10% off', type: 'percent', value: 10 }],
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
      { localId: 'd1', name: '10%', type: 'percent' as const, value: 10 },
      { localId: 'd2', name: '$5', type: 'amount' as const, value: 5 },
    ];
    expect(computeDiscountTotal(discounts, 100)).toBe(15);
  });

  it('computeDiscountLineAmount uses prior discounts when resolving a row', () => {
    const discounts = [
      { localId: 'd1', name: '10%', type: 'percent' as const, value: 10 },
      { localId: 'd2', name: '$5', type: 'amount' as const, value: 5 },
    ];
    expect(computeDiscountLineAmount(discounts[1], 100, [discounts[0]])).toBe(5);
  });

  it('floors grand total at zero when discounts exceed subtotal plus surcharges', () => {
    const snapshot = snapshotToEditable({
      items: [{ name: 'Coffee', unit_price: 5, quantity: 1 }],
      additional_charges: [],
      discounts: [{ name: 'Comp', type: 'amount', value: 20 }],
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
      discounts: [{ name: 'Comp', type: 'amount', value: 1 }],
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
