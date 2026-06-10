import type { AdditionalCharge, ReceiptParseResult } from './receipt-parser.schema';

const AMOUNT_TOLERANCE = 0.02;

/** Normalise fee labels for fuzzy match (SVC Fee ≈ SVC Fees). */
export function normalizeFeeLabel(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stripTrailingS(label: string): string {
  return label.endsWith('s') ? label.slice(0, -1) : label;
}

/** True when item name and charge name likely refer to the same receipt line. */
export function feeNamesLikelyMatch(itemName: string, chargeName: string): boolean {
  const a = normalizeFeeLabel(itemName);
  const b = normalizeFeeLabel(chargeName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  if (stripTrailingS(a) === stripTrailingS(b)) return true;
  return false;
}

export function itemLineTotal(item: { unit_price: number; quantity: number }): number {
  return Number((item.unit_price * item.quantity).toFixed(2));
}

export function amountsRoughlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

/**
 * Item duplicates an additional_charge when line total and label both align.
 * A1 sometimes returns the same surcharge in both arrays (e.g. "SVC Fee" in items and additional_charges).
 */
export function itemDuplicatesAdditionalCharge(
  item: { name: string; unit_price: number; quantity: number },
  charges: AdditionalCharge[],
): boolean {
  const lineTotal = itemLineTotal(item);
  return charges.some(
    (charge) =>
      amountsRoughlyEqual(lineTotal, charge.amount) &&
      feeNamesLikelyMatch(item.name, charge.name),
  );
}

function recalculateSubtotal(
  items: ReceiptParseResult['items'],
): number {
  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  return Number(total.toFixed(2));
}

/**
 * Remove food-line duplicates of additional_charges before DB persist.
 * Keeps at least one item row so Zod min(1) invariant holds for re-parsed results.
 */
export function dedupeFeeLineItems(result: ReceiptParseResult): ReceiptParseResult {
  const charges = result.additional_charges;
  if (charges.length === 0) {
    return result;
  }

  const filtered = result.items.filter((item) => !itemDuplicatesAdditionalCharge(item, charges));
  const items = filtered.length > 0 ? filtered : result.items;

  if (items.length === result.items.length) {
    return result;
  }

  return {
    ...result,
    items,
    subtotal: recalculateSubtotal(items),
  };
}
