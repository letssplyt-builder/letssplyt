import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { deleteEvent } from '../../../modules/events/event.delete';

const USER_ID = 'payer-user-1';
const OTHER_USER_ID = 'other-user-2';
const EVENT_ID = 'event-del-1111-1111-1111-111111111111';

const OPEN_EVENT = {
  id: EVENT_ID,
  payer_id: USER_ID,
  title: 'Dinner',
  event_date: null,
  total_amount: null,
  currency: 'USD',
  status: 'open',
  split_mode: null,
  ai_stage: 'none',
  locale: 'en-US',
  locked_at: null,
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  tax_amount: null,
  tip_amount: null,
  fees_amount: null,
  receipt_scan_attempted: false,
};

describe('deleteEvent', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('hard-deletes event when messages have not been sent', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ guest_pii_token: 'guest-pii-1' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('guest_pii', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: { id: EVENT_ID },
      error: null,
    });

    await deleteEvent(USER_ID, EVENT_ID);

    expect(mockSupabase.from).toHaveBeenCalledWith('settlement_log');
    expect(mockSupabase.from).toHaveBeenCalledWith('guest_pii');
  });

  it('rejects when messages were already sent', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: { ...OPEN_EVENT, messages_sent_at: '2026-01-02T00:00:00.000Z', status: 'sent' },
      error: null,
    });

    await expect(deleteEvent(USER_ID, EVENT_ID)).rejects.toMatchObject({
      code: 'EVENT_MESSAGES_ALREADY_SENT',
      statusCode: 409,
    });
  });

  it('rejects when caller is not the payer', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });

    await expect(deleteEvent(OTHER_USER_ID, EVENT_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });
});
