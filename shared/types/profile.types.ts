export const PAYMENT_PROVIDERS = [
  'venmo',
  'paypal',
  'cashapp',
  'zelle',
  'wise',
  'upi',
  'bank_transfer',
  'other',
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export interface PublicUserProfile {
  id: string;
  display_name: string;
  avatar_colour: string;
  avatar_url: string | null;
  total_events_created: number;
  total_events_joined: number;
  created_at: string;
  push_notifications_enabled: boolean;
  payment_alert_notifications_enabled: boolean;
  share_alert_notifications_enabled: boolean;
}

export interface PaymentHandle {
  id: string;
  provider: PaymentProvider;
  handle_value: string;
  display_order: number;
}

export interface CreateHandleResponse {
  id: string;
  provider: PaymentProvider;
  display_order: number;
}

export interface PaymentHandlesResponse {
  data: PaymentHandle[];
}
