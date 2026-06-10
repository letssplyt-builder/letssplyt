import type {
  ReceiptAdditionalCharge,
  ReceiptParseResponse,
  ReceiptParseResultItem,
  ReceiptReviewSnapshot,
} from '@letssplyt/shared/receipt.types';

export type EditableReviewItem = ReceiptParseResultItem & {
  localId: string;
  id?: string;
  is_fee: boolean;
};

export function createLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function snapshotToEditable(snapshot: ReceiptReviewSnapshot): {
  items: EditableReviewItem[];
  charges: ReceiptAdditionalCharge[];
  tax: string;
  tip: string;
} {
  const items: EditableReviewItem[] = snapshot.items.map((item, index) => ({
    ...item,
    localId: `food-${index}-${item.name}`,
    is_fee: false,
  }));
  const charges = snapshot.additional_charges.map((charge) => ({ ...charge }));
  return {
    items,
    charges,
    tax: formatAmountInput(snapshot.tax_amount),
    tip: formatAmountInput(snapshot.tip_amount),
  };
}

export function parseResultToSnapshot(
  parseResult: ReceiptReviewSnapshot & { storage_path?: string },
): ReceiptReviewSnapshot {
  return {
    items: parseResult.items,
    additional_charges: parseResult.additional_charges,
    tax_amount: parseResult.tax_amount,
    tip_amount: parseResult.tip_amount,
    fees_amount: parseResult.fees_amount,
    currency: parseResult.currency,
  };
}

export function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function parseAmountInput(value: string): number {
  const parsed = Number.parseFloat(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeItemsSubtotal(items: EditableReviewItem[]): number {
  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  return Number(total.toFixed(2));
}

export function computeChargesTotal(charges: ReceiptAdditionalCharge[]): number {
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return Number(total.toFixed(2));
}

export function computeReviewTotal(
  items: EditableReviewItem[],
  charges: ReceiptAdditionalCharge[],
  taxInput: string,
  tipInput: string,
): number {
  const subtotal = computeItemsSubtotal(items);
  const fees = computeChargesTotal(charges);
  const tax = parseAmountInput(taxInput);
  const tip = parseAmountInput(tipInput);
  return Number((subtotal + fees + tax + tip).toFixed(2));
}

/** Build parse-shaped payload for ItemReview from GET event receipt_review. */
export function receiptReviewToParseResult(
  review: ReceiptReviewSnapshot,
  storagePath = '',
): ReceiptParseResponse {
  const itemsSubtotal = review.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
  const totalAmount = Number(
    (itemsSubtotal + review.tax_amount + review.fees_amount + review.tip_amount).toFixed(2),
  );
  return {
    items: review.items,
    additional_charges: review.additional_charges,
    tax_amount: review.tax_amount,
    tip_amount: review.tip_amount,
    fees_amount: review.fees_amount,
    total_amount: totalAmount,
    currency: review.currency,
    storage_path: storagePath,
  };
}
