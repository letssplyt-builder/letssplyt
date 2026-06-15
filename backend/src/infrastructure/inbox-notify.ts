import type { InboxNotificationType } from '@letssplyt/shared/notification.types';
import { recordInboxNotification } from '../modules/notifications/inbox-notification.service';
import { firePush } from './push-notify';
import { sendPush } from './push.service';

export type PushDataPayload = Record<string, string>;

/** Records inbox row and sends Expo push (dev logs only). */
export function notifyUserInboxAndPush(
  userId: string,
  type: InboxNotificationType,
  title: string,
  body: string,
  data: PushDataPayload,
  eventId?: string | null,
): void {
  recordInboxNotification({
    userId,
    type,
    title,
    body,
    eventId,
  });

  firePush(() => sendPush(userId, title, body, data));
}
