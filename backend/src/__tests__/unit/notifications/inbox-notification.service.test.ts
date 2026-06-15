import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  getUnreadCount,
  getVisibleNotifications,
  markNotificationRead,
  recordInboxNotification,
} from '../../../modules/notifications/inbox-notification.service';

describe('inbox-notification.service', () => {
  const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const NOTIFICATION_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  it('records inbox notification without throwing', async () => {
    mockSupabase.__setMockResultForTable('user_notifications', { data: null, error: null });

    recordInboxNotification({
      userId: USER_ID,
      type: 'share_ready',
      title: 'Your share is ready',
      body: 'Your share for Dinner is ready to view.',
      eventId: 'event-1',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSupabase.from).toHaveBeenCalledWith('user_notifications');
  });

  it('marks notification as read', async () => {
    mockSupabase.__pushMockResultForTable('user_notifications', {
      data: { id: NOTIFICATION_ID },
      error: null,
    });

    await markNotificationRead(USER_ID, NOTIFICATION_ID);
    expect(mockSupabase.from).toHaveBeenCalledWith('user_notifications');
  });

  it('getVisibleNotifications returns rows and unread count from visible list', async () => {
    mockSupabase.__setMockResultForTable('user_notifications', {
      data: [
        {
          id: NOTIFICATION_ID,
          type: 'share_ready',
          title: 'Ready',
          body: 'Body',
          event_id: 'event-1',
          read_at: null,
          created_at: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'read-row',
          type: 'nudge',
          title: 'Nudge',
          body: 'Body',
          event_id: null,
          read_at: '2026-06-01T01:00:00.000Z',
          created_at: '2026-06-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await getVisibleNotifications(USER_ID);

    expect(result.notifications).toHaveLength(2);
    expect(result.unreadCount).toBe(1);
  });

  it('getUnreadCount returns count from head query', async () => {
    mockSupabase.__setMockResultForTable('user_notifications', {
      data: null,
      error: null,
      count: 5,
    });

    const count = await getUnreadCount(USER_ID);
    expect(count).toBe(5);
  });
});
