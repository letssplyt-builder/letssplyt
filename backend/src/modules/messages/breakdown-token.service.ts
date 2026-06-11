import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { buildBreakdownUrl, generateBreakdownTokenValue } from './breakdown-url';

export async function ensureParticipantBreakdownToken(participantId: string): Promise<string> {
  const { data: existing, error: readError } = await supabaseAdmin
    .from('participants')
    .select('breakdown_token')
    .eq('id', participantId)
    .maybeSingle();

  if (readError) {
    throw new AppError('DB_READ_FAILED', readError.message, 500);
  }

  if (existing?.breakdown_token) {
    return existing.breakdown_token as string;
  }

  const token = generateBreakdownTokenValue();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('participants')
    .update({ breakdown_token: token })
    .eq('id', participantId)
    .is('breakdown_token', null)
    .select('breakdown_token')
    .maybeSingle();

  if (updateError) {
    throw new AppError('DB_WRITE_FAILED', updateError.message, 500);
  }

  if (updated?.breakdown_token) {
    return updated.breakdown_token as string;
  }

  const { data: reread, error: rereadError } = await supabaseAdmin
    .from('participants')
    .select('breakdown_token')
    .eq('id', participantId)
    .maybeSingle();

  if (rereadError || !reread?.breakdown_token) {
    throw new AppError('DB_WRITE_FAILED', 'Could not assign breakdown token', 500);
  }

  return reread.breakdown_token as string;
}

export async function ensureParticipantBreakdownUrl(participantId: string): Promise<string> {
  const token = await ensureParticipantBreakdownToken(participantId);
  return buildBreakdownUrl(token);
}
