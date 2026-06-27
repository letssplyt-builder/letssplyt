import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { mockTwilio } from '../../mocks/twilio.mock';
import * as joinOtp from '../../../modules/join/join-otp';
import {
  encryptPhoneForJoin,
  hashPhoneForJoin,
  submitJoinPhone,
  verifyJoinOtp,
} from '../../../modules/join/join-web.service';

const TOKEN = 'join-token-unit';
const PHONE_E164 = '+15005550006';
const PHONE_NATIONAL = '5005550006';
const EVENT_ID = 'event-22222222-2222-2222-2222-222222222222';
const PAYER_ID = 'payer-22222222-2222-2222-2222-222222222222';
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function mockJoinContext(): void {
  mockSupabase.__setMockResultForTable('event_join_tokens', {
    data: {
      id: 'token-1',
      event_id: EVENT_ID,
      token: TOKEN,
      expires_at: FUTURE,
      is_active: true,
    },
    error: null,
  });
  mockSupabase.__setMockResultForTable('events', {
    data: {
      id: EVENT_ID,
      title: 'Friday Dinner',
      status: 'open',
      payer_id: PAYER_ID,
    },
    error: null,
  });
  mockSupabase.__setMockResultForTable('users', {
    data: { display_name: 'Alex' },
    error: null,
  });
}

describe('join-web.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    process.env.APP_ENV = 'test';
  });

  it('phone hashed before participant creation', async () => {
    const phone = PHONE_E164;
    const hash = hashPhoneForJoin(phone);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('phone encrypted before participant creation', () => {
    const encrypted = encryptPhoneForJoin(PHONE_E164);
    expect(encrypted).toContain(':');
    expect(encrypted.split(':')).toHaveLength(3);
  });

  it('sms_opt_outs checked by hash before OTP send', async () => {
    mockJoinContext();
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('sms_opt_outs', {
      data: { id: 'opt-out-1' },
      error: null,
    });
    mockSupabase.__setMockResultForTable('participants', { data: [], error: null });

    await expect(
      submitJoinPhone({
        token: TOKEN,
        displayName: 'Sam',
        countryDial: '+1',
        phoneNational: PHONE_NATIONAL,
        sessionId: 'session-1',
      }),
    ).rejects.toMatchObject({ code: 'OPTED_OUT' });

    expect(mockSupabase.from).toHaveBeenCalledWith('sms_opt_outs');
    expect(mockTwilio.messages.create).not.toHaveBeenCalled();
  });

  it('funnel_checkpoint written at phone_entered and join_confirmed', async () => {
    mockJoinContext();
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('participants', { data: [], error: null });

    await submitJoinPhone({
      token: TOKEN,
      displayName: 'Sam',
      countryDial: '+1',
      phoneNational: PHONE_NATIONAL,
      sessionId: 'session-phone',
    });

    const funnelCalls = mockSupabase.from.mock.calls.filter(([table]) => table === 'funnel_checkpoints');
    expect(funnelCalls.length).toBeGreaterThanOrEqual(2);

    mockSupabase.__setMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('guest_pii', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: 'participant-2' },
      error: null,
    });

    await verifyJoinOtp({
      token: TOKEN,
      displayName: 'Sam',
      phoneE164: PHONE_E164,
      code: '000000',
      sessionId: 'session-phone',
    });

    const allFunnelCalls = mockSupabase.from.mock.calls.filter(([table]) => table === 'funnel_checkpoints');
    expect(allFunnelCalls.length).toBeGreaterThanOrEqual(4);
    expect(mockSupabase.auth.admin.createUser).toHaveBeenCalled();

    const participantInsert = mockSupabase.from.mock.results
      .map((r) => (r.type === 'return' ? r.value : null))
      .flatMap((chain) => {
        if (!chain) return [];
        return (chain as { insert: jest.Mock }).insert.mock.calls;
      })
      .find((call) => (call[0] as { join_method?: string }).join_method === 'qr_web');

    expect(participantInsert).toBeTruthy();
    const payload = participantInsert![0] as {
      user_id: string;
      guest_pii_token: null;
      display_name: string;
    };
    expect(payload.user_id).toBeTruthy();
    expect(payload.guest_pii_token).toBeNull();
    expect(payload.display_name).toBe('Sam');
    expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user_metadata: { display_name: 'Sam' },
      }),
    );
  });

  it('verifyJoinOtp upgrades existing guest participant display_name from web form', async () => {
    mockJoinContext();
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });
    mockSupabase.__setMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('users', { data: { display_name: 'Alex' }, error: null });
    mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('guest_pii', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [{ id: 'guest-participant-1', guest_pii_token: 'guest-pii-1' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('guest_pii', {
      data: [{ id: 'guest-pii-1' }],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });

    await verifyJoinOtp({
      token: TOKEN,
      displayName: 'Robert',
      phoneE164: PHONE_E164,
      code: '000000',
      sessionId: 'session-guest-upgrade',
    });

    const participantUpdates = mockSupabase.from.mock.results
      .map((r) => (r.type === 'return' ? r.value : null))
      .flatMap((chain) => {
        if (!chain) return [];
        return (chain as { update: jest.Mock }).update.mock.calls;
      })
      .map((call) => call[0] as { display_name?: string; user_id?: string });

    expect(participantUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: expect.any(String), guest_pii_token: null }),
        expect.objectContaining({ display_name: 'Robert' }),
      ]),
    );
  });

  it('verifyJoinOtp recovers when OTP row is gone but participant already joined (double submit)', async () => {
    mockJoinContext();
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('users', { data: { display_name: 'Alex' }, error: null });
    mockSupabase.__pushMockResultForTable('users', {
      data: { id: 'user-already-joined' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: 'participant-already' },
      error: null,
    });

    jest.spyOn(joinOtp, 'verifyOtpCodeForJoin').mockResolvedValue(false);

    const result = await verifyJoinOtp({
      token: TOKEN,
      displayName: 'Sam',
      phoneE164: PHONE_E164,
      code: '123456',
      sessionId: 'session-race',
    });

    expect(result.participantId).toBe('participant-already');
    expect(result.eventTitle).toBe('Friday Dinner');
    expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled();
  });
});
