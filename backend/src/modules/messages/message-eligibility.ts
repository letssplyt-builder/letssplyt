export function hasPositiveBillShare(amount: number | null | undefined): boolean {
  return Number(amount ?? 0) > 0;
}

export function isSmsEligibleParticipant(
  row: {
    user_id?: string | null;
    join_method?: string | null;
    amount_owed?: number | null;
  },
  payerId: string,
): boolean {
  if ((row.user_id ?? null) === payerId) return false;
  if (row.join_method === 'manual_name_only') return false;
  return hasPositiveBillShare(row.amount_owed);
}
