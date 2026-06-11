import type { AiStage } from '@letssplyt/shared/event.types';
import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { getPaymentConfigForPhone } from '../../config/payment-methods.config';
import { getHandles } from '../profile/profile.service';
import { assertEventOwner, fetchEventRow } from '../events/event.service';
import { composeParticipantMessage } from './a3.agent';
import { assembleParticipantMessage } from './message-assembler';
import type { PayerHandleInput } from './deepLinks';
import { resolveParticipantPhoneContext } from './participant-phone';
import { ensureParticipantBreakdownUrl } from './breakdown-token.service';

export interface MessagePreviewItem {
  participant_id: string;
  display_name: string;
  amount_owed: number;
  message_text: string;
  channel: 'whatsapp' | 'sms';
  payment_links: Array<{
    provider: string;
    label: string;
    url: string;
  }>;
  breakdown_url: string | null;
}

export interface MessagePreviewResponse {
  previews: MessagePreviewItem[];
}

const PREVIEW_ALLOWED_STAGES: AiStage[] = ['calculated', 'messaging'];

async function claimMessagingStage(eventId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .update({ ai_stage: 'messaging' })
    .eq('id', eventId)
    .eq('ai_stage', 'calculated')
    .select('id');

  if (error) {
    throw new AppError('DB_WRITE_FAILED', error.message, 500);
  }

  return (data?.length ?? 0) > 0;
}

async function ensureMessagingStage(eventId: string, currentStage: AiStage): Promise<void> {
  if (currentStage === 'messaging' || currentStage === 'complete') {
    return;
  }

  if (!PREVIEW_ALLOWED_STAGES.includes(currentStage)) {
    throw new AppError(
      'SPLIT_NOT_CONFIRMED',
      'Split must be confirmed before generating message previews',
      409,
    );
  }

  const claimed = await claimMessagingStage(eventId);
  if (!claimed) {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('ai_stage')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      throw new AppError('EVENT_FETCH_FAILED', 'Could not verify event stage', 500);
    }

    const stage = data.ai_stage as AiStage;
    if (stage !== 'messaging' && stage !== 'complete') {
      throw new AppError(
        'SPLIT_NOT_CONFIRMED',
        'Could not advance to messaging stage — split may not be confirmed',
        409,
      );
    }
  }
}

export async function loadParticipantItemNames(eventId: string): Promise<Map<string, string[]>> {
  const { data, error } = await supabaseAdmin
    .from('item_assignments')
    .select('participant_id, receipt_items!inner(name, event_id)')
    .eq('receipt_items.event_id', eventId);

  if (error) {
    throw new AppError('ITEM_ASSIGNMENTS_FETCH_FAILED', 'Could not load item assignments', 500);
  }

  const map = new Map<string, string[]>();

  for (const row of data ?? []) {
    const participantId = row.participant_id as string;
    const raw = row.receipt_items as { name: string } | Array<{ name: string }> | null;
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item?.name) continue;

    const existing = map.get(participantId) ?? [];
    existing.push(item.name);
    map.set(participantId, existing);
  }

  return map;
}

