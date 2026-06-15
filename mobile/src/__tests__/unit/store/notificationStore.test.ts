import { useNotificationStore } from '../../../store/notificationStore';
import { ApiRequestError } from '../../../services/api';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
} from '../../../services/notifications.service';

jest.mock('../../../services/notifications.service', () => ({
  fetchNotifications: jest.fn(),
  fetchUnreadNotificationCount: jest.fn(),
  markNotificationRead: jest.fn(),
}));

const mockFetchNotifications = fetchNotifications as jest.MockedFunction<
  typeof fetchNotifications
>;
const mockFetchUnreadCount = fetchUnreadNotificationCount as jest.MockedFunction<
  typeof fetchUnreadNotificationCount
>;
const mockMarkRead = markNotificationRead as jest.MockedFunction<typeof markNotificationRead>;

const sampleNotification = {
  id: 'notif-1',
  type: 'share_ready' as const,
  title: 'Share ready',
  body: 'Your share is ready',
  event_id: 'event-1',
  read_at: null,
  created_at: '2026-06-01T12:00:00.000Z',
  is_read: false,
};

beforeEach(() => {
  useNotificationStore.getState().clear();
  jest.clearAllMocks();
});

describe('notificationStore', () => {
  it('markRead decrements unreadCount immediately and keeps it after API success', async () => {
    useNotificationStore.setState({
      unreadCount: 2,
      notifications: [sampleNotification],
    });
    mockMarkRead.mockResolvedValue({ ok: true, unread_count: 1 });

    await useNotificationStore.getState().markRead('notif-1');

    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(1);
    expect(state.notifications[0]?.is_read).toBe(true);
    expect(mockMarkRead).toHaveBeenCalledWith('notif-1');
  });

  it('loadNotifications does not overwrite a local read with stale server rows', async () => {
    useNotificationStore.setState({
      unreadCount: 0,
      notifications: [{ ...sampleNotification, is_read: true, read_at: '2026-06-01T13:00:00.000Z' }],
    });

    mockFetchNotifications.mockResolvedValue({
      notifications: [sampleNotification],
      unread_count: 1,
    });

    await useNotificationStore.getState().loadNotifications();

    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.notifications[0]?.is_read).toBe(true);
  });

  it('loadUnreadCount skips stale responses while markRead is in flight', async () => {
    useNotificationStore.setState({
      unreadCount: 2,
      notifications: [sampleNotification],
    });

    let resolveMark: ((value: { ok: true; unread_count: number }) => void) | undefined;
    mockMarkRead.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMark = resolve;
        }),
    );
    mockFetchUnreadCount.mockResolvedValue({ unread_count: 2 });

    const markPromise = useNotificationStore.getState().markRead('notif-1');
    expect(useNotificationStore.getState().unreadCount).toBe(1);

    await useNotificationStore.getState().loadUnreadCount();
    expect(useNotificationStore.getState().unreadCount).toBe(1);

    resolveMark?.({ ok: true, unread_count: 1 });
    await markPromise;
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('reverts optimistic update when mark API fails', async () => {
    useNotificationStore.setState({
      unreadCount: 2,
      notifications: [sampleNotification],
    });
    mockMarkRead.mockRejectedValue(new ApiRequestError('NETWORK_ERROR', 'No connection', 0));

    await useNotificationStore.getState().markRead('notif-1');

    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(2);
    expect(state.notifications[0]?.is_read).toBe(false);
  });
});
