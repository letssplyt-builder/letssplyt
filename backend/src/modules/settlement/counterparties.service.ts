import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type {
  GuestsCounterpartiesResponse,
  MembersCounterpartiesResponse,
} from '@letssplyt/shared/counterparty.types';
import { isOutstandingPaymentStatus } from './outstanding';

interface ParticipantOwedRow {
  id: string;
  event_id: string;
  display_name: string;
  amount_owed: number | null;
  payment_status: string;
  guest_pii_token: string | null;
  join_method: string;
}

interface EventMeta {
  id: string;
  title: string;
  payer_id: string;
}

async function fetchCreatedEventIds(viewerId: string): Promise<string[]> {
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

async function fetchUserProfiles(
  userIds: string[],
): Promise<Map<string, { display_name: string; avatar_colour: string }>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, display_name, avatar_colour')
    .in('id', userIds)
    .is('deleted_at', null);

  if (error) {
    throw new AppError('COUNTERPARTIES_FETCH_FAILED', 'Could not load counterparties', 500);
  }

  return new Map(
    (data ?? []).map((row) => [
      row.id as string,
      {
        display_name: row.display_name as string,
        avatar_colour: row.avatar_colour as string,
      },
    ]),
  );
}

export async function getMemberCounterparties(viewerId: string): Promise<MembersCounterpartiesResponse> {
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
      owedByUser.set(userId, (owedByUser.get(userId) ?? 0) + amount);
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
    owedToUser.set(payerId, (owedToUser.get(payerId) ?? 0) + amount);
  }

  const allUserIds = [...new Set([...owedByUser.keys(), ...owedToUser.keys()])];
  const profiles = await fetchUserProfiles(allUserIds);

  const oweYou: MembersCounterpartiesResponse['owe_you'] = [];
  const youOwe: MembersCounterpartiesResponse['you_owe'] = [];

  for (const userId of allUserIds) {
    const theyOwe = owedByUser.get(userId) ?? 0;
    const youOweAmt = owedToUser.get(userId) ?? 0;
    const net = theyOwe - youOweAmt;
    const profile = profiles.get(userId);
    if (!profile) continue;

    if (net > 0) {
      oweYou.push({
        user_id: userId,
        display_name: profile.display_name,
        avatar_colour: profile.avatar_colour,
        net_amount: net,
      });
    } else if (net < 0) {
      youOwe.push({
        user_id: userId,
        display_name: profile.display_name,
        avatar_colour: profile.avatar_colour,
        net_amount: Math.abs(net),
      });
    }
  }

  oweYou.sort((a, b) => b.net_amount - a.net_amount);
  youOwe.sort((a, b) => b.net_amount - a.net_amount);

  return { owe_you: oweYou, you_owe: youOwe };
}

export async function getGuestCounterparties(viewerId: string): Promise<GuestsCounterpartiesResponse> {
  const createdEventIds = await fetchCreatedEventIds(viewerId);
  if (createdEventIds.length === 0) {
    return { guests: [] };
  }

  const { data: guestParticipants, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('id, event_id, display_name, amount_owed, payment_status, guest_pii_token, join_method')
    .in('event_id', createdEventIds)
    .is('user_id', null);

  if (participantsError) {
    throw new AppError('COUNTERPARTIES_FETCH_FAILED', 'Could not load guest counterparties', 500);
  }

  const outstandingGuests = (guestParticipants ?? []).filter((row) => {
    const status = row.payment_status as string;
    const amount = row.amount_owed as number | null;
    return isOutstandingPaymentStatus(status) && amount !== null && amount > 0;
  }) as ParticipantOwedRow[];

  const guestTokens = outstandingGuests
    .map((row) => row.guest_pii_token)
    .filter((token): token is string => Boolean(token));

  const phoneHashByToken = new Map<string, string>();

  if (guestTokens.length > 0) {
    const { data: piiRows, error: piiError } = await supabaseAdmin
      .from('guest_pii')
      .select('id, phone_hash')
      .in('id', guestTokens);

    if (piiError) {
      throw new AppError('COUNTERPARTIES_FETCH_FAILED', 'Could not load guest counterparties', 500);
    }

    for (const row of piiRows ?? []) {
      phoneHashByToken.set(row.id as string, row.phone_hash as string);
    }
  }

  const phoneAggregates = new Map<
    string,
    { display_name: string; amount: number }
  >();
  const guests: GuestsCounterpartiesResponse['guests'] = [];

  for (const row of outstandingGuests) {
    const amount = row.amount_owed as number;
    const token = row.guest_pii_token;
    const phoneHash = token ? phoneHashByToken.get(token) : undefined;

    if (phoneHash) {
      const existing = phoneAggregates.get(phoneHash);
      if (existing) {
        existing.amount += amount;
      } else {
        phoneAggregates.set(phoneHash, {
          display_name: row.display_name,
          amount,
        });
      }
    } else {
      guests.push({
        guest_key: row.id,
        kind: 'name_only',
        display_name: row.display_name,
        amount,
        event_id: row.event_id as string,
        participant_id: row.id,
      });
    }
  }

  for (const [phoneHash, aggregate] of phoneAggregates) {
    guests.push({
      guest_key: phoneHash,
      kind: 'phone',
      display_name: aggregate.display_name,
      amount: aggregate.amount,
    });
  }

  guests.sort((a, b) => b.amount - a.amount);

  return { guests };
}
