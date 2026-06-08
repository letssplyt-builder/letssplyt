import type {
  CreateHandleResponse,
  PaymentHandle,
  PaymentHandlesResponse,
  PaymentProvider,
  PublicUserProfile,
} from '@letssplyt/shared/profile.types';
import { apiDelete, apiGet, apiPatch, apiPost, apiPostAuth } from './api';

export async function fetchMyProfile(): Promise<PublicUserProfile> {
  return apiGet<PublicUserProfile>('/users/me');
}

export async function updateMyProfile(
  body: Partial<Pick<PublicUserProfile, 'display_name' | 'avatar_colour'>>,
): Promise<PublicUserProfile> {
  return apiPatch<PublicUserProfile>('/users/me', body);
}

export async function fetchMyHandles(): Promise<PaymentHandle[]> {
  const response = await apiGet<PaymentHandlesResponse>('/users/me/handles');
  return response.data;
}

export async function addHandle(
  provider: PaymentProvider,
  handleValue: string,
): Promise<CreateHandleResponse> {
  return apiPostAuth<CreateHandleResponse>('/users/me/handles', {
    provider,
    handle_value: handleValue,
  });
}

export async function updateHandle(
  handleId: string,
  handleValue: string,
): Promise<PaymentHandle> {
  return apiPatch<PaymentHandle>(`/users/me/handles/${handleId}`, { handle_value: handleValue });
}

export async function deleteHandle(handleId: string): Promise<void> {
  await apiDelete(`/users/me/handles/${handleId}`);
}

export async function reorderHandles(orderedIds: string[]): Promise<void> {
  await apiPatch<{ ok: true }>('/users/me/handles/reorder', { orderedIds });
}

export async function registerPushToken(body: {
  device_id: string;
  token: string;
  platform: 'ios' | 'android';
}): Promise<void> {
  await apiPostAuth<{ ok: true }>('/users/me/push-token', body);
}
