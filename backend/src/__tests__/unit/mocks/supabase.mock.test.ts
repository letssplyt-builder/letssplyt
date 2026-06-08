import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';

describe('supabase mock', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('chainable mock returns configured data from single()', async () => {
    mockSupabase.__setMockResult({ data: { id: 'user-1' }, error: null });
    const result = await mockSupabase.from('users').select('*').eq('id', 'user-1').single();
    expect(result.data).toEqual({ id: 'user-1' });
  });

  it('__setMockResult changes what single() returns', async () => {
    mockSupabase.__setMockResult({ data: { name: 'Alex' }, error: null });
    const first = await mockSupabase.from('users').select().single();
    expect(first.data).toEqual({ name: 'Alex' });

    mockSupabase.__setMockResult({ data: { name: 'Jordan' }, error: null });
    const second = await mockSupabase.from('users').select().single();
    expect(second.data).toEqual({ name: 'Jordan' });
  });

  it('__mockRLSError causes single() to return PGRST116', async () => {
    mockSupabase.__mockRLSError();
    const result = await mockSupabase.from('users').select().single();
    expect(result.error?.code).toBe('PGRST116');
    expect(result.data).toBeNull();
  });

  it('__resetMock restores default null result', async () => {
    mockSupabase.__setMockResult({ data: { id: 'x' }, error: null });
    mockSupabase.__resetMock();
    const result = await mockSupabase.from('users').select().single();
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('maybeSingle() also returns configured mock result', async () => {
    mockSupabase.__setMockResult({ data: { token: 'abc' }, error: null });
    const result = await mockSupabase.from('event_join_tokens').select().maybeSingle();
    expect(result.data).toEqual({ token: 'abc' });
  });

  it('different from() calls to different tables can be configured independently', async () => {
    mockSupabase.__setMockResultForTable('users', { data: { id: 'user-1' }, error: null });
    mockSupabase.__setMockResultForTable('events', { data: { id: 'event-1' }, error: null });

    const userResult = await mockSupabase.from('users').select().single();
    const eventResult = await mockSupabase.from('events').select().single();

    expect(userResult.data).toEqual({ id: 'user-1' });
    expect(eventResult.data).toEqual({ id: 'event-1' });
  });
});
