import type {
  InboxNotificationsResponse,
  InboxUnreadCountResponse,
} from '@letssplyt/shared/notification.types';
import { apiGet, apiPatchAuth } from './api';

export async function fetchNotifications(): Promise<InboxNotificationsResponse> {
  return apiGet<InboxNotificationsResponse>('/users/me/notifications');
}

export async function fetchUnreadNotificationCount(): Promise<InboxUnreadCountResponse> {
  return apiGet<InboxUnreadCountResponse>('/users/me/notifications/unread-count');
}

export async function markNotificationRead(
  notificationId: string,
): Promise<InboxUnreadCountResponse & { ok: true }> {
  return apiPatchAuth<InboxUnreadCountResponse & { ok: true }>(
    `/users/me/notifications/${notificationId}/read`,
    {},
  );
}
