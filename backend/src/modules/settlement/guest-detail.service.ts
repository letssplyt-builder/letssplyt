import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type { GuestDetailResponse } from '@letssplyt/shared/counterparty.types';
import { isOutstandingPaymentStatus } from './outstanding';

export async function getGuestDetail(
  viewerId: string,
  phoneHash: string,
): Promise<GuestDetailResponse> {
  const { data: createdEvents, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id, title, created_at')
    .eq('payer_id', viewerId)
    .is('deleted_at', null);

  if (eventsError) {
    throw new AppError('GUEST_DETAIL_FAILED', 'Could not load guest detail', 500);
  }

  const eventIds = (createdEvents ?? []).map((row) => row.id as string);
  if (eventIds.length === 0) {
    return {
      display_name: 'Guest',
      amount: 0,
      currency: 'USD',
      outstanding: [],
      history: [],
    };
  }

  const eventMeta = new Map(
    (createdEvents ?? []).map((row) => [
      row.id as string,
      { title: row.title as string, created_at: row.created_at as string },
    ]),
  );

  const { data: guestParticipants, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('id, event_id, display_name, amount_owed, payment_status, guest_pii_token')
    .in('event_id', eventIds)
    .is('user_id', null)
    .not('guest_pii_token', 'is', null);

  if (participantsError) {
    throw new AppError('GUEST_DETAIL_FAILED', 'Could not load guest detail', 500);
  }

  const tokens = [...new Set((guestParticipants ?? []).map((row) => row.guest_pii_token as string))];

  const phoneHashByToken = new Map<string, string>();
  if (tokens.length > 0) {
    const { data: piiRows, error: piiError } = await supabaseAdmin
      .from('guest_pii')
      .select('id, phone_hash')
      .in('id', tokens);

    if (piiError) {
      throw new AppError('GUEST_DETAIL_FAILED', 'Could not load guest detail', 500);
    }

    for (const row of piiRows ?? []) {
      phoneHashByToken.set(row.id as string, row.phone_hash as string);
    }
  }

  const outstanding: GuestDetailResponse['outstanding'] = [];
  const history: GuestDetailResponse['history'] = [];
  let displayName = 'Guest';
  let totalOutstanding = 0;

  for (const row of guestParticipants ?? []) {
    const token = row.guest_pii_token as string;
    const rowPhoneHash = phoneHashByToken.get(token);
    if (rowPhoneHash !== phoneHash) continue;

    displayName = row.display_name as string;
    const meta = eventMeta.get(row.event_id as string);
    if (!meta) continue;

    const amount = row.amount_owed as number | null;
    const status = row.payment_status as string;
    const eventRow = {
      event_id: row.event_id as string,
      event_title: meta.title,
      amount: amount ?? 0,
      payment_status: status,
      participant_id: row.id as string,
    };

    if (isOutstandingPaymentStatus(status) && amount !== null && amount > 0) {
      outstanding.push(eventRow);
      totalOutstanding += amount;
    } else {
      history.push(eventRow);
    }
  }

  outstanding.sort((a, b) => b.amount - a.amount);
  history.sort((a, b) => b.event_title.localeCompare(a.event_title));

  return {
    display_name: displayName,
    amount: totalOutstanding,
    currency: 'USD',
    outstanding,
    history,
  };
}
