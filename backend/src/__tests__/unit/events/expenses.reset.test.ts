import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { resetEventExpenses } from '../../../modules/events/expenses.reset';

const USER_ID = 'payer-user-1';
const OTHER_USER_ID = 'other-user-2';
const EVENT_ID = 'event-11111111-1111-1111-1111-111111111111';

const LOCKED_EVENT = {
  id: EVENT_ID,
  payer_id: USER_ID,
  title: 'Dinner',
  event_date: null,
  total_amount: 120,
  currency: 'USD',
  status: 'locked',
  split_mode: 'equal',
  ai_stage: 'calculated',
  locale: 'en-US',
  locked_at: '2026-01-01T01:00:00.000Z',
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  tax_amount: null,
  tip_amount: null,
  fees_amount: null,
  receipt_scan_attempted: false,
};

const RESET_EVENT = {
  ...LOCKED_EVENT,
  ai_stage: 'none',
  split_mode: null,
  total_amount: null,
  receipt_scan_attempted: false,
};

describe('resetEventExpenses', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  it('resets expense data via RPC when it clears all fields', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: RESET_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [], error: null });

    const result = await resetEventExpenses(USER_ID, EVENT_ID);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('reset_event_expenses_data', {
      p_event_id: EVENT_ID,
    });
    expect(result).toEqual({
      reset: true,
      event_id: EVENT_ID,
      ai_stage: 'none',
    });
  });

  it('falls back to row updates when RPC leaves expense data behind', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [{ id: 'item-1' }], error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('ai_audit_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: { id: EVENT_ID }, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: RESET_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [], error: null });

    const result = await resetEventExpenses(USER_ID, EVENT_ID);

    expect(result.reset).toBe(true);
  });

  it('rejects when not event owner', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });

    await expect(resetEventExpenses(OTHER_USER_ID, EVENT_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects when messages already sent', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        ...LOCKED_EVENT,
        messages_sent_at: '2026-01-02T00:00:00.000Z',
      },
      error: null,
    });

    await expect(resetEventExpenses(USER_ID, EVENT_ID)).rejects.toMatchObject({
      code: 'MESSAGES_ALREADY_SENT',
    });
  });

  it('rejects when nothing to reset', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: {
        ...LOCKED_EVENT,
        ai_stage: 'none',
        total_amount: null,
        receipt_scan_attempted: false,
        split_mode: null,
      },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [], error: null });

    await expect(resetEventExpenses(USER_ID, EVENT_ID)).rejects.toMatchObject({
      code: 'NOTHING_TO_RESET',
    });
  });

  it('rejects when event is not locked', async () => {
    mockSupabase.__pushMockResultForTable('events', {
      data: { ...LOCKED_EVENT, status: 'open' },
      error: null,
    });

    await expect(resetEventExpenses(USER_ID, EVENT_ID)).rejects.toMatchObject({
      code: 'EVENT_NOT_LOCKED',
    });
  });

  it('rejects when reset leaves expense data behind', async () => {
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [{ id: 'item-1' }], error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('ai_audit_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: { id: EVENT_ID }, error: null });
    mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });
    mockSupabase.__pushMockResultForTable('receipt_items', { data: [{ id: 'item-1' }], error: null });

    await expect(resetEventExpenses(USER_ID, EVENT_ID)).rejects.toMatchObject({
      code: 'RESET_FAILED',
    });
  });
});
