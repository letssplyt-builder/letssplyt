import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { supabaseAdmin } from '../../infrastructure/supabase';

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2000;

export interface GuestPiiPurgeResult {
  purged: number;
}

export interface GuestPiiPurgeOptions {
  batchSize?: number;
}

/**
 * Hard-deletes expired guest_pii vault rows (phone/name encrypted).
 * Participant rows remain with display_name; guest_pii_token is cleared via FK ON DELETE SET NULL.
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

  logger.info({
    msg: 'Guest PII purge complete',
    purged,
    batchSize,
  });

  return { purged };
}
