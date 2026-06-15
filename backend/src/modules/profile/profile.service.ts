import { validatePaymentHandle } from '@letssplyt/shared/paymentHandleValidation';
import { AppError, Errors, NotFoundError } from '../../infrastructure/errors';
import { decryptHandle, encryptHandle } from '../../infrastructure/security';
import { getSupabaseForUser, supabaseAdmin } from '../../infrastructure/supabase';
import type {
  CreateHandleResponse,
  PaymentHandle,
  PaymentProvider,
  PublicUserProfile,
} from '@letssplyt/shared/profile.types';

const USER_BASE_COLUMNS =
  'id, display_name, avatar_colour, avatar_url, total_events_created, total_events_joined, created_at';

const USER_PUBLIC_COLUMNS =
  `${USER_BASE_COLUMNS}, push_notifications_enabled, payment_alert_notifications_enabled, share_alert_notifications_enabled`;

type UserRow = PublicUserProfile;

export interface UpdateMeInput {
  display_name?: string;
  avatar_colour?: string;
  expo_push_token?: string;
  push_notifications_enabled?: boolean;
  payment_alert_notifications_enabled?: boolean;
  share_alert_notifications_enabled?: boolean;
}

export interface UpdateMeHeaders {
  deviceId?: string;
  platform?: string;
}

function mapUserRow(row: UserRow): PublicUserProfile {
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_colour: row.avatar_colour,
    avatar_url: row.avatar_url ?? null,
    total_events_created: row.total_events_created,
    total_events_joined: row.total_events_joined,
    created_at: row.created_at,
    push_notifications_enabled: row.push_notifications_enabled ?? true,
    payment_alert_notifications_enabled: row.payment_alert_notifications_enabled ?? true,
    share_alert_notifications_enabled: row.share_alert_notifications_enabled ?? true,
  };
}

export async function getMe(userId: string, jwt: string): Promise<PublicUserProfile> {
  const client = getSupabaseForUser(jwt);
  const { data, error } = await client
    .from('users')
    .select(USER_PUBLIC_COLUMNS)
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (data) {
    return mapUserRow(data as UserRow);
  }

  const { data: legacyData, error: legacyError } = await client
    .from('users')
    .select(USER_BASE_COLUMNS)
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (legacyData) {
    return mapUserRow({
      ...(legacyData as UserRow),
      push_notifications_enabled: true,
      payment_alert_notifications_enabled: true,
      share_alert_notifications_enabled: true,
    });
  }

  if (error || legacyError) {
    throw new NotFoundError('User profile not found');
  }

  throw new NotFoundError('User profile not found');
}

export async function upsertDeviceSession(
  userId: string,
  jwt: string,
  deviceId: string,
  expoPushToken: string,
  platform: 'ios' | 'android',
): Promise<void> {
  const client = getSupabaseForUser(jwt);
  const sessionPayload = {
    user_id: userId,
    device_id: deviceId,
    expo_push_token: expoPushToken,
    platform,
    last_active_at: new Date().toISOString(),
  };

  const { data: existingSession, error: lookupError } = await client
    .from('device_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (lookupError) {
    throw new AppError('DEVICE_SESSION_UPDATE_FAILED', 'Could not look up device session', 500);
  }

  const { error: deviceError } = existingSession
    ? await client.from('device_sessions').update(sessionPayload).eq('id', existingSession.id)
    : await client.from('device_sessions').insert(sessionPayload);

  if (deviceError) {
    throw new AppError(
      'DEVICE_SESSION_UPDATE_FAILED',
      'Could not update device session',
      500,
      { code: deviceError.code, message: deviceError.message, details: deviceError.details },
    );
  }
}

export async function registerPushToken(
  userId: string,
  jwt: string,
  deviceId: string,
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  const isValidToken =
    token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
  if (!isValidToken) {
    throw new AppError('INVALID_TOKEN', 'Invalid Expo push token format', 400);
  }

  await upsertDeviceSession(userId, jwt, deviceId, token, platform);
}

export async function updateMe(
  userId: string,
  jwt: string,
  input: UpdateMeInput,
  headers: UpdateMeHeaders,
): Promise<PublicUserProfile> {
  const client = getSupabaseForUser(jwt);

  if (input.expo_push_token !== undefined) {
    if (!headers.deviceId) {
      throw Errors.validation('X-Device-ID header is required when expo_push_token is provided');
    }
    if (headers.platform !== 'ios' && headers.platform !== 'android') {
      throw Errors.validation("X-Platform header must be 'ios' or 'android'");
    }

    await upsertDeviceSession(
      userId,
      jwt,
      headers.deviceId,
      input.expo_push_token,
      headers.platform,
    );
  }

  const userUpdates: Record<string, string | boolean> = {};
  if (input.display_name !== undefined) {
    userUpdates.display_name = input.display_name;
  }
  if (input.avatar_colour !== undefined) {
    userUpdates.avatar_colour = input.avatar_colour;
  }
  if (input.push_notifications_enabled !== undefined) {
    userUpdates.push_notifications_enabled = input.push_notifications_enabled;
  }
  if (input.payment_alert_notifications_enabled !== undefined) {
    userUpdates.payment_alert_notifications_enabled = input.payment_alert_notifications_enabled;
  }
  if (input.share_alert_notifications_enabled !== undefined) {
    userUpdates.share_alert_notifications_enabled = input.share_alert_notifications_enabled;
  }

  if (Object.keys(userUpdates).length > 0) {
    const { error: updateError } = await client
      .from('users')
      .update(userUpdates)
      .eq('id', userId);

    if (updateError) {
      throw new AppError('PROFILE_UPDATE_FAILED', 'Could not update profile', 500);
    }

    if (input.display_name !== undefined) {
      const { error: participantSyncError } = await supabaseAdmin
        .from('participants')
        .update({ display_name: input.display_name })
        .eq('user_id', userId);

      if (participantSyncError) {
        throw new AppError('PROFILE_UPDATE_FAILED', 'Could not sync participant names', 500);
      }
    }
  }

  return getMe(userId, jwt);
}

