import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { splitImageStoragePath } from './split-image.generator';

const RECEIPTS_BUCKET = 'receipts';
const SIGNED_URL_TTL_SECONDS = 86400;

export async function uploadSplitImage(
  eventId: string,
  participantId: string,
  buffer: Buffer,
): Promise<string> {
  const path = splitImageStoragePath(eventId, participantId);
  const { error } = await supabaseAdmin.storage.from(RECEIPTS_BUCKET).upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  });

  if (error) {
    throw new AppError('STORAGE_WRITE_FAILED', error.message, 500, { path });
  }

  return path;
}

export async function createSplitImageSignedUrl(
  eventId: string,
  participantId: string,
): Promise<string> {
  const path = splitImageStoragePath(eventId, participantId);
  const { data, error } = await supabaseAdmin.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new AppError(
      'STORAGE_READ_FAILED',
      error?.message ?? 'Could not create split image signed URL',
      500,
      { path },
    );
  }

  return data.signedUrl;
}
