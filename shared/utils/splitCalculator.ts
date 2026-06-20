/**
 * Pure TypeScript split arithmetic — no AI, network, or database.
 * All money flows internally in minor units; outputs are major-unit decimals.
 */

export interface ConfirmedReceiptItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

export interface Assignment {
  item_id: string;
  assigned_to: string[];
}

export interface ReceiptTotals {
  subtotal: number;
  tax: number;
  fees: number;
  tip: number;
  /** Total discount off the bill (positive number). Prorated like tax/fees in itemised splits. */
  discounts: number;
  total: number;
}

export interface ParticipantSplit {
  participantName: string;
  amountOwed: number;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY',
  'KRW',
  'VND',
  'CLP',
  'IDR',
  'HUF',
  'TWD',
  'UGX',
  'RWF',
]);

const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'KWD', 'OMR', 'JOD', 'TND']);

export function getCurrencyMinorUnits(currencyCode: string): number {
  const code = currencyCode.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

export function toMinorUnits(amount: number, currencyCode: string): number {
  const exp = getCurrencyMinorUnits(currencyCode);
  return Math.round(amount * Math.pow(10, exp));
}

export function fromMinorUnits(minorAmount: number, currencyCode: string): number {
  const exp = getCurrencyMinorUnits(currencyCode);
  return minorAmount / Math.pow(10, exp);
}

/**
 * Largest-remainder rounding in minor units.
 * Input shares are major-unit fractional amounts (e.g. 3.333... USD).
 * Tiebreaker: lowest index receives an extra minor unit first.
 */
export function largestRemainderRound(shares: number[], currency: string): number[] {
  if (shares.length === 0) return [];

  const multiplier = Math.pow(10, getCurrencyMinorUnits(currency));
  const targetMinor = Math.round(shares.reduce((a, b) => a + b, 0) * multiplier);

  const withFloor = shares.map((amount, index) => {
    const amountMinor = amount * multiplier;
    const flooredMinor = Math.floor(amountMinor);
    return {
      flooredMinor,
      remainder: amountMinor - flooredMinor,
      index,
    };
  });

  const flooredSum = withFloor.reduce((sum, entry) => sum + entry.flooredMinor, 0);
  let unitsLeft = targetMinor - flooredSum;

  const indexed = [...withFloor];
  indexed.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-10) {
      return b.remainder - a.remainder;
    }
    return a.index - b.index;
  });

  const result = new Array<number>(shares.length);
  for (const entry of indexed) {
    const extra = unitsLeft > 0 ? 1 : 0;
    result[entry.index] = entry.flooredMinor + extra;
    if (unitsLeft > 0) unitsLeft -= 1;
  }

  return result;
}

export function calculateSplits(
  items: ConfirmedReceiptItem[],
  assignments: Assignment[],
  totals: ReceiptTotals,
  participantNames: string[],
  currencyCode: string = 'USD',
): ParticipantSplit[] {
  if (participantNames.length === 0) {
    throw new Error('At least one participant is required');
  }

  const itemMap = new Map(items.map((item) => [item.id, item]));
  const rawAmountsMinor = new Map<string, number>(
    participantNames.map((name) => [name, 0]),
  );

  for (const assignment of assignments) {
    const item = itemMap.get(assignment.item_id);
    if (!item) {
      throw new Error(`Unknown item id: ${assignment.item_id}`);
    }
    if (assignment.assigned_to.length === 0) {
      throw new Error(`Item ${assignment.item_id} has no assignees`);
    }

    const totalItemMinor = toMinorUnits(item.unit_price * item.quantity, currencyCode);
    const sharePerPersonMinor = Math.floor(totalItemMinor / assignment.assigned_to.length);
    const remainderMinor = totalItemMinor % assignment.assigned_to.length;

    for (let i = 0; i < assignment.assigned_to.length; i++) {
      const participant = assignment.assigned_to[i];
      if (!rawAmountsMinor.has(participant)) {
        throw new Error(`Unknown participant: "${participant}"`);
      }
      const extra = i === 0 ? remainderMinor : 0;
      rawAmountsMinor.set(
        participant,
        rawAmountsMinor.get(participant)! + sharePerPersonMinor + extra,
      );
    }
  }

  const subtotalMinor = toMinorUnits(totals.subtotal, currencyCode);
  const assignedSubtotalMinor = Array.from(rawAmountsMinor.values()).reduce((a, b) => a + b, 0);

  if (Math.abs(assignedSubtotalMinor - subtotalMinor) > 2) {
    throw new Error(
      `Subtotal mismatch: assignments sum to ${fromMinorUnits(assignedSubtotalMinor, currencyCode)}, ` +
        `receipt subtotal is ${totals.subtotal}`,
    );
  }

  const taxFeesTipAndDiscountMinor = toMinorUnits(
    totals.tax + totals.fees + totals.tip - totals.discounts,
    currencyCode,
  );

  const finalAmounts = new Map<string, number>();

  for (const [name, itemMinor] of rawAmountsMinor) {
    const proportion =
      assignedSubtotalMinor > 0
        ? itemMinor / assignedSubtotalMinor
        : 1 / participantNames.length;
    const totalMajor = fromMinorUnits(
      itemMinor + taxFeesTipAndDiscountMinor * proportion,
      currencyCode,
    );
    finalAmounts.set(name, totalMajor);
  }

  const participantIds = Array.from(finalAmounts.keys());
  const fractionalShares = participantIds.map((id) => finalAmounts.get(id)!);
  const roundedMinorUnits = largestRemainderRound(fractionalShares, currencyCode);

  const roundedMinorByName = new Map(
    participantIds.map((id, i) => [id, roundedMinorUnits[i]]),
  );

  const sumMinor = roundedMinorUnits.reduce((a, b) => a + b, 0);
  const targetTotalMinor = toMinorUnits(totals.total, currencyCode);
  if (Math.abs(sumMinor - targetTotalMinor) > 1) {
    throw new Error(
      `Sum invariant violated: rounded amounts sum to ${fromMinorUnits(sumMinor, currencyCode)}, ` +
        `expected ${totals.total}`,
    );
  }

  return participantNames.map((name) => ({
    participantName: name,
    amountOwed: fromMinorUnits(roundedMinorByName.get(name)!, currencyCode),
  }));
}
