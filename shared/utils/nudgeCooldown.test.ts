import { describe, expect, it } from '@jest/globals';
import {
  NUDGE_COOLDOWN_MS,
  canReceiveNudge,
  isNudgeCooldownActive,
  nextNudgeAvailableAt,
} from './nudgeCooldown';

describe('nudgeCooldown', () => {
  const now = Date.parse('2026-08-21T12:00:00.000Z');

  it('is inactive when the participant has never been nudged', () => {
    expect(isNudgeCooldownActive(null, now)).toBe(false);
    expect(isNudgeCooldownActive(undefined, now)).toBe(false);
  });

  it('is active within 48 hours of last_nudged_at', () => {
    const recent = new Date(now - 60 * 60 * 1000).toISOString();
    expect(isNudgeCooldownActive(recent, now)).toBe(true);
  });

  it('is inactive after 48 hours', () => {
    const old = new Date(now - NUDGE_COOLDOWN_MS - 1).toISOString();
    expect(isNudgeCooldownActive(old, now)).toBe(false);
  });

  it('blocks name-only members even without a prior nudge', () => {
    expect(canReceiveNudge({ joinMethod: 'manual_name_only', lastNudgedAt: null })).toBe(
      false,
    );
  });

  it('allows a reachable member after cooldown expires', () => {
    const old = new Date(now - NUDGE_COOLDOWN_MS - 1).toISOString();
    expect(
      canReceiveNudge({ joinMethod: 'qr_web', lastNudgedAt: old, nowMs: now }),
    ).toBe(true);
  });

  it('computes next_nudge_available_at 48 hours after last nudge', () => {
    expect(nextNudgeAvailableAt('2026-08-21T12:00:00.000Z')).toBe(
      '2026-08-23T12:00:00.000Z',
    );
  });
});
