/**
 * Live smoke test for settlement ledger API (E09-S03):
 * owed-to-me, i-owe (decrypted handles), person/:userId alias.
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npm run smoke:ledger
 */
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);
const PAYER_PHONE = '+15005550001';
const MEMBER_PHONE = '+15005550002';

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

function hasPhoneLeak(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object') {
    const text = String(obj);
    return text.includes('+1') || text.includes('phone_hash') || text.includes('phone_encrypted');
  }
  if (Array.isArray(obj)) return obj.some((row) => hasPhoneLeak(row));
  return Object.entries(obj as Record<string, unknown>).some(
    ([key, value]) =>
      key === 'phone_hash' ||
      key === 'phone_encrypted' ||
      key === 'phone_e164' ||
      hasPhoneLeak(value),
  );
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

async function verifyOtp(phone: string): Promise<{ token: string; userId: string } | null> {
  const res = await requestJson('POST', '/api/v1/auth/otp/verify', {
    phone_e164: phone,
    code: '123456',
    context: 'login',
  });
  const token = res.body.access_token as string | undefined;
  const user = res.body.user as { id: string } | undefined;
  if (res.status === 200 && token && user?.id) {
    pass(`OTP verify ${phone}`, user.id);
    return { token, userId: user.id };
  }
  fail(`OTP verify ${phone}`, `status ${res.status}`);
  return null;
}

async function ensurePayerHandle(payerToken: string): Promise<boolean> {
  const handles = await requestJson('GET', '/api/v1/users/me/handles', undefined, payerToken);
  const list = handles.body.data as Array<{ provider: string }> | undefined;
  if (handles.status === 200 && list && list.length > 0) {
    pass('GET /users/me/handles', `${list.length} handle(s)`);
    return true;
  }

  const created = await requestJson(
    'POST',
    '/api/v1/users/me/handles',
    { provider: 'venmo', handle_value: 'smoke-ledger-payer' },
    payerToken,
  );
  if (created.status === 201) {
    pass('POST /users/me/handles', 'venmo smoke-ledger-payer');
    return true;
  }
  if (created.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const retry = await requestJson(
      'POST',
      '/api/v1/users/me/handles',
      { provider: 'venmo', handle_value: 'smoke-ledger-payer' },
      payerToken,
    );
    if (retry.status === 201 || retry.status === 200) {
      pass('POST /users/me/handles', 'retry after rate limit');
      return true;
    }
  }
  fail('POST /users/me/handles', `status ${created.status}`);
  return false;
}

