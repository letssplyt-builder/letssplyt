import { apiGet, apiGetAuth, apiPostAuth } from './api';

export interface JoinPreviewResponse {
  eventName: string;
  creatorName: string;
  joinable: boolean;
  pageKind: 'form' | 'expired' | 'locked' | 'not_found';
}

export interface AppJoinResponse {
  eventId: string;
  eventName: string;
  amount_owed: null;
  participantId: string;
}

export async function fetchJoinPreview(token: string): Promise<JoinPreviewResponse> {
  return apiGet<JoinPreviewResponse>(`/join/${token}/preview`);
}

export async function appJoinEvent(token: string): Promise<AppJoinResponse> {
  return apiPostAuth<AppJoinResponse>(`/join/${token}/app-join`, {});
}
