import type {
  ReceiptConfirmRequest,
  ReceiptConfirmResponse,
  ReceiptParseResponse,
  ReceiptUploadUrlResponse,
} from '@letssplyt/shared/receipt.types';
import * as ImageManipulator from 'expo-image-manipulator';
import { getSupabase } from '../lib/supabase';
import { ApiRequestError, apiPostAuth } from './api';

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
  return apiPostAuth<ReceiptConfirmResponse>('/receipts/confirm', body);
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

export async function uploadAndParseReceipt(
  imageUri: string,
  eventId: string,
): Promise<ReceiptParseResponse> {
  const compressedUri = await compressReceiptImage(imageUri);
  const { upload_url, storage_path, upload_token } = await requestUploadUrl(eventId);
  await uploadReceiptToSignedUrl(upload_url, compressedUri, storage_path, upload_token);
  return parseReceipt(eventId, storage_path);
}
