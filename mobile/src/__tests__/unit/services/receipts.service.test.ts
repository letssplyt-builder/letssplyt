import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import { AUTH_TOKEN_KEY } from '../../../store/authStore';
import {
  compressReceiptImage,
  parseReceipt,
  requestUploadUrl,
  uploadAndParseReceipt,
  uploadReceiptToSignedUrl,
} from '../../../services/receipts.service';

const EVENT_ID = 'event-44444444-4444-4444-4444-444444444444';

describe('receipts.service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, 'test-jwt');
  });

  it('requests upload URL from backend', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        upload_url: 'https://storage.example/upload',
        storage_path: `${EVENT_ID}/file.jpg`,
        upload_token: 'mock-token',
      }),
    } as Response);

    const result = await requestUploadUrl(EVENT_ID);

    expect(result.upload_url).toBe('https://storage.example/upload');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/receipts/upload-url'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ event_id: EVENT_ID }),
      }),
    );
  });

  it('compresses image before upload', async () => {
    const uri = await compressReceiptImage('file://photo.jpg');
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file://photo.jpg',
      [{ resize: { width: 1200 } }],
      expect.objectContaining({ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }),
    );
    expect(uri).toBe('file://photo.jpg-compressed');
  });

  it('uploads via signed URL token with image/jpeg content type', async () => {
    const { mockUploadToSignedUrl } = require('../../mocks/supabase') as {
      mockUploadToSignedUrl: jest.Mock;
    };
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['jpeg']),
    } as Response);

    await uploadReceiptToSignedUrl(
      'https://storage.example/upload',
      'file://photo.jpg',
      `${EVENT_ID}/file.jpg`,
      'mock-token',
    );

    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(
      `${EVENT_ID}/file.jpg`,
      'mock-token',
      expect.any(Blob),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
  });

  it('calls parse endpoint after successful upload', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          upload_url: 'https://storage.example/upload',
          storage_path: `${EVENT_ID}/receipt.jpg`,
          upload_token: 'mock-token',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['jpeg']),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
          tax_amount: 0,
          tip_amount: 0,
          total_amount: 0,
          currency: 'USD',
          storage_path: `${EVENT_ID}/receipt.jpg`,
        }),
      } as Response);

    const result = await uploadAndParseReceipt('file://photo.jpg', EVENT_ID);

    expect(result.storage_path).toBe(`${EVENT_ID}/receipt.jpg`);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/receipts/parse'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          event_id: EVENT_ID,
          storage_path: `${EVENT_ID}/receipt.jpg`,
        }),
      }),
    );
  });

  it('parseReceipt posts event_id and storage_path', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ name: 'Burger', unit_price: 12, quantity: 1 }],
        tax_amount: 1,
        tip_amount: 2,
        total_amount: 15,
        currency: 'USD',
        storage_path: `${EVENT_ID}/receipt.jpg`,
      }),
    } as Response);

    const result = await parseReceipt(EVENT_ID, `${EVENT_ID}/receipt.jpg`);
    expect(result.items).toHaveLength(1);
  });
});
