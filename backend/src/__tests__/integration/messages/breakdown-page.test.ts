import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';
import * as security from '../../../infrastructure/security';

const TOKEN = 'breakdown-token-test';
const EVENT_ID = 'event-eeee-eeee-eeee-eeee-eeee-eeee-eeee';
const VIEWER_ID = 'part-v-1111-1111-1111-111111111111';
const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('Split breakdown page', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();

    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: VIEWER_ID,
        event_id: EVENT_ID,
        display_name: 'Jordan',
        amount_owed: 42,
        user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'qr_app',
      },
      error: null,
    });

    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        title: 'Team Dinner',
        payer_id: PAYER_ID,
        currency: 'USD',
        locale: 'en-US',
        total_amount: 84,
        deleted_at: null,
      },
      error: null,
    });

    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex' },
      error: null,
    });

    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: 'part-payer',
          display_name: 'Alex',
          amount_owed: 42,
          user_id: PAYER_ID,
        },
        {
          id: VIEWER_ID,
          display_name: 'Jordan',
          amount_owed: 42,
          user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        },
      ],
      error: null,
    });

    mockSupabase.__pushMockResultForTable('item_assignments', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('user_payment_handles', { data: [], error: null });
  });

  it('includes Venmo native app URL on pay buttons when payer has handles', async () => {
    jest.spyOn(security, 'decryptHandle').mockReturnValue('@alex-host');
    mockSupabase.__resetMock();

    mockSupabase.__pushMockResultForTable('participants', {
      data: {
        id: VIEWER_ID,
        event_id: EVENT_ID,
        display_name: 'Jordan',
        amount_owed: 42,
        user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'qr_app',
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        id: EVENT_ID,
        title: 'Team Dinner',
        payer_id: PAYER_ID,
        currency: 'USD',
        locale: 'en-US',
        total_amount: 84,
        deleted_at: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        { id: 'part-payer', display_name: 'Alex', amount_owed: 42, user_id: PAYER_ID },
        {
          id: VIEWER_ID,
          display_name: 'Jordan',
          amount_owed: 42,
          user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('item_assignments', { data: [], error: null });
    mockSupabase.__pushMockResultForTable('user_payment_handles', {
      data: [
        {
          id: 'handle-1',
          provider: 'venmo',
          handle_encrypted: 'enc-blob',
          display_order: 0,
        },
      ],
      error: null,
    });

    const response = await request(app).get(`/s/${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('Pay your share');
    expect(response.text).toContain('data-app-url="venmo://paycharge');
    expect(response.text).toContain('https://account.venmo.com/pay');
  });

  it('GET /s/:token serves the same breakdown page as /split/:token', async () => {
    const response = await request(app).get(`/s/${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('Team Dinner');
    expect(response.text).toContain('Jordan (you)');
  });

  it('GET /split/:token returns HTML breakdown with viewer highlighted', async () => {
    const response = await request(app).get(`/split/${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.text).toContain('Team Dinner');
    expect(response.text).toContain('Jordan (you)');
    expect(response.text).toContain('Alex (organiser)');
    expect(response.text).toContain('Who owes what');
  });

  it('GET /split/:token returns 404 HTML for unknown token', async () => {
    mockSupabase.__resetMock();
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });

    const response = await request(app).get('/split/unknown-token');

    expect(response.status).toBe(404);
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.text).toContain('invalid or has expired');
  });
});
