/**
 * Live smoke test for shared/utils/splitCalculator.ts (E07-S04).
 * No server required — exercises pure arithmetic with realistic bill scenarios.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/smoke-split-calculator.ts
 */
import {
  calculateSplits,
  fromMinorUnits,
  largestRemainderRound,
  toMinorUnits,
  type Assignment,
  type ConfirmedReceiptItem,
  type ReceiptTotals,
} from '../../shared/utils/splitCalculator';

type StepResult = { name: string; ok: boolean; detail: string };

const results: StepResult[] = [];

function pass(name: string, detail = 'ok'): void {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}: ${detail}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

function assertSumInvariant(
  name: string,
  splits: Array<{ amountOwed: number }>,
  expectedTotal: number,
  currency: string,
): void {
  const sumMinor = splits.reduce((acc, row) => acc + toMinorUnits(row.amountOwed, currency), 0);
  const targetMinor = toMinorUnits(expectedTotal, currency);
  if (Math.abs(sumMinor - targetMinor) <= 1) {
    pass(name, `sum ${fromMinorUnits(sumMinor, currency)} ≈ ${expectedTotal} ${currency}`);
  } else {
    fail(
      name,
      `sum invariant broken: got ${fromMinorUnits(sumMinor, currency)}, expected ${expectedTotal}`,
    );
  }
}

function run(): void {
  console.log('LetsSplyt splitCalculator smoke test (E07-S04)\n');

  // 1. Largest remainder — USD $10 three-way
  const usdShares = largestRemainderRound([10 / 3, 10 / 3, 10 / 3], 'USD');
  if (usdShares.join(',') === '334,333,333' && usdShares.reduce((a, b) => a + b, 0) === 1000) {
    pass('USD largestRemainderRound $10 ÷ 3', usdShares.join(', '));
  } else {
    fail('USD largestRemainderRound $10 ÷ 3', usdShares.join(', '));
  }

  // 2. JPY ¥1000 three-way (no ×100 bug)
  const jpyShares = largestRemainderRound([1000 / 3, 1000 / 3, 1000 / 3], 'JPY');
  if (jpyShares.reduce((a, b) => a + b, 0) === 1000) {
    pass('JPY largestRemainderRound ¥1000 ÷ 3', jpyShares.join(', '));
  } else {
    fail('JPY largestRemainderRound ¥1000 ÷ 3', jpyShares.join(', '));
  }

  // 3. BHD 10.000 three-way
  const bhdShares = largestRemainderRound([10 / 3, 10 / 3, 10 / 3], 'BHD');
  if (bhdShares.reduce((a, b) => a + b, 0) === 10000) {
    pass('BHD largestRemainderRound 10.000 ÷ 3', bhdShares.join(', '));
  } else {
    fail('BHD largestRemainderRound 10.000 ÷ 3', bhdShares.join(', '));
  }

  // 4. Realistic itemised dinner (USD)
  const participants = ['Alex', 'Jordan', 'Sam'];
  const items: ConfirmedReceiptItem[] = [
    { id: 'burger', name: 'Burger', unit_price: 18, quantity: 1 },
    { id: 'pasta', name: 'Pasta', unit_price: 22, quantity: 1 },
    { id: 'salad', name: 'Salad', unit_price: 12, quantity: 1 },
  ];
  const assignments: Assignment[] = [
    { item_id: 'burger', assigned_to: ['Alex'] },
    { item_id: 'pasta', assigned_to: ['Jordan', 'Sam'] },
    { item_id: 'salad', assigned_to: ['Alex', 'Jordan', 'Sam'] },
  ];
  const totals: ReceiptTotals = {
    subtotal: 52,
    tax: 4.16,
    fees: 2,
    tip: 6.4,
    discounts: 0,
    total: 64.56,
  };

  const dinnerSplits = calculateSplits(items, assignments, totals, participants, 'USD');
  const dinnerDetail = dinnerSplits
    .map((row) => `${row.participantName}=$${row.amountOwed.toFixed(2)}`)
    .join(', ');
  assertSumInvariant('Itemised dinner (USD)', dinnerSplits, totals.total, 'USD');
  if (dinnerSplits.length === 3) {
    pass('Itemised dinner row count', dinnerDetail);
  } else {
    fail('Itemised dinner row count', `expected 3 rows, got ${dinnerSplits.length}`);
  }

  // 5. Shared item remainder (3-way split of $10 item)
  const sharedItemSplits = calculateSplits(
    [{ id: 'wine', name: 'Wine', unit_price: 10, quantity: 1 }],
    [{ item_id: 'wine', assigned_to: participants }],
    { subtotal: 10, tax: 0, fees: 0, tip: 0, discounts: 0, total: 10 },
    participants,
    'USD',
  );
  const wineMinor = sharedItemSplits
    .map((r) => toMinorUnits(r.amountOwed, 'USD'))
    .sort((a, b) => b - a);
  if (wineMinor.join(',') === '334,333,333') {
    pass('Shared $10 item ÷ 3', wineMinor.join(', '));
  } else {
    fail('Shared $10 item ÷ 3', wineMinor.join(', '));
  }

  // 6. JPY itemised (¥1200 ramen split 3 ways)
  const ramenSplits = calculateSplits(
    [{ id: 'ramen', name: 'Ramen', unit_price: 1200, quantity: 1 }],
    [{ item_id: 'ramen', assigned_to: participants }],
    { subtotal: 1200, tax: 0, fees: 0, tip: 0, discounts: 0, total: 1200 },
    participants,
    'JPY',
  );
  const ramenAmounts = ramenSplits.map((r) => r.amountOwed).sort((a, b) => b - a);
  if (ramenAmounts.join(',') === '400,400,400') {
    pass('JPY ¥1200 ramen ÷ 3', ramenAmounts.join(', '));
  } else {
    fail('JPY ¥1200 ramen ÷ 3', ramenAmounts.join(', '));
  }

  // 7. Percentage-style shares via largestRemainderRound
  const pctShares = largestRemainderRound([33.33, 33.33, 33.34], 'USD');
  if (pctShares.reduce((a, b) => a + b, 0) === 10000) {
    pass('Percentage 33.33/33.33/33.34 of $100', pctShares.join(', '));
  } else {
    fail('Percentage rounding', pctShares.join(', '));
  }

  // 8. Error path — subtotal mismatch
  try {
    calculateSplits(
      [{ id: 'a', name: 'Item', unit_price: 10, quantity: 1 }],
      [{ item_id: 'a', assigned_to: ['Alex'] }],
      { subtotal: 50, tax: 0, fees: 0, tip: 0, discounts: 0, total: 50 },
      ['Alex'],
      'USD',
    );
    fail('Subtotal mismatch guard', 'expected throw');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Subtotal mismatch')) {
      pass('Subtotal mismatch guard', message.slice(0, 60));
    } else {
      fail('Subtotal mismatch guard', message);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
