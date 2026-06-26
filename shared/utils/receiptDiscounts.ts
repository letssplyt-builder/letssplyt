import type {
  ReceiptDiscountInput,
  ReceiptDiscountType,
} from '../types/receipt.types';

export type ReceiptDiscountScope = 'bill' | 'item';

export interface ReceiptLineForDiscount {
  id: string;
  unit_price: number;
  quantity: number;
}

export interface ResolvedReceiptDiscount extends ReceiptDiscountInput {
  scope: ReceiptDiscountScope;
  resolved_amount: number;
}

function lineTotal(item: ReceiptLineForDiscount): number {
  return Number((item.unit_price * item.quantity).toFixed(2));
}

/** Resolve one discount against a remaining amount cap. */
export function resolveDiscountAmount(
  discount: ReceiptDiscountInput,
  remainingAmount: number,
): number {
  if (remainingAmount <= 0 || discount.value <= 0) {
    return 0;
  }

  let amount =
    discount.type === 'percent'
      ? remainingAmount * (discount.value / 100)
      : discount.value;

  amount = Number(amount.toFixed(2));
  return Math.min(Math.max(amount, 0), remainingAmount);
}

/** Bill-level discounts stacked sequentially on a subtotal (legacy / manual-only). */
export function resolveBillDiscounts(
  discounts: ReceiptDiscountInput[],
  itemsSubtotal: number,
): ResolvedReceiptDiscount[] {
  let remaining = itemsSubtotal;
  const resolved: ResolvedReceiptDiscount[] = [];

  for (const discount of discounts) {
    const resolved_amount = resolveDiscountAmount(discount, remaining);
    resolved.push({ ...discount, scope: 'bill', resolved_amount });
    remaining = Number(Math.max(0, remaining - resolved_amount).toFixed(2));
  }

  return resolved;
}

/**
 * Resolve item-scoped discounts against their line totals, then bill-scoped on the remainder.
 */
export function resolveAllReceiptDiscounts(
  items: ReceiptLineForDiscount[],
  discounts: ReceiptDiscountInput[],
): ResolvedReceiptDiscount[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const itemDiscountApplied = new Map<string, number>();
  const resolved: ResolvedReceiptDiscount[] = [];

  for (const discount of discounts) {
    const scope = discount.scope ?? 'bill';
    if (scope !== 'item' || !discount.item_id) {
      continue;
    }

    const item = itemMap.get(discount.item_id);
    if (!item) {
      continue;
    }

    const already = itemDiscountApplied.get(discount.item_id) ?? 0;
    const remainingLine = Number(Math.max(0, lineTotal(item) - already).toFixed(2));
    const resolved_amount = resolveDiscountAmount(discount, remainingLine);
    itemDiscountApplied.set(
      discount.item_id,
      Number((already + resolved_amount).toFixed(2)),
    );
    resolved.push({
      ...discount,
      scope: 'item',
      item_id: discount.item_id,
      resolved_amount,
    });
  }

  const grossSubtotal = Number(
    items.reduce((sum, item) => sum + lineTotal(item), 0).toFixed(2),
  );
  let itemDiscountSum = 0;
  for (const amount of itemDiscountApplied.values()) {
    itemDiscountSum += amount;
  }
  itemDiscountSum = Number(itemDiscountSum.toFixed(2));

  let remaining = Number(Math.max(0, grossSubtotal - itemDiscountSum).toFixed(2));

  for (const discount of discounts) {
    const scope = discount.scope ?? 'bill';
    if (scope === 'item' && discount.item_id) {
      continue;
    }

    const resolved_amount = resolveDiscountAmount(discount, remaining);
    resolved.push({
      ...discount,
      scope: 'bill',
      resolved_amount,
    });
    remaining = Number(Math.max(0, remaining - resolved_amount).toFixed(2));
  }

  return resolved;
}

/** Sum of all resolved discounts (item + bill). */
export function resolveDiscountsTotal(
  discounts: ReceiptDiscountInput[],
  itemsSubtotal: number,
  items?: ReceiptLineForDiscount[],
): number {
  const resolved =
    items && items.length > 0
      ? resolveAllReceiptDiscounts(items, discounts)
      : resolveBillDiscounts(discounts, itemsSubtotal);

  return Number(resolved.reduce((sum, row) => sum + row.resolved_amount, 0).toFixed(2));
}

export function resolveReceiptDiscounts(
  discounts: ReceiptDiscountInput[],
  itemsSubtotal: number,
  items?: ReceiptLineForDiscount[],
): ResolvedReceiptDiscount[] {
  if (items && items.length > 0) {
    return resolveAllReceiptDiscounts(items, discounts);
  }
  return resolveBillDiscounts(discounts, itemsSubtotal);
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

/** Sum of resolved bill-scoped discount amounts (for split proration). */
export function sumBillDiscountResolved(
  items: ReceiptLineForDiscount[],
  discounts: ReceiptDiscountInput[],
): number {
  return resolveAllReceiptDiscounts(items, discounts)
    .filter((row) => row.scope === 'bill')
    .reduce((sum, row) => sum + row.resolved_amount, 0);
}

/** Per-item resolved discount totals for split line math. */
export function resolveItemLineDiscounts(
  items: ReceiptLineForDiscount[],
  discounts: ReceiptDiscountInput[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of resolveAllReceiptDiscounts(items, discounts)) {
    if (row.scope === 'item' && row.item_id) {
      map.set(row.item_id, (map.get(row.item_id) ?? 0) + row.resolved_amount);
    }
  }
  for (const [id, amount] of map) {
    map.set(id, Number(amount.toFixed(2)));
  }
  return map;
}

export type { ReceiptDiscountType };

// Re-export input type for consumers that import from this module.
export type { ReceiptDiscountInput } from '../types/receipt.types';
