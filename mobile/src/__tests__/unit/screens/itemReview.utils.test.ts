import { describe, expect, it } from '@jest/globals';
import {
  computeReviewTotal,
  parseAmountInput,
  receiptReviewToParseResult,
  snapshotToEditable,
} from '../../../screens/receipts/itemReview.utils';

describe('itemReview.utils', () => {
  it('computeReviewTotal sums food fees tax and tip', () => {
    const snapshot = snapshotToEditable({
      items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
      additional_charges: [{ name: 'SVC Fee', amount: 3.5 }],
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 3.5,
      currency: 'USD',
    });

    const total = computeReviewTotal(snapshot.items, snapshot.charges, '1', '2');

    expect(total).toBe(16.5);
  });

  it('parseAmountInput handles decimals', () => {
    expect(parseAmountInput('12.50')).toBe(12.5);
    expect(parseAmountInput('')).toBe(0);
  });

  it('receiptReviewToParseResult builds parse response with total', () => {
    const result = receiptReviewToParseResult({
      items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
      additional_charges: [{ name: 'SVC Fee', amount: 2 }],
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 2,
      currency: 'USD',
    });

    expect(result.total_amount).toBe(15);
    expect(result.storage_path).toBe('');
    expect(result.items[0].name).toBe('Burger');
  });
});
