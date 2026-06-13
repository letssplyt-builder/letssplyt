/** Counterparty list types for Home dashboard (E09-S02 / E09-S03) */

export interface MemberCounterpartyRow {
  user_id: string;
  display_name: string;
  avatar_colour: string;
  net_amount: number;
}

export interface MembersCounterpartiesResponse {
  owe_you: MemberCounterpartyRow[];
  you_owe: MemberCounterpartyRow[];
}

export interface GuestCounterpartyRow {
  guest_key: string;
  kind: 'phone' | 'name_only';
  display_name: string;
  amount: number;
  event_id?: string;
  participant_id?: string;
}

export interface GuestsCounterpartiesResponse {
  guests: GuestCounterpartyRow[];
}

export interface CounterpartyEventRow {
  event_id: string;
  event_title: string;
  event_date: string | null;
  amount: number;
  direction: 'owed_to_me' | 'i_owe';
  payment_status: string;
  participant_id: string;
  /** False for name-only guests / participants without a reachable phone. */
  can_nudge?: boolean;
}

export interface MemberDetailResponse {
  counterparty: {
    user_id: string;
    display_name: string;
    avatar_colour: string;
  };
  net_amount: number;
  currency: 'USD';
  outstanding: CounterpartyEventRow[];
  history: CounterpartyEventRow[];
}

export interface GuestDetailResponse {
  display_name: string;
  amount: number;
  currency: 'USD';
  outstanding: Array<{
    event_id: string;
    event_title: string;
    amount: number;
    payment_status: string;
    participant_id: string;
  }>;
  history: Array<{
    event_id: string;
    event_title: string;
    amount: number;
    payment_status: string;
    participant_id: string;
  }>;
}
