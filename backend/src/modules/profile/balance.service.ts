import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import {
  fetchCreatedEventIds,
  fetchMemberNetMaps,
  sumNettedMemberBalances,
} from '../settlement/member-net-balances';
import { isOutstandingPaymentStatus } from '../settlement/outstanding';

export interface UserBalanceSummary {
  net_balance: number;
  currency: string;
  owed_to_you: number;
  you_owe: number;
}

function roundMoney(total: number): number {
  return Number(total.toFixed(2));
}

async function sumGuestOutstanding(viewerId: string): Promise<number> {
  const createdEventIds = await fetchCreatedEventIds(viewerId);
  if (createdEventIds.length === 0) {
    return 0;
  }

  const { data: guestRows, error } = await supabaseAdmin
    .from('participants')
    .select('amount_owed, payment_status')
    .in('event_id', createdEventIds)
    .is('user_id', null);

  if (error) {
    throw new AppError('BALANCE_FETCH_FAILED', 'Could not load balance', 500);
  }

  let total = 0;
  for (const row of guestRows ?? []) {
    if (!isOutstandingPaymentStatus(row.payment_status as string)) continue;
    const amount = row.amount_owed as number | null;
    if (amount === null || amount <= 0) continue;
    total = roundMoney(total + amount);
  }

  return total;
}

export async function getUserBalance(userId: string): Promise<UserBalanceSummary> {
  const { data: createdEvents, error: createdError } = await supabaseAdmin
    .from('events')
    .select('id, currency')
    .eq('payer_id', userId)
    .is('deleted_at', null);

  if (createdError) {
    throw new AppError('BALANCE_FETCH_FAILED', 'Could not load balance', 500);
  }

  const memberMaps = await fetchMemberNetMaps(userId);
  const memberTotals = sumNettedMemberBalances(memberMaps);
  const guestOwed = await sumGuestOutstanding(userId);

  const owedToYou = roundMoney(memberTotals.owed_to_you + guestOwed);
  const youOwe = memberTotals.you_owe;
  const currency =
    (createdEvents?.[0]?.currency as string | undefined) ??
    'USD';

  return {
    owed_to_you: owedToYou,
    you_owe: youOwe,
    net_balance: roundMoney(owedToYou - youOwe),
    currency,
  };
}
