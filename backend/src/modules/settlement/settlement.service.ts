import { formatCurrency } from '../../infrastructure/security';
import { AppError } from '../../infrastructure/errors';
import { isPhoneOptedOut } from '../../infrastructure/notification/opt-out';
import { sendTwilioMessage } from '../../infrastructure/notification/twilio-messaging';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { assertEventOwner, fetchEventRow } from '../events/event.service';
import { buildNudgeMessage } from '../messages/nudge.builder';
import { resolveParticipantPhoneContext } from '../messages/participant-phone';
import {
  notifyCreatorMemberPaid,
  notifyCreatorEventFullySettled,
  notifyMemberNudge,
} from './settlement-push';
import {
  assertTransitionAllowed,
  isSettlementCompleteStatus,
  type PaymentStatus,
} from './settlement.state-machine';

const NUDGE_COOLDOWN_MS = 48 * 60 * 60 * 1000;

const SELF_REPORT_METHODS = new Set([
  'venmo',
  'paypal',
  'cashapp',
  'zelle',
  'wise',
  'cash',
  'bank_transfer',
  'other',
]);

const MARK_PAID_METHODS = new Set(['cash', 'zelle', 'bank_transfer', 'other']);

interface ParticipantRow {
  id: string;
  event_id: string;
  user_id: string | null;
  display_name: string;
  amount_owed: number | null;
  payment_status: string;
  disputed_count: number;
  last_nudged_at: string | null;
  nudge_count: number;
  guest_pii_token: string | null;
  country_code: string | null;
  join_method: string;
}

async function loadParticipantRow(
  eventId: string,
  participantId: string,
): Promise<ParticipantRow> {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select(
      'id, event_id, user_id, display_name, amount_owed, payment_status, disputed_count, last_nudged_at, nudge_count, guest_pii_token, country_code, join_method',
    )
    .eq('id', participantId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participant', 500);
  }

  if (!data) {
    throw new AppError('PARTICIPANT_NOT_FOUND', 'Participant not found for this event', 404);
  }

  return {
    id: data.id as string,
    event_id: data.event_id as string,
    user_id: data.user_id as string | null,
    display_name: data.display_name as string,
    amount_owed: data.amount_owed as number | null,
    payment_status: data.payment_status as string,
    disputed_count: Number(data.disputed_count ?? 0),
    last_nudged_at: data.last_nudged_at as string | null,
    nudge_count: Number(data.nudge_count ?? 0),
    guest_pii_token: data.guest_pii_token as string | null,
    country_code: data.country_code as string | null,
    join_method: data.join_method as string,
  };
}

