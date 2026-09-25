/**
 * Live RLS write-lock check (migration 20260925120000).
 * Hits Postgres directly — no Express server required.
 *
 * Proves:
 *   1. Service role can still write participants / events / RPCs (app path).
 *   2. A user JWT cannot change payment_status, amounts, event status, or phone_hash.
 *   3. A user JWT can still PATCH profile (display_name) and upsert device_sessions.
 *   4. A user JWT can still SELECT their participant row (Realtime / own reads).
 *
 * Usage (against the database that has the migration applied):
 *   cd backend && doppler run -- npm run smoke:rls
 */
import { createAdminSession } from '../src/infrastructure/supabase-auth';
import { getSupabaseForUser, supabaseAdmin } from '../src/infrastructure/supabase';

type StepResult = { name: string; ok: boolean; detail: string };

const results: StepResult[] = [];

function pass(name: string, detail = 'ok'): void {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}: ${detail}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

function clientWriteBlocked(
  error: { message?: string; code?: string } | null,
  rowCount: number,
): boolean {
  if (error) return true;
  return rowCount === 0;
}

async function main(): Promise<void> {
  console.log('Smoke: RLS client write lock (no Express required)\n');

  const stamp = Date.now();
  const email = `rls-smoke-${stamp}@letssplyt.internal`;
  let authUserId: string | null = null;
  let eventId: string | null = null;
  let participantId: string | null = null;
  let deviceSessionId: string | null = null;
  let originalDisplayName = 'RLS Smoke';

  try {
    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
    authUserId = createdAuth.user?.id ?? null;
    if (createAuthError || !authUserId) {
      fail('create auth user', createAuthError?.message ?? 'no user id');
      return;
    }
    pass('create auth user', authUserId);

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authUserId,
      phone_hash: `rls_smoke_hash_${stamp}`,
      phone_encrypted: 'rls_smoke_phone',
      display_name: originalDisplayName,
      avatar_colour: '#6366F1',
    });
    if (profileError) {
      fail('insert public.users', profileError.message);
      return;
    }
    pass('insert public.users');

    const { data: eventRow, error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        payer_id: authUserId,
        title: `RLS smoke ${stamp}`,
        currency: 'USD',
        status: 'open',
        total_amount: 40,
      })
      .select('id')
      .single();
    eventId = (eventRow?.id as string | undefined) ?? null;
    if (eventError || !eventId) {
      fail('service-role insert event', eventError?.message ?? 'no event id');
      return;
    }
    pass('service-role insert event', eventId);

    const { data: participantRow, error: participantError } = await supabaseAdmin
      .from('participants')
      .insert({
        event_id: eventId,
        user_id: authUserId,
        display_name: originalDisplayName,
        join_method: 'qr_app',
        amount_owed: 20,
        payment_status: 'pending',
      })
      .select('id')
      .single();
    participantId = (participantRow?.id as string | undefined) ?? null;
    if (participantError || !participantId) {
      fail('service-role insert participant', participantError?.message ?? 'no participant id');
      return;
    }
    pass('service-role insert participant', participantId);

    const { error: amountError } = await supabaseAdmin
      .from('participants')
      .update({ amount_owed: 21 })
      .eq('id', participantId);
    if (amountError) {
      fail('service-role update amount_owed', amountError.message);
      return;
    }
    pass('service-role update amount_owed');

    const { error: rpcError } = await supabaseAdmin.rpc('reset_event_expenses_data', {
      p_event_id: eventId,
    });
    if (rpcError) {
      fail('reset_event_expenses_data RPC', rpcError.message);
      return;
    }
    pass('reset_event_expenses_data RPC');

    const { error: restoreAmountError } = await supabaseAdmin
      .from('participants')
      .update({ amount_owed: 20, payment_status: 'pending' })
      .eq('id', participantId);
    if (restoreAmountError) {
      fail('service-role restore participant', restoreAmountError.message);
      return;
    }
    pass('service-role restore participant');

    const session = await createAdminSession(authUserId);
    const userClient = getSupabaseForUser(session.access_token);
    pass('create user JWT session');

    const { data: visibleRows, error: selectError } = await userClient
      .from('participants')
      .select('id, payment_status, amount_owed')
      .eq('id', participantId);
    if (selectError || !visibleRows?.length) {
      fail('user JWT SELECT own participant', selectError?.message ?? '0 rows');
      return;
    }
    pass('user JWT SELECT own participant');

    const { data: statusUpdate, error: statusError } = await userClient
      .from('participants')
      .update({ payment_status: 'confirmed' })
      .eq('id', participantId)
      .select('id');
    if (!clientWriteBlocked(statusError, statusUpdate?.length ?? 0)) {
      fail(
        'user JWT cannot update payment_status',
        'write succeeded — migration missing or policy still open',
      );
      return;
    }
    pass('user JWT cannot update payment_status', statusError?.code ?? '0 rows');

    const { data: amountUpdate, error: clientAmountError } = await userClient
      .from('participants')
      .update({ amount_owed: 1 })
      .eq('id', participantId)
      .select('id');
    if (!clientWriteBlocked(clientAmountError, amountUpdate?.length ?? 0)) {
      fail('user JWT cannot update amount_owed', 'write succeeded');
      return;
    }
    pass('user JWT cannot update amount_owed', clientAmountError?.code ?? '0 rows');

    const { data: eventUpdate, error: eventUpdateError } = await userClient
      .from('events')
      .update({ status: 'settled' })
      .eq('id', eventId)
      .select('id');
    if (!clientWriteBlocked(eventUpdateError, eventUpdate?.length ?? 0)) {
      fail('user JWT cannot update event status', 'write succeeded');
      return;
    }
    pass('user JWT cannot update event status', eventUpdateError?.code ?? '0 rows');

    const { error: phoneError } = await userClient
      .from('users')
      .update({ phone_hash: `hacked_${stamp}` })
      .eq('id', authUserId);
    if (!phoneError) {
      fail('user JWT cannot update phone_hash', 'write succeeded');
      return;
    }
    pass('user JWT cannot update phone_hash', phoneError.code ?? 'blocked');

    const patchedName = `RLS Smoke ${stamp}`;
    const { error: nameError } = await userClient
      .from('users')
      .update({ display_name: patchedName })
      .eq('id', authUserId);
    if (nameError) {
      fail('user JWT can update display_name', nameError.message);
      return;
    }
    originalDisplayName = patchedName;
    pass('user JWT can update display_name');

    const { data: deviceRow, error: deviceError } = await userClient
      .from('device_sessions')
      .insert({
        user_id: authUserId,
        device_id: `rls-smoke-${stamp}`,
        platform: 'ios',
        expo_push_token: 'ExponentPushToken[rls-smoke]',
        last_active_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    deviceSessionId = (deviceRow?.id as string | undefined) ?? null;
    if (deviceError || !deviceSessionId) {
      fail('user JWT can upsert device_sessions', deviceError?.message ?? 'no session id');
      return;
    }
    pass('user JWT can upsert device_sessions');

    const { data: afterRow, error: afterError } = await supabaseAdmin
      .from('participants')
      .select('payment_status, amount_owed')
      .eq('id', participantId)
      .single();
    if (
      afterError ||
      afterRow?.payment_status !== 'pending' ||
      Number(afterRow?.amount_owed) !== 20
    ) {
      fail(
        'participant financial fields unchanged',
        afterError?.message ?? JSON.stringify(afterRow),
      );
      return;
    }
    pass('participant financial fields unchanged');

    const { data: eventAfter, error: eventAfterError } = await supabaseAdmin
      .from('events')
      .select('status')
      .eq('id', eventId)
      .single();
    if (eventAfterError || eventAfter?.status !== 'open') {
      fail('event status unchanged', eventAfterError?.message ?? String(eventAfter?.status));
      return;
    }
    pass('event status unchanged');
  } finally {
    if (deviceSessionId) {
      await supabaseAdmin.from('device_sessions').delete().eq('id', deviceSessionId);
    }
    if (eventId) {
      await supabaseAdmin.from('participants').delete().eq('event_id', eventId);
      await supabaseAdmin.from('events').delete().eq('id', eventId);
    }
    if (authUserId) {
      await supabaseAdmin.from('users').delete().eq('id', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }
    pass('cleanup throwaway rows');
  }

  const failed = results.filter((row) => !row.ok);
  console.log(
    `\n${results.filter((row) => row.ok).length} passed, ${failed.length} failed`,
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
