import { describe, expect, it } from '@jest/globals';
import {
  calculateSplits,
  fromMinorUnits,
  getCurrencyMinorUnits,
  largestRemainderRound,
  toMinorUnits,
  type Assignment,
  type ConfirmedReceiptItem,
  type ReceiptTotals,
} from './splitCalculator';

describe('getCurrencyMinorUnits', () => {
  it('returns 0 for zero-decimal currencies', () => {
    expect(getCurrencyMinorUnits('JPY')).toBe(0);
    expect(getCurrencyMinorUnits('jpy')).toBe(0);
    expect(getCurrencyMinorUnits('KRW')).toBe(0);
    expect(getCurrencyMinorUnits('VND')).toBe(0);
    expect(getCurrencyMinorUnits('CLP')).toBe(0);
  });

  it('returns 3 for three-decimal currencies', () => {
    expect(getCurrencyMinorUnits('BHD')).toBe(3);
    expect(getCurrencyMinorUnits('KWD')).toBe(3);
    expect(getCurrencyMinorUnits('OMR')).toBe(3);
  });

  it('returns 2 for default currencies', () => {
    expect(getCurrencyMinorUnits('USD')).toBe(2);
    expect(getCurrencyMinorUnits('EUR')).toBe(2);
    expect(getCurrencyMinorUnits('INR')).toBe(2);
  });
});

describe('toMinorUnits / fromMinorUnits', () => {
  it('converts USD correctly', () => {
    expect(toMinorUnits(12.34, 'USD')).toBe(1234);
    expect(fromMinorUnits(1234, 'USD')).toBe(12.34);
  });

  it('does not multiply JPY', () => {
    expect(toMinorUnits(1200, 'JPY')).toBe(1200);
    expect(fromMinorUnits(1200, 'JPY')).toBe(1200);
  });

  it('converts BHD millifils', () => {
    expect(toMinorUnits(1.234, 'BHD')).toBe(1234);
    expect(fromMinorUnits(1234, 'BHD')).toBe(1.234);
  });
});

