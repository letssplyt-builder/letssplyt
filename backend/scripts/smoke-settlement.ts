/**
 * Live smoke test for per-event settlement API (E09-S01):
 * self-report, confirm, dispute, nudge, mark-paid (cash).
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npm run smoke:settlement
 */
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);
const PAYER_PHONE = '+15005550001';
const MEMBER_PHONE = '+15005550002';
const GUEST_PHONE = '+15005550003';

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

async function cleanup(eventId: string): Promise<void> {
  await supabaseAdmin.from('settlement_log').delete().eq('event_id', eventId);
  await supabaseAdmin.from('notification_log').delete().eq('event_id', eventId);
  await supabaseAdmin.from('participants').delete().eq('event_id', eventId);
  await supabaseAdmin.from('event_join_tokens').delete().eq('event_id', eventId);
  await supabaseAdmin.from('events').delete().eq('id', eventId);
}

async function verifyOtp(phone: string): Promise<string | null> {
  const res = await requestJson('POST', '/api/v1/auth/otp/verify', {
    phone_e164: phone,
    code: '123456',
    context: 'login',
  });
  const token = res.body.access_token as string | undefined;
  if (res.status === 200 && token) {
    pass(`OTP verify ${phone}`, 'token');
    return token;
  }
  fail(`OTP verify ${phone}`, `status ${res.status}`);
  return null;
}