async function writeSettlementLog(params: {
  eventId: string;
  participantId: string;
  action: string;
  actorId: string | null;
  fromStatus: string;
  toStatus: string;
  amount: number | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('settlement_log').insert({
    event_id: params.eventId,
    participant_id: params.participantId,
    action: params.action,
    actor_id: params.actorId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    amount: params.amount,
    note: params.note ?? null,
    metadata: params.metadata ?? null,
  });

  if (error) {
    throw new AppError('SETTLEMENT_LOG_FAILED', 'Could not write settlement log', 500);
  }
}

async function checkAndMarkEventSettled(eventId: string): Promise<boolean> {
  const { data: payerRow, error: payerError } = await supabaseAdmin
    .from('events')
    .select('payer_id, title')
    .eq('id', eventId)
    .maybeSingle();

  if (payerError) {
    throw new AppError('EVENT_FETCH_FAILED', 'Could not load event', 500);
  }

  const payerId = payerRow?.payer_id as string | undefined;

  const { data: rows, error } = await supabaseAdmin
    .from('participants')
    .select('id, user_id, payment_status, amount_owed')
    .eq('event_id', eventId);

  if (error) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  const participants = rows ?? [];
  if (participants.length === 0) {
    return false;
  }

  const owing = participants.filter((row) => {
    const amount = Number(row.amount_owed ?? 0);
    if (amount <= 0) return false;
    if (payerId && (row.user_id as string | null) === payerId) return false;
    return true;
  });

  const allSettled =
    owing.length === 0 ||
    owing.every((row) => isSettlementCompleteStatus(row.payment_status as string));

  if (!allSettled) {
    return false;
  }

  const now = new Date().toISOString();
  const { error: eventError } = await supabaseAdmin
    .from('events')
    .update({ status: 'settled', fully_settled_at: now })
    .eq('id', eventId);

  if (eventError) {
    throw new AppError('DB_WRITE_FAILED', eventError.message, 500);
  }

  const logParticipantId = participants[0]?.id as string;
  await supabaseAdmin.from('settlement_log').insert({
    event_id: eventId,
    participant_id: logParticipantId,
    action: 'settled',
    actor_id: null,
    from_status: 'confirmed',
    to_status: 'settled',
    amount: null,
    note: 'Event fully settled',
  });

  const payerIdFromEvent = payerRow?.payer_id as string | undefined;
  const eventTitle = (payerRow?.title as string) ?? 'Event';
  if (payerIdFromEvent) {
    notifyCreatorEventFullySettled(payerIdFromEvent, eventTitle, eventId);
  }

  return true;
}

export interface SelfReportInput {
  payment_method: string;
  note?: string;
}

export interface SelfReportResult {
  participant_id: string;
  payment_status: 'confirmed';
  self_reported_at: string;
  confirmed_at: string;
  event_fully_settled: boolean;
}

export async function selfReportPayment(
  userId: string,
  eventId: string,
  participantId: string,
  input: SelfReportInput,
  options?: { suppressCreatorPaymentPush?: boolean },
): Promise<SelfReportResult> {
  if (!SELF_REPORT_METHODS.has(input.payment_method)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid payment_method', 400);
  }

  const participant = await loadParticipantRow(eventId, participantId);

  if (!participant.user_id || participant.user_id !== userId) {
    throw new AppError('FORBIDDEN', 'Only the participant can self-report payment', 403);
  }

  const fromStatus = participant.payment_status as PaymentStatus;
  if (fromStatus !== 'pending' && fromStatus !== 'disputed') {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment can only be reported when status is pending or disputed',
      409,
    );
  }

  assertTransitionAllowed(fromStatus, 'confirmed');

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('participants')
    .update({
      payment_status: 'confirmed',
      self_reported_at: now,
      self_reported_method: input.payment_method,
      confirmed_at: now,
    })
    .eq('id', participantId)
    .eq('event_id', eventId)
    .in('payment_status', ['pending', 'disputed'])
    .select('id, amount_owed')
    .maybeSingle();

  if (error) {
    throw new AppError('DB_WRITE_FAILED', error.message, 500);
  }

  if (!updated) {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment could not be confirmed — status may have changed',
      409,
    );
  }

  await writeSettlementLog({
    eventId,
    participantId,
    action: 'confirmed',
    actorId: userId,
    fromStatus,
    toStatus: 'confirmed',
    amount: participant.amount_owed,
    note: input.note ?? null,
    metadata: { via: 'self_report', payment_method: input.payment_method },
  });

  const eventFullySettled = await checkAndMarkEventSettled(eventId);

  const eventRow = await fetchEventRow(eventId);
  if (!options?.suppressCreatorPaymentPush && eventRow.payer_id !== userId) {
    notifyCreatorMemberPaid(
      eventRow.payer_id,
      participant.display_name,
      participant.amount_owed ?? 0,
      eventRow.currency ?? 'USD',
      eventRow.locale ?? 'en-US',
      eventRow.title,
      eventId,
    );
  }

  return {
    participant_id: participantId,
    payment_status: 'confirmed',
    self_reported_at: now,
    confirmed_at: now,
    event_fully_settled: eventFullySettled,
  };
}

export interface ConfirmPaymentResult {
  participant_id: string;
  payment_status: 'confirmed';
  confirmed_at: string;
  event_fully_settled: boolean;
}

export async function confirmPayment(
  userId: string,
  eventId: string,
  participantId: string,
): Promise<ConfirmPaymentResult> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  const participant = await loadParticipantRow(eventId, participantId);

  if (participant.user_id === userId) {
    throw new AppError('FORBIDDEN', 'Participants cannot confirm their own payment', 403);
  }

  const fromStatus = participant.payment_status as PaymentStatus;
  if (fromStatus !== 'self_reported') {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment can only be confirmed when status is self_reported',
      409,
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('participants')
    .update({
      payment_status: 'confirmed',
      confirmed_at: now,
    })
    .eq('id', participantId)
    .eq('event_id', eventId)
    .eq('payment_status', 'self_reported')
    .select('id, amount_owed')
    .maybeSingle();

  if (error) {
    throw new AppError('DB_WRITE_FAILED', error.message, 500);
  }

  if (!updated) {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment can only be confirmed when status is self_reported',
      409,
    );
  }

  await writeSettlementLog({
    eventId,
    participantId,
    action: 'confirmed',
    actorId: userId,
    fromStatus: 'self_reported',
    toStatus: 'confirmed',
    amount: participant.amount_owed,
  });

  const eventFullySettled = await checkAndMarkEventSettled(eventId);

  return {
    participant_id: participantId,
    payment_status: 'confirmed',
    confirmed_at: now,
    event_fully_settled: eventFullySettled,
  };
}

export interface DisputePaymentInput {
  note?: string;
}

