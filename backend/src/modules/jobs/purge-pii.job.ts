import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { breakdownTokenPurgeCutoffIso } from '../messages/breakdown-token-expiry';

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2000;

export interface GuestPiiPurgeResult {
  purged: number;
  breakdown_tokens_cleared: number;
}

export interface GuestPiiPurgeOptions {
  batchSize?: number;
}

/**
 * Hard-deletes expired guest_pii vault rows (phone/name encrypted).
 * Participant rows remain with display_name; guest_pii_token is cleared via FK ON DELETE SET NULL.
 * Also clears breakdown_token on participants whose events settled past the grace window.
 */
export async function runGuestPiiPurge(
  options: GuestPiiPurgeOptions = {},
): Promise<GuestPiiPurgeResult> {
  const now = new Date().toISOString();
  const batchSize = Math.min(
    Math.max(options.batchSize ?? DEFAULT_BATCH_SIZE, 1),
    MAX_BATCH_SIZE,
  );

  const { data: deleted, error } = await supabaseAdmin
    .from('guest_pii')
    .delete()
    .not('purge_after', 'is', null)
    .lt('purge_after', now)
    .limit(batchSize)
    .select('id');

  if (error) {
    throw new AppError('GUEST_PII_PURGE_FAILED', error.message, 500);
  }

  const purged = (deleted ?? []).length;
  const breakdown_tokens_cleared = await clearExpiredBreakdownTokens(batchSize);

  logger.info({
    msg: 'Guest PII purge complete',
    purged,
    breakdown_tokens_cleared,
    batchSize,
  });

  return { purged, breakdown_tokens_cleared };
}

async function clearExpiredBreakdownTokens(batchSize: number): Promise<number> {
  const cutoff = breakdownTokenPurgeCutoffIso();

  const { data: expiredEvents, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id')
    .not('fully_settled_at', 'is', null)
    .lt('fully_settled_at', cutoff)
    .limit(batchSize);

  if (eventsError) {
    throw new AppError('BREAKDOWN_TOKEN_PURGE_FAILED', eventsError.message, 500);
  }

  const eventIds = (expiredEvents ?? []).map((row) => row.id as string);
  if (eventIds.length === 0) {
    return 0;
  }

  const { data: cleared, error: updateError } = await supabaseAdmin
    .from('participants')
    .update({ breakdown_token: null })
    .in('event_id', eventIds)
    .not('breakdown_token', 'is', null)
    .select('id');

  if (updateError) {
    throw new AppError('BREAKDOWN_TOKEN_PURGE_FAILED', updateError.message, 500);
  }

  return (cleared ?? []).length;
}
