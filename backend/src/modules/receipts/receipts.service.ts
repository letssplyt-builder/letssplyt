import { randomUUID } from 'crypto';
import { AppError, Errors } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type {
  ReceiptParseResponse,
  ReceiptUploadUrlResponse,
} from '@letssplyt/shared/receipt.types';
import { runA1ReceiptParse } from '../ai/a1-receipt-parser';
import {
  assertEventOwner,
  fetchEventRow,
} from '../events/event.service';

const RECEIPTS_BUCKET = 'receipts';

export async function createReceiptUploadUrl(
  userId: string,
  eventId: string,
): Promise<ReceiptUploadUrlResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'locked') {
    throw new AppError(
      'EVENT_NOT_LOCKED',
      'Event must be locked before uploading a receipt',
      400,
    );
  }

  const storagePath = `${eventId}/${randomUUID()}.jpg`;

  const { data, error } = await supabaseAdmin.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl || !data.token) {
    const detail =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : undefined;
    throw new AppError(
      'UPLOAD_URL_FAILED',
      detail
        ? `Could not create receipt upload URL: ${detail}`
        : 'Could not create receipt upload URL. Ensure the receipts storage bucket exists.',
      500,
      { storagePath, detail },
    );
  }

  return {
    upload_url: data.signedUrl,
    storage_path: storagePath,
    upload_token: data.token,
  };
}

export async function parseReceipt(
  userId: string,
  eventId: string,
  storagePath: string,
): Promise<ReceiptParseResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'locked') {
    throw new AppError(
      'EVENT_NOT_LOCKED',
      'Event must be locked before parsing a receipt',
      400,
    );
  }

  const expectedPrefix = `${eventId}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw Errors.validation('storage_path must belong to this event');
  }

  return runA1ReceiptParse(eventId, storagePath, eventRow.title);
}
