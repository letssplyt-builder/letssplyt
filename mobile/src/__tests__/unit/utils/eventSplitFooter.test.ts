import { describe, expect, it } from '@jest/globals';
import {
  canResetEventExpenses,
  getEventSplitActionMode,
  hasEventExpensesEntered,
  resolveEventSplitActionMode,
  resolveSplitEntryMode,
} from '../../../utils/eventSplitFooter';

describe('getEventSplitActionMode', () => {
  it('returns initial when no receipt scan', () => {
    expect(getEventSplitActionMode('none')).toBe('initial');
  });

  it('returns parsing while A1 is running', () => {
    expect(getEventSplitActionMode('parsing')).toBe('parsing');
  });

  it('returns review after parse before confirm', () => {
    expect(getEventSplitActionMode('parsed')).toBe('review');
  });

  it('returns edit after itemization', () => {
    expect(getEventSplitActionMode('parsed_confirmed')).toBe('edit');
    expect(getEventSplitActionMode('calculated')).toBe('edit');
    expect(getEventSplitActionMode('complete')).toBe('edit');
  });

  it('returns failed for retry scan path', () => {
    expect(getEventSplitActionMode('failed')).toBe('failed');
  });

  it('resolve falls back to review when receipt_review exists but stage is stale none', () => {
    expect(resolveEventSplitActionMode('none', true)).toBe('review');
  });

  it('resolve prefers stage when parsed', () => {
    expect(resolveEventSplitActionMode('parsed', true)).toBe('review');
  });

  it('resolve shows edit when confirmed with receipt data', () => {
    expect(resolveEventSplitActionMode('parsed_confirmed', true)).toBe('edit');
  });
});

describe('resolveSplitEntryMode', () => {
  it('uses itemised when receipt review is present', () => {
    expect(resolveSplitEntryMode(null, 'none', true)).toBe('itemised');
  });

  it('uses itemised when split_mode is itemised', () => {
    expect(resolveSplitEntryMode('itemised', 'parsed_confirmed', false)).toBe('itemised');
  });

  it('uses manual for equal split after calculate without receipt scan', () => {
    expect(resolveSplitEntryMode('equal', 'calculated', false)).toBe('manual');
  });

  it('uses manual for portion split after calculate', () => {
    expect(resolveSplitEntryMode('portion', 'calculated', false)).toBe('manual');
  });

  it('uses manual when calculated even if split_mode is still null', () => {
    expect(resolveSplitEntryMode(null, 'calculated', false)).toBe('manual');
  });
});

describe('hasEventExpensesEntered', () => {
  it('is true after receipt confirm or split calculate', () => {
    expect(hasEventExpensesEntered('parsed_confirmed')).toBe(true);
    expect(hasEventExpensesEntered('calculated')).toBe(true);
  });

  it('is false before expenses are entered', () => {
    expect(hasEventExpensesEntered('none')).toBe(false);
    expect(hasEventExpensesEntered('parsed')).toBe(false);
  });
});

describe('canResetEventExpenses', () => {
  it('allows reset when expenses entered and messages not sent', () => {
    expect(canResetEventExpenses('calculated', null)).toBe(true);
  });

  it('blocks reset after messages sent', () => {
    expect(canResetEventExpenses('calculated', '2026-01-01T00:00:00.000Z')).toBe(false);
  });
});
