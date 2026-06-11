import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

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
  });

  it('GET /split/:token returns HTML breakdown with viewer highlighted', async () => {
    const response = await request(app).get(`/split/${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
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
    expect(response.text).toContain('invalid or has expired');
  });
});
