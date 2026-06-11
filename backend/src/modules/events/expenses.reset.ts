import { AppError, Errors } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import {
  assertEventOwner,
  fetchEventRow,
  type EventRowWithReceiptFields,
} from './event.service';

const RECEIPTS_BUCKET = 'receipts';

export interface ResetExpensesResponse {
  reset: true;
  event_id: string;
  ai_stage: 'none';
}

function hasExpensesToReset(row: EventRowWithReceiptFields): boolean {
  return (
    row.ai_stage !== 'none' ||
    row.receipt_scan_attempted ||
    row.total_amount !== null ||
    row.tax_amount !== null ||
    row.tip_amount !== null ||
    row.fees_amount !== null ||
    row.split_mode !== null
  );
}

async function deleteReceiptImagesForEvent(eventId: string): Promise<void> {
  try {
    const bucket = supabaseAdmin.storage.from(RECEIPTS_BUCKET);
    if (typeof bucket.list !== 'function') {
      return;
    }

    const { data: files, error } = await bucket.list(eventId);
    if (error || !files?.length) {
      return;
    }

    const paths = files.map((file) => `${eventId}/${file.name}`);
    if (typeof bucket.remove !== 'function') {
      return;
    }

    const { error: removeError } = await bucket.remove(paths);
    if (removeError) {
      console.warn(
        `[resetExpenses] Could not delete receipt images for event ${eventId}: ${removeError.message}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[resetExpenses] Storage cleanup skipped for event ${eventId}: ${message}`);
  }
}

/** Optional DB function — never fails the request; falls back to row updates. */
async function tryRpcReset(eventId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('reset_event_expenses_data', {
      p_event_id: eventId,
    });
    if (error) {
      console.warn(`[resetExpenses] RPC reset_event_expenses_data failed: ${error.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[resetExpenses] RPC call failed: ${message}`);
  }
}

async function resetExpensesViaQueries(eventId: string): Promise<void> {
  const { error: deleteItemsError } = await supabaseAdmin
    .from('receipt_items')
    .delete()
    .eq('event_id', eventId);

  if (deleteItemsError) {
    throw new AppError('DB_WRITE_FAILED', deleteItemsError.message, 500);
  }

  const { error: participantsError } = await supabaseAdmin
    .from('participants')
    .update({
      amount_owed: null,
      payment_status: 'pending',
      message_sent_at: null,
      message_delivered_at: null,
      message_failed: false,
      message_channel: null,
      payment_link_tapped_at: null,
      self_reported_at: null,
      self_reported_method: null,
      confirmed_at: null,
      breakdown_token: null,
    })
    .eq('event_id', eventId);

  if (participantsError) {
    throw new AppError('DB_WRITE_FAILED', participantsError.message, 500);
  }

  const { error: auditError } = await supabaseAdmin
    .from('ai_audit_log')
    .delete()
    .eq('event_id', eventId);

  if (auditError) {
    console.warn(
      `[resetExpenses] ai_audit_log cleanup failed for event ${eventId}: ${auditError.message}`,
    );
  }

  const { error: eventUpdateError } = await supabaseAdmin
    .from('events')
    .update({
      total_amount: null,
      tax_amount: null,
      tip_amount: null,
      fees_amount: null,
      receipt_scan_attempted: false,
      ai_parse_success: null,
      ai_parse_confidence: null,
      ai_stage: 'none',
      split_mode: null,
      last_parse_attempt_id: null,
    })
    .eq('id', eventId);

  if (eventUpdateError) {
    throw new AppError('DB_WRITE_FAILED', eventUpdateError.message, 500);
  }
}

async function countReceiptItems(eventId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('receipt_items')
    .select('id')
    .eq('event_id', eventId);

  if (error) {
    throw new AppError('DB_WRITE_FAILED', error.message, 500);
  }

  return (data ?? []).length;
}

/**
 * Clears receipt scan data, manual totals, split assignments, and AI stage for a locked event.
 * Participants and join tokens are preserved. Blocked after payment messages have been sent.
 */
export async function resetEventExpenses(
  userId: string,
  eventId: string,
): Promise<ResetExpensesResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'locked') {
    throw Errors.conflict('Expenses can only be reset on a locked event', 'EVENT_NOT_LOCKED');
  }

  if (eventRow.messages_sent_at) {
    throw Errors.conflict(
      'Cannot reset expenses after messages have been sent',
      'MESSAGES_ALREADY_SENT',
    );
  }

  if (!hasExpensesToReset(eventRow) && (await countReceiptItems(eventId)) === 0) {
    throw new AppError('NOTHING_TO_RESET', 'No expense data to reset for this event', 400);
  }

  await tryRpcReset(eventId);

  let rowAfterRpc = await fetchEventRow(eventId);
  if (hasExpensesToReset(rowAfterRpc) || (await countReceiptItems(eventId)) > 0) {
    await resetExpensesViaQueries(eventId);
    rowAfterRpc = await fetchEventRow(eventId);
  }

  if (hasExpensesToReset(rowAfterRpc) || (await countReceiptItems(eventId)) > 0) {
    throw new AppError(
      'RESET_FAILED',
      'Expense data could not be cleared. Check backend logs and database migrations.',
      500,
    );
  }

  await deleteReceiptImagesForEvent(eventId);

  return {
    reset: true,
    event_id: eventId,
    ai_stage: 'none',
  };
}
