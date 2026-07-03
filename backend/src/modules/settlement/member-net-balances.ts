import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { isOutstandingPaymentStatus } from './outstanding';

export interface MemberNetMaps {
  owedByUser: Map<string, number>;
  owedToUser: Map<string, number>;
}

function roundMoney(total: number): number {
  return Number(total.toFixed(2));
}

export async function fetchCreatedEventIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('payer_id', viewerId)
    .is('deleted_at', null);

  if (error) {
    throw new AppError('COUNTERPARTIES_FETCH_FAILED', 'Could not load counterparties', 500);
  }

  return (data ?? []).map((row) => row.id as string);
}

/** Gross outstanding member ↔ member amounts before per-user netting. */
export async function fetchMemberNetMaps(viewerId: string): Promise<MemberNetMaps> {
  const createdEventIds = await fetchCreatedEventIds(viewerId);
  const owedByUser = new Map<string, number>();
  const owedToUser = new Map<string, number>();

  if (createdEventIds.length > 0) {
    const { data: owedRows, error: owedError } = await supabaseAdmin
      .from('participants')
      .select('user_id, amount_owed, payment_status')
      .in('event_id', createdEventIds)
      .not('user_id', 'is', null)
      .neq('user_id', viewerId);

    if (owedError) {
      throw new AppError('COUNTERPARTIES_FETCH_FAILED', 'Could not load counterparties', 500);
    }

    for (const row of owedRows ?? []) {
      const status = row.payment_status as string;
      const userId = row.user_id as string;
      if (!isOutstandingPaymentStatus(status)) continue;
      const amount = row.amount_owed as number | null;
      if (amount === null) continue;
      owedByUser.set(userId, roundMoney((owedByUser.get(userId) ?? 0) + amount));
    }
  }

  const { data: oweRows, error: oweError } = await supabaseAdmin
    .from('participants')
    .select('amount_owed, event_id, payment_status')
    .eq('user_id', viewerId);

  if (oweError) {
    throw new AppError('COUNTERPARTIES_FETCH_FAILED', 'Could not load counterparties', 500);
  }

  const oweEventIds = [...new Set((oweRows ?? []).map((row) => row.event_id as string))];
  const payerByEventId = new Map<string, string>();

  if (oweEventIds.length > 0) {
    const { data: oweEvents, error: oweEventsError } = await supabaseAdmin
      .from('events')
      .select('id, payer_id')
      .in('id', oweEventIds);

    if (oweEventsError) {
      throw new AppError('COUNTERPARTIES_FETCH_FAILED', 'Could not load counterparties', 500);
    }

    for (const event of oweEvents ?? []) {
      payerByEventId.set(event.id as string, event.payer_id as string);
    }
  }

  for (const row of oweRows ?? []) {
    const status = row.payment_status as string;
    if (!isOutstandingPaymentStatus(status)) continue;
    const amount = row.amount_owed as number | null;
    if (amount === null) continue;
    const payerId = payerByEventId.get(row.event_id as string);
    if (!payerId || payerId === viewerId) continue;
    owedToUser.set(payerId, roundMoney((owedToUser.get(payerId) ?? 0) + amount));
  }

  return { owedByUser, owedToUser };
}

export function sumNettedMemberBalances(maps: MemberNetMaps): {
  owed_to_you: number;
  you_owe: number;
} {
  const allUserIds = new Set([...maps.owedByUser.keys(), ...maps.owedToUser.keys()]);
  let owedToYou = 0;
  let youOwe = 0;

  for (const userId of allUserIds) {
    const theyOwe = maps.owedByUser.get(userId) ?? 0;
    const youOweAmt = maps.owedToUser.get(userId) ?? 0;
    const net = roundMoney(theyOwe - youOweAmt);
    if (net > 0) {
      owedToYou = roundMoney(owedToYou + net);
    } else if (net < 0) {
      youOwe = roundMoney(youOwe + Math.abs(net));
    }
  }

  return { owed_to_you: owedToYou, you_owe: youOwe };
}

export function netAmountForMember(
  maps: MemberNetMaps,
  counterpartyUserId: string,
): number {
  const theyOwe = maps.owedByUser.get(counterpartyUserId) ?? 0;
  const youOweAmt = maps.owedToUser.get(counterpartyUserId) ?? 0;
  return roundMoney(theyOwe - youOweAmt);
}
