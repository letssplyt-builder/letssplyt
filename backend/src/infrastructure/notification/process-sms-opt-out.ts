import { formatPhoneE164 } from '../security/phone-format';
import { hashPhone } from '../security';
import { supabaseAdmin } from '../supabase';

export interface OptedOutParticipantRow {
  id: string;
  event_id: string;
  payment_status: string;
  amount_owed: number | null;
}

async function findGuestPiiIdsByPhoneHash(phoneHash: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('guest_pii')
    .select('id')
    .eq('phone_hash', phoneHash);

  if (error) {
    throw new Error(`Failed to load guest_pii for opt-out: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id as string);
}

async function findActiveParticipantsForPhone(phoneHash: string): Promise<OptedOutParticipantRow[]> {
  const activeStatuses = ['pending', 'self_reported'];
  const byId = new Map<string, OptedOutParticipantRow>();

  const { data: userRow, error: userError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('phone_hash', phoneHash)
    .is('deleted_at', null)
    .maybeSingle();

  if (userError) {
    throw new Error(`Failed to load user for opt-out: ${userError.message}`);
  }

  if (userRow?.id) {
    const { data: userParticipants, error: participantError } = await supabaseAdmin
      .from('participants')
      .select('id, event_id, payment_status, amount_owed')
      .eq('user_id', userRow.id as string)
      .in('payment_status', activeStatuses);

    if (participantError) {
      throw new Error(`Failed to load participants for opt-out: ${participantError.message}`);
    }

    for (const row of userParticipants ?? []) {
      byId.set(row.id as string, {
        id: row.id as string,
        event_id: row.event_id as string,
        payment_status: row.payment_status as string,
        amount_owed: row.amount_owed as number | null,
      });
    }
  }

  const guestPiiIds = await findGuestPiiIdsByPhoneHash(phoneHash);
  if (guestPiiIds.length > 0) {
    const { data: guestParticipants, error: guestParticipantError } = await supabaseAdmin
      .from('participants')
      .select('id, event_id, payment_status, amount_owed')
      .in('guest_pii_token', guestPiiIds)
      .in('payment_status', activeStatuses);

    if (guestParticipantError) {
      throw new Error(`Failed to load guest participants for opt-out: ${guestParticipantError.message}`);
    }

    for (const row of guestParticipants ?? []) {
      byId.set(row.id as string, {
        id: row.id as string,
        event_id: row.event_id as string,
        payment_status: row.payment_status as string,
        amount_owed: row.amount_owed as number | null,
      });
    }
  }

  return [...byId.values()];
}

/**
 * TCPA STOP handler — marks global opt-out and updates all active participant rows for this phone.
 */
export async function processSmsStopOptOut(phoneE164: string): Promise<OptedOutParticipantRow[]> {
  const normalized = formatPhoneE164(phoneE164);
  if (!normalized) {
    throw new Error('Invalid phone number for STOP opt-out');
  }

  const phoneHash = hashPhone(normalized);
  const now = new Date().toISOString();

  const { error: optOutError } = await supabaseAdmin.from('sms_opt_outs').upsert(
    {
      phone_hash: phoneHash,
      opt_out_method: 'stop_reply',
      opted_out_at: now,
    },
    { onConflict: 'phone_hash' },
  );

  if (optOutError) {
    throw new Error(`Failed to upsert sms_opt_outs: ${optOutError.message}`);
  }

  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({ is_opted_out: true })
    .eq('phone_hash', phoneHash);

  if (userError) {
    throw new Error(`Failed to update users opt-out flag: ${userError.message}`);
  }

  const participants = await findActiveParticipantsForPhone(phoneHash);

  if (participants.length > 0) {
    const participantIds = participants.map((p) => p.id);
    const { error: participantUpdateError } = await supabaseAdmin
      .from('participants')
      .update({
        payment_status: 'opted_out',
        opted_out: true,
        opted_out_at: now,
      })
      .in('id', participantIds);

    if (participantUpdateError) {
      throw new Error(`Failed to update participants opt-out: ${participantUpdateError.message}`);
    }

    const settlementRows = participants.map((participant) => ({
      participant_id: participant.id,
      event_id: participant.event_id,
      action: 'opted_out',
      actor_id: null,
      from_status: participant.payment_status,
      to_status: 'opted_out',
      amount: participant.amount_owed,
      note: 'STOP received via SMS',
      metadata: { changed_by: 'sms_stop' },
    }));

    const { error: logError } = await supabaseAdmin.from('settlement_log').insert(settlementRows);

    if (logError) {
      throw new Error(`Failed to write settlement_log for opt-out: ${logError.message}`);
    }
  }

  return participants;
}