async function addManualGuest(
  payerToken: string,
  eventId: string,
  name: string,
  phone: string,
): Promise<string | null> {
  const res = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/participants/manual`,
    {
      display_name: name,
      join_method: 'manual_phone',
      phone_e164: phone,
    },
    payerToken,
  );
  const id = res.body.id as string | undefined;
  if (res.status === 201 && id) {
    pass(`Add guest ${name}`, id);
    return id;
  }
  fail(`Add guest ${name}`, `status ${res.status}`);
  return null;
}

async function sendEventToSettlement(payerToken: string, eventId: string): Promise<boolean> {
  const locked = await requestJson('POST', `/api/v1/events/${eventId}/lock`, {}, payerToken);
  if (locked.status !== 200) {
    fail('POST lock', `status ${locked.status}`);
    return false;
  }
  pass('POST lock');

  const calculate = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/split/calculate`,
    { split_mode: 'equal', manual_total: 90 },
    payerToken,
  );
  const splits = calculate.body.splits as Array<{ participant_id: string; amount_owed: number }> | undefined;
  if (calculate.status !== 200 || !splits?.length) {
    fail('POST split/calculate', `status ${calculate.status}`);
    return false;
  }
  pass('POST split/calculate', `${splits.length} splits`);

  const confirm = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/split/confirm`,
    {
      splits: splits.map((row) => ({
        participant_id: row.participant_id,
        amount_owed: row.amount_owed,
      })),
    },
    payerToken,
  );
  if (confirm.status !== 200) {
    fail('POST split/confirm', `status ${confirm.status}`);
    return false;
  }
  pass('POST split/confirm');

  const preview = await requestJson(
    'GET',
    `/api/v1/events/${eventId}/messages/preview`,
    undefined,
    payerToken,
  );
  if (preview.status !== 200) {
    fail('GET messages/preview', `status ${preview.status}`);
    return false;
  }
  pass('GET messages/preview');

  const send = await requestJson('POST', `/api/v1/events/${eventId}/messages/send`, {}, payerToken);
  if (send.status !== 200) {
    fail('POST messages/send', `status ${send.status}`);
    return false;
  }
  pass('POST messages/send', `sent=${send.body.sent_count}`);
  return true;
}

async function main(): Promise<void> {
  console.log(`Smoke: per-event settlement (E09-S01) (${BASE_URL})\n`);

  let eventId: string | null = null;

  try {
    const health = await requestJson('GET', '/health');
    if (health.status !== 200) {
      fail('GET /health', `status ${health.status}`);
      return;
    }
    pass('GET /health');

    const payerToken = await verifyOtp(PAYER_PHONE);
    const memberToken = await verifyOtp(MEMBER_PHONE);
    if (!payerToken || !memberToken) return;

    const created = await requestJson(
      'POST',
      '/api/v1/events',
      { title: `Smoke Settlement ${Date.now()}` },
      payerToken,
    );
    eventId = created.body.id as string | undefined ?? null;
    if (created.status !== 201 || !eventId) {
      fail('POST /events', `status ${created.status}`);
      return;
    }
    pass('POST /events', eventId);

    const memberParticipantId = await addManualGuest(payerToken, eventId, 'MemberUser', MEMBER_PHONE);
    const guestParticipantId = await addManualGuest(payerToken, eventId, 'GuestUser', GUEST_PHONE);
    if (!memberParticipantId || !guestParticipantId) return;

    if (!(await sendEventToSettlement(payerToken, eventId))) return;

    const selfReport = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/settlement/${memberParticipantId}/self-report`,
      { payment_method: 'venmo' },
      memberToken,
    );
    if (selfReport.status !== 200 || selfReport.body.payment_status !== 'confirmed') {
      fail('POST self-report', `status ${selfReport.status} ${JSON.stringify(selfReport.body)}`);
      return;
    }
    pass('POST self-report', 'confirmed');

    const dispute = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/settlement/${memberParticipantId}/dispute`,
      { note: 'smoke dispute' },
      payerToken,
    );
    if (dispute.status !== 200 || dispute.body.payment_status !== 'disputed') {
      fail('POST dispute', `status ${dispute.status} ${JSON.stringify(dispute.body)}`);
      return;
    }
    pass('POST dispute', 'disputed');

    const selfReport2 = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/settlement/${memberParticipantId}/self-report`,
      { payment_method: 'paypal' },
      memberToken,
    );
    if (selfReport2.status !== 200) {
      fail('POST self-report (retry)', `status ${selfReport2.status}`);
      return;
    }
    pass('POST self-report (retry)');

    const confirm = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/settlement/${memberParticipantId}/confirm`,
      undefined,
      payerToken,
    );
    const confirmError = confirm.body.error as { code?: string } | undefined;
    if (confirm.status === 409 && confirmError?.code === 'INVALID_PAYMENT_STATUS') {
      pass('POST confirm (legacy)', '409 — already confirmed via self-report');
    } else if (confirm.status !== 200 || confirm.body.payment_status !== 'confirmed') {
      fail('POST confirm', `status ${confirm.status} ${JSON.stringify(confirm.body)}`);
      return;
    } else {
      pass('POST confirm', 'confirmed');
    }

    const selfConfirm403 = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/settlement/${memberParticipantId}/confirm`,
      undefined,
      memberToken,
    );
    if (selfConfirm403.status === 403) {
      pass('POST confirm as participant', '403 as expected');
    } else {
      fail('POST confirm as participant', `status ${selfConfirm403.status}`);
    }

    const nudge = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/messages/nudge/${guestParticipantId}`,
      undefined,
      payerToken,
    );
    if (nudge.status !== 200 || nudge.body.sent !== true) {
      fail('POST nudge', `status ${nudge.status}`);
      return;
    }
    pass('POST nudge', 'sent');

    const nudgeCooldown = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/messages/nudge/${guestParticipantId}`,
      undefined,
      payerToken,
    );
    if (nudgeCooldown.status === 429) {
      pass('POST nudge cooldown', '429 as expected');
    } else {
      fail('POST nudge cooldown', `status ${nudgeCooldown.status}`);
    }

    const markGuestPaid = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/settlement/cash/${guestParticipantId}`,
      { payment_method: 'cash' },
      payerToken,
    );
    if (markGuestPaid.status !== 200 || markGuestPaid.body.payment_status !== 'confirmed') {
      fail('POST mark-paid (guest)', `status ${markGuestPaid.status}`);
      return;
    }
    pass('POST mark-paid (guest)', 'confirmed');

    const eventDetail = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, payerToken);
    const roster = eventDetail.body.participants as
      | Array<{ id: string; payment_status: string; amount_owed: number | null }>
      | undefined;
    const pendingOwing = (roster ?? []).filter(
      (row) => Number(row.amount_owed ?? 0) > 0 && row.payment_status === 'pending',
    );
    for (const row of pendingOwing) {
      const markRow = await requestJson(
        'POST',
        `/api/v1/events/${eventId}/settlement/cash/${row.id}`,
        { payment_method: 'cash' },
        payerToken,
      );
      if (markRow.status !== 200) {
        fail('POST mark-paid (remaining)', `participant ${row.id} status ${markRow.status}`);
        return;
      }
    }
    if (pendingOwing.length > 0) {
      pass('POST mark-paid (remaining)', `${pendingOwing.length} row(s)`);
    }

    const { data: eventRow } = await supabaseAdmin
      .from('events')
      .select('status')
      .eq('id', eventId)
      .maybeSingle();
    if (eventRow?.status === 'settled') {
      pass('Event status settled', 'settled');
    } else {
      fail('Event status settled', `got ${eventRow?.status}`);
    }
  } finally {
    if (eventId) {
      await cleanup(eventId);
      pass('Cleanup', eventId);
    }
  }

  const failed = results.filter((row) => !row.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
