/**
 * Live smoke test for post-send split edit via Edit share flow (E08-S07):
 * split/confirm after send + POST /splits/resend to affected participants only.
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npm run smoke:split-revision
 */
import { buildRevisionMessagesForParticipants } from '../src/modules/messages/messages.service';
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);
const ALEX_PHONE = '+15005550001';
const GUEST_PHONE_A = '+15005550002';
const GUEST_PHONE_B = '+15005550003';
const GUEST_PHONE_C = '+15005550004';

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

async function requestJson(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { _raw: text };
    }
  }
  return { status: res.status, body: parsed };
}

async function cleanupStorage(eventId: string): Promise<void> {
  const bucket = supabaseAdmin.storage.from('receipts');
  const { data: files } = await bucket.list(eventId);
  if (files?.length) {
    const paths = files.map((file) => `${eventId}/${file.name}`);
    await bucket.remove(paths);
  }
}

async function cleanup(eventId: string): Promise<void> {
  await cleanupStorage(eventId);
  await supabaseAdmin.from('notification_log').delete().eq('event_id', eventId);
  await supabaseAdmin.from('ai_audit_log').delete().eq('event_id', eventId);
  const { data: items } = await supabaseAdmin
    .from('receipt_items')
    .select('id')
    .eq('event_id', eventId);
  const itemIds = (items ?? []).map((row) => row.id as string);
  if (itemIds.length > 0) {
    await supabaseAdmin.from('item_assignments').delete().in('item_id', itemIds);
  }
  await supabaseAdmin.from('receipt_items').delete().eq('event_id', eventId);
  await supabaseAdmin.from('participants').delete().eq('event_id', eventId);
  await supabaseAdmin.from('event_join_tokens').delete().eq('event_id', eventId);
  await supabaseAdmin.from('events').delete().eq('id', eventId);
}

async function ensurePayerHandle(accessToken: string): Promise<boolean> {
  const handles = await requestJson('GET', '/api/v1/users/me/handles', undefined, accessToken);
  const list = handles.body.data as Array<{ provider: string }> | undefined;
  if (handles.status === 200 && list && list.length > 0) {
    pass('GET /users/me/handles', `${list.length} handle(s)`);
    return true;
  }

  const created = await requestJson(
    'POST',
    '/api/v1/users/me/handles',
    { provider: 'venmo', handle_value: 'smoke-payer' },
    accessToken,
  );
  if (created.status === 201) {
    pass('POST /users/me/handles', 'venmo smoke-payer');
    return true;
  }

  fail('POST /users/me/handles', `status ${created.status} ${JSON.stringify(created.body)}`);
  return false;
}

