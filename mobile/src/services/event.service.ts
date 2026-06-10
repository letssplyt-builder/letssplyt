import type {
  CreateEventResponse,
  EventDetailResponse,
  EventListResponse,
  LockEventResponse,
  ReopenEventResponse,
  ResetExpensesResponse,
} from '@letssplyt/shared/event.types';
import type { ManualParticipantResponse } from '@letssplyt/shared/participant.types';
import { ApiRequestError, apiGet, apiPostAuth, apiDelete } from './api';
import * as SecureStore from 'expo-secure-store';
import { AUTH_TOKEN_KEY } from '../store/authStore';
import { getApiBaseUrl } from './getApiBaseUrl';

export interface BalanceSummary {
  net_balance: number;
  currency: string;
  owed_to_you: number;
  you_owe: number;
  unavailable?: boolean;
}

export async function createEvent(title: string): Promise<CreateEventResponse> {
  return apiPostAuth<CreateEventResponse>('/events', { title });
}

export async function fetchEvents(
  cursor?: string,
  options?: { role?: 'creator' | 'participant' | 'all' },
): Promise<EventListResponse> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  if (options?.role) params.set('role', options.role);
  return apiGet<EventListResponse>(`/events?${params.toString()}`);
}

export async function fetchEventById(eventId: string): Promise<EventDetailResponse> {
  return apiGet<EventDetailResponse>(`/events/${eventId}`);
}

export async function lockEvent(eventId: string): Promise<LockEventResponse> {
  return apiPostAuth<LockEventResponse>(`/events/${eventId}/lock`, {});
}

export async function regenerateJoinToken(eventId: string): Promise<ReopenEventResponse> {
  return apiPostAuth<ReopenEventResponse>(`/events/${eventId}/join-token/regenerate`, {});
}

export async function reopenEvent(eventId: string): Promise<ReopenEventResponse> {
  return apiPostAuth<ReopenEventResponse>(`/events/${eventId}/reopen`, {});
}

export async function resetEventExpenses(eventId: string): Promise<ResetExpensesResponse> {
  return apiPostAuth<ResetExpensesResponse>(`/events/${eventId}/expenses/reset`, {});
}

export async function addManualParticipant(
  eventId: string,
  input: {
    display_name: string;
    join_method: 'manual_phone' | 'manual_name_only';
    phone_e164?: string;
  },
): Promise<ManualParticipantResponse> {
  return apiPostAuth<ManualParticipantResponse>(`/events/${eventId}/participants/manual`, input);
}

export async function deleteParticipant(eventId: string, participantId: string): Promise<void> {
  await apiDelete(`/events/${eventId}/participants/${participantId}`);
}

export async function fetchBalance(): Promise<BalanceSummary> {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (!token) {
    return {
      net_balance: 0,
      currency: 'USD',
      owed_to_you: 0,
      you_owe: 0,
      unavailable: true,
    };
  }

  const url = `${getApiBaseUrl()}/api/v1/users/me/balance`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return {
        net_balance: 0,
        currency: 'USD',
        owed_to_you: 0,
        you_owe: 0,
        unavailable: true,
      };
    }

    const payload = (await response.json()) as {
      net_balance?: number;
      currency?: string;
      owed_to_you?: number;
      you_owe?: number;
    };
    const owedToYou = payload.owed_to_you ?? 0;
    const youOwe = payload.you_owe ?? 0;
    return {
      net_balance: payload.net_balance ?? owedToYou - youOwe,
      currency: payload.currency ?? 'USD',
      owed_to_you: owedToYou,
      you_owe: youOwe,
      unavailable: false,
    };
  } catch {
    return {
      net_balance: 0,
      currency: 'USD',
      owed_to_you: 0,
      you_owe: 0,
      unavailable: true,
    };
  }
}

export function isBalanceApiError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 404;
}
