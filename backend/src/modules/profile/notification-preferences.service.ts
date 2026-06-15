import type { InboxNotificationType } from '@letssplyt/shared/notification.types';
import { supabaseAdmin } from '../../infrastructure/supabase';

export interface NotificationPreferences {
  push_notifications_enabled: boolean;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('push_notifications_enabled')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    return { push_notifications_enabled: true };
  }

  return {
    push_notifications_enabled: Boolean(data.push_notifications_enabled),
  };
}

export async function shouldDeliverNotification(
  userId: string,
  _type: InboxNotificationType,
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  return prefs.push_notifications_enabled;
}

export async function shouldSendPush(userId: string): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  return prefs.push_notifications_enabled;
}