async function sendEventToSettlement(
  payerToken: string,
  eventId: string,
  memberParticipantId: string,
  label: string,
): Promise<boolean> {
  const locked = await requestJson('POST', `/api/v1/events/${eventId}/lock`, {}, payerToken);
  if (locked.status !== 200) {
    fail(`POST lock (${label})`, `status ${locked.status}`);
    return false;
  }

  const calculate = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/split/calculate`,
    { split_mode: 'equal', manual_total: 60 },
    payerToken,
  );
  const splits = calculate.body.splits as Array<{ participant_id: string; amount_owed: number }> | undefined;
  if (calculate.status !== 200 || !splits?.length) {
    fail(`POST split/calculate (${label})`, `status ${calculate.status}`);
    return false;
  }

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
    fail(`POST split/confirm (${label})`, `status ${confirm.status}`);
    return false;
  }

  const preview = await requestJson('GET', `/api/v1/events/${eventId}/messages/preview`, undefined, payerToken);
  if (preview.status !== 200) {
    fail(`GET messages/preview (${label})`, `status ${preview.status}`);
    return false;
  }

  const send = await requestJson('POST', `/api/v1/events/${eventId}/messages/send`, {}, payerToken);
  if (send.status !== 200) {
    fail(`POST messages/send (${label})`, `status ${send.status}`);
    return false;
  }
  pass(`Send to settlement (${label})`, `sent=${send.body.sent_count}`);
  return true;
}

async function main(): Promise<void> {
  console.log(`Smoke: settlement ledger (E09-S03) (${BASE_URL})\n`);

  const eventIds: string[] = [];

  try {
    const health = await requestJson('GET', '/health');
    if (health.status !== 200) {
      fail('GET /health', `status ${health.status}`);
      return;
    }
    pass('GET /health');

    const payer = await verifyOtp(PAYER_PHONE);
    const member = await verifyOtp(MEMBER_PHONE);
    if (!payer || !member) return;

    if (!(await ensurePayerHandle(payer.token))) return;

    const eventA = await requestJson(
      'POST',
      '/api/v1/events',
      { title: `Smoke Ledger A ${Date.now()}` },
      payer.token,
    );
    const eventAId = eventA.body.id as string | undefined;
    if (eventA.status !== 201 || !eventAId) {
      fail('POST /events (A)', `status ${eventA.status}`);
      return;
    }
    eventIds.push(eventAId);

    const addMemberA = await requestJson(
      'POST',
      `/api/v1/events/${eventAId}/participants/manual`,
      {
        display_name: 'LedgerMember',
        join_method: 'manual_phone',
        phone_e164: MEMBER_PHONE,
      },
      payer.token,
    );
    const memberPartA = addMemberA.body.id as string | undefined;
    if (addMemberA.status !== 201 || !memberPartA) {
      fail('Add member (A)', `status ${addMemberA.status}`);
      return;
    }

    const eventB = await requestJson(
      'POST',
      '/api/v1/events',
      { title: `Smoke Ledger B ${Date.now()}` },
      payer.token,
    );
    const eventBId = eventB.body.id as string | undefined;
    if (eventB.status !== 201 || !eventBId) {
      fail('POST /events (B)', `status ${eventB.status}`);
      return;
    }
    eventIds.push(eventBId);

    const addMemberB = await requestJson(
      'POST',
      `/api/v1/events/${eventBId}/participants/manual`,
      {
        display_name: 'LedgerMember',
        join_method: 'manual_phone',
        phone_e164: MEMBER_PHONE,
      },
      payer.token,
    );
    const memberPartB = addMemberB.body.id as string | undefined;
    if (addMemberB.status !== 201 || !memberPartB) {
      fail('Add member (B)', `status ${addMemberB.status}`);
      return;
    }

    if (!(await sendEventToSettlement(payer.token, eventAId, memberPartA, 'A'))) return;
    if (!(await sendEventToSettlement(payer.token, eventBId, memberPartB, 'B'))) return;

    const owedToMe = await requestJson('GET', '/api/v1/settlement/owed-to-me', undefined, payer.token);
    const owedData = owedToMe.body.data as Array<{ event_id: string; amount_minor_units: number }> | undefined;
    const runEventIds = [eventAId, eventBId];
    const owedThisRun = (owedData ?? []).filter((row) => runEventIds.includes(row.event_id));
    if (owedToMe.status !== 200 || owedThisRun.length !== 2) {
      fail('GET owed-to-me', JSON.stringify(owedToMe.body));
      return;
    }
    const owedThisRunTotal = owedThisRun.reduce((sum, row) => sum + row.amount_minor_units, 0);
    if (owedThisRunTotal <= 0 || owedToMe.body.currency !== 'USD') {
      fail('GET owed-to-me totals', JSON.stringify(owedToMe.body));
      return;
    }
    if (hasPhoneLeak(owedToMe.body)) {
      fail('GET owed-to-me PII', 'phone fields leaked');
      return;
    }
    pass('GET owed-to-me', `${owedThisRun.length} rows this run, total=${owedThisRunTotal}`);

    const iOwe = await requestJson('GET', '/api/v1/settlement/i-owe', undefined, member.token);
    const oweData = iOwe.body.data as
      | Array<{
          event_id: string;
          amount_minor_units: number;
          payer_display_name: string;
          creator_payment_handles: Array<{ provider: string; handle_display: string }>;
        }>
      | undefined;
    if (iOwe.status !== 200 || !oweData) {
      fail('GET i-owe', JSON.stringify(iOwe.body));
      return;
    }
    const oweThisRun = oweData.filter((row) => runEventIds.includes(row.event_id));
    const oweThisRunTotal = oweThisRun.reduce((sum, row) => sum + row.amount_minor_units, 0);
    if (oweThisRun.length !== 2 || oweThisRunTotal !== owedThisRunTotal) {
      fail(
        'GET i-owe total matches owed-to-me (this run)',
        `owe=${oweThisRunTotal} owed=${owedThisRunTotal}`,
      );
      return;
    }
    const handles = oweThisRun[0]?.creator_payment_handles ?? [];
    if (handles.length === 0 || !handles[0].handle_display) {
      fail('GET i-owe handles', 'missing decrypted handles');
      return;
    }
    if (hasPhoneLeak(iOwe.body)) {
      fail('GET i-owe PII', 'phone fields leaked');
      return;
    }
    pass(
      'GET i-owe',
      `${oweThisRun.length} rows this run, total=${oweThisRunTotal}, handle=${handles[0].provider}:${handles[0].handle_display}`,
    );

    const memberDetail = await requestJson(
      'GET',
      `/api/v1/settlement/member/${member.userId}`,
      undefined,
      payer.token,
    );
    const personDetail = await requestJson(
      'GET',
      `/api/v1/settlement/person/${member.userId}`,
      undefined,
      payer.token,
    );
    if (memberDetail.status !== 200 || personDetail.status !== 200) {
      fail('GET member/person detail', `member=${memberDetail.status} person=${personDetail.status}`);
      return;
    }
    const memberCp = memberDetail.body.counterparty as Record<string, unknown> | undefined;
    const personCp = personDetail.body.counterparty as Record<string, unknown> | undefined;
    if (JSON.stringify(memberCp) !== JSON.stringify(personCp)) {
      fail('GET person alias', 'counterparty mismatch');
      return;
    }
    pass('GET person/:userId alias', 'matches member detail');

    const confirmOne = await requestJson(
      'POST',
      `/api/v1/events/${eventAId}/settlement/cash/${memberPartA}`,
      { payment_method: 'cash' },
      payer.token,
    );
    if (confirmOne.status !== 200 || confirmOne.body.payment_status !== 'confirmed') {
      fail('POST mark-paid (one row)', `status ${confirmOne.status}`);
      return;
    }
    pass('POST mark-paid (one row)', 'confirmed');

    const owedAfter = await requestJson('GET', '/api/v1/settlement/owed-to-me', undefined, payer.token);
    const afterData = owedAfter.body.data as
      | Array<{ event_id: string; amount_minor_units?: number }>
      | undefined;
    const afterTotal = Number(owedAfter.body.total_owed_minor_units);
    if (owedAfter.status !== 200 || !afterData) {
      fail('GET owed-to-me after confirm', JSON.stringify(owedAfter.body));
      return;
    }
    const afterThisRun = (afterData ?? []).filter((row) => runEventIds.includes(row.event_id));
    if (afterThisRun.length !== 1 || afterThisRun[0].event_id !== eventBId) {
      fail('GET owed-to-me after confirm', `expected only event B: ${JSON.stringify(afterThisRun)}`);
      return;
    }
    const afterThisRunTotal = afterThisRun.reduce((sum, row) => {
      const amount = (row as { amount_minor_units?: number }).amount_minor_units ?? 0;
      return sum + amount;
    }, 0);
    if (afterThisRunTotal >= owedThisRunTotal) {
      fail('GET owed-to-me after confirm', `total did not decrease: ${afterThisRunTotal}`);
      return;
    }
    pass('GET owed-to-me excludes confirmed', `1 row this run, total=${afterThisRunTotal}`);
  } finally {
    for (const eventId of eventIds) {
      await cleanup(eventId);
    }
    if (eventIds.length > 0) {
      pass('Cleanup', `${eventIds.length} event(s)`);
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
