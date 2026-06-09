import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';

const OUTSTANDING_STATUSES = ['pending', 'self_reported', 'disputed'] as const;

export interface UserBalanceSummary {
  net_balance: number;
  currency: string;
  owed_to_you: number;
  you_owe: number;
}

function sumOutstanding(amounts: Array<number | null>): number {
  return amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
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

  const createdEventIds = (createdEvents ?? []).map((row) => row.id as string);
  let owedToYou = 0;

  if (createdEventIds.length > 0) {
    const { data: owedRows, error: owedError } = await supabaseAdmin
      .from('participants')
      .select('amount_owed')
      .in('event_id', createdEventIds)
      .neq('user_id', userId)
      .in('payment_status', [...OUTSTANDING_STATUSES])
      .not('amount_owed', 'is', null);

    if (owedError) {
      throw new AppError('BALANCE_FETCH_FAILED', 'Could not load balance', 500);
    }

    owedToYou = sumOutstanding((owedRows ?? []).map((row) => row.amount_owed as number | null));
  }

  const { data: oweRows, error: oweError } = await supabaseAdmin
    .from('participants')
    .select('amount_owed, event_id')
    .eq('user_id', userId)
    .in('payment_status', [...OUTSTANDING_STATUSES])
    .not('amount_owed', 'is', null);

  if (oweError) {
    throw new AppError('BALANCE_FETCH_FAILED', 'Could not load balance', 500);
  }

  const oweEventIds = [...new Set((oweRows ?? []).map((row) => row.event_id as string))];
  const payerByEventId = new Map<string, string>();

  if (oweEventIds.length > 0) {
    const { data: oweEvents, error: oweEventsError } = await supabaseAdmin
      .from('events')
      .select('id, payer_id')
      .in('id', oweEventIds);

    if (oweEventsError) {
      throw new AppError('BALANCE_FETCH_FAILED', 'Could not load balance', 500);
    }

    for (const event of oweEvents ?? []) {
      payerByEventId.set(event.id as string, event.payer_id as string);
    }
  }

  const youOwe = sumOutstanding(
    (oweRows ?? [])
      .filter((row) => payerByEventId.get(row.event_id as string) !== userId)
      .map((row) => row.amount_owed as number | null),
  );

  const currency =
    (createdEvents?.[0]?.currency as string | undefined) ??
    'USD';

  return {
    owed_to_you: owedToYou,
    you_owe: youOwe,
    net_balance: owedToYou - youOwe,
    currency,
  };
}
