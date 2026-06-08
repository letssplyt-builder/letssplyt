/** Settlement types — shared between mobile and backend */

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
