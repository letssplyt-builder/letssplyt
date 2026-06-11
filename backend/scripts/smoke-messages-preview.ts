/**
 * Live smoke test for split confirm, messages preview (E08-S01), send (E08-S02),
 * SMS breakdown links, and delivery tracking fields + retry (E08-S05).
 *
 * Usage (backend must be running on PORT, default 3000):
 *   doppler run -- npm run smoke:messages-preview
 */
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);
const ALEX_PHONE = '+15005550001';
/** Twilio magic number — distinct from payer for manual_phone guest. */
const GUEST_PHONE = '+15005550002';

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

async function main(): Promise<void> {
  console.log(`Smoke: messages preview + send + delivery (E08-S01–S05) (${BASE_URL})\n`);

  let eventId: string | null = null;

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
    if (verify.status !== 200 || !accessToken) {
      fail('POST /auth/otp/verify', `status ${verify.status} ${JSON.stringify(verify.body)}`);
      return;
    }
    pass('POST /auth/otp/verify', 'token received');

    if (!(await ensurePayerHandle(accessToken))) return;

    const created = await requestJson(
      'POST',
      '/api/v1/events',
      { title: `Smoke Messages ${Date.now()}` },
      accessToken,
    );
    const newEventId = created.body.id as string | undefined;
    if (created.status !== 201 || !newEventId) {
      fail('POST /events', `status ${created.status}`);
      return;
    }
    eventId = newEventId;
    pass('POST /events', eventId);

    const addGuest = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/participants/manual`,
      {
        display_name: 'Jordan',
        join_method: 'manual_phone',
        phone_e164: GUEST_PHONE,
      },
      accessToken,
    );
    const guestParticipantId = addGuest.body.id as string | undefined;
    if (addGuest.status !== 201 || !guestParticipantId) {
      fail('POST /participants/manual (phone)', `status ${addGuest.status}`);
      return;
    }
    pass('POST /participants/manual (phone)', guestParticipantId);

    const locked = await requestJson('POST', `/api/v1/events/${eventId}/lock`, {}, accessToken);
    if (locked.status !== 200) {
      fail('POST /events/:id/lock', `status ${locked.status}`);
      return;
    }
    pass('POST /events/:id/lock');

    const manualTotal = 84;
    const calculate = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/split/calculate`,
      { split_mode: 'equal', manual_total: manualTotal },
      accessToken,
    );
    const calcSplits = calculate.body.splits as
      | Array<{ participant_id: string; amount_owed: number }>
      | undefined;
    if (calculate.status !== 200 || !calcSplits?.length) {
      fail('POST split/calculate', `status ${calculate.status} ${JSON.stringify(calculate.body)}`);
      return;
    }
    pass('POST split/calculate', `${calcSplits.length} splits`);

    const detailPreConfirm = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, accessToken);
    const participantsPre = detailPreConfirm.body.participants as
      | Array<{ amount_owed: number | null }>
      | undefined;
    const allNull =
      participantsPre?.every((row) => row.amount_owed === null || row.amount_owed === undefined) ?? false;
    if (detailPreConfirm.status === 200 && allNull) {
      pass('GET /events/:id pre-confirm', 'participant amount_owed still null');
    } else {
      fail('GET /events/:id pre-confirm', JSON.stringify(participantsPre));
    }

    const previewEarly = await requestJson(
      'GET',
      `/api/v1/events/${eventId}/messages/preview`,
      undefined,
      accessToken,
    );
    if (previewEarly.status === 409) {
      pass('GET messages/preview before confirm', '409 as expected');
    } else {
      fail('GET messages/preview before confirm', `status ${previewEarly.status}`);
    }

    const confirm = await requestJson(
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
    if (confirm.status === 200 && confirm.body.confirmed === true && confirm.body.ai_stage === 'calculated') {
      pass('POST split/confirm', 'confirmed');
    } else {
      fail('POST split/confirm', `status ${confirm.status} ${JSON.stringify(confirm.body)}`);
      return;
    }

    const detailPostConfirm = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, accessToken);
    const participantsPost = detailPostConfirm.body.participants as
      | Array<{ amount_owed: number | null; display_name: string; is_organiser?: boolean }>
      | undefined;
    const memberCount =
      participantsPost?.filter((row) => !row.is_organiser).length ?? 0;
    const allSet =
      participantsPost?.every((row) => row.amount_owed !== null && row.amount_owed > 0) ?? false;
    const sumPost =
      participantsPost?.reduce((acc, row) => acc + (row.amount_owed ?? 0), 0) ?? 0;
    if (detailPostConfirm.status === 200 && allSet && Math.abs(sumPost - manualTotal) <= 0.02) {
      pass('GET /events/:id post-confirm', `amounts set sum=${sumPost.toFixed(2)}`);
    } else {
      fail('GET /events/:id post-confirm', JSON.stringify(participantsPost));
    }

    const preview = await requestJson(
      'GET',
      `/api/v1/events/${eventId}/messages/preview`,
      undefined,
      accessToken,
    );
    const previews = preview.body.previews as
      | Array<{
          participant_id: string;
          display_name: string;
          amount_owed: number;
          message_text: string;
          channel: string;
          breakdown_url: string | null;
          payment_links: Array<{ provider: string; label: string; url: string }>;
        }>
      | undefined;

    const previewsWithLinks = previews?.filter((p) => p.payment_links.length > 0) ?? [];
    const previewsWithBreakdown =
      previews?.filter((p) => typeof p.breakdown_url === 'string' && p.breakdown_url.length > 0) ??
      [];
    if (
      preview.status === 200 &&
      previews?.length === memberCount &&
      previews.every((p) => p.message_text.length > 20) &&
      previewsWithBreakdown.length >= 1 &&
      previews.every((p) => p.message_text.includes('See full split:'))
    ) {
      pass(
        'GET messages/preview',
        `${previews.length} previews, ${previewsWithLinks.length} with payment_links, ${previewsWithBreakdown.length} with breakdown_url`,
      );
    } else {
      fail('GET messages/preview', `status ${preview.status} ${JSON.stringify(preview.body)}`);
      return;
    }

    const hasDisplayName = previews?.every(
      (p) => p.message_text.includes(p.display_name) && !p.message_text.includes('Recipient'),
    );
    if (hasDisplayName) {
      pass('preview message_text', 'uses display_name not Recipient');
    } else {
      fail('preview message_text', 'missing display_name or contains Recipient');
    }

    const { data: stageRow } = await supabaseAdmin
      .from('events')
      .select('ai_stage')
      .eq('id', eventId)
      .maybeSingle();
    if (stageRow?.ai_stage === 'messaging') {
      pass('DB ai_stage after preview', stageRow.ai_stage);
    } else {
      fail('DB ai_stage after preview', String(stageRow?.ai_stage));
    }

    const previewAgain = await requestJson(
      'GET',
      `/api/v1/events/${eventId}/messages/preview`,
      undefined,
      accessToken,
    );
    if (previewAgain.status === 200 && (previewAgain.body.previews as unknown[] | undefined)?.length) {
      pass('GET messages/preview (repeat)', 'idempotent 200');
    } else {
      fail('GET messages/preview (repeat)', `status ${previewAgain.status}`);
    }

    const send = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/messages/send`,
      {},
      accessToken,
    );
    const sentCount = send.body.sent_count as number | undefined;
    const skippedCount = send.body.skipped_count as number | undefined;
    const eventStatus = send.body.event_status as string | undefined;
    if (
      send.status === 200 &&
      sentCount === 1 &&
      skippedCount === 0 &&
      eventStatus === 'sent'
    ) {
      pass('POST messages/send', `sent=${sentCount} skipped=${skippedCount}`);
    } else {
      fail('POST messages/send', `status ${send.status} ${JSON.stringify(send.body)}`);
      return;
    }

    const { data: logs } = await supabaseAdmin
      .from('notification_log')
      .select('id, participant_id, status, twilio_sid, channel')
      .eq('event_id', eventId);
    if (logs?.length === 1 && logs[0]?.participant_id === guestParticipantId) {
      pass('DB notification_log', `1 row sid=${logs[0]?.twilio_sid}`);
    } else {
      fail('DB notification_log', JSON.stringify(logs));
      return;
    }

    const detailAfterSend = await requestJson('GET', `/api/v1/events/${eventId}`, undefined, accessToken);
    const participantsAfterSend = detailAfterSend.body.participants as
      | Array<{
          id: string;
          is_organiser?: boolean;
          message_sent_at?: string | null;
          message_delivered_at?: string | null;
          message_failed?: boolean;
        }>
      | undefined;
    const guestAfterSend = participantsAfterSend?.find((row) => row.id === guestParticipantId);
    if (
      detailAfterSend.status === 200 &&
      guestAfterSend?.message_sent_at &&
      guestAfterSend?.message_delivered_at &&
      !guestAfterSend?.message_failed
    ) {
      pass('GET event message delivery fields', 'message_sent_at + message_delivered_at');
    } else {
      fail('GET event message delivery fields', JSON.stringify(guestAfterSend));
      return;
    }

    const { data: guestRow } = await supabaseAdmin
      .from('participants')
      .select('message_sent_at, message_delivered_at, message_failed')
      .eq('id', guestParticipantId)
      .maybeSingle();
    if (guestRow?.message_sent_at && guestRow?.message_delivered_at && !guestRow?.message_failed) {
      pass('DB participant delivery fields', 'sent_at + delivered_at');
    } else {
      fail('DB participant delivery fields', JSON.stringify(guestRow));
      return;
    }

    const retry = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/messages/retry/${guestParticipantId}`,
      {},
      accessToken,
    );
    const retrySent = retry.body.sent_count as number | undefined;
    if (retry.status === 200 && retrySent === 1) {
      pass('POST messages/retry/:participantId', `sent=${retrySent}`);
    } else {
      fail('POST messages/retry/:participantId', `status ${retry.status} ${JSON.stringify(retry.body)}`);
      return;
    }

    const { data: guestBreakdown } = await supabaseAdmin
      .from('participants')
      .select('breakdown_token')
      .eq('id', guestParticipantId)
      .maybeSingle();

    const breakdownToken = guestBreakdown?.breakdown_token as string | undefined;
    if (!breakdownToken) {
      fail('DB participant breakdown_token', 'missing token');
      return;
    }

    const breakdownPage = await fetch(`${BASE_URL}/split/${breakdownToken}`);
    const breakdownHtml = await breakdownPage.text();
    if (
      breakdownPage.status === 200 &&
      breakdownHtml.includes('Who owes what') &&
      breakdownHtml.includes('(you)')
    ) {
      pass('GET /split/:token', 'HTML breakdown page');
    } else {
      fail('GET /split/:token', `status ${breakdownPage.status}`);
      return;
    }

    const { data: eventAfterSend } = await supabaseAdmin
      .from('events')
      .select('status, ai_stage, messages_sent_at')
      .eq('id', eventId)
      .maybeSingle();
    if (
      eventAfterSend?.status === 'sent' &&
      eventAfterSend?.ai_stage === 'complete' &&
      eventAfterSend?.messages_sent_at
    ) {
      pass('DB event after send', `${eventAfterSend.status}/${eventAfterSend.ai_stage}`);
    } else {
      fail('DB event after send', JSON.stringify(eventAfterSend));
    }

    const sendAgain = await requestJson(
      'POST',
      `/api/v1/events/${eventId}/messages/send`,
      {},
      accessToken,
    );
    if (sendAgain.status === 200 && (sendAgain.body.sent_count as number) >= 0) {
      pass('POST messages/send (repeat)', 'idempotent 200');
    } else {
      fail('POST messages/send (repeat)', `status ${sendAgain.status}`);
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
