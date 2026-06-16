import { formatPhoneE164 } from '../security/phone-format';
import { hashPhone } from '../security';
import { supabaseAdmin } from '../supabase';

/**
 * TCPA START handler — clears global SMS opt-out. Does not revert participant payment_status.
 */
export async function processSmsStartOptIn(phoneE164: string): Promise<void> {
  const normalized = formatPhoneE164(phoneE164);
  if (!normalized) {
    throw new Error('Invalid phone number for START opt-in');
  }

  const phoneHash = hashPhone(normalized);

  const { error: deleteError } = await supabaseAdmin
    .from('sms_opt_outs')
    .delete()
    .eq('phone_hash', phoneHash);

  if (deleteError) {
    throw new Error(`Failed to remove sms_opt_outs row: ${deleteError.message}`);
  }

  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({ is_opted_out: false })
    .eq('phone_hash', phoneHash);

  if (userError) {
    throw new Error(`Failed to clear users opt-out flag: ${userError.message}`);
  }
}
