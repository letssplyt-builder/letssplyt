import { NUDGE_COOLDOWN_MS, nextNudgeAvailableAt } from '@letssplyt/shared/utils/nudgeCooldown';
import { formatCurrency } from '../../infrastructure/security';
import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { isPhoneOptedOut } from '../../infrastructure/notification/opt-out';
import { sendOutboundMessage } from '../../infrastructure/notification/outbound-messaging.service';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { buildConsolidatedNudgeMessage } from '../messages/nudge.builder';
import { resolveParticipantPhoneContext } from '../messages/participant-phone';
import { getGuestDetail } from './guest-detail.service';
import { getMemberDetail } from './member-detail.service';
import { claimParticipantNudgeSlot } from './nudge-claim';
import { ensureNudgeSummaryUrl } from './nudge-link.service';
import { notifyMemberNudge } from './settlement-push';

export interface ConsolidatedNudgeResult {
  sent: boolean;
  channel: 'sms' | 'whatsapp';
  twilio_sid?: string;
  next_nudge_available_at: string;
  nudged_count: number;
  total_amount: number;
  currency: string;
}

interface NudgeCandidate {
  event_id: string;
  event_title: string;
  participant_id: string;
  amount: number;
  payment_status: string;
}

interface ParticipantNudgeRow {
  id: string;
  event_id: string;
  user_id: string | null;
  display_name: string;
  amount_owed: number | null;
  payment_status: string;
  guest_pii_token: string | null;
  country_code: string | null;
  join_method: string;
}

export async function nudgeMemberOutstanding(
  payerId: string,
  counterpartyUserId: string,
): Promise<ConsolidatedNudgeResult> {
  const detail = await getMemberDetail(payerId, counterpartyUserId);
  const pending = detail.outstanding.filter(
    (row) => row.direction === 'owed_to_me' && row.payment_status === 'pending',
  );
  const nudgeable = pending.filter((row) => row.can_nudge === true);
  assertNudgeTargets(pending, nudgeable);

  return sendConsolidatedNudge({
    payerId,
    candidates: nudgeable,
    counterpartyUserId,
    fallbackDisplayName: detail.counterparty.display_name,
  });
}

export async function nudgeGuestOutstanding(
  payerId: string,
  phoneHash: string,
): Promise<ConsolidatedNudgeResult> {
  const detail = await getGuestDetail(payerId, phoneHash);
  const pending = detail.outstanding.filter((row) => row.payment_status === 'pending');
  const nudgeable = pending.filter((row) => row.can_nudge === true);
  assertNudgeTargets(pending, nudgeable);

  return sendConsolidatedNudge({
    payerId,
    candidates: nudgeable,
    guestPhoneHash: phoneHash,
    fallbackDisplayName: detail.display_name,
  });
}

function assertNudgeTargets(
  pending: Array<{ can_nudge?: boolean; last_nudged_at?: string | null }>,
  nudgeable: unknown[],
): void {
  if (nudgeable.length > 0) {
    return;
  }
  const cooling = pending.filter((row) => row.can_nudge === false && row.last_nudged_at);
  if (cooling.length > 0) {
    const soonest = cooling
      .map((row) => row.last_nudged_at)
      .filter((value): value is string => Boolean(value))
      .sort()[0]!;
    throw new AppError(
      'NUDGE_COOLDOWN',
      'Nudge cooldown active for this participant',
      429,
      { next_nudge_available_at: nextNudgeAvailableAt(soonest) },
    );
  }
  throw new AppError('NO_PHONE', 'Participant has no phone number for nudge', 400);
}

