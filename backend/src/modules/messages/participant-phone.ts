import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { decrypt } from '../../infrastructure/security/crypto';
import { supabaseAdmin } from '../../infrastructure/supabase';

export interface ParticipantPhoneContext {
  phoneE164: string | null;
  resolvedCountry: string | undefined;
  channel: 'whatsapp' | 'sms';
}

export async function resolveParticipantPhoneContext(
  participant: {
    user_id: string | null;
    guest_pii_token: string | null;
    country_code: string | null;
    join_method: string;
  },
): Promise<ParticipantPhoneContext> {
  if (participant.join_method === 'manual_name_only') {
    return { phoneE164: null, resolvedCountry: undefined, channel: 'sms' };
  }

  let phoneE164: string | null = null;

  if (participant.user_id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(participant.user_id);
    if (!error && data.user?.phone) {
      phoneE164 = data.user.phone;
    }
  } else if (participant.guest_pii_token) {
    const { data, error } = await supabaseAdmin
      .from('guest_pii')
      .select('phone_encrypted')
      .eq('id', participant.guest_pii_token)
      .maybeSingle();

    if (!error && data?.phone_encrypted) {
      const key = process.env.PHONE_ENCRYPTION_KEY;
      if (key) {
        phoneE164 = decrypt(data.phone_encrypted as string, key);
      }
    }
  }

  let resolvedCountry = participant.country_code ?? undefined;

  if (phoneE164) {
    const parsed = parsePhoneNumberFromString(phoneE164);
    if (parsed?.country) {
      resolvedCountry = parsed.country;
    }
  }

  const channel = resolveMessageChannel(phoneE164, resolvedCountry);

  return { phoneE164, resolvedCountry, channel };
}

export function resolveMessageChannel(
  phoneE164: string | null,
  resolvedCountry?: string,
): 'whatsapp' | 'sms' {
  if (resolvedCountry === 'US' || resolvedCountry === 'CA') {
    return 'sms';
  }
  if (phoneE164?.startsWith('+1')) {
    return 'sms';
  }
  if (!phoneE164) {
    return 'sms';
  }
  return 'whatsapp';
}
