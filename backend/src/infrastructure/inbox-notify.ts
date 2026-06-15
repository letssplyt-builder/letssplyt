import type { InboxNotificationType } from '@letssplyt/shared/notification.types';
import {
  shouldDeliverNotification,
  shouldSendPush,
} from '../modules/profile/notification-preferences.service';
import { recordInboxNotification } from '../modules/notifications/inbox-notification.service';
import { firePush } from './push-notify';
import { sendPush } from './push.service';

export type PushDataPayload = Record<string, string>;

/** Records inbox row and sends Expo push (dev logs only). Respects user notification prefs. */
export function notifyUserInboxAndPush(
  userId: string,
  type: InboxNotificationType,
  title: string,
  body: string,
  data: PushDataPayload,
  eventId?: string | null,
): void {
  void (async () => {
    const deliver = await shouldDeliverNotification(userId, type);
    if (!deliver) return;

    recordInboxNotification({
      userId,
      type,
      title,
      body,
      eventId,
    });

    const pushEnabled = await shouldSendPush(userId);
    if (!pushEnabled) return;

    firePush(() => sendPush(userId, title, body, data));
  })();
}
