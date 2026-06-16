/**
 * Allowed client analytics event names (mobile → POST /analytics/events).
 * Add new names here before tracking in the app.
 */
export const ANALYTICS_EVENT_NAMES = [
  'app_opened',
  'otp_requested',
  'otp_verified',
  'user_registered',
  'event_created',
  'event_locked',
  'event_reopened',
  'participant_joined',
  'join_qr_scanned',
  'join_completed',
  'receipt_scan_started',
  'receipt_parsed_success',
  'receipt_parsed_failed',
  'split_calculated',
  'split_confirmed',
  'split_revised',
  'messages_sent',
  'message_delivery_failed',
  'payment_self_reported',
  'payment_confirmed',
  'payment_disputed',
  'payment_nudge_sent',
  'expenses_reset',
] as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENT_NAMES[number];

export const ANALYTICS_EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);

export function isAnalyticsEventName(name: string): name is AnalyticsEventName {
  return ANALYTICS_EVENT_NAME_SET.has(name);
}
