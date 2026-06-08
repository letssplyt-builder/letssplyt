import { AppError, Errors, NotFoundError } from '../../infrastructure/errors';
import { encrypt, encryptPhone, hashPhone } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type { JoinMethod, ManualParticipantResponse } from '@letssplyt/shared/participant.types';
import { assertEventOwner, fetchEventRow } from './event.service';

type ManualJoinMethod = Extract<JoinMethod, 'manual_phone' | 'manual_name_only'>;

interface ManualParticipantInput {
  display_name: string;
  phone_e164?: string;
  join_method: ManualJoinMethod;
}

function encryptGuestName(displayName: string): string {
  const key = process.env.PHONE_ENCRYPTION_KEY;
  if (!key) {
    throw new AppError('ENCRYPTION_CONFIG_MISSING', 'Phone encryption is not configured', 500);
  }
  return encrypt(displayName, key);
}

function assertEventOpen(status: string): void {
  if (status !== 'open') {
    throw new AppError(
      'GROUP_IS_LOCKED',
      'Participants can only be modified while the event is open',
      400,
    );
  }
}

async function checkSmsOptOut(phoneHash: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('sms_opt_outs')
    .select('id')
    .eq('phone_hash', phoneHash)
    .maybeSingle();

  if (error) {
    throw new AppError('OPT_OUT_CHECK_FAILED', 'Could not verify SMS opt-out status', 500);
  }

  if (data) {
    // Opt-out is recorded server-side; manual add still proceeds (no invite SMS in E05-S02).
  }
}

async function hasDuplicatePhoneInEvent(eventId: string, phoneHash: string): Promise<boolean> {
  const { data: participants, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('guest_pii_token')
    .eq('event_id', eventId)
    .not('guest_pii_token', 'is', null);

  if (participantsError) {
    throw new AppError('PARTICIPANTS_LOOKUP_FAILED', 'Could not check existing participants', 500);
  }

  const guestTokens = (participants ?? [])
    .map((row) => row.guest_pii_token as string | null)
    .filter((token): token is string => Boolean(token));

  if (guestTokens.length === 0) {
    return false;
  }

  const { data: matches, error: guestError } = await supabaseAdmin
    .from('guest_pii')
    .select('id')
    .in('id', guestTokens)
    .eq('phone_hash', phoneHash)
    .limit(1);

  if (guestError) {
    throw new AppError('GUEST_PII_LOOKUP_FAILED', 'Could not verify guest phone uniqueness', 500);
  }

  return (matches ?? []).length > 0;
}

function mapManualParticipant(row: {
  id: string;
  display_name: string;
  join_method: string;
  payment_status: string;
}): ManualParticipantResponse {
  return {
    id: row.id,
    display_name: row.display_name,
    join_method: row.join_method as ManualParticipantResponse['join_method'],
    payment_status: row.payment_status as ManualParticipantResponse['payment_status'],
  };
}

export async function addManualParticipant(
  userId: string,
  eventId: string,
  input: ManualParticipantInput,
): Promise<ManualParticipantResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);
  assertEventOpen(eventRow.status);

  if (input.join_method === 'manual_name_only') {
    const { data, error } = await supabaseAdmin
      .from('participants')
      .insert({
        event_id: eventId,
        user_id: null,
        guest_pii_token: null,
        display_name: input.display_name,
        join_method: 'manual_name_only',
        payment_status: 'pending',
      })
      .select('id, display_name, join_method, payment_status')
      .single();

    if (error || !data) {
      throw new AppError('PARTICIPANT_CREATE_FAILED', 'Could not add participant', 500);
    }

    return mapManualParticipant(data);
  }

  if (!input.phone_e164) {
    throw Errors.validation('phone_e164 is required for manual_phone participants');
  }

  const phoneHash = hashPhone(input.phone_e164);
  const phoneEncrypted = encryptPhone(input.phone_e164);

  await checkSmsOptOut(phoneHash);

  if (await hasDuplicatePhoneInEvent(eventId, phoneHash)) {
    throw Errors.conflict('This phone number is already in the event', 'DUPLICATE_PHONE');
  }

  const { data: guestPii, error: guestError } = await supabaseAdmin
    .from('guest_pii')
    .insert({
      phone_hash: phoneHash,
      phone_encrypted: phoneEncrypted,
      name_encrypted: encryptGuestName(input.display_name),
    })
    .select('id')
    .single();

  if (guestError || !guestPii) {
    throw new AppError('GUEST_PII_CREATE_FAILED', 'Could not store guest contact details', 500);
  }

  const { data: participant, error: participantError } = await supabaseAdmin
    .from('participants')
    .insert({
      event_id: eventId,
      user_id: null,
      guest_pii_token: guestPii.id,
      display_name: input.display_name,
      join_method: 'manual_phone',
      payment_status: 'pending',
    })
    .select('id, display_name, join_method, payment_status')
    .single();

  if (participantError || !participant) {
    await supabaseAdmin.from('guest_pii').delete().eq('id', guestPii.id as string);
    throw new AppError('PARTICIPANT_CREATE_FAILED', 'Could not add participant', 500);
  }

  return mapManualParticipant(participant);
}

export async function deleteParticipant(
  userId: string,
  eventId: string,
  participantId: string,
): Promise<void> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);
  assertEventOpen(eventRow.status);

  const { data: participant, error: fetchError } = await supabaseAdmin
    .from('participants')
    .select('id, payment_status, guest_pii_token')
    .eq('id', participantId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError('PARTICIPANT_FETCH_FAILED', 'Could not load participant', 500);
  }

  if (!participant) {
    throw new NotFoundError('Participant not found');
  }

  if (participant.payment_status !== 'pending') {
    throw new AppError(
      'CANNOT_REMOVE_ACTIVE_PARTICIPANT',
      'Only participants with pending payment status can be removed',
      400,
    );
  }

  if (participant.guest_pii_token) {
    const { error: guestDeleteError } = await supabaseAdmin
      .from('guest_pii')
      .delete()
      .eq('id', participant.guest_pii_token as string);

    if (guestDeleteError) {
      throw new AppError('GUEST_PII_DELETE_FAILED', 'Could not remove guest contact details', 500);
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('participants')
    .delete()
    .eq('id', participantId);

  if (deleteError) {
    throw new AppError('PARTICIPANT_DELETE_FAILED', 'Could not remove participant', 500);
  }
}
