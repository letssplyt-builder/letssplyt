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
    sendResult === 'skipped_no_phone'
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
