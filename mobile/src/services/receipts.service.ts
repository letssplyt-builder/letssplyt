import type {
  ReceiptConfirmRequest,
  ReceiptConfirmResponse,
  ReceiptParseResponse,
  ReceiptUploadUrlResponse,
} from '@letssplyt/shared/receipt.types';
import * as ImageManipulator from 'expo-image-manipulator';
import { getSupabase } from '../lib/supabase';
import { ApiRequestError, apiPostAuth, isApiRequestError } from './api';

const MAX_RECEIPT_WIDTH = 1200;
const JPEG_QUALITY = 0.7;

export async function compressReceiptImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_RECEIPT_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export async function requestUploadUrl(eventId: string): Promise<ReceiptUploadUrlResponse> {
  return apiPostAuth<ReceiptUploadUrlResponse>('/receipts/upload-url', { event_id: eventId });
}

export async function uploadReceiptToSignedUrl(
  uploadUrl: string,
  fileUri: string,
  storagePath: string,
  uploadToken: string,
): Promise<void> {
  const fileResponse = await fetch(fileUri);
  if (!fileResponse.ok) {
    throw new ApiRequestError('UPLOAD_FAILED', 'Could not read receipt image', 0);
  }

  const body = await fileResponse.blob();
  const supabase = getSupabase();

  if (supabase?.storage) {
    const { error } = await supabase.storage
      .from('receipts')
      .uploadToSignedUrl(storagePath, uploadToken, body, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (!error) {
      return;
    }
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body,
  });

  if (!uploadResponse.ok) {
    throw new ApiRequestError(
      'UPLOAD_FAILED',
      'Receipt upload failed. Check your connection and try again.',
      uploadResponse.status,
    );
  }
}

export async function confirmReceipt(
  body: ReceiptConfirmRequest,
): Promise<ReceiptConfirmResponse> {
  return apiPostAuth<ReceiptConfirmResponse>(
    '/receipts/confirm',
    body as unknown as Record<string, unknown>,
  );
}

export async function parseReceipt(
  eventId: string,
  storagePath: string,
): Promise<ReceiptParseResponse> {
  return apiPostAuth<ReceiptParseResponse>('/receipts/parse', {
    event_id: eventId,
    storage_path: storagePath,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient parse failures the UI should absorb with one silent retry. */
export function isRetriableParseError(err: unknown): boolean {
  if (!isApiRequestError(err)) {
    return true;
  }
  if (err.code === 'RECEIPT_UNREADABLE' || err.code === 'AI_QUOTA_EXCEEDED') {
    return false;
  }
  return (
    err.code === 'PARSE_FAILED' ||
    err.code === 'NETWORK_ERROR' ||
    err.code === 'ALREADY_PROCESSING' ||
    err.status === 409 ||
    err.status >= 500
  );
}

/**
 * Call parse once; on transient failure wait briefly and try again before
 * surfacing an error to the user (matches the "tap Retry and it works" case).
 */
export async function parseReceiptWithRetry(
  eventId: string,
  storagePath: string,
  options?: { onRetry?: () => void },
): Promise<ReceiptParseResponse> {
  try {
    return await parseReceipt(eventId, storagePath);
  } catch (err) {
    if (!isRetriableParseError(err)) {
      throw err;
    }

    options?.onRetry?.();
    const waitMs =
      isApiRequestError(err) && err.code === 'ALREADY_PROCESSING' ? 2000 : 900;
    await sleep(waitMs);
    return parseReceipt(eventId, storagePath);
  }
}

export async function uploadAndParseReceipt(
  imageUri: string,
  eventId: string,
): Promise<ReceiptParseResponse> {
  const compressedUri = await compressReceiptImage(imageUri);
  const { upload_url, storage_path, upload_token } = await requestUploadUrl(eventId);
  await uploadReceiptToSignedUrl(upload_url, compressedUri, storage_path, upload_token);
  return parseReceiptWithRetry(eventId, storage_path);
}
