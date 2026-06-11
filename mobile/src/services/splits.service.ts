import { apiGet, apiPostAuth } from './api';

export type SplitModeApi = 'equal' | 'itemised' | 'portion';

export interface SplitCalculateRequest {
  split_mode: SplitModeApi;
  assignments?: Array<{ item_id: string; participant_ids: string[] }>;
  manual_splits?: Array<{ participant_id: string; value: number }>;
  manual_total?: number;
}

export interface SplitLineResponse {
  participant_id: string;
  display_name: string;
  amount_owed: number;
  item_names: string[];
}

export interface SplitCalculateResponse {
  splits: SplitLineResponse[];
  total_check: number;
  unassigned_item_ids: string[];
  confidence: number;
  requires_review: boolean;
}

export async function calculateSplit(
  eventId: string,
  body: SplitCalculateRequest,
): Promise<SplitCalculateResponse> {
  return apiPostAuth<SplitCalculateResponse>(
    `/events/${eventId}/split/calculate`,
    body as Record<string, unknown>,
  );
}

export interface SplitAssignmentsResponse {
  assignments: Array<{ item_id: string; participant_ids: string[] }>;
}

export async function fetchSplitAssignments(eventId: string): Promise<SplitAssignmentsResponse> {
  return apiGet<SplitAssignmentsResponse>(`/events/${eventId}/split/assignments`);
}
