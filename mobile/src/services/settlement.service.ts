import type {
  GuestDetailResponse,
  GuestsCounterpartiesResponse,
  MemberDetailResponse,
  MembersCounterpartiesResponse,
} from '@letssplyt/shared/counterparty.types';
import { apiGet } from './api';

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
