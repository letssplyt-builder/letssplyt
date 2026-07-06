import { decrypt } from './crypto';
import { supabaseAdmin } from '../supabase';

/** Resolve participant E.164 phone from auth user or encrypted guest PII vault. */
export async function resolveParticipantPhone(participant: {
  user_id: string | null;
  phone_encrypted: string | null;
}): Promise<string | null> {
  if (participant.user_id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(participant.user_id);
    if (error || !data.user?.phone) return null;
    return data.user.phone;
  }

  if (participant.phone_encrypted) {
    const key = process.env.PHONE_ENCRYPTION_KEY;
    if (!key) return null;
    return decrypt(participant.phone_encrypted, key);
  }

  return null;
}
