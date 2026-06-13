import type {
  GuestDetailResponse,
  GuestsCounterpartiesResponse,
  MemberDetailResponse,
  MembersCounterpartiesResponse,
} from '@letssplyt/shared/counterparty.types';
import type { IOweResponse, OwedToMeResponse } from '@letssplyt/shared/settlement.types';
import { apiGet, apiPostAuth } from './api';

export type SelfReportPaymentMethod =
  | 'venmo'
  | 'paypal'
  | 'cashapp'
  | 'zelle'
  | 'wise'
  | 'cash'
  | 'bank_transfer'
  | 'other';

export type MarkPaidPaymentMethod = 'cash' | 'zelle' | 'bank_transfer' | 'other';

export async function fetchMemberCounterparties(): Promise<MembersCounterpartiesResponse> {
  return apiGet<MembersCounterpartiesResponse>('/users/me/counterparties?kind=members');
}

export async function fetchGuestCounterparties(): Promise<GuestsCounterpartiesResponse> {
  return apiGet<GuestsCounterpartiesResponse>('/users/me/counterparties?kind=guests');
}

export async function fetchMemberDetail(userId: string): Promise<MemberDetailResponse> {
  return apiGet<MemberDetailResponse>(`/settlement/member/${userId}`);
}

export async function fetchGuestDetail(phoneHash: string): Promise<GuestDetailResponse> {
  return apiGet<GuestDetailResponse>(`/settlement/guest/${phoneHash}`);
}

export async function fetchOwedToMe(): Promise<OwedToMeResponse> {
  return apiGet<OwedToMeResponse>('/settlement/owed-to-me');
}

export async function fetchIOwe(): Promise<IOweResponse> {
  return apiGet<IOweResponse>('/settlement/i-owe');
}

export async function selfReportPayment(
  eventId: string,
  participantId: string,
  paymentMethod: SelfReportPaymentMethod,
): Promise<{ payment_status: string }> {
  return apiPostAuth(`/events/${eventId}/settlement/${participantId}/self-report`, {
    payment_method: paymentMethod,
  });
}

export async function confirmPayment(
  eventId: string,
  participantId: string,
): Promise<{ payment_status: string; event_fully_settled?: boolean }> {
  return apiPostAuth(`/events/${eventId}/settlement/${participantId}/confirm`, {});
}

export async function disputePayment(
  eventId: string,
  participantId: string,
  note?: string,
): Promise<{ payment_status: string }> {
  return apiPostAuth(`/events/${eventId}/settlement/${participantId}/dispute`, {
    note,
  });
}

export async function markParticipantPaid(
  eventId: string,
  participantId: string,
  paymentMethod: MarkPaidPaymentMethod,
): Promise<{ payment_status: string; event_fully_settled?: boolean }> {
  return apiPostAuth(`/events/${eventId}/settlement/cash/${participantId}`, {
    payment_method: paymentMethod,
  });
}

export async function nudgeParticipant(
  eventId: string,
  participantId: string,
): Promise<{ sent: boolean; next_nudge_available_at?: string }> {
  return apiPostAuth(`/events/${eventId}/messages/nudge/${participantId}`, {});
}

export async function memberSelfReportAll(
  counterpartyUserId: string,
  paymentMethod: SelfReportPaymentMethod,
): Promise<{ updated_count: number }> {
  return apiPostAuth(`/settlement/member/${counterpartyUserId}/self-report-all`, {
    payment_method: paymentMethod,
  });
}

export async function memberConfirmAll(counterpartyUserId: string): Promise<{ updated_count: number }> {
  return apiPostAuth(`/settlement/member/${counterpartyUserId}/confirm-all`, {});
}

export async function memberDisputeAll(
  counterpartyUserId: string,
  note?: string,
): Promise<{ updated_count: number }> {
  return apiPostAuth(`/settlement/member/${counterpartyUserId}/dispute-all`, { note });
}

export async function memberMarkPaidAll(
  counterpartyUserId: string,
  paymentMethod: MarkPaidPaymentMethod,
): Promise<{ updated_count: number }> {
  return apiPostAuth(`/settlement/member/${counterpartyUserId}/mark-paid-all`, {
    payment_method: paymentMethod,
  });
}

export async function guestConfirmAll(phoneHash: string): Promise<{ updated_count: number }> {
  return apiPostAuth(`/settlement/guest/${phoneHash}/confirm-all`, {});
}

export async function guestDisputeAll(phoneHash: string, note?: string): Promise<{ updated_count: number }> {
  return apiPostAuth(`/settlement/guest/${phoneHash}/dispute-all`, { note });
}

export async function guestMarkPaidAll(
  phoneHash: string,
  paymentMethod: MarkPaidPaymentMethod,
): Promise<{ updated_count: number }> {
  return apiPostAuth(`/settlement/guest/${phoneHash}/mark-paid-all`, {
    payment_method: paymentMethod,
  });
}