export interface DisputePaymentResult {
  participant_id: string;
  payment_status: 'disputed';
  disputed_count: number;
}

export async function disputePayment(
  userId: string,
  eventId: string,
  participantId: string,
  input: DisputePaymentInput,
): Promise<DisputePaymentResult> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  const participant = await loadParticipantRow(eventId, participantId);

  const fromStatus = participant.payment_status as PaymentStatus;
  if (fromStatus !== 'confirmed' && fromStatus !== 'self_reported') {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment can only be disputed when status is confirmed',
      409,
    );
  }

  assertTransitionAllowed(fromStatus, 'disputed');

  const newDisputedCount = participant.disputed_count + 1;
  const { data: updated, error } = await supabaseAdmin
    .from('participants')
    .update({
      payment_status: 'disputed',
      disputed_count: newDisputedCount,
      confirmed_at: null,
    })
    .eq('id', participantId)
    .eq('event_id', eventId)
    .in('payment_status', ['confirmed', 'self_reported'])
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError('DB_WRITE_FAILED', error.message, 500);
  }

  if (!updated) {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment can only be disputed when status is confirmed',
      409,
    );
  }

  await writeSettlementLog({
    eventId,
    participantId,
    action: 'disputed',
    actorId: userId,
    fromStatus,
    toStatus: 'disputed',
    amount: participant.amount_owed,
    note: input.note ?? null,
  });

  return {
    participant_id: participantId,
    payment_status: 'disputed',
    disputed_count: newDisputedCount,
  };
}

export interface NudgeParticipantResult {
  sent: boolean;
  channel: 'whatsapp' | 'sms';
  twilio_sid?: string;
  next_nudge_available_at: string;
}

export interface MarkParticipantPaidInput {
  payment_method: string;
  note?: string;
}

export interface MarkParticipantPaidResult {
  participant_id: string;
  payment_status: 'confirmed';
  event_fully_settled: boolean;
}

export async function markParticipantPaid(
  userId: string,
  eventId: string,
  participantId: string,
  input: MarkParticipantPaidInput,
): Promise<MarkParticipantPaidResult> {
  if (!MARK_PAID_METHODS.has(input.payment_method)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid payment_method', 400);
  }

  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  const participant = await loadParticipantRow(eventId, participantId);

  if (participant.payment_status !== 'pending') {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment can only be marked paid when status is pending',
      409,
    );
  }

  assertTransitionAllowed('pending', 'payer_marked');

  const now = new Date().toISOString();
  const { data: marked, error: markError } = await supabaseAdmin
    .from('participants')
    .update({
      payment_status: 'payer_marked',
    })
    .eq('id', participantId)
    .eq('event_id', eventId)
    .eq('payment_status', 'pending')
    .select('id, amount_owed')
    .maybeSingle();

  if (markError) {
    throw new AppError('DB_WRITE_FAILED', markError.message, 500);
  }

  if (!marked) {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Payment can only be marked paid when status is pending',
      409,
    );
  }

  const { data: confirmed, error: confirmError } = await supabaseAdmin
    .from('participants')
    .update({
      payment_status: 'confirmed',
      confirmed_at: now,
    })
    .eq('id', participantId)
    .eq('event_id', eventId)
    .eq('payment_status', 'payer_marked')
    .select('id, amount_owed')
    .maybeSingle();

  if (confirmError) {
    throw new AppError('DB_WRITE_FAILED', confirmError.message, 500);
  }

  if (!confirmed) {
    throw new AppError('DB_WRITE_FAILED', 'Could not confirm payer-marked payment', 500);
  }

  await writeSettlementLog({
    eventId,
    participantId,
    action: 'confirmed',
    actorId: userId,
    fromStatus: 'pending',
    toStatus: 'confirmed',
    amount: participant.amount_owed,
    note: input.note ?? null,
    metadata: { via: 'payer_marked', payment_method: input.payment_method },
  });

  const eventFullySettled = await checkAndMarkEventSettled(eventId);

  return {
    participant_id: participantId,
    payment_status: 'confirmed',
    event_fully_settled: eventFullySettled,
  };
}

