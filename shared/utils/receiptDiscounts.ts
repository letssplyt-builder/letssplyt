/** Receipt discount resolution — shared by mobile review UI and backend confirm. */

export type ReceiptDiscountType = 'percent' | 'amount';

export interface ReceiptDiscountInput {
  name: string;
  type: ReceiptDiscountType;
  value: number;
}

export interface ResolvedReceiptDiscount extends ReceiptDiscountInput {
  resolved_amount: number;
}

/** Resolve one discount against the remaining items subtotal (sequential stacking). */
export function resolveDiscountAmount(
  discount: ReceiptDiscountInput,
  remainingSubtotal: number,
): number {
  if (remainingSubtotal <= 0 || discount.value <= 0) {
    return 0;
  }

  let amount =
    discount.type === 'percent'
      ? remainingSubtotal * (discount.value / 100)
      : discount.value;

  amount = Number(amount.toFixed(2));
  return Math.min(Math.max(amount, 0), remainingSubtotal);
}

/** Sum discounts applied sequentially to the items subtotal. */
export function resolveDiscountsTotal(
  discounts: ReceiptDiscountInput[],
  itemsSubtotal: number,
): number {
  let remaining = itemsSubtotal;
  let total = 0;

  for (const discount of discounts) {
    const amount = resolveDiscountAmount(discount, remaining);
    total += amount;
    remaining = Number(Math.max(0, remaining - amount).toFixed(2));
  }

  return Number(total.toFixed(2));
}

export function resolveReceiptDiscounts(
  discounts: ReceiptDiscountInput[],
  itemsSubtotal: number,
): ResolvedReceiptDiscount[] {
  let remaining = itemsSubtotal;
  const resolved: ResolvedReceiptDiscount[] = [];

  for (const discount of discounts) {
    const resolved_amount = resolveDiscountAmount(discount, remaining);
    resolved.push({ ...discount, resolved_amount });
    remaining = Number(Math.max(0, remaining - resolved_amount).toFixed(2));
  }

  return resolved;
}

export function computeReceiptGrandTotal(
  subtotal: number,
  fees: number,
  tax: number,
  tip: number,
  discountTotal: number,
): number {
  return Number(Math.max(0, subtotal + fees + tax + tip - discountTotal).toFixed(2));
}
