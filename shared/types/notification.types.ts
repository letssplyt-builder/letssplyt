export type InboxNotificationType =
  | 'member_paid'
  | 'event_fully_settled'
  | 'member_paid_all'
  | 'added_to_event'
  | 'nudge'
  | 'share_ready'
  | 'share_edited';

export interface InboxNotification {
  id: string;
  type: InboxNotificationType;
  title: string;
  body: string;
  event_id: string | null;
  read_at: string | null;
  created_at: string;
  is_read: boolean;
}

export interface InboxNotificationsResponse {
  notifications: InboxNotification[];
  unread_count: number;
}

export interface InboxUnreadCountResponse {
  unread_count: number;
}
