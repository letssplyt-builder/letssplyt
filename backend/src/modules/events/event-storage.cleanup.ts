import logger from '../../infrastructure/logger';
import { supabaseAdmin } from '../../infrastructure/supabase';

const RECEIPTS_BUCKET = 'receipts';

/**
 * Removes all objects under receipts/{eventId}/ (receipt scans, split PNGs).
 * Best-effort — logs warnings and never throws.
 */
export async function deleteReceiptImagesForEvent(eventId: string): Promise<void> {
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
      logger.warn({
        msg: 'Could not delete receipt images for event',
        eventId,
        dbMessage: removeError.message,
      });
    }
  } catch (err) {
    logger.warn({
      msg: 'Storage cleanup skipped for event',
      eventId,
      err,
    });
  }
}
