import { describe, expect, it } from '@jest/globals';
import {
  BREAKDOWN_TOKEN_GRACE_DAYS,
  breakdownGraceEndsAt,
  breakdownTokenPurgeCutoffIso,
  isBreakdownLinkClosed,
} from '../../../modules/messages/breakdown-token-expiry';

describe('breakdown-token-expiry', () => {
  const settledAt = '2026-01-01T12:00:00.000Z';

  it('returns false when event is not fully settled', () => {
    expect(isBreakdownLinkClosed(null)).toBe(false);
    expect(isBreakdownLinkClosed(undefined)).toBe(false);
  });

  it('returns false during the grace window after settlement', () => {
    const graceEnd = breakdownGraceEndsAt(settledAt);
    const duringGrace = new Date(graceEnd.getTime() - 60_000);
    expect(isBreakdownLinkClosed(settledAt, duringGrace)).toBe(false);
  });

  it('returns true after grace window ends', () => {
    const graceEnd = breakdownGraceEndsAt(settledAt);
    const afterGrace = new Date(graceEnd.getTime() + 1);
    expect(isBreakdownLinkClosed(settledAt, afterGrace)).toBe(true);
  });

  it('computes purge cutoff aligned with grace days', () => {
    const now = new Date('2026-02-15T00:00:00.000Z');
    const cutoff = breakdownTokenPurgeCutoffIso(now);
    const expected = new Date(now.getTime() - BREAKDOWN_TOKEN_GRACE_DAYS * 24 * 60 * 60 * 1000);
    expect(cutoff).toBe(expected.toISOString());
  });
});
