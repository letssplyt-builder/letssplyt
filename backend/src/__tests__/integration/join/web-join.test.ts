import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockTwilio } from '../../mocks/twilio.mock';
import { mockSupabase } from '../../mocks/supabase.mock';

const TOKEN = 'join-token-valid-abc';
const PHONE_E164 = '+15005550006';
const PHONE_NATIONAL = '5005550006';
const EXPIRED_TOKEN = 'join-token-expired';
const LOCKED_TOKEN = 'join-token-locked';
const EVENT_ID = 'event-11111111-1111-1111-1111-111111111111';
const PAYER_ID = 'payer-11111111-1111-1111-1111-111111111111';
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function extractCookie(setCookie: string[] | string | undefined, name: string): string {
  const header = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

function mockOpenJoinToken(token: string): void {
  mockSupabase.__setMockResultForTable('event_join_tokens', {
    data: {
      id: 'token-row-1',
      event_id: EVENT_ID,
      token,
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

describe('Web join integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    process.env.APP_ENV = 'test';
  });

  it('GET /join/:validToken → 200 HTML with form', async () => {
    mockOpenJoinToken(TOKEN);
    mockSupabase.__pushMockResultForTable('funnel_checkpoints', { data: null, error: null });

    const response = await request(app).get(`/join/${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toContain('Join the group');
    expect(response.text).toContain('Friday Dinner');
    expect(response.text).toContain('name="display_name"');
    expect(response.text).toContain('terms.html');
    expect(response.text).toContain('privacy.html');
    expect(response.text).toContain('never shared with the organiser');
  });

  it('GET /join/:expiredToken → 200 HTML with expiry message (NOT 404)', async () => {
    mockSupabase.__setMockResultForTable('event_join_tokens', {
      data: {
        id: 'token-row-expired',
        event_id: EVENT_ID,
        token: EXPIRED_TOKEN,
        expires_at: PAST,
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

    const response = await request(app).get(`/join/${EXPIRED_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('expired');
    expect(response.text).not.toContain('name="display_name"');
  });

  it('GET /join/:lockedToken → 200 HTML with locked message', async () => {
    mockSupabase.__setMockResultForTable('event_join_tokens', {
      data: {
        id: 'token-row-locked',
        event_id: EVENT_ID,
        token: LOCKED_TOKEN,
        expires_at: FUTURE,
        is_active: true,
      },
      error: null,
    });
    mockSupabase.__setMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        title: 'Friday Dinner',
        status: 'locked',
        payer_id: PAYER_ID,
      },
      error: null,
    });
    mockSupabase.__setMockResultForTable('users', {
      data: { display_name: 'Alex' },
      error: null,
    });

    const response = await request(app).get(`/join/${LOCKED_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('no longer accepting new members');
  });

  it('POST /join/:token with valid phone → OTP sent, funnel_checkpoint written', async () => {
    process.env.OTP_DEV_BYPASS = 'false';
    mockOpenJoinToken(TOKEN);
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__setMockResultForTable('otp_verifications', { data: null, error: null });

    const getResponse = await request(app).get(`/join/${TOKEN}`);
    const csrfToken = extractCookie(getResponse.headers['set-cookie'], 'csrf_token');
    const cookieHeader = Array.isArray(getResponse.headers['set-cookie'])
      ? getResponse.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ')
      : '';

    const response = await request(app)
      .post(`/join/${TOKEN}`)
      .set('Cookie', cookieHeader)
      .type('form')
      .send({
        csrf_token: csrfToken,
        display_name: 'Sam Guest',
        country_dial: '+1',
        phone_national: PHONE_NATIONAL,
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain('Enter your code');
    expect(mockTwilio.messages.create).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('funnel_checkpoints');
    process.env.OTP_DEV_BYPASS = 'true';
  });

  it("POST /join/:token/verify-otp with '000000' → participant created in DB", async () => {
    mockOpenJoinToken(TOKEN);
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__setMockResultForTable('users', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('guest_pii', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: 'participant-1' },
      error: null,
    });

    const getResponse = await request(app).get(`/join/${TOKEN}`);
    const csrfToken = extractCookie(getResponse.headers['set-cookie'], 'csrf_token');
    const cookieHeader = Array.isArray(getResponse.headers['set-cookie'])
      ? getResponse.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ')
      : '';

    const response = await request(app)
      .post(`/join/${TOKEN}/verify-otp`)
      .set('Cookie', cookieHeader)
      .type('form')
      .send({
        csrf_token: csrfToken,
        display_name: 'Sam Guest',
        phone_e164: PHONE_E164,
        code: '000000',
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain("You're in!");
    expect(mockSupabase.from).toHaveBeenCalledWith('participants');
    expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user_metadata: { display_name: 'Sam Guest' },
      }),
    );

    const participantInsert = mockSupabase.from.mock.results
      .map((r) => (r.type === 'return' ? r.value : null))
      .flatMap((chain) => {
        if (!chain) return [];
        return (chain as { insert: jest.Mock }).insert.mock.calls;
      })
      .find((call) => (call[0] as { join_method?: string }).join_method === 'qr_web');

    expect(participantInsert).toBeTruthy();
    expect((participantInsert![0] as { display_name: string }).display_name).toBe('Sam Guest');
  });

  it('registered user already in event → idempotent without OTP', async () => {
    mockOpenJoinToken(TOKEN);
    mockSupabase.__setMockResultForTable('funnel_checkpoints', { data: null, error: null });
    mockSupabase.__setMockResultForTable('sms_opt_outs', { data: null, error: null });
    mockSupabase.__setMockResultForTable('users', { data: null, error: null });
    // Each loadJoinEventContext consumes a payer lookup; submitJoinPhone adds a registered-user lookup.
    mockSupabase.__pushMockResultForTable('users', { data: { display_name: 'Alex' }, error: null });
    mockSupabase.__pushMockResultForTable('users', { data: { display_name: 'Alex' }, error: null });
    mockSupabase.__pushMockResultForTable('users', {
      data: { id: 'user-registered-1' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: 'participant-1' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', { data: { display_name: 'Alex' }, error: null });

    const getResponse = await request(app).get(`/join/${TOKEN}`);
    const csrfToken = extractCookie(getResponse.headers['set-cookie'], 'csrf_token');
    const cookieHeader = Array.isArray(getResponse.headers['set-cookie'])
      ? getResponse.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ')
      : '';

    const response = await request(app)
      .post(`/join/${TOKEN}`)
      .set('Cookie', cookieHeader)
      .type('form')
      .send({
        csrf_token: csrfToken,
        display_name: 'Sam Guest',
        country_dial: '+1',
        phone_national: PHONE_NATIONAL,
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain("You're in!");
    expect(mockTwilio.messages.create).not.toHaveBeenCalled();
  });
});
