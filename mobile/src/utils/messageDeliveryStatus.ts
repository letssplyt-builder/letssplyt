import type { SendResultStatus } from '../services/messages.service';

export type MessageDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped';

export interface MessageDeliveryFields {
  join_method?: string;
  message_sent_at?: string | null;
  message_delivered_at?: string | null;
  message_failed?: boolean;
}

export function deriveMessageDeliveryStatus(
  fields: MessageDeliveryFields,
  sendResult?: SendResultStatus,
): MessageDeliveryStatus {
  if (
    fields.join_method === 'manual_name_only' ||
    sendResult === 'skipped_opt_out' ||
    sendResult === 'skipped_no_phone' ||
    sendResult === 'skipped_zero_share'
  ) {
    return 'skipped';
  }
  if (sendResult === 'failed') {
    return 'failed';
  }
  if (fields.message_failed) {
    return 'failed';
  }
  if (fields.message_delivered_at) {
    return 'delivered';
  }
  if (fields.message_sent_at) {
    return 'sent';
  }
  return 'queued';
}

/** Creator can leave once Twilio accepts the message — carrier delivery is informational. */
export function isTerminalMessageDeliveryStatus(status: MessageDeliveryStatus): boolean {
  return (
    status === 'sent' ||
    status === 'delivered' ||
    status === 'failed' ||
    status === 'skipped'
  );
}

export function listFailedSmsRecipients<
  T extends {
    id: string;
    display_name: string;
    is_organiser?: boolean;
    join_method?: string;
    message_failed?: boolean;
  },
>(participants: T[]): T[] {
  return participants.filter(
    (row) =>
      !row.is_organiser &&
      row.join_method !== 'manual_name_only' &&
      row.message_failed === true,
  );
}

export function formatFailedRecipientNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const leading = names.slice(0, -1).join(', ');
  return `${leading}, and ${names[names.length - 1]}`;
}

export function messageDeliveryAccessibilityLabel(
  displayName: string,
  status: MessageDeliveryStatus,
): string {
  switch (status) {
    case 'queued':
      return `${displayName} — message queued`;
    case 'sent':
      return `${displayName} — message sent`;
    case 'delivered':
      return `${displayName} — message delivered`;
    case 'failed':
      return `${displayName} — message failed`;
    case 'skipped':
      return `${displayName} — message skipped`;
    default:
      return displayName;
  }
}
