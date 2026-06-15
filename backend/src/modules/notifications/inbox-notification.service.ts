import logger from '../../infrastructure/logger';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type { InboxNotificationType } from '@letssplyt/shared/notification.types';

const UNREAD_WINDOW_DAYS = 30;
const READ_VISIBLE_HOURS = 24;

export interface CreateInboxNotificationInput {
  userId: string;
  type: InboxNotificationType;
  title: string;
  body: string;
  eventId?: string | null;
}

function unreadWindowStart(): string {
  const date = new Date();
  date.setDate(date.getDate() - UNREAD_WINDOW_DAYS);
  return date.toISOString();
}

function readVisibleStart(): string {
  const date = new Date();
  date.setHours(date.getHours() - READ_VISIBLE_HOURS);
  return date.toISOString();
}

/** Fire-and-forget inbox row — never throws to callers. */
export function recordInboxNotification(input: CreateInboxNotificationInput): void {
  void supabaseAdmin
    .from('user_notifications')
    .insert({
      user_id: input.userId,
      event_id: input.eventId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
    })
    .then(({ error }) => {
      if (error) {
        logger.warn({
          msg: 'Failed to record inbox notification',
          userId: input.userId,
          type: input.type,
          error: error.message,
        });
      }
    });
}

export async function getVisibleNotifications(userId: string): Promise<{
  notifications: Array<{
    id: string;
    type: InboxNotificationType;
    title: string;
    body: string;
    event_id: string | null;
    read_at: string | null;
    created_at: string;
  }>;
  unreadCount: number;
}> {
  const createdAfter = unreadWindowStart();
  const readAfter = readVisibleStart();

  const { data, error } = await supabaseAdmin
    .from('user_notifications')
    .select('id, type, title, body, event_id, read_at, created_at')
    .eq('user_id', userId)
    .gt('created_at', createdAfter)
    .or(`read_at.is.null,read_at.gt.${readAfter}`)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`INBOX_FETCH_FAILED: ${error.message}`);
  }

  const rows = data ?? [];
  const unreadCount = rows.filter((row) => row.read_at === null).length;

  return {
    notifications: rows.map((row) => ({
      id: row.id as string,
      type: row.type as InboxNotificationType,
      title: row.title as string,
      body: row.body as string,
      event_id: (row.event_id as string | null) ?? null,
      read_at: (row.read_at as string | null) ?? null,
      created_at: row.created_at as string,
    })),
    unreadCount,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const createdAfter = unreadWindowStart();

  const { count, error } = await supabaseAdmin
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
    .gt('created_at', createdAfter);

  if (error) {
    throw new Error(`INBOX_COUNT_FAILED: ${error.message}`);
  }

  return count ?? 0;
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('user_notifications')
    .update({ read_at: now })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`INBOX_READ_FAILED: ${error.message}`);
  }

  if (!data) {
    throw new Error('NOTIFICATION_NOT_FOUND');
  }
}
