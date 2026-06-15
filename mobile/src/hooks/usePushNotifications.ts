import { useEffect } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { navigationRef } from '../navigation/navigationRef';
import { getDeviceId } from '../services/deviceId';
import { registerPushToken } from '../services/profile.service';
import { showPushToast } from '../store/pushToastStore';
import { useNotificationStore } from '../store/notificationStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function navigateToEvent(eventId: string): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('MainTabs', {
    screen: 'EventsTab',
    params: {
      screen: 'EventDetail',
      params: { eventId },
    },
  });
}

function extractEventId(data: Record<string, unknown> | undefined): string | undefined {
  const eventId = data?.event_id;
  return typeof eventId === 'string' ? eventId : undefined;
}

async function registerTokenIfPermitted(): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } =
    existing === 'granted' ? { status: existing } : await Notifications.requestPermissionsAsync();

  if (status !== 'granted') return;

  const projectId = resolveProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const deviceId = await getDeviceId();
  await registerPushToken({
    device_id: deviceId,
    token: tokenResult.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
}

/**
 * Registers Expo push token when authenticated and wires foreground/background handlers.
 */
export function usePushNotifications(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let receivedSubscription: Notifications.EventSubscription | undefined;
    let responseSubscription: Notifications.EventSubscription | undefined;

    void registerTokenIfPermitted().catch(() => {
      // Permission denied or token unavailable — silent.
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const eventId = extractEventId(
        response?.notification.request.content.data as Record<string, unknown> | undefined,
      );
      if (eventId) navigateToEvent(eventId);
    });

    receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? 'Notification';
      const body = notification.request.content.body ?? '';
      showPushToast({ title, body });
      void useNotificationStore.getState().loadUnreadCount();
    });

    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const eventId = extractEventId(
        response.notification.request.content.data as Record<string, unknown> | undefined,
      );
      if (eventId) navigateToEvent(eventId);
    });

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [enabled]);
}
