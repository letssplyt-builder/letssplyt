import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  createReceiptUploadUrl,
  parseReceipt,
} from '../../../modules/receipts/receipts.service';

const USER_ID = 'receipt-payer-1';
const OTHER_USER_ID = 'receipt-other-2';
const EVENT_ID = 'event-44444444-4444-4444-4444-444444444444';

const LOCKED_EVENT_ROW = {
  id: EVENT_ID,
  payer_id: USER_ID,
  title: 'Locked Dinner',
  event_date: null,
  total_amount: null,
  currency: 'USD',
  status: 'locked',
  split_mode: null,
  ai_stage: 'none',
  locale: 'en-US',
  locked_at: '2026-01-02T00:00:00.000Z',
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

describe('receipts.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  describe('createReceiptUploadUrl', () => {
    it('returns 403 when event belongs to another user', async () => {
      mockSupabase.__setMockResultForTable('events', {
        data: { ...LOCKED_EVENT_ROW, payer_id: OTHER_USER_ID },
        error: null,
      });

      await expect(createReceiptUploadUrl(USER_ID, EVENT_ID)).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });

    it('returns 400 when event status is not locked', async () => {
      mockSupabase.__setMockResultForTable('events', {
        data: { ...LOCKED_EVENT_ROW, status: 'open' },
        error: null,
      });

      await expect(createReceiptUploadUrl(USER_ID, EVENT_ID)).rejects.toMatchObject({
        code: 'EVENT_NOT_LOCKED',
        statusCode: 400,
      });
    });

    it('generates signed URL for event-scoped storage path', async () => {
      mockSupabase.__setMockResultForTable('events', { data: LOCKED_EVENT_ROW, error: null });

      const result = await createReceiptUploadUrl(USER_ID, EVENT_ID);

      expect(result.upload_url).toContain('https://test.supabase.co/upload/receipts/');
      expect(result.storage_path).toMatch(
        new RegExp(`^${EVENT_ID}/[0-9a-f-]+\\.jpg$`),
      );
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('receipts');
    });
  });

  describe('parseReceipt', () => {
    it('rejects storage_path outside event folder', async () => {
      mockSupabase.__setMockResultForTable('events', { data: LOCKED_EVENT_ROW, error: null });

      await expect(
        parseReceipt(USER_ID, EVENT_ID, 'other-event/photo.jpg'),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    });
  });
});
