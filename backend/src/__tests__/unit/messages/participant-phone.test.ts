import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  resolveMessageChannel,
  resolveParticipantPhoneContext,
} from '../../../modules/messages/participant-phone';

describe('resolveParticipantPhoneContext', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  it('returns no phone for manual_name_only without querying auth or guest_pii', async () => {
    const result = await resolveParticipantPhoneContext({
      user_id: 'user-with-phone-on-file',
      guest_pii_token: 'guest-token',
      country_code: 'US',
      join_method: 'manual_name_only',
    });

    expect(result).toEqual({
      phoneE164: null,
      resolvedCountry: undefined,
      channel: 'sms',
    });
    expect(mockSupabase.auth.admin.getUserById).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe('resolveMessageChannel', () => {
  it('defaults to sms when phone is missing', () => {
    expect(resolveMessageChannel(null)).toBe('sms');
  });
});
