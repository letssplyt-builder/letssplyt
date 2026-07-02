import { describe, expect, it } from '@jest/globals';
import { canViewSharedReceipt } from '../../../utils/receiptQuickView';

describe('canViewSharedReceipt', () => {
  it('returns true only after messages were sent and receipt data exists', () => {
    expect(
      canViewSharedReceipt('2026-01-02T00:00:00.000Z', {
        items: [],
        additional_charges: [],
        discounts: [],
        tax_amount: 0,
        tip_amount: 0,
        fees_amount: 0,
        discount_amount: 0,
        currency: 'USD',
      }),
    ).toBe(true);
    expect(canViewSharedReceipt(null, undefined)).toBe(false);
    expect(canViewSharedReceipt('2026-01-02T00:00:00.000Z', undefined)).toBe(false);
  });
});
