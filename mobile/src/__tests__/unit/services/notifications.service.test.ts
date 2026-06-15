import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
} from '../../../services/notifications.service';
import * as api from '../../../services/api';

jest.mock('../../../services/api', () => ({
  apiGet: jest.fn(),
  apiPatchAuth: jest.fn(),
}));

const mockApiGet = api.apiGet as jest.MockedFunction<typeof api.apiGet>;
const mockApiPatchAuth = api.apiPatchAuth as jest.MockedFunction<typeof api.apiPatchAuth>;

describe('notifications.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchNotifications calls GET /users/me/notifications', async () => {
    mockApiGet.mockResolvedValue({ notifications: [], unread_count: 0 });

    await fetchNotifications();

    expect(mockApiGet).toHaveBeenCalledWith('/users/me/notifications');
  });

  it('markNotificationRead calls PATCH /users/me/notifications/:id/read via apiPatchAuth', async () => {
    mockApiPatchAuth.mockResolvedValue({ ok: true, unread_count: 1 });

    const result = await markNotificationRead('notif-abc');

    expect(mockApiPatchAuth).toHaveBeenCalledWith('/users/me/notifications/notif-abc/read', {});
    expect(result.unread_count).toBe(1);
  });

  it('fetchUnreadNotificationCount calls GET unread-count endpoint', async () => {
    mockApiGet.mockResolvedValue({ unread_count: 4 });

    const result = await fetchUnreadNotificationCount();

    expect(mockApiGet).toHaveBeenCalledWith('/users/me/notifications/unread-count');
    expect(result.unread_count).toBe(4);
  });
});
