import { create } from 'zustand';
import type { InboxNotification } from '@letssplyt/shared/notification.types';
import { isApiRequestError } from '../services/api';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
} from '../services/notifications.service';

interface NotificationState {
  unreadCount: number;
  notifications: InboxNotification[];
  isLoadingList: boolean;
  isLoadingCount: boolean;
  listError: string | null;
  loadUnreadCount: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  clear: () => void;
}

function countUnread(notifications: InboxNotification[]): number {
  return notifications.filter((entry) => !entry.is_read).length;
}

function mergeNotifications(
  serverRows: InboxNotification[],
  localRows: InboxNotification[],
): InboxNotification[] {
  return serverRows.map((serverRow) => {
    const localRow = localRows.find((entry) => entry.id === serverRow.id);
    if (localRow?.is_read && !serverRow.is_read) {
      return {
        ...serverRow,
        is_read: true,
        read_at: localRow.read_at ?? serverRow.read_at,
      };
    }
    return serverRow;
  });
}

let notificationsRequestId = 0;
let unreadCountRequestId = 0;
let pendingMarkReads = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  notifications: [],
  isLoadingList: false,
  isLoadingCount: false,
  listError: null,

  loadUnreadCount: async () => {
    const requestId = ++unreadCountRequestId;
    set({ isLoadingCount: true });
    try {
      const { unread_count } = await fetchUnreadNotificationCount();
      if (requestId !== unreadCountRequestId) return;
      if (pendingMarkReads > 0) return;
      set({ unreadCount: unread_count, isLoadingCount: false });
    } catch {
      if (requestId === unreadCountRequestId) {
        set({ isLoadingCount: false });
      }
    }
  },

  loadNotifications: async () => {
    const requestId = ++notificationsRequestId;
    set({ isLoadingList: true, listError: null });
    try {
      const response = await fetchNotifications();
      if (requestId !== notificationsRequestId) return;

      const snapshot = get();
      const notifications = mergeNotifications(response.notifications, snapshot.notifications);

      set({
        notifications,
        unreadCount: countUnread(notifications),
        isLoadingList: false,
      });
    } catch {
      if (requestId === notificationsRequestId) {
        set({
          isLoadingList: false,
          listError: 'Could not load notifications.',
        });
      }
    }
  },

  markRead: async (notificationId: string) => {
    const snapshot = get();
    const row = snapshot.notifications.find((entry) => entry.id === notificationId);
    const wasUnread = row ? !row.is_read : snapshot.unreadCount > 0;

    if (!wasUnread) return;

    set((state) => ({
      unreadCount: Math.max(0, state.unreadCount - 1),
      notifications: state.notifications.map((entry) =>
        entry.id === notificationId
          ? {
              ...entry,
              is_read: true,
              read_at: entry.read_at ?? new Date().toISOString(),
            }
          : entry,
      ),
    }));

    pendingMarkReads += 1;
    try {
      const { unread_count } = await markNotificationRead(notificationId);
      set((state) => ({
        unreadCount: unread_count,
        notifications: state.notifications.map((entry) =>
          entry.id === notificationId
            ? {
                ...entry,
                is_read: true,
                read_at: entry.read_at ?? new Date().toISOString(),
              }
            : entry,
        ),
      }));
    } catch (err) {
      if (isApiRequestError(err) && err.status === 404) {
        return;
      }
      if (row) {
        set({
          unreadCount: snapshot.unreadCount,
          notifications: snapshot.notifications,
        });
      }
    } finally {
      pendingMarkReads = Math.max(0, pendingMarkReads - 1);
    }
  },

  clear: () => {
    notificationsRequestId += 1;
    unreadCountRequestId += 1;
    pendingMarkReads = 0;
    set({
      unreadCount: 0,
      notifications: [],
      isLoadingList: false,
      isLoadingCount: false,
      listError: null,
    });
  },
}));
