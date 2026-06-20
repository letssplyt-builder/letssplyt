import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  buildJoinUrl,
  createEvent,
  decodeEventCursor,
  encodeEventCursor,
  generateJoinTokenValue,
  getEventById,
  listEvents,
  lockEvent,
  reopenEvent,
} from '../../../modules/events/event.service';
const USER_ID = 'payer-user-1';
const OTHER_USER_ID = 'other-user-2';
const EVENT_ID = 'event-11111111-1111-1111-1111-111111111111';

describe('event.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
    process.env.APP_DOMAIN = 'http://localhost:3000';
  });

  describe('token helpers', () => {
    it('generates cryptographically random tokens', () => {
      const a = generateJoinTokenValue();
      const b = generateJoinTokenValue();
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThanOrEqual(18);
    });

    it('buildJoinUrl uses APP_DOMAIN', () => {
      expect(buildJoinUrl('abc123')).toBe('http://localhost:3000/join/abc123');
    });

    it('encodes and decodes event cursors', () => {
      const cursor = encodeEventCursor('2026-01-02T00:00:00.000Z', EVENT_ID);
      expect(decodeEventCursor(cursor)).toEqual({
        created_at: '2026-01-02T00:00:00.000Z',
        id: EVENT_ID,
      });
    });
  });

  describe('createEvent', () => {
    it('creates event with correct payer_id, creator participant, and join token', async () => {
      mockSupabase.__pushMockResultForTable('events', {
        data: { id: EVENT_ID, title: 'Dinner', status: 'open' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: USER_ID, display_name: 'Alex' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('event_join_tokens', { data: null, error: null });

      const result = await createEvent(USER_ID, { title: 'Dinner' });

      expect(result.title).toBe('Dinner');
      expect(result.status).toBe('open');
      expect(result.join_url).toContain('/join/');
      expect(result.token_expires_at).toBeTruthy();

      const insertChain = mockSupabase.from.mock.results.find((r) => {
        if (r.type !== 'return') return false;
        const chain = r.value as { insert: jest.Mock };
        return chain.insert.mock.calls.length > 0;
      });
      expect(insertChain).toBeDefined();
      const eventInsert = (insertChain!.value as { insert: jest.Mock }).insert.mock.calls.find(
        (call) => (call[0] as { payer_id?: string }).payer_id === USER_ID,
      );
      expect(eventInsert).toBeTruthy();

      const participantInsert = mockSupabase.from.mock.results
        .map((r) => (r.type === 'return' ? (r.value as { insert: jest.Mock }) : null))
        .find((chain) =>
          chain?.insert.mock.calls.some(
            (call) =>
              (call[0] as { event_id?: string; user_id?: string }).event_id === EVENT_ID &&
              (call[0] as { user_id?: string }).user_id === USER_ID,
          ),
        );
      expect(participantInsert).toBeTruthy();
    });
  });

  describe('listEvents', () => {
    it('returns cursor-paginated results', async () => {
      mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
      mockSupabase.__pushMockResultForTable('events', {
        data: [
          {
            id: 'event-2',
            title: 'Lunch',
            status: 'open',
            total_amount: null,
            created_at: '2026-01-02T00:00:00.000Z',
            payer_id: USER_ID,
          },
          {
            id: 'event-1',
            title: 'Breakfast',
            status: 'locked',
            total_amount: 42.5,
            created_at: '2026-01-01T00:00:00.000Z',
            payer_id: USER_ID,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', { data: [{ id: 'p1' }], error: null });

      const page1 = await listEvents(USER_ID, { limit: 1 });
      expect(page1.events).toHaveLength(1);
      expect(page1.events[0]?.role).toBe('creator');
      expect(page1.has_more).toBe(true);
      expect(page1.next_cursor).toBeTruthy();

      mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
      mockSupabase.__pushMockResultForTable('events', {
        data: [
          {
            id: 'event-1',
            title: 'Breakfast',
            status: 'locked',
            total_amount: 42.5,
            created_at: '2026-01-01T00:00:00.000Z',
            payer_id: USER_ID,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', { data: [{ id: 'p1' }], error: null });

      const page2 = await listEvents(USER_ID, {
        limit: 1,
        cursor: page1.next_cursor!,
      });
      expect(page2.events).toHaveLength(1);
      expect(page2.has_more).toBe(false);
    });
  });

  describe('lockEvent', () => {
    it('rejects when participant count is below 2', async () => {
      mockSupabase.__setMockResultForTable('events', {
        data: {
          id: EVENT_ID,
          payer_id: USER_ID,
          title: 'Dinner',
          event_date: null,
          total_amount: null,
          currency: 'USD',
          status: 'open',
          split_mode: null,
          ai_stage: 'none',
          locale: 'en-US',
          locked_at: null,
          messages_sent_at: null,
          fully_settled_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
        error: null,
      });
      mockSupabase.__setMockResultForTable('participants', {
        data: [{ id: 'participant-1' }],
        error: null,
      });

      await expect(lockEvent(USER_ID, EVENT_ID)).rejects.toMatchObject({
        code: 'MINIMUM_PARTICIPANTS_REQUIRED',
        statusCode: 400,
      });
    });

    it('sets locked_at when participant count is sufficient', async () => {
      const openEvent = {
        id: EVENT_ID,
        payer_id: USER_ID,
        title: 'Dinner',
        event_date: null,
        total_amount: null,
        currency: 'USD',
        status: 'open',
        split_mode: null,
        ai_stage: 'none',
        locale: 'en-US',
        locked_at: null,
        messages_sent_at: null,
        fully_settled_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      };
      mockSupabase.__pushMockResultForTable('events', { data: openEvent, error: null });
      mockSupabase.__pushMockResultForTable('participants', {
        data: [{ id: 'p1' }, { id: 'p2' }],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('events', { data: { id: EVENT_ID }, error: null });
      mockSupabase.__pushMockResultForTable('event_join_tokens', { data: null, error: null });

      const result = await lockEvent(USER_ID, EVENT_ID);
      expect(result.status).toBe('locked');
      expect(result.locked_at).toBeTruthy();
      expect(result.participant_count).toBe(2);
    });

    it('returns 403 when user does not own the event', async () => {
      mockSupabase.__setMockResultForTable('events', {
        data: {
          id: EVENT_ID,
          payer_id: OTHER_USER_ID,
          title: 'Dinner',
          event_date: null,
          total_amount: null,
          currency: 'USD',
          status: 'open',
          split_mode: null,
          ai_stage: 'none',
          locale: 'en-US',
          locked_at: null,
          messages_sent_at: null,
          fully_settled_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
        error: null,
      });

      await expect(lockEvent(USER_ID, EVENT_ID)).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });
  });

  describe('getEventById receipt_review', () => {
    const lockedParsedEvent = {
      id: EVENT_ID,
      payer_id: USER_ID,
      title: 'Dinner',
      event_date: null,
      total_amount: 23,
      currency: 'USD',
      status: 'locked',
      split_mode: null,
      ai_stage: 'parsed',
      locale: 'en-US',
      locked_at: '2026-01-01T01:00:00.000Z',
      messages_sent_at: null,
      fully_settled_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      tax_amount: 1,
      tip_amount: 2,
      fees_amount: 2,
      discount_amount: null,
      receipt_scan_attempted: true,
    };

    it('includes receipt_review for payer when parsed and scan attempted', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: lockedParsedEvent, error: null });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: USER_ID, display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', {
        data: [
          {
            id: 'p1',
            user_id: USER_ID,
            display_name: 'Alex',
            join_method: 'qr_app',
            payment_status: 'pending',
            amount_owed: null,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: [{ id: USER_ID, display_name: 'Alex' }],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('receipt_items', {
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Burger',
            unit_price: 10,
            quantity: 1,
            confidence_score: 0.95,
            is_low_confidence: false,
            is_fee: false,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('receipt_discounts', { data: [], error: null });

      const detail = await getEventById(USER_ID, EVENT_ID);

      expect(detail.receipt_review).toEqual({
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Burger',
            unit_price: 10,
            quantity: 1,
            confidence: 'high',
          },
        ],
        additional_charges: [],
        discounts: [],
        tax_amount: 1,
        tip_amount: 2,
        fees_amount: 2,
        discount_amount: 0,
        currency: 'USD',
      });
    });

    it('includes receipt_review when ai_stage is calculated', async () => {
      mockSupabase.__pushMockResultForTable('events', {
        data: { ...lockedParsedEvent, ai_stage: 'calculated' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: USER_ID, display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', {
        data: [
          {
            id: 'p1',
            user_id: USER_ID,
            display_name: 'Alex',
            join_method: 'qr_app',
            payment_status: 'pending',
            amount_owed: 10,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: [{ id: USER_ID, display_name: 'Alex' }],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('receipt_items', {
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Burger',
            unit_price: 10,
            quantity: 1,
            confidence_score: 0.95,
            is_low_confidence: false,
            is_fee: false,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('receipt_discounts', { data: [], error: null });

      const detail = await getEventById(USER_ID, EVENT_ID);

      expect(detail.receipt_review?.items).toHaveLength(1);
      expect(detail.receipt_review?.items[0].name).toBe('Burger');
    });

    it('omits receipt_review when ai_stage is none', async () => {
      mockSupabase.__pushMockResultForTable('events', {
        data: { ...lockedParsedEvent, ai_stage: 'none', receipt_scan_attempted: false },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: USER_ID, display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', {
        data: [
          {
            id: 'p1',
            user_id: USER_ID,
            display_name: 'Alex',
            join_method: 'qr_app',
            payment_status: 'pending',
            amount_owed: null,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: [{ id: USER_ID, display_name: 'Alex' }],
        error: null,
      });

      const detail = await getEventById(USER_ID, EVENT_ID);

      expect(detail.receipt_review).toBeUndefined();
    });

    it('omits receipt_review for non-payer participants', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: lockedParsedEvent, error: null });
      mockSupabase.__pushMockResultForTable('participants', {
        data: { id: 'p2' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: USER_ID, display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', {
        data: [
          {
            id: 'p2',
            user_id: OTHER_USER_ID,
            display_name: 'Guest',
            join_method: 'qr_app',
            payment_status: 'pending',
            amount_owed: null,
          },
        ],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: [{ id: OTHER_USER_ID, display_name: 'Guest' }],
        error: null,
      });

      const detail = await getEventById(OTHER_USER_ID, EVENT_ID);

      expect(detail.receipt_review).toBeUndefined();
    });
  });

  describe('reopenEvent', () => {
    it('deactivates old token and creates a new one', async () => {
      const lockedEvent = {
        id: EVENT_ID,
        payer_id: USER_ID,
        title: 'Dinner',
        event_date: null,
        total_amount: null,
        currency: 'USD',
        status: 'locked',
        split_mode: null,
        ai_stage: 'none',
        locale: 'en-US',
        locked_at: '2026-01-01T01:00:00.000Z',
        messages_sent_at: null,
        fully_settled_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      };
      mockSupabase.__pushMockResultForTable('events', { data: lockedEvent, error: null });
      mockSupabase.__pushMockResultForTable('events', { data: { id: EVENT_ID }, error: null });
      mockSupabase.__pushMockResultForTable('event_join_tokens', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('event_join_tokens', { data: null, error: null });

      const result = await reopenEvent(USER_ID, EVENT_ID);
      expect(result.join_token).toBeTruthy();
      expect(result.join_url).toContain(result.join_token);
      expect(result.expires_at).toBeTruthy();
    });
  });
});
