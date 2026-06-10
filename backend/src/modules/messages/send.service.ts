import type { AiStage } from '@letssplyt/shared/event.types';
import { AppError } from '../../infrastructure/errors';
import { isPhoneOptedOut } from '../../infrastructure/notification/opt-out';
import { sendTwilioMessage } from '../../infrastructure/notification/twilio-messaging';
import { supabaseAdmin } from '../../infrastructure/supabase';
import {
  assertEventOwner,
  fetchEventRow,
} from '../events/event.service';
import { buildMessagePreviewsForEvent, loadParticipantItemNames } from './messages.service';
import { resolveParticipantPhoneContext } from './participant-phone';
import { prepareSplitImageMediaUrl } from './split-image.service';

export type SendResultStatus =
  | 'sent'
  | 'skipped_opt_out'
  | 'skipped_no_phone'
  | 'failed';

export interface SendMessagesResult {
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  results: Array<{
    participant_id: string;
    status: SendResultStatus;
    twilio_sid?: string;
  }>;
  event_status: 'sent';
}

async function assertSendableStage(eventId: string, stage: AiStage): Promise<void> {
  if (stage === 'messaging' || stage === 'complete') {
    return;
  }
  throw new AppError(
    'MESSAGES_NOT_READY',
    'Generate message previews before sending (ai_stage must be messaging)',
    409,
  );
}

async function completeEventSend(eventId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .update({
      status: 'sent',
      ai_stage: 'complete',
      messages_sent_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .in('ai_stage', ['messaging', 'complete'])
    .select('id');

  if (error) {
    throw new AppError('DB_WRITE_FAILED', error.message, 500);
  }

  if (!data?.length) {
    throw new AppError('MESSAGES_NOT_READY', 'Event is not in messaging stage', 409);
  }
}

export async function sendEventMessages(
  userId: string,
  eventId: string,
  participantIds?: string[],
): Promise<SendMessagesResult> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);
  await assertSendableStage(eventId, eventRow.ai_stage);

  const filterIds =
    participantIds && participantIds.length > 0 ? new Set(participantIds) : null;

  const previews = await buildMessagePreviewsForEvent(eventId, eventRow.payer_id);
  const previewMap = new Map(previews.map((row) => [row.participant_id, row]));

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', eventRow.payer_id)
    .maybeSingle();

  if (payerError || !payer) {
    throw new AppError('PAYER_FETCH_FAILED', 'Could not load payer profile', 500);
  }

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select(
      'id, user_id, guest_pii_token, country_code, join_method, display_name, amount_owed',
    )
    .eq('event_id', eventId);

  if (participantsError) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  const rows = participantRows ?? [];
  const itemNamesByParticipant = await loadParticipantItemNames(eventId);
  const payerDisplayName = payer.display_name as string;

  const results: SendMessagesResult['results'] = [];
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const participantId = row.id as string;
    if (filterIds && !filterIds.has(participantId)) {
      continue;
    }

    const preview = previewMap.get(participantId);
    if (!preview) {
      continue;
    }

    const phoneContext = await resolveParticipantPhoneContext({
      user_id: row.user_id as string | null,
      guest_pii_token: row.guest_pii_token as string | null,
      country_code: row.country_code as string | null,
      join_method: row.join_method as string,
    });

    if (!phoneContext.phoneE164) {
      skippedCount += 1;
      results.push({ participant_id: participantId, status: 'skipped_no_phone' });
      continue;
    }

    if (await isPhoneOptedOut(phoneContext.phoneE164)) {
      skippedCount += 1;
      results.push({ participant_id: participantId, status: 'skipped_opt_out' });
      continue;
    }

    try {
      const mediaUrl = await prepareSplitImageMediaUrl(
        eventRow,
        payerDisplayName,
        rows.map((participant) => ({
          id: participant.id as string,
          display_name: participant.display_name as string,
          amount_owed: participant.amount_owed as number | null,
        })),
        itemNamesByParticipant,
        participantId,
      );

      const twilioResult = await sendTwilioMessage(
        phoneContext.phoneE164,
        phoneContext.channel,
        preview.message_text,
        mediaUrl,
      );

      const { error: participantError } = await supabaseAdmin
        .from('participants')
        .update({
          message_sent_at: new Date().toISOString(),
          message_channel: twilioResult.channel,
          message_failed: false,
        })
        .eq('id', participantId);

      if (participantError) {
        throw new AppError('DB_WRITE_FAILED', participantError.message, 500);
      }

      const { error: logError } = await supabaseAdmin.from('notification_log').insert({
        user_id: (row.user_id as string | null) ?? null,
        event_id: eventId,
        participant_id: participantId,
        type: 'split_received_sms',
        channel: twilioResult.channel,
        status: 'sent',
        twilio_sid: twilioResult.sid,
        sent_at: new Date().toISOString(),
      });

      if (logError) {
        throw new AppError('DB_WRITE_FAILED', logError.message, 500);
      }

      sentCount += 1;
      results.push({
        participant_id: participantId,
        status: 'sent',
        twilio_sid: twilioResult.sid,
      });
    } catch {
      failedCount += 1;
      await supabaseAdmin
        .from('participants')
        .update({ message_failed: true })
        .eq('id', participantId);
      results.push({ participant_id: participantId, status: 'failed' });
    }
  }

  await completeEventSend(eventId);

  return {
    sent_count: sentCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
    results,
    event_status: 'sent',
  };
}
