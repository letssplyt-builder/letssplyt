import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { buildNudgeSummaryUrl, generateNudgeLinkToken } from '../messages/nudge-url';

export async function ensureNudgeSummaryUrl(params: {
  payerId: string;
  counterpartyUserId?: string;
  guestPhoneHash?: string;
}): Promise<string> {
  const token = await ensureNudgeLinkToken(params);
  return buildNudgeSummaryUrl(token);
}

async function ensureNudgeLinkToken(params: {
  payerId: string;
  counterpartyUserId?: string;
  guestPhoneHash?: string;
}): Promise<string> {
  if (params.counterpartyUserId) {
    const existing = await findMemberLink(params.payerId, params.counterpartyUserId);
    if (existing) return existing;
  } else if (params.guestPhoneHash) {
    const existing = await findGuestLink(params.payerId, params.guestPhoneHash);
    if (existing) return existing;
  } else {
    throw new AppError('VALIDATION_ERROR', 'Nudge link subject is required', 400);
  }

  const token = generateNudgeLinkToken();
  const { data, error } = await supabaseAdmin
    .from('nudge_links')
    .insert({
      token,
      payer_id: params.payerId,
      counterparty_user_id: params.counterpartyUserId ?? null,
      guest_phone_hash: params.guestPhoneHash ?? null,
    })
    .select('token')
    .maybeSingle();

  if (!error && data?.token) {
    return data.token as string;
  }

  if (params.counterpartyUserId) {
    const raced = await findMemberLink(params.payerId, params.counterpartyUserId);
    if (raced) return raced;
  } else if (params.guestPhoneHash) {
    const raced = await findGuestLink(params.payerId, params.guestPhoneHash);
    if (raced) return raced;
  }

  throw new AppError('DB_WRITE_FAILED', error?.message ?? 'Could not create nudge link', 500);
}

async function findMemberLink(payerId: string, counterpartyUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('nudge_links')
    .select('token')
    .eq('payer_id', payerId)
    .eq('counterparty_user_id', counterpartyUserId)
    .maybeSingle();

  if (error) {
    throw new AppError('DB_READ_FAILED', error.message, 500);
  }
  return (data?.token as string | undefined) ?? null;
}

async function findGuestLink(payerId: string, guestPhoneHash: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('nudge_links')
    .select('token')
    .eq('payer_id', payerId)
    .eq('guest_phone_hash', guestPhoneHash)
    .maybeSingle();

  if (error) {
    throw new AppError('DB_READ_FAILED', error.message, 500);
  }
  return (data?.token as string | undefined) ?? null;
}
