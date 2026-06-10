import { hashPhone } from '../security';
import { supabaseAdmin } from '../supabase';

export async function isPhoneOptedOut(phoneE164: string): Promise<boolean> {
  const phoneHash = hashPhone(phoneE164);
  const { data, error } = await supabaseAdmin
    .from('sms_opt_outs')
    .select('id')
    .eq('phone_hash', phoneHash)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check sms_opt_outs: ${error.message}`);
  }

  return Boolean(data);
}
