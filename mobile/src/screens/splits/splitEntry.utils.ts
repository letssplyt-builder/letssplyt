import {
  fromMinorUnits,
  largestRemainderRound,
} from '@letssplyt/shared/utils/splitCalculator';

export type SplitEntryTab = 'even' | 'amount' | 'percent' | 'portion';

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
