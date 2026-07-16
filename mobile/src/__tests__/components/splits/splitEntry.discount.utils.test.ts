import { describe, expect, it } from '@jest/globals';
import {
  attachLineDiscountsToFoodItems,
  buildSplitPersonExplainers,
  hasBillScopedDiscounts,
  toPricedSplitItems,
} from '../../../screens/splits/splitEntry.utils';

describe('splitEntry discount helpers', () => {
  const items = [
    { id: 'a', name: 'Item 1', unit_price: 20, quantity: 1 },
    { id: 'b', name: 'Item 2', unit_price: 30, quantity: 1 },
  ];

  it('attaches item-scoped discounts to the matching line', () => {
    const withDiscounts = attachLineDiscountsToFoodItems(items, [
      { name: 'Promo', type: 'amount', value: 5, scope: 'item', item_id: 'a' },
      { name: 'Member', type: 'amount', value: 2, scope: 'bill' },
    ]);

    expect(withDiscounts.find((row) => row.id === 'a')?.line_discount).toBe(5);
    expect(withDiscounts.find((row) => row.id === 'b')?.line_discount).toBe(0);
  });

  it('builds priced items with net after line discount', () => {
    const priced = toPricedSplitItems([
      { id: 'a', name: 'Item 1', unit_price: 20, quantity: 1, line_discount: 5 },
      { id: 'b', name: 'Item 2', unit_price: 30, quantity: 1, line_discount: 0 },
    ]);

    expect(priced[0]).toMatchObject({
      price: 20,
      lineDiscount: 5,
      netPrice: 15,
    });
    expect(priced[1]?.netPrice).toBe(30);
  });

  it('detects bill-scoped discounts separately from item discounts', () => {
    const food = attachLineDiscountsToFoodItems(items, [
      { name: 'Promo', type: 'amount', value: 5, scope: 'item', item_id: 'a' },
    ]);
    expect(hasBillScopedDiscounts(food, [
      { name: 'Promo', type: 'amount', value: 5, scope: 'item', item_id: 'a' },
    ])).toBe(false);

    expect(hasBillScopedDiscounts(food, [
      { name: 'Promo', type: 'amount', value: 5, scope: 'item', item_id: 'a' },
      { name: 'Member', type: 'amount', value: 2, scope: 'bill' },
    ])).toBe(true);
  });

  it('builds per-person explainers with gross → net math', () => {
    const priced = toPricedSplitItems([
      { id: 'a', name: 'Item 1', unit_price: 20, quantity: 1, line_discount: 5 },
      { id: 'b', name: 'Item 2', unit_price: 30, quantity: 1, line_discount: 0 },
    ]);
    const assignments = new Map([
      ['a', ['p-a']],
      ['b', ['p-b']],
    ]);

    const explainers = buildSplitPersonExplainers(priced, assignments, 'USD');
    const forA = explainers.find((row) => row.participant_id === 'p-a');
    const forB = explainers.find((row) => row.participant_id === 'p-b');

    expect(forA?.lines[0]?.detail).toContain('$20.00');
    expect(forA?.lines[0]?.detail).toContain('$5.00');
    expect(forA?.lines[0]?.detail).toContain('$15.00');
    expect(forB?.lines[0]?.detail).toBe('$30.00');
  });

  it('splits discounted net when multiple assignees share a line', () => {
    const priced = toPricedSplitItems([
      { id: 'a', name: 'Shared', unit_price: 20, quantity: 1, line_discount: 5 },
    ]);
    const assignments = new Map([['a', ['p1', 'p2']]]);
    const explainers = buildSplitPersonExplainers(priced, assignments, 'USD');

    expect(explainers[0]?.lines[0]?.detail).toContain('÷ 2');
    expect(explainers[0]?.lines[0]?.detail).toContain('$7.50');
  });
});
