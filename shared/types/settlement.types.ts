/** Settlement types — shared between mobile and backend */

import type { PaymentProvider } from './profile.types';
import type { PaymentStatus } from './participant.types';

export type SettlementAction =
  | 'self_reported'
  | 'confirmed'
  | 'disputed'
  | 'settled'
  | 'cancelled'
  | 'nudged'
  | 'opted_out';

export interface SettlementLogEntry {
  id: string;
  participant_id: string;
  event_id: string;
  action: SettlementAction;
  actor_id?: string | null;
  from_status?: PaymentStatus | null;
  to_status?: PaymentStatus | null;
  amount?: number | null;
  created_at: string;
}

export interface OwedToMeEntry {
  event_id: string;
  event_title: string;
  participant_id: string;
  participant_display_name: string;
  amount_minor_units: number;
  currency: string;
  payment_status: PaymentStatus;
  settled_at: string | null;
}

export interface OwedToMeResponse {
  data: OwedToMeEntry[];
  total_owed_minor_units: number;
  currency: string;
}

export interface IOwePaymentHandle {
  provider: PaymentProvider;
  handle_display: string;
}

export interface IOweEntry {
  event_id: string;
  event_title: string;
  payer_display_name: string;
  amount_minor_units: number;
  currency: string;
  payment_status: PaymentStatus;
  creator_payment_handles: IOwePaymentHandle[];
}

export interface IOweResponse {
  data: IOweEntry[];
  total_owe_minor_units: number;
  currency: string;
}
