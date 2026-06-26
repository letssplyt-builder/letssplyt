import { describe, expect, it } from '@jest/globals';
import {
  computeReceiptGrandTotal,
  resolveDiscountAmount,
  resolveDiscountsTotal,
  resolveReceiptDiscounts,
} from './receiptDiscounts';

describe('receiptDiscounts', () => {
  it('resolves percent discounts from subtotal', () => {
    expect(
      resolveDiscountAmount({ name: 'Happy hour', type: 'percent', value: 10 }, 100),
    ).toBe(10);
  });

  it('resolves fixed amount discounts capped at subtotal', () => {
    expect(
      resolveDiscountAmount({ name: 'Comp', type: 'amount', value: 15 }, 10),
    ).toBe(10);
  });

  it('stacks multiple discounts sequentially on remaining subtotal', () => {
    const discounts = [
      { name: '10% off', type: 'percent' as const, value: 10 },
      { name: '$5 off', type: 'amount' as const, value: 5 },
    ];
    expect(resolveDiscountsTotal(discounts, 100)).toBe(15);
    expect(resolveReceiptDiscounts(discounts, 100)).toEqual([
      { name: '10% off', type: 'percent', value: 10, scope: 'bill', resolved_amount: 10 },
      { name: '$5 off', type: 'amount', value: 5, scope: 'bill', resolved_amount: 5 },
    ]);
  });

  it('resolves 100 percent discount as the full subtotal', () => {
    expect(resolveDiscountAmount({ name: 'Free', type: 'percent', value: 100 }, 50)).toBe(50);
  });

  it('computes grand total after discounts', () => {
    expect(computeReceiptGrandTotal(100, 5, 8, 10, 10)).toBe(113);
    expect(computeReceiptGrandTotal(10, 0, 0, 0, 50)).toBe(0);
  });

  it('returns zero discount when subtotal is zero or value is non-positive', () => {
    const discount = { name: '10% off', type: 'percent' as const, value: 10 };
    expect(resolveDiscountAmount(discount, 0)).toBe(0);
    expect(resolveDiscountAmount({ ...discount, value: 0 }, 100)).toBe(0);
  });

  it('caps a fixed discount at the remaining subtotal', () => {
    const discounts = [
      { name: '50%', type: 'percent' as const, value: 50 },
      { name: 'Big comp', type: 'amount' as const, value: 100 },
    ];
    expect(resolveDiscountsTotal(discounts, 40)).toBe(40);
    expect(resolveReceiptDiscounts(discounts, 40)).toEqual([
      { name: '50%', type: 'percent', value: 50, scope: 'bill', resolved_amount: 20 },
      { name: 'Big comp', type: 'amount', value: 100, scope: 'bill', resolved_amount: 20 },
    ]);
  });

  it('applies item-scoped discounts to a single line before bill discounts', () => {
    const items = [
      { id: 'a', unit_price: 25.99, quantity: 1 },
      { id: 'b', unit_price: 13.49, quantity: 1 },
    ];
    const discounts = [
      {
        name: 'Item savings',
        type: 'amount' as const,
        value: 2,
        scope: 'item' as const,
        item_id: 'a',
      },
      { name: 'Bill coupon', type: 'amount' as const, value: 5, scope: 'bill' as const },
    ];

    expect(resolveDiscountsTotal(discounts, 39.48, items)).toBe(7);
    expect(resolveReceiptDiscounts(discounts, 39.48, items)).toEqual([
      {
        name: 'Item savings',
        type: 'amount',
        value: 2,
        scope: 'item',
        item_id: 'a',
        resolved_amount: 2,
      },
      {
        name: 'Bill coupon',
        type: 'amount',
        value: 5,
        scope: 'bill',
        resolved_amount: 5,
      },
    ]);
  });

  it('supports three sequential discounts without exceeding subtotal', () => {
    const discounts = [
      { name: '10%', type: 'percent' as const, value: 10 },
      { name: '$5', type: 'amount' as const, value: 5 },
      { name: '5%', type: 'percent' as const, value: 5 },
    ];
    expect(resolveDiscountsTotal(discounts, 100)).toBeCloseTo(19.25, 2);
  });
});
