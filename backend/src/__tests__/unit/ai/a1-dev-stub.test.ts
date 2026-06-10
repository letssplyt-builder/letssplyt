import { describe, expect, it } from '@jest/globals';
import { buildA1DevStubResult } from '../../../modules/ai/a1-dev-stub';
import { sumAdditionalCharges } from '../../../modules/ai/receipt-parser/receipt-parser.schema';

describe('a1-dev-stub', () => {
  it('buildA1DevStubResult includes additional_charges and balanced total', () => {
    const result = buildA1DevStubResult();
    const fees = sumAdditionalCharges(result.additional_charges);
    const itemsTotal = result.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );

    expect(result.additional_charges.length).toBeGreaterThan(0);
    expect(fees).toBe(2.5);
    expect(itemsTotal + result.tax + fees + result.tip).toBe(result.total);
  });
});
