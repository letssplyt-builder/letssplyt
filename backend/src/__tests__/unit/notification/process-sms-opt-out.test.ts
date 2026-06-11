import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { processSmsStopOptOut } from '../../../infrastructure/notification/process-sms-opt-out';

describe('processSmsStopOptOut', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('users', { data: { id: 'user-1' }, error: null });
    mockSupabase.__setMockResultForTable('guest_pii', { data: [], error: null });
    mockSupabase.__setMockResultForTable('participants', {
      data: [
        {
          id: 'part-1',
          event_id: 'event-1',
          payment_status: 'pending',
          amount_owed: 25,
        },
      ],
      error: null,
    });
    mockSupabase.__setMockResultForTable('settlement_log', { data: null, error: null });
  });

  it('upserts sms_opt_outs, updates users, participants, and settlement_log', async () => {
    const updated = await processSmsStopOptOut('+12125551234');

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('part-1');
    expect(mockSupabase.from).toHaveBeenCalledWith('sms_opt_outs');
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect(mockSupabase.from).toHaveBeenCalledWith('participants');
    expect(mockSupabase.from).toHaveBeenCalledWith('settlement_log');
  });
});
