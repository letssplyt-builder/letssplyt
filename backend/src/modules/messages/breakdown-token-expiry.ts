/** Grace period after event settlement — aligned with guest PII purge (docs/04-Data-Architecture). */
export const BREAKDOWN_TOKEN_GRACE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function breakdownGraceEndsAt(fullySettledAt: string): Date {
  const settledAt = new Date(fullySettledAt);
  return new Date(settledAt.getTime() + BREAKDOWN_TOKEN_GRACE_DAYS * MS_PER_DAY);
}

export function isBreakdownLinkClosed(
  fullySettledAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!fullySettledAt) {
    return false;
  }
  return now >= breakdownGraceEndsAt(fullySettledAt);
}

export function breakdownTokenPurgeCutoffIso(now: Date = new Date()): string {
  return new Date(now.getTime() - BREAKDOWN_TOKEN_GRACE_DAYS * MS_PER_DAY).toISOString();
}