export async function buildMessagePreviewsForEvent(
  eventId: string,
  payerId: string,
): Promise<MessagePreviewItem[]> {
  const eventRow = await fetchEventRow(eventId);

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', eventRow.payer_id)
    .maybeSingle();

  if (payerError || !payer) {
    throw new AppError('PAYER_FETCH_FAILED', 'Could not load payer profile', 500);
  }

  const payerHandles = await getHandles(payerId);
  const payerHandleInputs = payerHandles.map((handle) => ({
    provider: handle.provider,
    handle_value: handle.handle_value,
  }));

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select(
      'id, user_id, display_name, amount_owed, guest_pii_token, country_code, join_method',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (participantsError) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  const rows = participantRows ?? [];
  const memberRows = rows.filter(
    (row) => (row.user_id as string | null) !== eventRow.payer_id,
  );

  if (memberRows.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Event has no members to message', 400);
  }

  const missingAmounts = memberRows.filter((row) => row.amount_owed === null);
  if (missingAmounts.length > 0) {
    throw new AppError(
      'SPLIT_NOT_CONFIRMED',
      'All members must have amount_owed set before preview',
      409,
    );
  }

  const itemNamesByParticipant = await loadParticipantItemNames(eventId);
  const currency = eventRow.currency ?? 'USD';
  const locale = eventRow.locale ?? 'en-US';
  const eventName = eventRow.title;
  const payerDisplayName = payer.display_name as string;
  const previews: MessagePreviewItem[] = [];

  for (const row of memberRows) {
    const amountOwed = Number(row.amount_owed);
    const displayName = row.display_name as string;
    const phoneContext = await resolveParticipantPhoneContext({
      user_id: row.user_id as string | null,
      guest_pii_token: row.guest_pii_token as string | null,
      country_code: row.country_code as string | null,
      join_method: row.join_method as string,
    });

    const paymentConfig = phoneContext.phoneE164
      ? getPaymentConfigForPhone(phoneContext.phoneE164, phoneContext.resolvedCountry)
      : getPaymentConfigForPhone('+1', phoneContext.resolvedCountry);

    const participantId = row.id as string;
    const breakdownUrl = await ensureParticipantBreakdownUrl(participantId);

    const composed = await composeParticipantMessage({
      eventId,
      eventName,
      displayName,
      payerDisplayName,
      itemNames: itemNamesByParticipant.get(participantId) ?? [],
      amountOwed,
      currency,
      locale,
      payerHandles: payerHandleInputs,
      supportedMethods: paymentConfig.supportedMethods,
      channel: phoneContext.channel,
      isRegistered: Boolean(row.user_id),
      breakdownUrl,
    });

    previews.push({
      participant_id: participantId,
      display_name: displayName,
      amount_owed: amountOwed,
      message_text: composed.messageText,
      channel: composed.channel,
      payment_links: composed.paymentLinks.map((link) => ({
        provider: link.provider,
        label: link.label,
        url: link.url,
      })),
      breakdown_url: breakdownUrl,
    });
  }

  return previews;
}

export async function previewEventMessages(
  userId: string,
  eventId: string,
): Promise<MessagePreviewResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);
  await ensureMessagingStage(eventId, eventRow.ai_stage);
  const previews = await buildMessagePreviewsForEvent(eventId, eventRow.payer_id);
  return { previews };
}

export interface RevisionMessagePackage {
  participant_id: string;
  message_text: string;
  channel: 'whatsapp' | 'sms';
}

export async function buildRevisionMessagesForParticipants(
  eventId: string,
  payerId: string,
  participantIds: string[],
): Promise<RevisionMessagePackage[]> {
  if (participantIds.length === 0) {
    return [];
  }

  const eventRow = await fetchEventRow(eventId);

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', eventRow.payer_id)
    .maybeSingle();

  if (payerError || !payer) {
    throw new AppError('PAYER_FETCH_FAILED', 'Could not load payer profile', 500);
  }

  const payerHandles = await getHandles(payerId);
  const payerHandleInputs: PayerHandleInput[] = payerHandles.map((handle) => ({
    provider: handle.provider,
    handle_value: handle.handle_value,
  }));

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select(
      'id, user_id, display_name, amount_owed, guest_pii_token, country_code, join_method',
    )
    .eq('event_id', eventId)
    .in('id', participantIds);

  if (participantsError) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  const currency = eventRow.currency ?? 'USD';
  const locale = eventRow.locale ?? 'en-US';
  const eventName = eventRow.title;
  const packages: RevisionMessagePackage[] = [];

  for (const row of participantRows ?? []) {
    const participantId = row.id as string;
    if (row.amount_owed === null) {
      continue;
    }

    const amountOwed = Number(row.amount_owed);
    const displayName = row.display_name as string;
    const phoneContext = await resolveParticipantPhoneContext({
      user_id: row.user_id as string | null,
      guest_pii_token: row.guest_pii_token as string | null,
      country_code: row.country_code as string | null,
      join_method: row.join_method as string,
    });

    const paymentConfig = phoneContext.phoneE164
      ? getPaymentConfigForPhone(phoneContext.phoneE164, phoneContext.resolvedCountry)
      : getPaymentConfigForPhone('+1', phoneContext.resolvedCountry);

    const breakdownUrl = await ensureParticipantBreakdownUrl(participantId);

    const composed = assembleParticipantMessage({
      revisionLeadIn: 'Your share has been updated.',
      aiGreeting: `Hi ${displayName}!`,
      displayName,
      amountOwed,
      currency,
      locale,
      eventName,
      payerHandles: payerHandleInputs,
      supportedMethods: paymentConfig.supportedMethods,
      channel: phoneContext.channel,
      isRegistered: Boolean(row.user_id),
      breakdownUrl,
    });

    packages.push({
      participant_id: participantId,
      message_text: composed.messageText,
      channel: composed.channel,
    });
  }

  return packages;
}
