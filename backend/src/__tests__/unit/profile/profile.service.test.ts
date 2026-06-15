import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockSupabase, type ChainableMock } from '../../mocks/supabase.mock';
import * as security from '../../../infrastructure/security';
import {
  createHandle,
  deleteHandle,
  getHandles,
  getMe,
  updateMe,
} from '../../../modules/profile/profile.service';

const USER_ID = 'profile-user-1';
const JWT = 'mock-jwt-token';

const PUBLIC_USER = {
  id: USER_ID,
  display_name: 'Alex R.',
  avatar_colour: '#6366F1',
  avatar_url: null,
  total_events_created: 2,
  total_events_joined: 5,
  created_at: '2026-01-01T00:00:00.000Z',
  push_notifications_enabled: true,
  payment_alert_notifications_enabled: true,
  share_alert_notifications_enabled: true,
};

function mockAuthenticatedUser(): void {
  mockSupabase.__setMockResultForTable('users', {
    data: PUBLIC_USER,
    error: null,
  });
}

describe('profile.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.restoreAllMocks();
  });

  describe('getMe', () => {
    it('returns a user object without phone_hash or phone_encrypted', async () => {
      mockAuthenticatedUser();

      const profile = await getMe(USER_ID, JWT);

      expect(profile).toEqual(PUBLIC_USER);
      expect(profile).not.toHaveProperty('phone_hash');
      expect(profile).not.toHaveProperty('phone_encrypted');
      expect(profile).not.toHaveProperty('name_encrypted');
    });

    it('falls back to base columns when notification preference columns are missing', async () => {
      mockSupabase.__pushMockResultForTable('users', {
        data: null,
        error: { code: '42703', message: 'column push_notifications_enabled does not exist' },
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: {
          id: USER_ID,
          display_name: 'Alex R.',
          avatar_colour: '#6366F1',
          avatar_url: null,
          total_events_created: 2,
          total_events_joined: 5,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      });

      const profile = await getMe(USER_ID, JWT);

      expect(profile).toEqual(PUBLIC_USER);
    });
  });

  describe('createHandle', () => {
    it('calls encryptHandle before inserting into the database', async () => {
      const encryptSpy = jest.spyOn(security, 'encryptHandle').mockReturnValue('iv:tag:cipher');

      mockSupabase.__pushMockResultForTable('user_payment_handles', {
        data: null,
        error: null,
      });
      mockSupabase.__pushMockResultForTable('user_payment_handles', {
        data: [],
        error: null,
      });
      mockSupabase.__pushMockResultForTable('user_payment_handles', {
        data: {
          id: 'handle-1',
          provider: 'venmo',
          display_order: 0,
        },
        error: null,
      });

      const result = await createHandle(USER_ID, 'venmo', '@myhandle');

      expect(encryptSpy).toHaveBeenCalledWith('@myhandle');
      expect(result).toEqual({ id: 'handle-1', provider: 'venmo', display_order: 0 });

      const insertChain = mockSupabase.from.mock.results.find(
        (r) => r.type === 'return' && (r.value as { insert: jest.Mock }).insert.mock.calls.length > 0,
      );
      expect(insertChain).toBeDefined();
    });
  });

  describe('getHandles', () => {
    it('decrypts handle_encrypted and returns handle_value', async () => {
      const decryptSpy = jest.spyOn(security, 'decryptHandle').mockReturnValue('@myhandle');

      mockSupabase.__setMockResultForTable('user_payment_handles', {
        data: [
          {
            id: 'handle-1',
            provider: 'venmo',
            handle_encrypted: 'iv:tag:cipher',
            display_order: 0,
          },
        ],
        error: null,
      });

      const handles = await getHandles(USER_ID);

      expect(decryptSpy).toHaveBeenCalledWith('iv:tag:cipher');
      expect(handles).toEqual([
        { id: 'handle-1', provider: 'venmo', handle_value: '@myhandle', display_order: 0 },
      ]);
      expect(handles[0]).not.toHaveProperty('handle_encrypted');
    });
  });

  describe('deleteHandle', () => {
    it('returns 403 when handleId belongs to a different user', async () => {
      mockSupabase.__setMockResultForTable('user_payment_handles', {
        data: { user_id: 'other-user-id' },
        error: null,
      });

      await expect(deleteHandle(USER_ID, 'foreign-handle')).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });
  });

  describe('updateMe', () => {
    it('inserts device_sessions with expo_push_token when no existing session', async () => {
      mockAuthenticatedUser();
      mockSupabase.__pushMockResultForTable('device_sessions', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('device_sessions', { data: null, error: null });
      mockSupabase.__setMockResultForTable('users', { data: PUBLIC_USER, error: null });

      await updateMe(
        USER_ID,
        JWT,
        { expo_push_token: 'ExponentPushToken[test123]' },
        { deviceId: 'test-device-001', platform: 'ios' },
      );

      const deviceCalls = mockSupabase.from.mock.calls.filter(([table]) => table === 'device_sessions');
      expect(deviceCalls.length).toBeGreaterThanOrEqual(2);

      const insertIndex = mockSupabase.from.mock.calls.findIndex(
        ([table], i) =>
          table === 'device_sessions' &&
          (mockSupabase.from.mock.results[i]?.value as ChainableMock).insert.mock.calls.length > 0,
      );
      const insertChain = mockSupabase.from.mock.results[insertIndex]?.value as ChainableMock;
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          device_id: 'test-device-001',
          expo_push_token: 'ExponentPushToken[test123]',
          platform: 'ios',
        }),
      );
    });

    it('returns 400 when expo_push_token is present but X-Device-ID header is missing', async () => {
      await expect(
        updateMe(USER_ID, JWT, { expo_push_token: 'ExponentPushToken[test123]' }, {}),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    });

    it('syncs display_name to all participant rows for the user', async () => {
      mockAuthenticatedUser();
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
      mockSupabase.__setMockResultForTable('users', {
        data: { ...PUBLIC_USER, display_name: 'PQR' },
        error: null,
      });

      await updateMe(USER_ID, JWT, { display_name: 'PQR' }, {});

      const participantUpdateIndex = mockSupabase.from.mock.calls.findIndex(
        ([table], i) =>
          table === 'participants' &&
          (mockSupabase.from.mock.results[i]?.value as ChainableMock).update.mock.calls.length > 0,
      );
      const participantChain = mockSupabase.from.mock.results[participantUpdateIndex]?.value as ChainableMock;
      expect(participantChain.update).toHaveBeenCalledWith({ display_name: 'PQR' });
      expect(participantChain.eq).toHaveBeenCalledWith('user_id', USER_ID);
    });
  });
});
