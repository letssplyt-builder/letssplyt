import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { getHandles } from '../profile/profile.service';
import type { PaymentStatus } from '@letssplyt/shared/participant.types';
import type {
  IOweEntry,
  IOweResponse,
  OwedToMeEntry,
  OwedToMeResponse,
} from '@letssplyt/shared/settlement.types';
import { isOutstandingPaymentStatus } from './outstanding';

const MVP_CURRENCY = 'USD';

export async function getOwedToMe(userId: string): Promise<OwedToMeResponse> {
  const { data: events, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id, title, currency')
    .eq('payer_id', userId)
    .is('deleted_at', null);

  if (eventsError) {
    throw new AppError('LEDGER_FETCH_FAILED', 'Could not load owed-to-me ledger', 500);
  }

  const eventIds = (events ?? []).map((row) => row.id as string);
  if (eventIds.length === 0) {
    return { data: [], total_owed_minor_units: 0, currency: MVP_CURRENCY };
  }

  const eventMeta = new Map(
    (events ?? []).map((row) => [
      row.id as string,
      { title: row.title as string, currency: (row.currency as string) ?? MVP_CURRENCY },
    ]),
  );

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select(
      'id, event_id, display_name, amount_owed, payment_status, confirmed_at',
    )
    .in('event_id', eventIds)
    .or(`user_id.is.null,user_id.neq.${userId}`)
    .not('amount_owed', 'is', null);

  if (participantsError) {
    throw new AppError('LEDGER_FETCH_FAILED', 'Could not load owed-to-me ledger', 500);
  }

  const data: OwedToMeEntry[] = [];
  let total = 0;

  for (const row of participantRows ?? []) {
    const status = row.payment_status as string;
    if (!isOutstandingPaymentStatus(status)) {
      continue;
    }

    const amount = row.amount_owed as number;
    const meta = eventMeta.get(row.event_id as string);
    if (!meta) continue;

    total += amount;
    data.push({
      event_id: row.event_id as string,
      event_title: meta.title,
      participant_id: row.id as string,
      participant_display_name: row.display_name as string,
      amount_minor_units: amount,
      currency: meta.currency,
      payment_status: status as PaymentStatus,
      settled_at: (row.confirmed_at as string | null) ?? null,
    });
  }

  return {
    data,
    total_owed_minor_units: total,
    currency: MVP_CURRENCY,
  };
}

export async function getIOwe(userId: string): Promise<IOweResponse> {
  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('event_id, amount_owed, payment_status')
    .eq('user_id', userId)
    .not('amount_owed', 'is', null);

  if (participantsError) {
    throw new AppError('LEDGER_FETCH_FAILED', 'Could not load i-owe ledger', 500);
  }

  const eventIds = [...new Set((participantRows ?? []).map((row) => row.event_id as string))];
  if (eventIds.length === 0) {
    return { data: [], total_owe_minor_units: 0, currency: MVP_CURRENCY };
  }

  const { data: events, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id, title, currency, payer_id')
    .in('id', eventIds)
    .neq('payer_id', userId)
    .is('deleted_at', null);

  if (eventsError) {
    throw new AppError('LEDGER_FETCH_FAILED', 'Could not load i-owe ledger', 500);
  }

  const eventMeta = new Map(
    (events ?? []).map((row) => [
      row.id as string,
      {
        title: row.title as string,
        currency: (row.currency as string) ?? MVP_CURRENCY,
        payer_id: row.payer_id as string,
      },
    ]),
  );

  const payerIds = [...new Set((events ?? []).map((row) => row.payer_id as string))];
  const payerNameById = new Map<string, string>();
  const payerHandlesById = new Map<string, IOweEntry['creator_payment_handles']>();

  if (payerIds.length > 0) {
    const { data: payers, error: payersError } = await supabaseAdmin
      .from('users')
      .select('id, display_name')
      .in('id', payerIds)
      .is('deleted_at', null);

    if (payersError) {
      throw new AppError('LEDGER_FETCH_FAILED', 'Could not load i-owe ledger', 500);
    }

    for (const payer of payers ?? []) {
      payerNameById.set(payer.id as string, payer.display_name as string);
    }

    for (const payerId of payerIds) {
      const handles = await getHandles(payerId);
      payerHandlesById.set(
        payerId,
        handles.map((handle) => ({
          provider: handle.provider,
          handle_display: handle.handle_value,
        })),
      );
    }
  }

  const data: IOweEntry[] = [];
  let total = 0;

  for (const row of participantRows ?? []) {
    const status = row.payment_status as string;
    if (!isOutstandingPaymentStatus(status)) {
      continue;
    }

    const meta = eventMeta.get(row.event_id as string);
    if (!meta) continue;

    const amount = row.amount_owed as number;
    total += amount;

    data.push({
      event_id: row.event_id as string,
      event_title: meta.title,
      payer_display_name: payerNameById.get(meta.payer_id) ?? 'Unknown',
      amount_minor_units: amount,
      currency: meta.currency,
      payment_status: status as PaymentStatus,
      creator_payment_handles: payerHandlesById.get(meta.payer_id) ?? [],
    });
  }

  return {
    data,
    total_owe_minor_units: total,
    currency: MVP_CURRENCY,
  };
}
