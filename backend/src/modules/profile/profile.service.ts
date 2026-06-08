import { AppError, Errors, NotFoundError } from '../../infrastructure/errors';
import { decryptHandle, encryptHandle } from '../../infrastructure/security';
import { getSupabaseForUser, supabaseAdmin } from '../../infrastructure/supabase';
import type {
  CreateHandleResponse,
  PaymentHandle,
  PaymentProvider,
  PublicUserProfile,
} from '@letssplyt/shared/profile.types';

const USER_PUBLIC_COLUMNS =
  'id, display_name, avatar_colour, avatar_url, total_events_created, total_events_joined, created_at';

type UserRow = PublicUserProfile;

export interface UpdateMeInput {
  display_name?: string;
  avatar_colour?: string;
  expo_push_token?: string;
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

  if (error || !data) {
    throw new NotFoundError('User profile not found');
  }

  return mapUserRow(data as UserRow);
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

    const sessionPayload = {
      user_id: userId,
      device_id: headers.deviceId,
      expo_push_token: input.expo_push_token,
      platform: headers.platform,
      last_active_at: new Date().toISOString(),
    };

    const { data: existingSession, error: lookupError } = await client
      .from('device_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', headers.deviceId)
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

  const userUpdates: Record<string, string> = {};
  if (input.display_name !== undefined) {
    userUpdates.display_name = input.display_name;
  }
  if (input.avatar_colour !== undefined) {
    userUpdates.avatar_colour = input.avatar_colour;
  }

  if (Object.keys(userUpdates).length > 0) {
    const { error: updateError } = await client
      .from('users')
      .update(userUpdates)
      .eq('id', userId);

    if (updateError) {
      throw new AppError('PROFILE_UPDATE_FAILED', 'Could not update profile', 500);
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

export async function createHandle(
  userId: string,
  provider: PaymentProvider,
  handleValue: string,
): Promise<CreateHandleResponse> {
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
  const handleEncrypted = encryptHandle(handleValue);

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
