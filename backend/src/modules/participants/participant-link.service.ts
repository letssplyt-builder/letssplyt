import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';

/**
 * Links historical guest participant rows (manual add or pre-registration web join)
 * to a verified user account after OTP registration/login.
 */
export async function upgradeGuestParticipantsToUser(
  phoneHash: string,
  userId: string,
): Promise<void> {
  const { data: guestRows, error: guestError } = await supabaseAdmin
    .from('guest_pii')
    .select('id')
    .eq('phone_hash', phoneHash);

  if (guestError) {
    throw new AppError('GUEST_PII_LOOKUP_FAILED', 'Could not upgrade guest participants', 500);
  }

  const guestIds = (guestRows ?? []).map((row) => row.id as string);
  if (guestIds.length === 0) {
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('participants')
    .update({ user_id: userId, guest_pii_token: null })
    .in('guest_pii_token', guestIds)
    .is('user_id', null);

  if (updateError) {
    throw new AppError('PARTICIPANT_LINK_FAILED', 'Could not link guest participants to user', 500);
  }
}

export async function findParticipantIdByUserInEvent(
  eventId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new AppError('PARTICIPANTS_LOOKUP_FAILED', 'Could not check existing participants', 500);
  }

  return (data?.id as string) ?? null;
}

export async function linkParticipantToUser(
  participantId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('participants')
    .update({ user_id: userId, guest_pii_token: null })
    .eq('id', participantId)
    .is('user_id', null);

  if (error) {
    throw new AppError('PARTICIPANT_LINK_FAILED', 'Could not link participant to user', 500);
  }
}
