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

export interface EventRecord {
  id: string;
  payer_id: string;
  title: string;
  event_date: string | null;
  total_amount: number | null;
  currency: string;
  status: EventStatus;
  split_mode: SplitMode | null;
  ai_stage: AiStage;
  locale: string;
  locked_at: string | null;
  messages_sent_at: string | null;
  fully_settled_at: string | null;
  created_at: string;
  updated_at: string;
}

export type EventListRole = 'creator' | 'participant';

export interface EventListItem {
  id: string;
  title: string;
  status: EventStatus;
  participant_count: number;
  total_amount: number | null;
  created_at: string;
  role: EventListRole;
  /** Set when role is participant — who created the event. */
  creator_name?: string | null;
}

export interface EventListResponse {
  events: EventListItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface CreateEventResponse {
  id: string;
  title: string;
  status: EventStatus;
  join_url: string;
  token_expires_at: string;
}

export interface JoinTokenInfo {
  token: string;
  join_url: string;
  expires_at: string;
  is_active: boolean;
}

export interface EventParticipantSummary {
  id: string;
  display_name: string;
  join_method: string;
  payment_status: string;
  amount_owed: number | null;
  /** True when this row is the event payer / organiser. */
  is_organiser?: boolean;
  /** True when this row belongs to the authenticated viewer. */
  is_self?: boolean;
}

export interface ParticipantAssignedItem {
  id: string;
  name: string;
  share_amount: number;
  is_shared: boolean;
}

export interface EventSettlementSummary {
  total: number;
  collected: number;
  outstanding: number;
  confirmed_count: number;
  pending_count: number;
}

export interface EventDetailResponse {
  event: EventRecord & {
    payer: { id: string; display_name: string; avatar_colour: string };
  };
  participants: EventParticipantSummary[];
  join_token: JoinTokenInfo | null;
  summary: EventSettlementSummary | null;
  /** Itemised split — current viewer's assigned line items (participant view only). */
  my_items?: ParticipantAssignedItem[];
}

export interface LockEventResponse {
  event_id: string;
  status: 'locked';
  locked_at: string;
  participant_count: number;
}

export interface ReopenEventResponse {
  join_token: string;
  join_url: string;
  expires_at: string;
}

/** @deprecated Use EventRecord */
export type Event = EventRecord;
