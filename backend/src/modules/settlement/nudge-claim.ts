import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';

export async function claimParticipantNudgeSlot(
  eventId: string,
  participantId: string,
): Promise<string | null> {
  const { data: claimedAt, error: claimError } = await supabaseAdmin.rpc(
    'claim_participant_nudge',
    {
      p_participant_id: participantId,
      p_event_id: eventId,
    },
  );

  if (claimError) {
    throw new AppError('DB_WRITE_FAILED', claimError.message, 500);
  }

  if (typeof claimedAt === 'string' && claimedAt.length > 0) {
    return claimedAt;
  }

  return null;
}
