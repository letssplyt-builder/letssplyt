import type { ReceiptDiscountLine } from '@letssplyt/shared/receipt.types';
import {
  resolveItemLineDiscounts,
  sumBillDiscountResolved,
} from '@letssplyt/shared/utils/receiptDiscounts';
import {
  fromMinorUnits,
  largestRemainderRound,
} from '@letssplyt/shared/utils/splitCalculator';

export type SplitEntryTab = 'even' | 'amount' | 'percent' | 'portion';

export interface SplitFoodItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  /** Resolved item-scoped discount for this line. */
  line_discount: number;
}

export interface SplitPricedItem {
  id: string;
  name: string;
  /** Gross line total (unit_price × quantity). */
  price: number;
  lineDiscount: number;
  netPrice: number;
}

export interface SplitLineExplainer {
  name: string;
  /** Human-readable math for this person's share of the line. */
  detail: string;
}

export interface SplitPersonExplainer {
  participant_id: string;
  lines: SplitLineExplainer[];
}

const AVATAR_PALETTE = ['#6366F1', '#0E5C66', '#7C3AED', '#EC4899', '#F59E0B', '#14B8A6'];

export function avatarColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function formatSplitMoney(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  const zeroDecimal = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'TWD', 'UGX', 'RWF']);
  const threeDecimal = new Set(['BHD', 'KWD', 'OMR', 'JOD', 'TND']);
  const decimals = zeroDecimal.has(code) ? 0 : threeDecimal.has(code) ? 3 : 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function parseNumericInput(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeEvenAmounts(total: number, count: number, currency: string): number[] {
  if (count <= 0) return [];
  const share = total / count;
  const minor = largestRemainderRound(Array(count).fill(share), currency);
  return minor.map((m) => fromMinorUnits(m, currency));
}

export function amountsFromPercents(
  percentages: number[],
  total: number,
  currency: string,
): number[] {
  const fractional = percentages.map((p) => (p / 100) * total);
  const minor = largestRemainderRound(fractional, currency);
  return minor.map((m) => fromMinorUnits(m, currency));
}

export function isWithinMoneyTolerance(sum: number, target: number, currency: string): boolean {
  const code = currency.toUpperCase();
  const zeroDecimal = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'TWD', 'UGX', 'RWF']);
  const tolerance = zeroDecimal.has(code) ? 1 : 0.01;
  return Math.abs(sum - target) <= tolerance;
}

export function isPercentTotalValid(percentages: number[]): boolean {
  const sum = percentages.reduce((a, b) => a + b, 0);
  return Math.round(sum) === 100;
}

export function allItemsAssigned(
  itemIds: string[],
  assignments: Map<string, string[]>,
): boolean {
  if (itemIds.length === 0) return false;
  return itemIds.every((id) => (assignments.get(id)?.length ?? 0) > 0);
}

export function attachLineDiscountsToFoodItems(
  items: Array<{ id: string; name: string; unit_price: number; quantity: number }>,
  discounts: ReceiptDiscountLine[],
): SplitFoodItem[] {
  const lineDiscounts = resolveItemLineDiscounts(
    items.map((item) => ({
      id: item.id,
      unit_price: item.unit_price,
      quantity: item.quantity,
    })),
    discounts.map((discount) => ({
      name: discount.name,
      type: discount.type,
      value: discount.value,
      scope: discount.scope ?? 'bill',
      item_id: discount.item_id,
    })),
  );

  return items.map((item) => ({
    ...item,
    line_discount: lineDiscounts.get(item.id) ?? 0,
  }));
}

export function toPricedSplitItems(items: SplitFoodItem[]): SplitPricedItem[] {
  return items.map((item) => {
    const price = Number((item.unit_price * item.quantity).toFixed(2));
    const lineDiscount = Number((item.line_discount ?? 0).toFixed(2));
    const netPrice = Number(Math.max(0, price - lineDiscount).toFixed(2));
    return {
      id: item.id,
      name: item.name,
      price,
      lineDiscount,
      netPrice,
    };
  });
}

export function hasBillScopedDiscounts(
  items: SplitFoodItem[],
  discounts: ReceiptDiscountLine[],
): boolean {
  if (discounts.length === 0) return false;
  const billTotal = sumBillDiscountResolved(
    items.map((item) => ({
      id: item.id,
      unit_price: item.unit_price,
      quantity: item.quantity,
    })),
    discounts.map((discount) => ({
      name: discount.name,
      type: discount.type,
      value: discount.value,
      scope: discount.scope ?? 'bill',
      item_id: discount.item_id,
    })),
  );
  return billTotal > 0;
}

/** Build per-person item math for Split Review (client-side; no API change). */
export function buildSplitPersonExplainers(
  items: SplitPricedItem[],
  assignments: Map<string, string[]>,
  currency: string,
): SplitPersonExplainer[] {
  const byParticipant = new Map<string, SplitLineExplainer[]>();

  for (const item of items) {
    const assigneeIds = assignments.get(item.id) ?? [];
    if (assigneeIds.length === 0) continue;

    const shareNet = Number((item.netPrice / assigneeIds.length).toFixed(2));
    const detail =
      item.lineDiscount > 0
        ? assigneeIds.length > 1
          ? `${formatSplitMoney(item.price, currency)} − ${formatSplitMoney(item.lineDiscount, currency)} → ${formatSplitMoney(item.netPrice, currency)} ÷ ${assigneeIds.length} = ${formatSplitMoney(shareNet, currency)}`
          : `${formatSplitMoney(item.price, currency)} − ${formatSplitMoney(item.lineDiscount, currency)} → ${formatSplitMoney(item.netPrice, currency)}`
        : assigneeIds.length > 1
          ? `${formatSplitMoney(item.price, currency)} ÷ ${assigneeIds.length} = ${formatSplitMoney(shareNet, currency)}`
          : formatSplitMoney(item.price, currency);

    for (const participantId of assigneeIds) {
      const lines = byParticipant.get(participantId) ?? [];
      lines.push({ name: item.name, detail });
      byParticipant.set(participantId, lines);
    }
  }

  return Array.from(byParticipant.entries()).map(([participant_id, lines]) => ({
    participant_id,
    lines,
  }));
}
