/**
 * Live smoke test for counterparty bulk settlement API (E09-S02):
 * member self-report-all, dispute-all, confirm-all; guest mark-paid-all, confirm-all.
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npm run smoke:bulk-settlement
 */
import { hashPhone } from '../src/infrastructure/security';
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);
const PAYER_PHONE = '+15005550001';
const MEMBER_PHONE = '+15005550002';
const GUEST_PHONE = '+15005550004';

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

function resultsForEvents(
  results: Array<{ event_id: string; payment_status: string }> | undefined,
  eventIds: string[],
): Array<{ event_id: string; payment_status: string }> {
  return (results ?? []).filter((row) => eventIds.includes(row.event_id));
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

async function createEventWithMember(
  payerToken: string,
  memberPhone: string,
  label: string,
): Promise<{ eventId: string; memberParticipantId: string } | null> {
  const created = await requestJson(
    'POST',
    '/api/v1/events',
    { title: `Smoke Bulk ${label} ${Date.now()}` },
    payerToken,
  );
  const eventId = created.body.id as string | undefined;
  if (created.status !== 201 || !eventId) {
    fail(`POST /events (${label})`, `status ${created.status}`);
    return null;
  }
  pass(`POST /events (${label})`, eventId);

  const addMember = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/participants/manual`,
    {
      display_name: 'BulkMember',
      join_method: 'manual_phone',
      phone_e164: memberPhone,
    },
    payerToken,
  );
  const memberParticipantId = addMember.body.id as string | undefined;
  if (addMember.status !== 201 || !memberParticipantId) {
    fail(`Add member (${label})`, `status ${addMember.status}`);
    return null;
  }
  pass(`Add member (${label})`, memberParticipantId);

  return { eventId, memberParticipantId };
}

async function sendEventToSettlement(payerToken: string, eventId: string, label: string): Promise<boolean> {
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

async function createEventWithGuest(
  payerToken: string,
  guestPhone: string,
  label: string,
): Promise<{ eventId: string; guestParticipantId: string } | null> {
  const created = await requestJson(
    'POST',
    '/api/v1/events',
    { title: `Smoke Bulk Guest ${label} ${Date.now()}` },
    payerToken,
  );
  const eventId = created.body.id as string | undefined;
  if (created.status !== 201 || !eventId) {
    fail(`POST /events guest (${label})`, `status ${created.status}`);
    return null;
  }

  const addGuest = await requestJson(
    'POST',
    `/api/v1/events/${eventId}/participants/manual`,
    {
      display_name: 'BulkGuest',
      join_method: 'manual_phone',
      phone_e164: guestPhone,
    },
    payerToken,
  );
  const guestParticipantId = addGuest.body.id as string | undefined;
  if (addGuest.status !== 201 || !guestParticipantId) {
    fail(`Add guest (${label})`, `status ${addGuest.status}`);
    return null;
  }

  return { eventId, guestParticipantId };
}

async function main(): Promise<void> {
  console.log(`Smoke: bulk settlement (E09-S02) (${BASE_URL})\n`);

  const eventIds: string[] = [];
  const guestPhoneHash = hashPhone(GUEST_PHONE);

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

    const memberEventA = await createEventWithMember(payer.token, MEMBER_PHONE, 'A');
    const memberEventB = await createEventWithMember(payer.token, MEMBER_PHONE, 'B');
    if (!memberEventA || !memberEventB) return;
    eventIds.push(memberEventA.eventId, memberEventB.eventId);

    if (!(await sendEventToSettlement(payer.token, memberEventA.eventId, 'member A'))) return;
    if (!(await sendEventToSettlement(payer.token, memberEventB.eventId, 'member B'))) return;

    const runEventIds = [memberEventA.eventId, memberEventB.eventId];

    const selfReportAll = await requestJson(
      'POST',
      `/api/v1/settlement/member/${payer.userId}/self-report-all`,
      { payment_method: 'venmo' },
      member.token,
    );
    const selfReportedThisRun = resultsForEvents(
      selfReportAll.body.results as Array<{ event_id: string; payment_status: string }> | undefined,
      runEventIds,
    );
    if (
      selfReportAll.status !== 200 ||
      selfReportedThisRun.length !== 2 ||
      !selfReportedThisRun.every((row) => row.payment_status === 'confirmed')
    ) {
      fail('POST member self-report-all', JSON.stringify(selfReportAll.body));
      return;
    }
    pass('POST member self-report-all', `updated_count=${selfReportAll.body.updated_count} (2 this run)`);

    const disputeAll = await requestJson(
      'POST',
      `/api/v1/settlement/member/${member.userId}/dispute-all`,
      { note: 'bulk smoke dispute' },
      payer.token,
    );
    const disputedThisRun = resultsForEvents(
      disputeAll.body.results as Array<{ event_id: string; payment_status: string }> | undefined,
      runEventIds,
    );
    if (
      disputeAll.status !== 200 ||
      disputedThisRun.length !== 2 ||
      disputedThisRun.every((row) => row.payment_status === 'disputed') !== true
    ) {
      fail('POST member dispute-all', JSON.stringify(disputeAll.body));
      return;
    }
    pass('POST member dispute-all', `updated_count=${disputeAll.body.updated_count} (2 this run)`);

    const selfReportAll2 = await requestJson(
      'POST',
      `/api/v1/settlement/member/${payer.userId}/self-report-all`,
      { payment_method: 'paypal' },
      member.token,
    );
    const selfReportedRetry = resultsForEvents(
      selfReportAll2.body.results as Array<{ event_id: string; payment_status: string }> | undefined,
      runEventIds,
    );
    if (
      selfReportAll2.status !== 200 ||
      selfReportedRetry.length !== 2 ||
      !selfReportedRetry.every((row) => row.payment_status === 'confirmed')
    ) {
      fail('POST member self-report-all (retry)', JSON.stringify(selfReportAll2.body));
      return;
    }
    pass('POST member self-report-all (retry)', `updated_count=${selfReportAll2.body.updated_count} (2 this run)`);

    const confirmAll = await requestJson(
      'POST',
      `/api/v1/settlement/member/${member.userId}/confirm-all`,
      undefined,
      payer.token,
    );
    if (confirmAll.status !== 200) {
      fail('POST member confirm-all', JSON.stringify(confirmAll.body));
      return;
    }
    const confirmCount = Number(confirmAll.body.updated_count);
    if (confirmCount === 0) {
      pass('POST member confirm-all', '0 — self-report-all already confirmed rows');
    } else if (confirmCount === 2) {
      pass('POST member confirm-all', `updated_count=${confirmCount}`);
    } else {
      fail('POST member confirm-all', JSON.stringify(confirmAll.body));
      return;
    }

    const guestEventA = await createEventWithGuest(payer.token, GUEST_PHONE, 'A');
    const guestEventB = await createEventWithGuest(payer.token, GUEST_PHONE, 'B');
    if (!guestEventA || !guestEventB) return;
    eventIds.push(guestEventA.eventId, guestEventB.eventId);

    if (!(await sendEventToSettlement(payer.token, guestEventA.eventId, 'guest A'))) return;
    if (!(await sendEventToSettlement(payer.token, guestEventB.eventId, 'guest B'))) return;

    const markPaidAll = await requestJson(
      'POST',
      `/api/v1/settlement/guest/${guestPhoneHash}/mark-paid-all`,
      { payment_method: 'cash' },
      payer.token,
    );
    if (markPaidAll.status !== 200 || Number(markPaidAll.body.updated_count) !== 2) {
      fail('POST guest mark-paid-all', JSON.stringify(markPaidAll.body));
      return;
    }
    pass('POST guest mark-paid-all', `updated_count=${markPaidAll.body.updated_count}`);

    const memberMarkPaidNoop = await requestJson(
      'POST',
      `/api/v1/settlement/member/${payer.userId}/mark-paid-all`,
      { payment_method: 'cash' },
      member.token,
    );
    if (
      memberMarkPaidNoop.status === 200 &&
      Number(memberMarkPaidNoop.body.updated_count) === 0
    ) {
      pass('POST member mark-paid-all as participant', '0 targets (no owed_to_me rows)');
    } else {
      fail(
        'POST member mark-paid-all as participant',
        `status ${memberMarkPaidNoop.status} body=${JSON.stringify(memberMarkPaidNoop.body)}`,
      );
    }
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
