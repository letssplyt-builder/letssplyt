import { mockSupabase } from '../mocks/supabase.mock';

/** Route middleware and services each call fetchEventRow once per HTTP request. */
export function pushEventRow(row: unknown): void {
  const result = { data: row, error: null };
  mockSupabase.__pushMockResultForTable('events', result);
  mockSupabase.__pushMockResultForTable('events', result);
}
