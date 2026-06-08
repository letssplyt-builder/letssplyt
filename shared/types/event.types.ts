/** Event types — shared between mobile and backend */

export type EventStatus =
  | 'open'
  | 'locked'
  | 'calculating'
  | 'sent'
  | 'settled'
  | 'archived';

export type SplitMode = 'equal' | 'portion' | 'itemised';

export type AiStage =
  | 'none'
  | 'parsing'
  | 'parsed'
  | 'calculating'
  | 'calculated'
  | 'messaging'
  | 'complete'
  | 'failed';

export interface Event {
  id: string;
  payer_id: string;
  title: string;
  event_date?: string | null;
  total_amount?: number | null;
  currency: string;
  status: EventStatus;
  split_mode?: SplitMode | null;
  ai_stage: AiStage;
  created_at: string;
  updated_at: string;
}
