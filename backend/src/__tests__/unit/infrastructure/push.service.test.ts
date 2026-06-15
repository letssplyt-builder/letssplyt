import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';

const mockSendPushNotificationsAsync = jest.fn<() => Promise<unknown[]>>();
const mockChunkPushNotifications = jest.fn<(messages: unknown[]) => unknown[][]>();
const mockIsExpoPushToken = jest.fn<(token: string) => boolean>();

jest.mock('expo-server-sdk', () => {
  class MockExpo {
    chunkPushNotifications = mockChunkPushNotifications;
    sendPushNotificationsAsync = mockSendPushNotificationsAsync;
    static isExpoPushToken = mockIsExpoPushToken;
  }
  return { __esModule: true, default: MockExpo };
});

import { sendPush } from '../../../infrastructure/push.service';

const USER_ID = 'push-user-1111-1111-1111-111111111111';
const VALID_TOKEN = 'ExponentPushToken[valid-token]';

describe('push.service', () => {
  const originalAppEnv = process.env.APP_ENV;

  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    process.env.APP_ENV = 'staging';
    mockChunkPushNotifications.mockImplementation((messages) => [messages]);
    mockIsExpoPushToken.mockReturnValue(true);
    mockSendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
  });

  afterEach(() => {
    process.env.APP_ENV = originalAppEnv;
  });

  it('looks up push token from device_sessions', async () => {
    mockSupabase.__setMockResultForTable('device_sessions', {
      data: { expo_push_token: VALID_TOKEN },
      error: null,
    });

    await sendPush(USER_ID, 'Payment confirmed', 'Your payment was confirmed', {
      type: 'payment_confirmed',
      event_id: 'event-1',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('device_sessions');
    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('calls Expo Push API with correct payload', async () => {
    mockSupabase.__setMockResultForTable('device_sessions', {
      data: { expo_push_token: VALID_TOKEN },
      error: null,
    });

    await sendPush(USER_ID, 'Payment confirmed', 'Body text', {
      type: 'payment_confirmed',
      event_id: 'event-abc',
      event_title: 'Dinner',
    });

    expect(mockChunkPushNotifications).toHaveBeenCalledWith([
      {
        to: VALID_TOKEN,
        sound: 'default',
        title: 'Payment confirmed',
        body: 'Body text',
        data: {
          type: 'payment_confirmed',
          event_id: 'event-abc',
          event_title: 'Dinner',
        },
      },
    ]);
  });

  it('silently skips when no push token found', async () => {
    mockSupabase.__setMockResultForTable('device_sessions', {
      data: null,
      error: null,
    });

    await sendPush(USER_ID, 'Title', 'Body', { type: 'nudge', event_id: 'event-1' });

    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('removes stale token on DeviceNotRegistered error', async () => {
    mockSupabase.__setMockResultForTable('device_sessions', {
      data: { expo_push_token: VALID_TOKEN },
      error: null,
    });
    mockSendPushNotificationsAsync.mockResolvedValue([
      {
        status: 'error',
        message: 'Device not registered',
        details: { error: 'DeviceNotRegistered' },
      },
    ]);

    await sendPush(USER_ID, 'Title', 'Body', { type: 'nudge', event_id: 'event-1' });

    const updateCalls = mockSupabase.from.mock.results
      .map((result) => result.value as { update?: jest.Mock })
      .filter((chain) => (chain.update?.mock.calls.length ?? 0) > 0);

    expect(updateCalls.length).toBeGreaterThan(0);
    expect(mockSupabase.from).toHaveBeenCalledWith('device_sessions');
  });

  it('sends correct data payload for member_paid type', async () => {
    mockSupabase.__setMockResultForTable('device_sessions', {
      data: { expo_push_token: VALID_TOKEN },
      error: null,
    });

    await sendPush(USER_ID, 'Payment received', 'Jordan has paid $25.00 for Dinner.', {
      type: 'member_paid',
      event_id: 'event-99',
      event_title: 'Dinner',
    });

    const chunk = mockChunkPushNotifications.mock.calls[0]?.[0] as Array<{
      data: Record<string, string>;
    }>;
    expect(chunk[0].data).toEqual({
      type: 'member_paid',
      event_id: 'event-99',
      event_title: 'Dinner',
    });
  });

  it('sends correct data payload for nudge type', async () => {
    mockSupabase.__setMockResultForTable('device_sessions', {
      data: { expo_push_token: VALID_TOKEN },
      error: null,
    });

    await sendPush(USER_ID, 'Payment reminder', 'You still owe $12.00', {
      type: 'nudge',
      event_id: 'event-55',
      event_title: 'Lunch',
    });

    const chunk = mockChunkPushNotifications.mock.calls[0]?.[0] as Array<{
      data: Record<string, string>;
    }>;
    expect(chunk[0].data).toEqual({
      type: 'nudge',
      event_id: 'event-55',
      event_title: 'Lunch',
    });
  });

  it('logs only in development without calling Expo', async () => {
    process.env.APP_ENV = 'development';
    mockSupabase.__setMockResultForTable('device_sessions', {
      data: { expo_push_token: VALID_TOKEN },
      error: null,
    });

    await sendPush(USER_ID, 'Title', 'Body', { type: 'nudge', event_id: 'event-1' });

    expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});
