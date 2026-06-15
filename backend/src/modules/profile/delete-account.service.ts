import { randomBytes } from 'node:crypto';
import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { getUserBalance } from './balance.service';

const PHONE_TOMBSTONE_PLAINTEXT = 'DELETED';

export interface DeleteAccountResult {
  deleted: true;
  anonymised_participant_records: number;
}

export async function assertAccountDeletionAllowed(userId: string): Promise<void> {
  const balance = await getUserBalance(userId);
  if (balance.you_owe > 0) {
    throw new AppError(
      'OUTSTANDING_BALANCE',
      'You must settle all outstanding payments before deleting your account.',
      409,
      { you_owe: balance.you_owe, currency: balance.currency },
    );
  }
}

type TombstonePayload = {
  phone_encrypted: string | null;
  phone_hash: string;
  display_name: string;
  deleted_at: string;
  name_encrypted?: null;
};

function buildTombstonePayload(
  phoneEncrypted: string | null,
  includeNameEncrypted = false,
): TombstonePayload {
  const payload: TombstonePayload = {
    phone_encrypted: phoneEncrypted,
    phone_hash: `DELETED-${randomBytes(16).toString('hex')}`,
    display_name: 'Deleted User',
    deleted_at: new Date().toISOString(),
  };
  if (includeNameEncrypted) {
    payload.name_encrypted = null;
  }
  return payload;
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST204' || error.message?.includes('schema cache') === true;
}

async function tombstoneUserRow(userId: string): Promise<void> {
  const tombstoneAttempts: TombstonePayload[] = [
    buildTombstonePayload(null, true),
    buildTombstonePayload(PHONE_TOMBSTONE_PLAINTEXT, true),
    buildTombstonePayload(null, false),
    buildTombstonePayload(PHONE_TOMBSTONE_PLAINTEXT, false),
  ];

  let lastError: { code?: string; message?: string; details?: string } | null = null;
  let sawZeroRowUpdate = false;

  for (const payload of tombstoneAttempts) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(payload)
      .eq('id', userId)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      lastError = error;
      logger.warn({
        msg: 'User tombstone update failed',
        userId,
        phone_encrypted: payload.phone_encrypted,
        includes_name_encrypted: payload.name_encrypted !== undefined,
        code: error.code,
        dbMessage: error.message,
        details: error.details,
      });
      if (payload.phone_encrypted === null || isMissingColumnError(error)) {
        continue;
      }
      break;
    }

    const updatedRows = data ?? [];
    if (updatedRows.length > 0) {
      return;
    }

    sawZeroRowUpdate = true;
    if (payload.phone_encrypted === null) {
      continue;
    }
    break;
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, deleted_at')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError('USER_ANONYMISE_FAILED', 'Could not anonymise user profile', 500, {
      message: fetchError.message,
      code: fetchError.code,
    });
  }

  if (!existing) {
    throw new AppError('USER_ANONYMISE_FAILED', 'User profile not found', 404);
  }

  if (existing.deleted_at) {
    return;
  }

  const detailMessage = lastError?.message ?? (sawZeroRowUpdate ? 'no matching active user row' : 'unknown');
  throw new AppError(
    'USER_ANONYMISE_FAILED',
    `Could not anonymise user profile: ${detailMessage}`,
    500,
    {
      message: detailMessage,
      code: lastError?.code,
      details: lastError?.details,
      hint: 'Run supabase db push to apply users_phone_encrypted_nullable_on_delete migration',
    },
  );
}

export async function deleteUserAccount(userId: string): Promise<DeleteAccountResult> {
  await assertAccountDeletionAllowed(userId);

  const { error: handlesError } = await supabaseAdmin
    .from('user_payment_handles')
    .delete()
    .eq('user_id', userId);

  if (handlesError) {
    throw new AppError('DELETE_HANDLES_FAILED', 'Could not delete payment handles', 500, {
      message: handlesError.message,
    });
  }

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .update({ display_name: 'Deleted User' })
    .eq('user_id', userId)
    .select('id');

  if (participantsError) {
    throw new AppError('ANONYMISE_PARTICIPANTS_FAILED', 'Could not anonymise participant records', 500, {
      message: participantsError.message,
    });
  }

  await tombstoneUserRow(userId);

  await supabaseAdmin.from('device_sessions').delete().eq('user_id', userId);
  await supabaseAdmin.from('user_notifications').delete().eq('user_id', userId);

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    throw new AppError('AUTH_USER_DELETE_FAILED', 'Could not remove auth account', 500, {
      message: authDeleteError.message,
    });
  }

  return {
    deleted: true,
    anonymised_participant_records: participantRows?.length ?? 0,
  };
}
