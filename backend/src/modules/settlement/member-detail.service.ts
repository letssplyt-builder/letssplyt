import { AppError, NotFoundError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type { MemberDetailResponse } from '@letssplyt/shared/counterparty.types';
import { isOutstandingPaymentStatus } from './outstanding';

function participantCanReceiveNudge(joinMethod: string): boolean {
  return joinMethod !== 'manual_name_only';
}

export async function getMemberDetail(
  viewerId: string,
  counterpartyUserId: string,
): Promise<MemberDetailResponse> {
  const { data: counterparty, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, display_name, avatar_colour')
    .eq('id', counterpartyUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (userError) {
    throw new AppError('MEMBER_DETAIL_FAILED', 'Could not load member detail', 500);
  }

  if (!counterparty) {
    throw new NotFoundError('User not found');
  }

  const { data: viewerAsPayerEvents, error: payerEventsError } = await supabaseAdmin
    .from('events')
    .select('id, title, created_at')
    .eq('payer_id', viewerId)
    .is('deleted_at', null);

  if (payerEventsError) {
    throw new AppError('MEMBER_DETAIL_FAILED', 'Could not load member detail', 500);
  }

  const { data: counterpartyAsPayerEvents, error: cpPayerError } = await supabaseAdmin
    .from('events')
    .select('id, title, created_at')
    .eq('payer_id', counterpartyUserId)
    .is('deleted_at', null);

  if (cpPayerError) {
    throw new AppError('MEMBER_DETAIL_FAILED', 'Could not load member detail', 500);
  }

  const eventMeta = new Map<string, { title: string; created_at: string }>();
  for (const row of viewerAsPayerEvents ?? []) {
    eventMeta.set(row.id as string, {
      title: row.title as string,
      created_at: row.created_at as string,
    });
  }
  for (const row of counterpartyAsPayerEvents ?? []) {
    eventMeta.set(row.id as string, {
      title: row.title as string,
      created_at: row.created_at as string,
    });
  }

  const viewerPayerEventIds = (viewerAsPayerEvents ?? []).map((row) => row.id as string);
  const counterpartyPayerEventIds = (counterpartyAsPayerEvents ?? []).map((row) => row.id as string);

  const rows: MemberDetailResponse['outstanding'] = [];
  const history: MemberDetailResponse['history'] = [];

  if (viewerPayerEventIds.length > 0) {
    const { data: theyOweRows, error } = await supabaseAdmin
      .from('participants')
      .select('id, event_id, amount_owed, payment_status, join_method')
      .in('event_id', viewerPayerEventIds)
      .eq('user_id', counterpartyUserId);

    if (error) {
      throw new AppError('MEMBER_DETAIL_FAILED', 'Could not load member detail', 500);
    }

    for (const row of theyOweRows ?? []) {
      const meta = eventMeta.get(row.event_id as string);
      if (!meta) continue;
      const amount = row.amount_owed as number | null;
      const status = row.payment_status as string;
      const joinMethod = row.join_method as string;
      const eventRow = {
        event_id: row.event_id as string,
        event_title: meta.title,
        event_date: meta.created_at,
        amount: amount ?? 0,
        direction: 'owed_to_me' as const,
        payment_status: status,
        participant_id: row.id as string,
        can_nudge: participantCanReceiveNudge(joinMethod),
      };
      if (isOutstandingPaymentStatus(status) && amount !== null && amount > 0) {
        rows.push(eventRow);
      } else {
        history.push(eventRow);
      }
    }
  }

  if (counterpartyPayerEventIds.length > 0) {
    const { data: youOweRows, error } = await supabaseAdmin
      .from('participants')
      .select('id, event_id, amount_owed, payment_status')
      .in('event_id', counterpartyPayerEventIds)
      .eq('user_id', viewerId);

    if (error) {
      throw new AppError('MEMBER_DETAIL_FAILED', 'Could not load member detail', 500);
    }

    for (const row of youOweRows ?? []) {
      const meta = eventMeta.get(row.event_id as string);
      if (!meta) continue;
      const amount = row.amount_owed as number | null;
      const status = row.payment_status as string;
      const eventRow = {
        event_id: row.event_id as string,
        event_title: meta.title,
        event_date: meta.created_at,
        amount: amount ?? 0,
        direction: 'i_owe' as const,
        payment_status: status,
        participant_id: row.id as string,
      };
      if (isOutstandingPaymentStatus(status) && amount !== null && amount > 0) {
        rows.push(eventRow);
      } else {
        history.push(eventRow);
      }
    }
  }

  let netAmount = 0;
  for (const row of rows) {
    netAmount += row.direction === 'owed_to_me' ? row.amount : -row.amount;
  }

  rows.sort((a, b) => b.amount - a.amount);
  history.sort((a, b) => {
    const dateA = a.event_date ?? '';
    const dateB = b.event_date ?? '';
    return dateB.localeCompare(dateA);
  });

  return {
    counterparty: {
      user_id: counterparty.id as string,
      display_name: counterparty.display_name as string,
      avatar_colour: counterparty.avatar_colour as string,
    },
    net_amount: netAmount,
    currency: 'USD',
    outstanding: rows,
    history,
  };
}
