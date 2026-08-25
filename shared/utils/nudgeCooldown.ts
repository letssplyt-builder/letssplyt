/** Manual organizer nudge cooldown — must match `claim_participant_nudge` INTERVAL. */
export const NUDGE_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export function isNudgeCooldownActive(
  lastNudgedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastNudgedAt) {
    return false;
  }
  const lastNudgeMs = new Date(lastNudgedAt).getTime();
  if (Number.isNaN(lastNudgeMs)) {
    return false;
  }
  return nowMs < lastNudgeMs + NUDGE_COOLDOWN_MS;
}

export function nextNudgeAvailableAt(
  lastNudgedAt: string,
): string {
  return new Date(new Date(lastNudgedAt).getTime() + NUDGE_COOLDOWN_MS).toISOString();
}

export function canReceiveNudge(params: {
  joinMethod?: string | null;
  lastNudgedAt?: string | null;
  nowMs?: number;
}): boolean {
  if (params.joinMethod === 'manual_name_only') {
    return false;
  }
  return !isNudgeCooldownActive(params.lastNudgedAt, params.nowMs);
}
