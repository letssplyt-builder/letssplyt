import type { ReceiptDiscountType } from '@letssplyt/shared/receipt.types';

export type ReceiptDiscountScope = 'bill' | 'item';

/** Raw discount row from A1 before item ids are assigned. */
export interface ParsedReceiptDiscount {
  name: string;
  type: ReceiptDiscountType;
  value: number;
  scope: ReceiptDiscountScope;
  item_index?: number;
}

const DISCOUNT_NAME_FALLBACK = 'Discount';

function normalizeDiscountName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) {
    return DISCOUNT_NAME_FALLBACK;
  }
  return name.trim().slice(0, 60);
}

function normalizeDiscountType(value: unknown): ReceiptDiscountType {
  return value === 'percent' ? 'percent' : 'amount';
}

/**
 * Convert negative-price lines and negative fee rows into structured discounts.
 * Negative item lines immediately after a positive item → item-scoped discount.
 * Standalone negative lines → bill-scoped.
 */
export function extractDiscountsFromNegativeLines(
  rawItems: unknown[],
  rawCharges: unknown[] | undefined,
): ParsedReceiptDiscount[] {
  const discounts: ParsedReceiptDiscount[] = [];
  let lastPositiveIndex = -1;

  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const unitPrice = row.unit_price;

    if (typeof unitPrice === 'number' && unitPrice > 0) {
      lastPositiveIndex += 1;
      continue;
    }

    if (typeof unitPrice === 'number' && unitPrice < 0) {
      const value = Number(Math.abs(unitPrice).toFixed(2));
      const scope: ReceiptDiscountScope =
        lastPositiveIndex >= 0 ? 'item' : 'bill';
      const discount: ParsedReceiptDiscount = {
        name: normalizeDiscountName(row.name),
        type: 'amount',
        value,
        scope,
      };
      if (scope === 'item') {
        discount.item_index = lastPositiveIndex;
      }
      discounts.push(discount);
    }
  }

  if (Array.isArray(rawCharges)) {
    for (const entry of rawCharges) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const row = entry as Record<string, unknown>;
      const amount = row.amount;
      if (typeof amount === 'number' && amount < 0) {
        discounts.push({
          name: normalizeDiscountName(row.name),
          type: 'amount',
          value: Number(Math.abs(amount).toFixed(2)),
          scope: 'bill',
        });
      }
    }
  }

  return discounts;
}

function asParsedDiscount(entry: unknown): ParsedReceiptDiscount | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  const row = entry as Record<string, unknown>;
  const value = row.value ?? row.amount;
  if (typeof value !== 'number' || value <= 0) {
    return null;
  }

  const scope: ReceiptDiscountScope = row.scope === 'item' ? 'item' : 'bill';
  const discount: ParsedReceiptDiscount = {
    name: normalizeDiscountName(row.name),
    type: normalizeDiscountType(row.type),
    value: Number(value.toFixed(2)),
    scope,
  };

  if (scope === 'item' && typeof row.item_index === 'number' && row.item_index >= 0) {
    discount.item_index = Math.floor(row.item_index);
  }

  return discount;
}

export function mergeParsedDiscounts(
  fromModel: unknown,
  fromNegatives: ParsedReceiptDiscount[],
  positiveItemCount: number,
): ParsedReceiptDiscount[] {
  const merged: ParsedReceiptDiscount[] = [];

  if (Array.isArray(fromModel)) {
    for (const entry of fromModel) {
      const parsed = asParsedDiscount(entry);
      if (!parsed) {
        continue;
      }
      if (
        parsed.scope === 'item' &&
        parsed.item_index !== undefined &&
        parsed.item_index >= positiveItemCount
      ) {
        parsed.scope = 'bill';
        delete parsed.item_index;
      }
      merged.push(parsed);
    }
  }

  merged.push(...fromNegatives);
  return merged;
}

/** Map A1 discount rows (item_index) to API lines (item_id). */
export function mapParsedDiscountsToApiLines(
  discounts: ParsedReceiptDiscount[],
  items: Array<{ id: string }>,
): Array<{
  name: string;
  type: ReceiptDiscountType;
  value: number;
  scope: ReceiptDiscountScope;
  item_id?: string;
}> {
  return discounts.map((discount) => {
    const scope = discount.scope;
    if (scope === 'item' && discount.item_index !== undefined && items[discount.item_index]) {
      return {
        name: discount.name,
        type: discount.type,
        value: discount.value,
        scope: 'item',
        item_id: items[discount.item_index].id,
      };
    }

    return {
      name: discount.name,
      type: discount.type,
      value: discount.value,
      scope: 'bill',
    };
  });
}
