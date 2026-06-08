import type {
  CreateEventResponse,
  EventDetailResponse,
  EventListResponse,
  LockEventResponse,
  ReopenEventResponse,
} from '@letssplyt/shared/event.types';
import type { ManualParticipantResponse } from '@letssplyt/shared/participant.types';
import { ApiRequestError, apiGet, apiPostAuth, apiDelete } from './api';
import * as SecureStore from 'expo-secure-store';
import { AUTH_TOKEN_KEY } from '../store/authStore';
import { getApiBaseUrl } from './getApiBaseUrl';

export interface BalanceSummary {
  net_balance: number;
  currency: string;
  unavailable?: boolean;
}

export async function createEvent(title: string): Promise<CreateEventResponse> {
  return apiPostAuth<CreateEventResponse>('/events', { title });
}

export async function fetchEvents(cursor?: string): Promise<EventListResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : '?limit=20';
  return apiGet<EventListResponse>(`/events${query}`);
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

/** Balance endpoint ships in E09-S02 — degrade gracefully until then. */
export async function fetchBalance(): Promise<BalanceSummary> {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (!token) {
    return { net_balance: 0, currency: 'USD', unavailable: true };
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

    if (response.status === 404) {
      return { net_balance: 0, currency: 'USD', unavailable: true };
    }

    if (!response.ok) {
      return { net_balance: 0, currency: 'USD', unavailable: true };
    }

    const payload = (await response.json()) as { net_balance?: number; currency?: string };
    return {
      net_balance: payload.net_balance ?? 0,
      currency: payload.currency ?? 'USD',
      unavailable: false,
    };
  } catch {
    return { net_balance: 0, currency: 'USD', unavailable: true };
  }
}

export function isBalanceApiError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 404;
}
