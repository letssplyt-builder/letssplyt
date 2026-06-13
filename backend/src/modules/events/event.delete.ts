import { AppError, Errors } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import {
  assertEventOwner,
  fetchEventRow,
} from './event.service';
import { deleteReceiptImagesForEvent } from './event-storage.cleanup';

/**
 * Hard-deletes an event and cascaded children when payment messages have not been sent.
 * Explicit cleanup for guest_pii, notification_log, settlement_log, and Storage.
 */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.messages_sent_at) {
    throw Errors.conflict(
      'Cannot delete an event after payment messages have been sent',
      'EVENT_MESSAGES_ALREADY_SENT',
    );
  }

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('guest_pii_token')
    .eq('event_id', eventId);

  if (participantsError) {
    throw new AppError('DB_READ_FAILED', participantsError.message, 500);
  }

  const guestPiiIds = (participantRows ?? [])
    .map((row) => row.guest_pii_token as string | null)
    .filter((token): token is string => Boolean(token));

  await deleteReceiptImagesForEvent(eventId);

  const { error: settlementLogError } = await supabaseAdmin
    .from('settlement_log')
    .delete()
    .eq('event_id', eventId);

  if (settlementLogError) {
    throw new AppError('DB_WRITE_FAILED', settlementLogError.message, 500);
  }

  const { error: notificationLogError } = await supabaseAdmin
    .from('notification_log')
    .delete()
    .eq('event_id', eventId);

  if (notificationLogError) {
    throw new AppError('DB_WRITE_FAILED', notificationLogError.message, 500);
  }

  const { error: optOutError } = await supabaseAdmin
    .from('sms_opt_outs')
    .update({ event_id: null })
    .eq('event_id', eventId);

  if (optOutError) {
    throw new AppError('DB_WRITE_FAILED', optOutError.message, 500);
  }

  if (guestPiiIds.length > 0) {
    const { error: guestPiiError } = await supabaseAdmin
      .from('guest_pii')
      .delete()
      .in('id', guestPiiIds);

    if (guestPiiError) {
      throw new AppError('DB_WRITE_FAILED', guestPiiError.message, 500);
    }
  }

  const { data: deleted, error: deleteError } = await supabaseAdmin
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('payer_id', userId)
    .select('id')
    .maybeSingle();

  if (deleteError) {
    throw new AppError('DB_WRITE_FAILED', deleteError.message, 500);
  }

  if (!deleted) {
    throw Errors.notFound('Event not found');
  }
}
