import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { hashPhone } from '../../../infrastructure/security';
import { mockSupabase } from '../../mocks/supabase.mock';
import { addManualParticipant, deleteParticipant } from '../../../modules/events/participant.service';

jest.mock('../../../modules/participants/participant-push', () => ({
  notifyMemberAddedToEvent: jest.fn(),
}));

import { notifyMemberAddedToEvent } from '../../../modules/participants/participant-push';

const USER_ID = 'payer-user-1';
const OTHER_USER_ID = 'other-user-2';
const EVENT_ID = 'event-11111111-1111-1111-1111-111111111111';
const PARTICIPANT_ID = 'participant-11111111-1111-1111-1111-111111111111';
const GUEST_PII_ID = 'guest-pii-11111111-1111-1111-1111-111111111111';
const PHONE = '+15005550007';
const REGISTERED_USER_ID = '00000000-0000-0000-0000-000000000002';

const OPEN_EVENT = {
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

const LOCKED_EVENT = { ...OPEN_EVENT, status: 'locked', locked_at: '2026-01-01T01:00:00.000Z' };

describe('participant.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  describe('addManualParticipant', () => {
    it('hashes phone before storing in guest_pii', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });
      mockSupabase.__pushMockResultForTable('sms_opt_outs', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
      mockSupabase.__pushMockResultForTable('guest_pii', { data: [], error: null });
      mockSupabase.__pushMockResultForTable('guest_pii', {
        data: { id: GUEST_PII_ID },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', {
        data: {
          id: PARTICIPANT_ID,
          display_name: 'Sam',
          join_method: 'manual_phone',
          payment_status: 'pending',
        },
        error: null,
      });

      const result = await addManualParticipant(USER_ID, EVENT_ID, {
        display_name: 'Sam',
        phone_e164: PHONE,
        join_method: 'manual_phone',
      });

      expect(result.display_name).toBe('Sam');
      expect(result.join_method).toBe('manual_phone');

      const guestInsert = mockSupabase.from.mock.results
        .map((r) => (r.type === 'return' ? r.value : null))
        .flatMap((chain) => {
          if (!chain) return [];
          const insert = (chain as { insert: jest.Mock }).insert;
          return insert.mock.calls;
        })
        .find((call) => (call[0] as { phone_hash?: string }).phone_hash !== undefined);

      expect(guestInsert).toBeTruthy();
      const guestPayload = guestInsert![0] as {
        phone_hash: string;
        phone_encrypted: string;
        name_encrypted: string;
      };
      expect(guestPayload.phone_hash).toBe(hashPhone(PHONE));
      expect(guestPayload.phone_hash).not.toBe(PHONE);
      expect(guestPayload.phone_encrypted).not.toContain(PHONE);
      expect(guestPayload.name_encrypted).toBeTruthy();
    });

    it('links registered users by user_id without creating guest_pii', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });
      mockSupabase.__pushMockResultForTable('sms_opt_outs', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: REGISTERED_USER_ID },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('participants', { data: [], error: null });
      mockSupabase.__pushMockResultForTable('participants', {
        data: {
          id: PARTICIPANT_ID,
          display_name: 'Jordan',
          join_method: 'manual_phone',
          payment_status: 'pending',
        },
        error: null,
      });

      const result = await addManualParticipant(USER_ID, EVENT_ID, {
        display_name: 'Jordan',
        phone_e164: PHONE,
        join_method: 'manual_phone',
      });

      expect(result.display_name).toBe('Jordan');
      expect(result.join_method).toBe('manual_phone');
      expect(notifyMemberAddedToEvent).toHaveBeenCalledWith(REGISTERED_USER_ID, 'Dinner', EVENT_ID);

      const participantInsert = mockSupabase.from.mock.results
        .map((r) => (r.type === 'return' ? r.value : null))
        .flatMap((chain) => {
          if (!chain) return [];
          const insert = (chain as { insert: jest.Mock }).insert;
          return insert.mock.calls;
        })
        .find((call) => (call[0] as { display_name?: string }).display_name === 'Jordan');

      expect(participantInsert).toBeTruthy();
      const payload = participantInsert![0] as {
        user_id: string;
        guest_pii_token: null;
        join_method: string;
      };
      expect(payload.user_id).toBe(REGISTERED_USER_ID);
      expect(payload.guest_pii_token).toBeNull();
      expect(payload.join_method).toBe('manual_phone');

      const guestInsert = mockSupabase.from.mock.results
        .map((r) => (r.type === 'return' ? r.value : null))
        .flatMap((chain) => {
          if (!chain) return [];
          const insert = (chain as { insert: jest.Mock }).insert;
          return insert.mock.calls;
        })
        .find((call) => (call[0] as { phone_hash?: string }).phone_hash !== undefined);

      expect(guestInsert).toBeUndefined();
    });

    it('creates name-only participant with user_id=null and no guest_pii', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });
      mockSupabase.__pushMockResultForTable('participants', {
        data: {
          id: PARTICIPANT_ID,
          display_name: 'Cash Guest',
          join_method: 'manual_name_only',
          payment_status: 'pending',
        },
        error: null,
      });

      const result = await addManualParticipant(USER_ID, EVENT_ID, {
        display_name: 'Cash Guest',
        join_method: 'manual_name_only',
      });

      expect(result.join_method).toBe('manual_name_only');

      const participantInsert = mockSupabase.from.mock.results
        .map((r) => (r.type === 'return' ? r.value : null))
        .flatMap((chain) => {
          if (!chain) return [];
          const insert = (chain as { insert: jest.Mock }).insert;
          return insert.mock.calls;
        })
        .find((call) => (call[0] as { display_name?: string }).display_name === 'Cash Guest');

      expect(participantInsert).toBeTruthy();
      const payload = participantInsert![0] as {
        user_id: null;
        guest_pii_token: null;
        join_method: string;
      };
      expect(payload.user_id).toBeNull();
      expect(payload.guest_pii_token).toBeNull();
      expect(payload.join_method).toBe('manual_name_only');
    });

    it('returns GROUP_IS_LOCKED when event is not open', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: LOCKED_EVENT, error: null });

      await expect(
        addManualParticipant(USER_ID, EVENT_ID, {
          display_name: 'Sam',
          join_method: 'manual_name_only',
        }),
      ).rejects.toMatchObject({
        code: 'GROUP_IS_LOCKED',
        statusCode: 400,
      });
    });

    it('returns 403 when user does not own the event', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });

      await expect(
        addManualParticipant(OTHER_USER_ID, EVENT_ID, {
          display_name: 'Sam',
          join_method: 'manual_name_only',
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });
  });

  describe('deleteParticipant', () => {
    it('rejects delete for the organiser', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });
      mockSupabase.__pushMockResultForTable('participants', {
        data: {
          id: PARTICIPANT_ID,
          user_id: USER_ID,
          payment_status: 'pending',
          guest_pii_token: null,
        },
        error: null,
      });

      await expect(deleteParticipant(USER_ID, EVENT_ID, PARTICIPANT_ID)).rejects.toMatchObject({
        code: 'CANNOT_REMOVE_ORGANISER',
        statusCode: 400,
      });
    });

    it('rejects delete when payment_status is not pending', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });
      mockSupabase.__pushMockResultForTable('participants', {
        data: {
          id: PARTICIPANT_ID,
          user_id: null,
          payment_status: 'self_reported',
          guest_pii_token: null,
        },
        error: null,
      });

      await expect(deleteParticipant(USER_ID, EVENT_ID, PARTICIPANT_ID)).rejects.toMatchObject({
        code: 'CANNOT_REMOVE_ACTIVE_PARTICIPANT',
        statusCode: 400,
      });
    });

    it('deletes pending participant', async () => {
      mockSupabase.__pushMockResultForTable('events', { data: OPEN_EVENT, error: null });
      mockSupabase.__pushMockResultForTable('participants', {
        data: {
          id: PARTICIPANT_ID,
          user_id: null,
          payment_status: 'pending',
          guest_pii_token: GUEST_PII_ID,
        },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('guest_pii', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });

      await expect(deleteParticipant(USER_ID, EVENT_ID, PARTICIPANT_ID)).resolves.toBeUndefined();
    });
  });
});
