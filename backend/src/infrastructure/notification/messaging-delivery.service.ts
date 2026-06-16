import { supabaseAdmin } from '../supabase';

export type MappedDeliveryStatus = 'sent' | 'delivered' | 'failed' | 'bounced';

/**
 * Update notification_log and participants when a provider reports delivery status.
 * `messageId` is stored in notification_log.twilio_sid (legacy column name).
 */
export async function applyDeliveryUpdate(
  messageId: string,
  mappedStatus: MappedDeliveryStatus,
): Promise<void> {
  const { data: logRow, error: logFetchError } = await supabaseAdmin
    .from('notification_log')
    .select('participant_id')
    .eq('twilio_sid', messageId)
    .maybeSingle();

  if (logFetchError) {
    throw new Error(`Failed to load notification_log: ${logFetchError.message}`);
  }

  const updatePayload: Record<string, unknown> = { status: mappedStatus };
  if (mappedStatus === 'delivered') {
    updatePayload.delivered_at = new Date().toISOString();
  }

  const { error: logError } = await supabaseAdmin
    .from('notification_log')
    .update(updatePayload)
    .eq('twilio_sid', messageId);

  if (logError) {
    throw new Error(`Failed to update notification_log: ${logError.message}`);
  }

  const participantId = logRow?.participant_id as string | undefined;
  if (participantId && mappedStatus === 'delivered') {
    const { error: participantError } = await supabaseAdmin
      .from('participants')
      .update({ message_delivered_at: new Date().toISOString() })
      .eq('id', participantId);

    if (participantError) {
      throw new Error(`Failed to update participant delivery: ${participantError.message}`);
    }
  }

  if (participantId && (mappedStatus === 'failed' || mappedStatus === 'bounced')) {
    const { error: participantError } = await supabaseAdmin
      .from('participants')
      .update({ message_failed: true })
      .eq('id', participantId);

    if (participantError) {
      throw new Error(`Failed to update participant failure: ${participantError.message}`);
    }
  }
}
