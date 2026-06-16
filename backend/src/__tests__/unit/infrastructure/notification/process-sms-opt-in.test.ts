import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockSupabase } from '../../../mocks/supabase.mock';
import { processSmsStartOptIn } from '../../../../infrastructure/notification/process-sms-opt-in';

describe('processSmsStartOptIn', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('users', { data: null, error: null });
  });

  it('removes sms_opt_outs row and clears users.is_opted_out', async () => {
    await processSmsStartOptIn('+12125551234');

    expect(mockSupabase.from).toHaveBeenCalledWith('sms_opt_outs');
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
  });

  it('normalizes phone without plus prefix', async () => {
    await processSmsStartOptIn('12125551234');

    expect(mockSupabase.from).toHaveBeenCalledWith('sms_opt_outs');
  });
});