export async function getHandles(userId: string): Promise<PaymentHandle[]> {
  const { data, error } = await supabaseAdmin
    .from('user_payment_handles')
    .select('id, provider, handle_encrypted, display_order')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    throw new AppError('HANDLES_FETCH_FAILED', 'Could not fetch payment handles', 500);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    provider: row.provider as PaymentProvider,
    handle_value: decryptHandle(row.handle_encrypted as string),
    display_order: row.display_order as number,
  }));
}

function assertValidHandle(provider: PaymentProvider, handleValue: string): string {
  const result = validatePaymentHandle(provider, handleValue);
  if (!result.valid) {
    throw new AppError('INVALID_HANDLE', result.error ?? 'Invalid payment handle', 400);
  }
  return result.normalized;
}

export async function createHandle(
  userId: string,
  provider: PaymentProvider,
  handleValue: string,
): Promise<CreateHandleResponse> {
  const normalizedValue = assertValidHandle(provider, handleValue);

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from('user_payment_handles')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('is_active', true)
    .maybeSingle();

  if (duplicateError) {
    throw new AppError('HANDLES_FETCH_FAILED', 'Could not verify existing handles', 500);
  }

  if (duplicate) {
    throw new AppError(
      'DUPLICATE_PROVIDER',
      'You already have an active handle for this provider',
      409,
    );
  }

  const { data: existingHandles, error: orderError } = await supabaseAdmin
    .from('user_payment_handles')
    .select('display_order')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('display_order', { ascending: false })
    .limit(1);

  if (orderError) {
    throw new AppError('HANDLES_FETCH_FAILED', 'Could not determine handle order', 500);
  }

  const maxOrder = existingHandles?.[0]?.display_order ?? -1;
  const displayOrder = (maxOrder as number) + 1;
  const handleEncrypted = encryptHandle(normalizedValue);

  const { data, error } = await supabaseAdmin
    .from('user_payment_handles')
    .insert({
      user_id: userId,
      provider,
      handle_encrypted: handleEncrypted,
      display_order: displayOrder,
      is_active: true,
    })
    .select('id, provider, display_order')
    .single();

  if (error || !data) {
    throw new AppError('HANDLE_CREATE_FAILED', 'Could not create payment handle', 500);
  }

  return {
    id: data.id as string,
    provider: data.provider as PaymentProvider,
    display_order: data.display_order as number,
  };
}

export async function updateHandle(
  userId: string,
  handleId: string,
  handleValue: string,
): Promise<PaymentHandle> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('user_payment_handles')
    .select('id, user_id, provider, display_order, is_active')
    .eq('id', handleId)
    .maybeSingle();

  if (fetchError || !existing) {
    throw new NotFoundError('Payment handle not found');
  }

  if (existing.user_id !== userId) {
    throw Errors.forbidden('You do not have permission to update this handle');
  }

  if (!existing.is_active) {
    throw new NotFoundError('Payment handle not found');
  }

  const provider = existing.provider as PaymentProvider;
  const normalizedValue = assertValidHandle(provider, handleValue);
  const handleEncrypted = encryptHandle(normalizedValue);

  const { error: updateError } = await supabaseAdmin
    .from('user_payment_handles')
    .update({ handle_encrypted: handleEncrypted })
    .eq('id', handleId)
    .eq('user_id', userId);

  if (updateError) {
    throw new AppError('HANDLE_UPDATE_FAILED', 'Could not update payment handle', 500);
  }

  return {
    id: handleId,
    provider,
    handle_value: normalizedValue,
    display_order: existing.display_order as number,
  };
}

export async function deleteHandle(userId: string, handleId: string): Promise<void> {
  const { data: handle, error: fetchError } = await supabaseAdmin
    .from('user_payment_handles')
    .select('user_id')
    .eq('id', handleId)
    .maybeSingle();

  if (fetchError || !handle) {
    throw new NotFoundError('Payment handle not found');
  }

  if (handle.user_id !== userId) {
    throw Errors.forbidden('You do not have permission to delete this handle');
  }

  const { error: updateError } = await supabaseAdmin
    .from('user_payment_handles')
    .update({ is_active: false })
    .eq('id', handleId);

  if (updateError) {
    throw new AppError('HANDLE_DELETE_FAILED', 'Could not delete payment handle', 500);
  }
}

export async function reorderHandles(userId: string, orderedIds: string[]): Promise<void> {
  const { data: handles, error: fetchError } = await supabaseAdmin
    .from('user_payment_handles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (fetchError) {
    throw new AppError('HANDLES_FETCH_FAILED', 'Could not fetch payment handles', 500);
  }

  const ownedIds = new Set((handles ?? []).map((row) => row.id as string));
  if (
    orderedIds.length !== ownedIds.size ||
    orderedIds.some((id) => !ownedIds.has(id))
  ) {
    throw Errors.validation('orderedIds must include every active handle exactly once');
  }

  const updates = orderedIds.map((id, index) =>
    supabaseAdmin
      .from('user_payment_handles')
      .update({ display_order: index })
      .eq('id', id)
      .eq('user_id', userId),
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new AppError('HANDLE_REORDER_FAILED', 'Could not reorder payment handles', 500);
  }
}
