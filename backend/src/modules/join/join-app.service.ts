import { randomUUID } from 'crypto';
import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { findParticipantIdByUserInEvent } from '../participants/participant-link.service';
import {
  loadJoinEventContext,
  writeFunnelCheckpoint,
  type JoinPageKind,
} from './join-web.service';

export interface AppJoinPreview {
  eventName: string;
  creatorName: string;
  joinable: boolean;
  pageKind: JoinPageKind;
}

export interface AppJoinResult {
  eventId: string;
  eventName: string;
  amount_owed: null;
  participantId: string;
}

async function fetchUserDisplayName(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.display_name) {
    return 'LetsSplyt User';
  }

  return data.display_name as string;
}

export async function getAppJoinPreview(token: string): Promise<AppJoinPreview> {
  const { pageKind, context } = await loadJoinEventContext(token);

  if (!context || pageKind === 'not_found') {
    throw new AppError('TOKEN_NOT_FOUND', 'Join link is not valid', 404);
  }

  return {
    eventName: context.eventTitle,
    creatorName: context.payerName,
    joinable: pageKind === 'form',
    pageKind,
  };
}

export async function appJoinEvent(token: string, userId: string): Promise<AppJoinResult> {
  const { pageKind, context } = await loadJoinEventContext(token);

  if (!context || pageKind === 'not_found') {
    throw new AppError('TOKEN_NOT_FOUND', 'Join link is not valid', 404);
  }

  if (pageKind === 'expired') {
    throw new AppError('TOKEN_EXPIRED', 'Join link has expired', 410);
  }

  if (pageKind !== 'form') {
    throw new AppError(
      'GROUP_IS_LOCKED',
      'This group is no longer accepting new members',
      400,
    );
  }

  const existingParticipantId = await findParticipantIdByUserInEvent(context.eventId, userId);
  if (existingParticipantId) {
    throw new AppError('ALREADY_JOINED', 'You are already in this event', 409);
  }

  const displayName = await fetchUserDisplayName(userId);

  const { data: participant, error: participantError } = await supabaseAdmin
    .from('participants')
    .insert({
      event_id: context.eventId,
      user_id: userId,
      guest_pii_token: null,
      display_name: displayName,
      join_method: 'qr_app',
      payment_status: 'pending',
      country_code: 'US',
      message_channel: 'sms',
    })
    .select('id')
    .single();

  if (participantError || !participant) {
    throw new AppError('PARTICIPANT_CREATE_FAILED', 'Could not add you to the event', 500);
  }

  await writeFunnelCheckpoint({
    sessionId: randomUUID(),
    eventId: context.eventId,
    checkpoint: 'join_confirmed',
    metadata: { participant_id: participant.id, join_method: 'qr_app' },
  });

  return {
    eventId: context.eventId,
    eventName: context.eventTitle,
    amount_owed: null,
    participantId: participant.id as string,
  };
}