describe('largestRemainderRound', () => {
  it('splits $10.00 three ways in cents', () => {
    const share = 10 / 3;
    const result = largestRemainderRound([share, share, share], 'USD');
    expect(result).toEqual([334, 333, 333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('splits ¥1000 three ways without decimal conversion', () => {
    const share = 1000 / 3;
    const result = largestRemainderRound([share, share, share], 'JPY');
    expect(result).toEqual([334, 333, 333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('splits 10.000 BHD three ways in millifils', () => {
    const share = 10 / 3;
    const result = largestRemainderRound([share, share, share], 'BHD');
    expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(result.sort((a, b) => b - a)).toEqual([3334, 3333, 3333]);
  });

  it('gives 100% to a single participant', () => {
    const result = largestRemainderRound([10], 'USD');
    expect(result).toEqual([1000]);
  });

  it('handles amounts that divide evenly', () => {
    const result = largestRemainderRound([5, 5], 'USD');
    expect(result).toEqual([500, 500]);
  });

  it('handles percentage shares summing to 100%', () => {
    const total = 100;
    const shares = [total * 0.3333, total * 0.3333, total * 0.3334];
    const result = largestRemainderRound(shares, 'USD');
    expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('returns empty array for empty input', () => {
    expect(largestRemainderRound([], 'USD')).toEqual([]);
  });

  it('is deterministic for identical inputs', () => {
    const shares = [10 / 3, 10 / 3, 10 / 3];
    const first = largestRemainderRound(shares, 'USD');
    const second = largestRemainderRound(shares, 'USD');
    expect(first).toEqual(second);
    expect(first).toEqual([334, 333, 333]);
  });
});

describe('calculateSplits', () => {
  const participants = ['Alex', 'Jordan', 'Sam'];

  function runItemised(
    items: ConfirmedReceiptItem[],
    assignments: Assignment[],
    totals: ReceiptTotals,
    currency = 'USD',
  ) {
    return calculateSplits(items, assignments, totals, participants, currency);
  }

  it('allocates itemised shares with tax and tip proportional to subtotal', () => {
    const items: ConfirmedReceiptItem[] = [
      { id: 'a', name: 'Burger', unit_price: 20, quantity: 1 },
      { id: 'b', name: 'Pasta', unit_price: 30, quantity: 1 },
    ];
    const assignments: Assignment[] = [
      { item_id: 'a', assigned_to: ['Alex'] },
      { item_id: 'b', assigned_to: ['Jordan', 'Sam'] },
    ];
    const totals: ReceiptTotals = {
      subtotal: 50,
      tax: 5,
      fees: 0,
      tip: 10,
      discounts: 0,
      total: 65,
    };

    const splits = runItemised(items, assignments, totals);
    const sum = splits.reduce((acc, row) => acc + row.amountOwed, 0);
    expect(sum).toBe(65);
    expect(splits.find((r) => r.participantName === 'Alex')!.amountOwed).toBe(26);
    expect(splits.find((r) => r.participantName === 'Jordan')!.amountOwed).toBe(19.5);
    expect(splits.find((r) => r.participantName === 'Sam')!.amountOwed).toBe(19.5);
  });

  it('distributes rounding remainder across participants', () => {
    const items: ConfirmedReceiptItem[] = [
      { id: 'a', name: 'Item', unit_price: 10, quantity: 1 },
    ];
    const assignments: Assignment[] = [
      { item_id: 'a', assigned_to: ['Alex', 'Jordan', 'Sam'] },
    ];
    const totals: ReceiptTotals = {
      subtotal: 10,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 0,
      total: 10,
    };

    const splits = runItemised(items, assignments, totals);
    const amounts = splits.map((s) => toMinorUnits(s.amountOwed, 'USD')).sort((a, b) => b - a);
    expect(amounts).toEqual([334, 333, 333]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('handles JPY without incorrect cent scaling', () => {
    const items: ConfirmedReceiptItem[] = [
      { id: 'a', name: 'Ramen', unit_price: 1200, quantity: 1 },
    ];
    const assignments: Assignment[] = [
      { item_id: 'a', assigned_to: ['Alex', 'Jordan', 'Sam'] },
    ];
    const totals: ReceiptTotals = {
      subtotal: 1200,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 0,
      total: 1200,
    };

    const splits = runItemised(items, assignments, totals, 'JPY');
    const amounts = splits.map((s) => s.amountOwed).sort((a, b) => b - a);
    expect(amounts).toEqual([400, 400, 400]);
  });

  it('throws on unknown item id', () => {
    const totals: ReceiptTotals = {
      subtotal: 10,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 0,
      total: 10,
    };
    expect(() =>
      runItemised(
        [{ id: 'a', name: 'Item', unit_price: 10, quantity: 1 }],
        [{ item_id: 'missing', assigned_to: ['Alex'] }],
        totals,
      ),
    ).toThrow(/Unknown item id/);
  });

  it('throws on unknown participant', () => {
    const totals: ReceiptTotals = {
      subtotal: 10,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 0,
      total: 10,
    };
    expect(() =>
      runItemised(
        [{ id: 'a', name: 'Item', unit_price: 10, quantity: 1 }],
        [{ item_id: 'a', assigned_to: ['Nobody'] }],
        totals,
      ),
    ).toThrow(/Unknown participant/);
  });

  it('throws on subtotal mismatch', () => {
    const totals: ReceiptTotals = {
      subtotal: 50,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 0,
      total: 50,
    };
    expect(() =>
      runItemised(
        [{ id: 'a', name: 'Item', unit_price: 10, quantity: 1 }],
        [{ item_id: 'a', assigned_to: ['Alex'] }],
        totals,
      ),
    ).toThrow(/Subtotal mismatch/);
  });

  it('throws when no participants provided', () => {
    expect(() =>
      calculateSplits([], [], { subtotal: 0, tax: 0, fees: 0, tip: 0, discounts: 0, total: 0 }, [], 'USD'),
    ).toThrow(/At least one participant/);
  });

  it('throws when receipt total disagrees with allocated shares', () => {
    const totals: ReceiptTotals = {
      subtotal: 10,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 0,
      total: 12,
    };
    expect(() =>
      runItemised(
        [{ id: 'a', name: 'Item', unit_price: 10, quantity: 1 }],
        [{ item_id: 'a', assigned_to: ['Alex'] }],
        totals,
      ),
    ).toThrow(/Sum invariant violated/);
  });

  it('defaults to USD when currency code omitted', () => {
    const splits = calculateSplits(
      [{ id: 'a', name: 'Item', unit_price: 10, quantity: 1 }],
      [{ item_id: 'a', assigned_to: ['Alex'] }],
      { subtotal: 10, tax: 0, fees: 0, tip: 0, discounts: 0, total: 10 },
      ['Alex'],
    );
    expect(splits[0].amountOwed).toBe(10);
  });

  it('handles zero subtotal with no item assignments', () => {
    const splits = calculateSplits(
      [],
      [],
      { subtotal: 0, tax: 0, fees: 0, tip: 0, discounts: 0, total: 0 },
      ['Alex', 'Jordan'],
      'USD',
    );
    expect(splits).toEqual([
      { participantName: 'Alex', amountOwed: 0 },
      { participantName: 'Jordan', amountOwed: 0 },
    ]);
  });

  it('prorates discounts like tax and fees in itemised splits', () => {
    const items: ConfirmedReceiptItem[] = [
      { id: 'a', name: 'Burger', unit_price: 20, quantity: 1 },
      { id: 'b', name: 'Pasta', unit_price: 30, quantity: 1 },
    ];
    const assignments: Assignment[] = [
      { item_id: 'a', assigned_to: ['Alex'] },
      { item_id: 'b', assigned_to: ['Jordan', 'Sam'] },
    ];
    const totals: ReceiptTotals = {
      subtotal: 50,
      tax: 5,
      fees: 0,
      tip: 0,
      discounts: 10,
      total: 45,
    };

    const splits = runItemised(items, assignments, totals);
    expect(splits.reduce((sum, row) => sum + row.amountOwed, 0)).toBe(45);
    expect(splits.find((r) => r.participantName === 'Alex')!.amountOwed).toBe(18);
    expect(splits.find((r) => r.participantName === 'Jordan')!.amountOwed).toBe(13.5);
  });

  it('allows discounts larger than tax and fees by reducing participant shares', () => {
    const items: ConfirmedReceiptItem[] = [
      { id: 'a', name: 'Burger', unit_price: 20, quantity: 1 },
      { id: 'b', name: 'Pasta', unit_price: 30, quantity: 1 },
    ];
    const assignments: Assignment[] = [
      { item_id: 'a', assigned_to: ['Alex'] },
      { item_id: 'b', assigned_to: ['Jordan', 'Sam'] },
    ];
    const totals: ReceiptTotals = {
      subtotal: 50,
      tax: 2,
      fees: 0,
      tip: 0,
      discounts: 15,
      total: 37,
    };

    const splits = runItemised(items, assignments, totals);
    expect(splits.reduce((sum, row) => sum + row.amountOwed, 0)).toBe(37);
    expect(splits.find((r) => r.participantName === 'Alex')!.amountOwed).toBe(14.8);
    expect(splits.find((r) => r.participantName === 'Jordan')!.amountOwed).toBe(11.1);
  });

  it('handles JPY itemised split with discount in major units', () => {
    const items: ConfirmedReceiptItem[] = [
      { id: 'a', name: 'Ramen', unit_price: 1200, quantity: 1 },
    ];
    const assignments: Assignment[] = [{ item_id: 'a', assigned_to: ['Alex', 'Jordan'] }];
    const totals: ReceiptTotals = {
      subtotal: 1200,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 120,
      total: 1080,
    };

    const splits = calculateSplits(items, assignments, totals, ['Alex', 'Jordan'], 'JPY');
    expect(splits.reduce((sum, row) => sum + row.amountOwed, 0)).toBe(1080);
    expect(splits.map((row) => row.amountOwed).sort((a, b) => b - a)).toEqual([540, 540]);
  });

  it('throws when item has no assignees', () => {
    const totals: ReceiptTotals = {
      subtotal: 10,
      tax: 0,
      fees: 0,
      tip: 0,
      discounts: 0,
      total: 10,
    };
    expect(() =>
      runItemised(
        [{ id: 'a', name: 'Item', unit_price: 10, quantity: 1 }],
        [{ item_id: 'a', assigned_to: [] }],
        totals,
      ),
    ).toThrow(/no assignees/);
  });
});