/** Payer confirms a counterparty obligation without self-report (net offset). */
export async function payerConfirmOffset(
  payerId: string,
  eventId: string,
  participantId: string,
  note?: string,
): Promise<ConfirmPaymentResult> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, payerId);

  const participant = await loadParticipantRow(eventId, participantId);
  const fromStatus = participant.payment_status as PaymentStatus;

  if (fromStatus !== 'pending' && fromStatus !== 'disputed') {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Offset confirmation requires pending or disputed status',
      409,
    );
  }

  assertTransitionAllowed(fromStatus, 'confirmed');

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('participants')
    .update({
      payment_status: 'confirmed',
      confirmed_at: now,
    })
    .eq('id', participantId)
    .eq('event_id', eventId)
    .in('payment_status', ['pending', 'disputed'])
    .select('id, amount_owed')
    .maybeSingle();

  if (error) {
    throw new AppError('DB_WRITE_FAILED', error.message, 500);
  }

  if (!updated) {
    throw new AppError(
      'INVALID_PAYMENT_STATUS',
      'Offset confirmation could not be applied — status may have changed',
      409,
    );
  }

  await writeSettlementLog({
    eventId,
    participantId,
    action: 'confirmed',
    actorId: payerId,
    fromStatus,
    toStatus: 'confirmed',
    amount: participant.amount_owed,
    note: note ?? null,
    metadata: { via: 'net_offset' },
  });

  const eventFullySettled = await checkAndMarkEventSettled(eventId);

  return {
    participant_id: participantId,
    payment_status: 'confirmed',
    confirmed_at: now,
    event_fully_settled: eventFullySettled,
  };
}

export async function nudgeParticipant(
  userId: string,
  eventId: string,
  participantId: string,
): Promise<NudgeParticipantResult> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  const participant = await loadParticipantRow(eventId, participantId);

  if (isSettlementCompleteStatus(participant.payment_status)) {
    throw new AppError('PARTICIPANT_SETTLED', 'Participant has already settled', 409);
  }

  if (participant.last_nudged_at) {
    const lastNudge = new Date(participant.last_nudged_at).getTime();
    const nextAvailable = lastNudge + NUDGE_COOLDOWN_MS;
    if (Date.now() < nextAvailable) {
      throw new AppError(
        'NUDGE_COOLDOWN',
        'Nudge cooldown active for this participant',
        429,
        { next_nudge_available_at: new Date(nextAvailable).toISOString() },
      );
    }
  }

  const phoneContext = await resolveParticipantPhoneContext({
    user_id: participant.user_id,
    guest_pii_token: participant.guest_pii_token,
    country_code: participant.country_code,
    join_method: participant.join_method,
  });

  if (!phoneContext.phoneE164) {
    throw new AppError('NO_PHONE', 'Participant has no phone number for nudge', 400);
  }

  if (await isPhoneOptedOut(phoneContext.phoneE164)) {
    throw new AppError('PARTICIPANT_OPTED_OUT', 'Cannot nudge opted-out participant', 403);
  }

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', eventRow.payer_id)
    .maybeSingle();

  if (payerError || !payer) {
    throw new AppError('PAYER_FETCH_FAILED', 'Could not load payer profile', 500);
  }

  const currency = eventRow.currency ?? 'USD';
  const locale = eventRow.locale ?? 'en-US';
  const amount = participant.amount_owed ?? 0;
  const messageText = buildNudgeMessage({
    participantDisplayName: participant.display_name,
    payerDisplayName: payer.display_name as string,
    amountFormatted: formatCurrency(amount, currency, locale),
    eventTitle: eventRow.title,
  });

  const twilioResult = await sendTwilioMessage(
    phoneContext.phoneE164,
    phoneContext.channel,
    messageText,
  );

  const now = new Date();
  const sentAt = now.toISOString();
  const nextNudgeAvailableAt = new Date(now.getTime() + NUDGE_COOLDOWN_MS).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('participants')
    .update({
      last_nudged_at: sentAt,
      nudge_count: participant.nudge_count + 1,
    })
    .eq('id', participantId);

  if (updateError) {
    throw new AppError('DB_WRITE_FAILED', updateError.message, 500);
  }

  const { error: logError } = await supabaseAdmin.from('notification_log').insert({
    user_id: participant.user_id,
    event_id: eventId,
    participant_id: participantId,
    type: 'nudge_sms',
    channel: twilioResult.channel,
    status: 'sent',
    twilio_sid: twilioResult.sid,
    sent_at: sentAt,
  });

  if (logError) {
    throw new AppError('DB_WRITE_FAILED', logError.message, 500);
  }

  await writeSettlementLog({
    eventId,
    participantId,
    action: 'nudged',
    actorId: userId,
    fromStatus: participant.payment_status,
    toStatus: participant.payment_status,
    amount: participant.amount_owed,
    metadata: { twilio_sid: twilioResult.sid, channel: twilioResult.channel },
  });

  if (participant.user_id) {
    notifyMemberNudge(
      participant.user_id,
      amount,
      currency,
      locale,
      eventRow.title,
      eventId,
    );
  }

  return {
    sent: true,
    channel: twilioResult.channel,
    twilio_sid: twilioResult.sid,
    next_nudge_available_at: nextNudgeAvailableAt,
  };
}
