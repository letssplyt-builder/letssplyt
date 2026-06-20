import type {
  ReceiptAdditionalCharge,
  ReceiptDiscountLine,
  ReceiptParseResponse,
  ReceiptParseResultItem,
  ReceiptReviewSnapshot,
} from '@letssplyt/shared/receipt.types';
import {
  computeReceiptGrandTotal,
  resolveDiscountAmount,
  resolveDiscountsTotal,
} from '@letssplyt/shared/utils/receiptDiscounts';

export type EditableReviewItem = ReceiptParseResultItem & {
  localId: string;
  id?: string;
  is_fee: boolean;
};

export type EditableReviewDiscount = ReceiptDiscountLine & {
  localId: string;
};

export function createLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function snapshotToEditable(snapshot: ReceiptReviewSnapshot): {
  items: EditableReviewItem[];
  charges: ReceiptAdditionalCharge[];
  discounts: EditableReviewDiscount[];
  tax: string;
  tip: string;
} {
  const items: EditableReviewItem[] = snapshot.items.map((item, index) => ({
    ...item,
    localId: `food-${index}-${item.name}`,
    is_fee: false,
  }));
  const charges = snapshot.additional_charges.map((charge) => ({ ...charge }));
  const discounts = snapshot.discounts.map((discount, index) => ({
    ...discount,
    localId: `discount-${index}-${discount.name}`,
  }));
  return {
    items,
    charges,
    discounts,
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
    discounts: parseResult.discounts ?? [],
    tax_amount: parseResult.tax_amount,
    tip_amount: parseResult.tip_amount,
    fees_amount: parseResult.fees_amount,
    discount_amount: parseResult.discount_amount ?? 0,
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

export function computeDiscountTotal(
  discounts: EditableReviewDiscount[],
  itemsSubtotal: number,
): number {
  return resolveDiscountsTotal(discounts, itemsSubtotal);
}

export function computeDiscountLineAmount(
  discount: EditableReviewDiscount,
  itemsSubtotal: number,
  priorDiscounts: EditableReviewDiscount[],
): number {
  const priorTotal = resolveDiscountsTotal(priorDiscounts, itemsSubtotal);
  const remaining = Number(Math.max(0, itemsSubtotal - priorTotal).toFixed(2));
  return resolveDiscountAmount(discount, remaining);
}

export function computeReviewTotal(
  items: EditableReviewItem[],
  charges: ReceiptAdditionalCharge[],
  discounts: EditableReviewDiscount[],
  taxInput: string,
  tipInput: string,
): number {
  const subtotal = computeItemsSubtotal(items);
  const fees = computeChargesTotal(charges);
  const discountTotal = computeDiscountTotal(discounts, subtotal);
  const tax = parseAmountInput(taxInput);
  const tip = parseAmountInput(tipInput);
  return computeReceiptGrandTotal(subtotal, fees, tax, tip, discountTotal);
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
  const discountTotal = review.discount_amount ?? resolveDiscountsTotal(review.discounts, itemsSubtotal);
  const totalAmount = computeReceiptGrandTotal(
    itemsSubtotal,
    review.fees_amount,
    review.tax_amount,
    review.tip_amount,
    discountTotal,
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
