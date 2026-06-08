/** Participant types — shared between mobile and backend */

export type PaymentStatus =
  | 'pending'
  | 'self_reported'
  | 'payer_marked'
  | 'confirmed'
  | 'disputed'
  | 'opted_out'
  | 'settled';

export type JoinMethod =
  | 'qr_app'
  | 'qr_web'
  | 'manual_phone'
  | 'manual_name_only';

export interface Participant {
  id: string;
  event_id: string;
  user_id?: string | null;
  display_name: string;
  join_method: JoinMethod;
  amount_owed?: number | null;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}