async function addGuest(
  accessToken: string,
  eventId: string,
  displayName: string,
  phoneE164: string,
): Promise<string | null> {
  const res = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/participants/manual`,
    {
      display_name: displayName,
      join_method: 'manual_phone',
      phone_e164: phoneE164,
    },
    accessToken,
  );
  const id = res.body.id as string | undefined;
  if (res.status === 201 && id) {
    pass(`POST /participants/manual (${displayName})`, id);
    return id;
  }
  fail(`POST /participants/manual (${displayName})`, `status ${res.status}`);
  return null;
}

async function main(): Promise<void> {
  console.log(`Smoke: post-send split revision via confirm (E08-S07) (${BASE_URL})\n`);

  let eventId: string | null = null;
  let payerId: string | null = null;

  try {
    const health = await requestJson('GET', '/health');
    if (health.status !== 200) {
      fail('GET /health', `status ${health.status}`);
      return;
    }
    pass('GET /health', `status ${health.status}`);

    const verify = await requestJson('POST', '/api/v1/auth/otp/verify', {
      phone_e164: ALEX_PHONE,
      code: '123456',
      context: 'login',
    });
    const accessToken = verify.body.access_token as string | undefined;
    payerId = verify.body.user_id as string | undefined ?? null;
    if (verify.status !== 200 || !accessToken) {
      fail('POST /auth/otp/verify', `status ${verify.status}`);
      return;
    }
    pass('POST /auth/otp/verify', 'token received');

    if (!(await ensurePayerHandle(accessToken))) return;

    const created = await requestJson(
      'POST',
      '/api/v1/events',
      { title: `Smoke Split Revision ${Date.now()}` },
      accessToken,
    );
    eventId = created.body.id as string | undefined ?? null;
    if (created.status !== 201 || !eventId) {
      fail('POST /events', `status ${created.status}`);
      return;
    }
    pass('POST /events', eventId);

    const guestAId = await addGuest(accessToken, eventId, 'GuestA', GUEST_PHONE_A);
    const guestBId = await addGuest(accessToken, eventId, 'GuestB', GUEST_PHONE_B);
    const guestCId = await addGuest(accessToken, eventId, 'GuestC', GUEST_PHONE_C);
    if (!guestAId || !guestBId || !guestCId) return;

    const locked = await requestJson('POST', `/api/v1/events/${eventId}/lock`, {}, accessToken);
    if (locked.status !== 200) {
      fail('POST /events/:id/lock', `status ${locked.status}`);
      return;
    }
    pass('POST /events/:id/lock');

    const manualTotal = 120;
    const calculate = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/calculate`,
      { split_mode: 'equal', manual_total: manualTotal },
      accessToken,
    );
    const calcSplits = calculate.body.splits as
      | Array<{ participant_id: string; amount_owed: number; display_name?: string }>
      | undefined;
    if (calculate.status !== 200 || !calcSplits?.length) {
      fail('POST split/calculate', `status ${calculate.status}`);
      return;
    }
    pass('POST split/calculate', `${calcSplits.length} splits`);

    const confirmPre = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/confirm`,
      {
        splits: calcSplits.map((row) => ({
          participant_id: row.participant_id,
          amount_owed: row.amount_owed,
        })),
      },
      accessToken,
    );
    if (confirmPre.status !== 200) {
      fail('POST split/confirm (pre-send)', `status ${confirmPre.status}`);
      return;
    }
    pass('POST split/confirm (pre-send)', 'ok');

    const preview = await requestJson(
      'GET',
      `/api/v1/events/${eventId}/messages/preview`,
      undefined,
      accessToken,
    );
    if (preview.status !== 200) {
      fail('GET messages/preview', `status ${preview.status}`);
      return;
    }
    pass('GET messages/preview', 'ok');

    const send = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/messages/send`,
      {},
      accessToken,
    );
    if (send.status !== 200 || (send.body.sent_count as number) !== 3) {
      fail('POST messages/send', `status ${send.status}`);
      return;
    }
    pass('POST messages/send', `sent=${send.body.sent_count}`);

    const badConfirm = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/confirm`,
      {
        splits: calcSplits.map((row) => ({
          participant_id: row.participant_id,
          amount_owed:
            row.participant_id === guestAId ? 50 : row.amount_owed,
        })),
      },
      accessToken,
    );
    if (badConfirm.status === 400 || badConfirm.status === 422) {
      pass('POST split/confirm sum mismatch', `status ${badConfirm.status} as expected`);
    } else {
      fail('POST split/confirm sum mismatch', `status ${badConfirm.status}`);
    }

    const revisedSplits = calcSplits.map((row) => {
      if (row.participant_id === guestAId) {
        return { participant_id: row.participant_id, amount_owed: 40 };
      }
      if (row.participant_id === guestBId) {
        return { participant_id: row.participant_id, amount_owed: 20 };
      }
      return { participant_id: row.participant_id, amount_owed: row.amount_owed };
    });

    const confirmPost = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/confirm`,
      { splits: revisedSplits },
      accessToken,
    );
    if (confirmPost.status === 200 && confirmPost.body.ai_stage === 'complete') {
      pass('POST split/confirm (post-send)', 'ai_stage=complete');
    } else {
      fail('POST split/confirm (post-send)', `status ${confirmPost.status} ${JSON.stringify(confirmPost.body)}`);
      return;
    }

    const { data: rowsAfterConfirm } = await supabaseAdmin
      .from('participants')
      .select('id, amount_owed, payment_status, revision_count')
      .eq('event_id', eventId);

    const guestA = rowsAfterConfirm?.find((row) => row.id === guestAId);
    const guestB = rowsAfterConfirm?.find((row) => row.id === guestBId);
    const guestC = rowsAfterConfirm?.find((row) => row.id === guestCId);

    if (
      guestA?.payment_status === 'pending' &&
      guestB?.payment_status === 'pending' &&
      Number(guestA.revision_count) === 1 &&
      Number(guestB.revision_count) === 1 &&
      Number(guestC?.revision_count ?? 0) === 0
    ) {
      pass('DB participants after confirm', 'A/B revised, C unchanged');
    } else {
      fail('DB participants after confirm', JSON.stringify(rowsAfterConfirm));
      return;
    }

    if (!payerId) {
      const { data: eventRow } = await supabaseAdmin
        .from('events')
        .select('payer_id')
        .eq('id', eventId)
        .maybeSingle();
      payerId = eventRow?.payer_id as string | null;
    }

    const revisionPackages = await buildRevisionMessagesForParticipants(
      eventId,
      payerId!,
      [guestAId, guestBId],
    );
    const guestAMsg = revisionPackages.find((pkg) => pkg.participant_id === guestAId);
    if (
      guestAMsg?.message_text.includes('Your share has been updated.') &&
      guestAMsg.message_text.includes('$40.00')
    ) {
      pass('revision message text', 'includes update lead-in and new amount');
    } else {
      fail('revision message text', guestAMsg?.message_text ?? 'missing');
      return;
    }

    const resend = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/splits/resend`,
      {},
      accessToken,
    );
    if (resend.status === 200 && (resend.body.sent_count as number) === 2) {
      pass('POST /splits/resend', 'sent=2 (A+B only)');
    } else {
      fail('POST /splits/resend', `status ${resend.status} ${JSON.stringify(resend.body)}`);
      return;
    }

    await supabaseAdmin
      .from('participants')
      .update({ payment_status: 'self_reported' })
      .eq('id', guestCId);

    const blockedBySelfReport = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/confirm`,
      { splits: revisedSplits },
      accessToken,
    );
    if (blockedBySelfReport.status === 409) {
      pass('POST split/confirm after self-report', '409 SETTLEMENTS_IN_PROGRESS');
    } else {
      fail('POST split/confirm after self-report', `status ${blockedBySelfReport.status}`);
    }

    await supabaseAdmin
      .from('participants')
      .update({ payment_status: 'pending' })
      .eq('id', guestCId);

    const allowedAfterDispute = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/confirm`,
      { splits: revisedSplits },
      accessToken,
    );
    if (allowedAfterDispute.status === 200) {
      pass('POST split/confirm after dispute to pending', '200 allowed');
    } else {
      fail('POST split/confirm after dispute to pending', `status ${allowedAfterDispute.status}`);
    }

    await supabaseAdmin
      .from('participants')
      .update({ payment_status: 'confirmed' })
      .eq('id', guestCId);

    const blockedByConfirmed = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/confirm`,
      { splits: revisedSplits },
      accessToken,
    );
    if (blockedByConfirmed.status === 409) {
      pass('POST split/confirm after confirmed payment', '409 SETTLEMENTS_IN_PROGRESS');
    } else {
      fail('POST split/confirm after confirmed payment', `status ${blockedByConfirmed.status}`);
    }
  } finally {
    if (eventId) {
      await cleanup(eventId);
      console.log(`\nCleaned up event ${eventId}`);
    }

    const failed = results.filter((row) => !row.ok);
    console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
    if (failed.length > 0) {
      console.error('Failed steps:', failed.map((row) => row.name).join(', '));
      process.exit(1);
    }
    console.log('All smoke steps passed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
