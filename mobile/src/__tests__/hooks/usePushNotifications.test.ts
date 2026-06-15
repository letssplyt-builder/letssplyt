import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import * as deviceId from '../../services/deviceId';
import * as profileService from '../../services/profile.service';
import { navigationRef } from '../../navigation/navigationRef';

jest.mock('../../services/deviceId', () => ({
  getDeviceId: jest.fn(),
}));

jest.mock('../../services/profile.service', () => ({
  registerPushToken: jest.fn(),
}));

jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: {
    isReady: jest.fn(),
    navigate: jest.fn(),
  },
}));

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(deviceId.getDeviceId).mockResolvedValue('device-abc');
    jest.mocked(profileService.registerPushToken).mockResolvedValue(undefined);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'undetermined' } as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      data: 'ExponentPushToken[test]',
    } as never);
    jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
    jest.mocked(Notifications.addNotificationReceivedListener).mockImplementation(() => ({
      remove: jest.fn(),
    }));
    jest.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(() => ({
      remove: jest.fn(),
    }));
    jest.mocked(navigationRef.isReady).mockReturnValue(true);
  });

  it('requests permission on mount', async () => {
    renderHook(() => usePushNotifications(true));

    await waitFor(() => {
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  it('calls push-token registration when permission granted', async () => {
    renderHook(() => usePushNotifications(true));

    await waitFor(() => {
      expect(profileService.registerPushToken).toHaveBeenCalledWith({
        device_id: 'device-abc',
        token: 'ExponentPushToken[test]',
        platform: 'ios',
      });
    });
  });

  it('does not register token when permission denied', async () => {
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);

    renderHook(() => usePushNotifications(true));

    await waitFor(() => {
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    expect(profileService.registerPushToken).not.toHaveBeenCalled();
  });

  it('registers foreground listener on mount', async () => {
    renderHook(() => usePushNotifications(true));

    await waitFor(() => {
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
    });
  });

  it('unregisters listener on unmount (no memory leak)', async () => {
    const removeReceived = jest.fn();
    const removeResponse = jest.fn();
    jest.mocked(Notifications.addNotificationReceivedListener).mockImplementation(() => ({
      remove: removeReceived,
    }));
    jest.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(() => ({
      remove: removeResponse,
    }));

    const { unmount } = renderHook(() => usePushNotifications(true));

    await waitFor(() => {
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
    });

    unmount();

    expect(removeReceived).toHaveBeenCalled();
    expect(removeResponse).toHaveBeenCalled();
  });
});