async function sendConsolidatedNudge(params: {
  payerId: string;
  candidates: NudgeCandidate[];
  counterpartyUserId?: string;
  guestPhoneHash?: string;
  fallbackDisplayName: string;
}): Promise<ConsolidatedNudgeResult> {
  const participantRows = (
    await loadParticipantRows(params.candidates.map((row) => row.participant_id))
  ).filter((row) => row.join_method !== 'manual_name_only');
  if (participantRows.length === 0) {
    throw new AppError('NO_PHONE', 'Participant has no phone number for nudge', 400);
  }

  const eventMeta = await loadEventMeta(
    params.candidates.map((row) => row.event_id),
    params.payerId,
  );
  const eventById = new Map(eventMeta.map((event) => [event.id, event]));
  const eligibleCandidates = params.candidates.filter((row) => eventById.has(row.event_id));
  const reachableRows = participantRows.filter((row) => eventById.has(row.event_id));
  const firstReachable = reachableRows[0];
  if (!firstReachable || eligibleCandidates.length === 0) {
    throw new AppError('EVENT_FETCH_FAILED', 'Could not load events', 500);
  }

  const phoneContext = await resolveParticipantPhoneContext({
    user_id: firstReachable.user_id,
    guest_pii_token: firstReachable.guest_pii_token,
    country_code: firstReachable.country_code,
    join_method: firstReachable.join_method,
  });

  if (!phoneContext.phoneE164) {
    throw new AppError('NO_PHONE', 'Participant has no phone number for nudge', 400);
  }

  if (await isPhoneOptedOut(phoneContext.phoneE164)) {
    throw new AppError('PARTICIPANT_OPTED_OUT', 'Cannot nudge opted-out participant', 403);
  }

  const currencies = new Set(
    eligibleCandidates.map((row) => eventById.get(row.event_id)!.currency),
  );
  if (currencies.size > 1) {
    throw new AppError(
      'MIXED_CURRENCY',
      'Cannot send one nudge across events with different currencies',
      400,
    );
  }
  const firstEvent = eventById.get(eligibleCandidates[0]!.event_id)!;
  const currency = firstEvent.currency;
  const locale = firstEvent.locale;

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', params.payerId)
    .maybeSingle();

  if (payerError || !payer) {
    throw new AppError('PAYER_FETCH_FAILED', 'Could not load payer profile', 500);
  }

  const detailsUrl = await ensureNudgeSummaryUrl({
    payerId: params.payerId,
    counterpartyUserId: params.counterpartyUserId,
    guestPhoneHash: params.guestPhoneHash,
  });

  const claimed: Array<NudgeCandidate & { claimedAt: string; row: ParticipantNudgeRow }> = [];
  for (const candidate of eligibleCandidates) {
    const row = reachableRows.find((item) => item.id === candidate.participant_id);
    if (!row) continue;
    const claimedAt = await claimParticipantNudgeSlot(candidate.event_id, candidate.participant_id);
    if (!claimedAt) continue;
    claimed.push({ ...candidate, claimedAt, row });
  }

  if (claimed.length === 0) {
    throw new AppError(
      'NUDGE_COOLDOWN',
      'Nudge cooldown active for this participant',
      429,
      {
        next_nudge_available_at: new Date(Date.now() + NUDGE_COOLDOWN_MS).toISOString(),
      },
    );
  }

  const totalAmount = claimed.reduce((sum, item) => sum + item.amount, 0);

  const messageText = buildConsolidatedNudgeMessage({
    participantDisplayName: firstReachable.display_name || params.fallbackDisplayName,
    payerDisplayName: payer.display_name as string,
    totalFormatted: formatCurrency(totalAmount, currency, locale),
    eventCount: claimed.length,
    detailsUrl,
  });

  let outboundResult: { messageId: string; channel: 'sms' | 'whatsapp' };
  try {
    outboundResult = await sendOutboundMessage(
      phoneContext.phoneE164,
      phoneContext.channel,
      messageText,
    );
  } catch (err) {
    logger.error({
      msg: 'Consolidated nudge SMS send failed after cooldown claim',
      payerId: params.payerId,
      participantIds: claimed.map((item) => item.participant_id),
      err,
    });
    throw err;
  }

  const sentAt = new Date().toISOString();
  const latestClaim = claimed
    .map((item) => item.claimedAt)
    .sort()
    .at(-1)!;

  for (const item of claimed) {
    const { error: logError } = await supabaseAdmin.from('notification_log').insert({
      user_id: item.row.user_id,
      event_id: item.event_id,
      participant_id: item.participant_id,
      type: 'nudge_sms',
      channel: outboundResult.channel,
      status: 'sent',
      twilio_sid: outboundResult.messageId,
      sent_at: sentAt,
    });
    if (logError) {
      throw new AppError('DB_WRITE_FAILED', logError.message, 500);
    }

    const { error: settlementError } = await supabaseAdmin.from('settlement_log').insert({
      event_id: item.event_id,
      participant_id: item.participant_id,
      action: 'nudged',
      actor_id: params.payerId,
      from_status: item.row.payment_status,
      to_status: item.row.payment_status,
      amount: item.amount,
      note: null,
      metadata: {
        twilio_sid: outboundResult.messageId,
        channel: outboundResult.channel,
        consolidated: true,
      },
    });
    if (settlementError) {
      throw new AppError('SETTLEMENT_LOG_FAILED', 'Could not write settlement log', 500);
    }
  }

  if (firstReachable.user_id) {
    const title =
      claimed.length === 1 ? claimed[0]!.event_title : `${claimed.length} events`;
    notifyMemberNudge(
      firstReachable.user_id,
      totalAmount,
      currency,
      locale,
      title,
      claimed[0]!.event_id,
    );
  }

  return {
    sent: true,
    channel: outboundResult.channel,
    twilio_sid: outboundResult.messageId,
    next_nudge_available_at: nextNudgeAvailableAt(latestClaim),
    nudged_count: claimed.length,
    total_amount: totalAmount,
    currency,
  };
}

async function loadParticipantRows(ids: string[]): Promise<ParticipantNudgeRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select(
      'id, event_id, user_id, display_name, amount_owed, payment_status, guest_pii_token, country_code, join_method',
    )
    .in('id', ids);

  if (error) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    event_id: row.event_id as string,
    user_id: row.user_id as string | null,
    display_name: row.display_name as string,
    amount_owed: row.amount_owed as number | null,
    payment_status: row.payment_status as string,
    guest_pii_token: row.guest_pii_token as string | null,
    country_code: row.country_code as string | null,
    join_method: row.join_method as string,
  }));
}

async function loadEventMeta(
  eventIds: string[],
  payerId: string,
): Promise<Array<{ id: string; currency: string; locale: string }>> {
  const uniqueIds = [...new Set(eventIds)];
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, currency, locale, payer_id, deleted_at')
    .in('id', uniqueIds)
    .eq('payer_id', payerId)
    .is('deleted_at', null);

  if (error) {
    throw new AppError('EVENT_FETCH_FAILED', 'Could not load events', 500);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    currency: (row.currency as string | null) ?? 'USD',
    locale: (row.locale as string | null) ?? 'en-US',
  }));
}
