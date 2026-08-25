import { beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { mockSupabase } from '../../mocks/supabase.mock';

describe('Nudge summary page', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('returns the not-found reminder page for an unknown token', async () => {
    mockSupabase.__pushMockResultForTable('nudge_links', { data: null, error: null });

    const response = await request(app).get('/nudge/unknown-token');

    expect(response.status).toBe(404);
    expect(response.text).toContain('This reminder link is invalid');
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});
