import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../../mocks/supabase.mock';
import { applyDeliveryUpdate } from '../../../../infrastructure/notification/messaging-delivery.service';

describe('applyDeliveryUpdate', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    mockSupabase.__pushMockResultForTable('notification_log', {
      data: { participant_id: 'part-1' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
  });

  it('sets delivered_at on notification_log and message_delivered_at on participant', async () => {
    await applyDeliveryUpdate('telnyx-msg-1', 'delivered');

    expect(mockSupabase.from).toHaveBeenCalledWith('notification_log');
    expect(mockSupabase.from).toHaveBeenCalledWith('participants');
  });

  it('sets message_failed when status is failed', async () => {
    await applyDeliveryUpdate('telnyx-msg-2', 'failed');

    expect(mockSupabase.from).toHaveBeenCalledWith('participants');
  });
});
