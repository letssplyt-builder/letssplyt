import type { ReceiptDiscountLine, ReceiptParseResponse } from '@letssplyt/shared/receipt.types';
import {
  computeReceiptGrandTotal,
  resolveDiscountsTotal,
  resolveReceiptDiscounts,
  type ReceiptLineForDiscount,
} from '@letssplyt/shared/utils/receiptDiscounts';

export type EditableReviewItem = ReceiptParseResponse['items'][number] & {
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

export function snapshotToEditable(snapshot: {
  items: ReceiptParseResponse['items'];
  additional_charges: ReceiptParseResponse['additional_charges'];
  discounts: ReceiptDiscountLine[];
  tax_amount: number;
  tip_amount: number;
}): {
  items: EditableReviewItem[];
  charges: ReceiptParseResponse['additional_charges'];
  discounts: EditableReviewDiscount[];
  tax: string;
  tip: string;
} {
  const items: EditableReviewItem[] = snapshot.items.map((item, index) => ({
    ...item,
    localId: item.id ? `food-${item.id}` : `food-${index}-${item.name}`,
    is_fee: false,
  }));
  const charges = snapshot.additional_charges.map((charge) => ({ ...charge }));
  const discounts = snapshot.discounts.map((discount, index) => ({
    ...discount,
    scope: discount.scope ?? 'bill',
    localId: discount.item_id
      ? `discount-item-${discount.item_id}`
      : `discount-${index}-${discount.name}`,
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
  parseResult: ReceiptParseResponse,
): {
  items: ReceiptParseResponse['items'];
  additional_charges: ReceiptParseResponse['additional_charges'];
  discounts: ReceiptDiscountLine[];
  tax_amount: number;
  tip_amount: number;
  fees_amount: number;
  discount_amount: number;
  currency: string;
} {
  const itemLines = discountItemLines(parseResult.items);
  const itemsSubtotal = computeItemsSubtotal(
    parseResult.items.map((item, index) => ({
      ...item,
      localId: item.id ? `food-${item.id}` : `food-${index}`,
      is_fee: false,
    })),
  );
  const discountTotal = resolveDiscountsTotal(
    parseResult.discounts ?? [],
    itemsSubtotal,
    itemLines,
  );

  return {
    items: parseResult.items,
    additional_charges: parseResult.additional_charges,
    discounts: (parseResult.discounts ?? []).map((discount) => ({
      ...discount,
      scope: discount.scope ?? 'bill',
    })),
    tax_amount: parseResult.tax_amount,
    tip_amount: parseResult.tip_amount,
    fees_amount: parseResult.fees_amount,
    discount_amount: discountTotal,
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

function discountItemLines(items: EditableReviewItem[]): ReceiptLineForDiscount[] {
  return items
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id!,
      unit_price: item.unit_price,
      quantity: item.quantity,
    }));
}

export function computeItemsSubtotal(items: EditableReviewItem[]): number {
  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  return Number(total.toFixed(2));
}

export function computeChargesTotal(
  charges: ReceiptParseResponse['additional_charges'],
): number {
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return Number(total.toFixed(2));
}

export function computeDiscountTotal(
  discounts: EditableReviewDiscount[],
  items: EditableReviewItem[],
): number {
  const itemLines = discountItemLines(items);
  return resolveDiscountsTotal(discounts, computeItemsSubtotal(items), itemLines);
}

export function computeDiscountLineAmount(
  discount: EditableReviewDiscount,
  items: EditableReviewItem[],
  priorDiscounts: EditableReviewDiscount[],
): number {
  const itemLines = discountItemLines(items);
  const subtotal = computeItemsSubtotal(items);
  const linesArg = itemLines.length > 0 ? itemLines : undefined;
  const allResolved = resolveReceiptDiscounts(
    [...priorDiscounts, discount],
    subtotal,
    linesArg,
  );
  const priorResolved = resolveReceiptDiscounts(priorDiscounts, subtotal, linesArg);
  const total = allResolved.reduce((sum, row) => sum + row.resolved_amount, 0);
  const priorTotal = priorResolved.reduce((sum, row) => sum + row.resolved_amount, 0);
  return Number((total - priorTotal).toFixed(2));
}

export function itemLabelForDiscount(
  discount: EditableReviewDiscount,
  items: EditableReviewItem[],
): string | null {
  if (discount.scope !== 'item' || !discount.item_id) {
    return null;
  }
  const item = items.find((row) => row.id === discount.item_id);
  return item?.name ?? null;
}

export function computeReviewTotal(
  items: EditableReviewItem[],
  charges: ReceiptParseResponse['additional_charges'],
  discounts: EditableReviewDiscount[],
  taxInput: string,
  tipInput: string,
): number {
  const subtotal = computeItemsSubtotal(items);
  const fees = computeChargesTotal(charges);
  const discountTotal = computeDiscountTotal(discounts, items);
  const tax = parseAmountInput(taxInput);
  const tip = parseAmountInput(tipInput);
  return computeReceiptGrandTotal(subtotal, fees, tax, tip, discountTotal);
}

/** Build parse-shaped payload for ItemReview from GET event receipt_review. */
export function receiptReviewToParseResult(
  review: {
    items: ReceiptParseResponse['items'];
    additional_charges: ReceiptParseResponse['additional_charges'];
    discounts: ReceiptDiscountLine[];
    tax_amount: number;
    tip_amount: number;
    fees_amount: number;
    discount_amount: number;
    currency: string;
  },
  storagePath = '',
): ReceiptParseResponse {
  const editableItems = review.items.map((item, index) => ({
    ...item,
    localId: item.id ? `food-${item.id}` : `food-${index}`,
    is_fee: false as const,
  }));
  const itemLines = discountItemLines(editableItems);
  const itemsSubtotal = computeItemsSubtotal(editableItems);
  const discountTotal =
    review.discount_amount ??
    resolveDiscountsTotal(review.discounts, itemsSubtotal, itemLines);
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
    discounts: review.discounts,
    tax_amount: review.tax_amount,
    tip_amount: review.tip_amount,
    fees_amount: review.fees_amount,
    total_amount: totalAmount,
    currency: review.currency,
    storage_path: storagePath,
  };
}
