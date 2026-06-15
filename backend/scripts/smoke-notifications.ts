/**
 * Live smoke test for in-app notification inbox + mark-read API (E10-S02).
 *
 * Usage (backend must be running, Supabase configured):
 *   doppler run -- npm run smoke:notifications
 */
import { supabaseAdmin } from '../src/infrastructure/supabase';

const BASE_URL = (process.env.SMOKE_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(
  /\/$/,
  '',
);
const TEST_PHONE = '+15005550001';

type StepResult = { name: string; ok: boolean; detail: string };

const results: StepResult[] = [];
const insertedNotificationIds: string[] = [];

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

async function verifyOtp(phone: string): Promise<{ token: string; userId: string } | null> {
  const res = await requestJson('POST', '/api/v1/auth/otp/verify', {
    phone_e164: phone,
    code: '123456',
    context: 'login',
  });
  const token = res.body.access_token as string | undefined;
  const user = res.body.user as { id?: string } | undefined;
  const userId = user?.id;
  if (res.status === 200 && token && userId) {
    pass(`OTP verify ${phone}`, userId);
    return { token, userId };
  }
  fail(`OTP verify ${phone}`, `status ${res.status}`);
  return null;
}

async function seedNotifications(userId: string): Promise<void> {
  const rows = [
    {
      user_id: userId,
      type: 'share_ready',
      title: 'Smoke share ready',
      body: 'Your share is ready (smoke test).',
      event_id: null,
    },
    {
      user_id: userId,
      type: 'nudge',
      title: 'Smoke nudge',
      body: 'Friendly reminder (smoke test).',
      event_id: null,
    },
  ];

  for (const row of rows) {
    const { data, error } = await supabaseAdmin
      .from('user_notifications')
      .insert(row)
      .select('id')
      .single();
    if (error || !data?.id) {
      throw new Error(`Failed to seed notification: ${error?.message ?? 'no id'}`);
    }
    insertedNotificationIds.push(data.id as string);
  }
  pass('Seed inbox rows', `${insertedNotificationIds.length} notifications`);
}

async function cleanup(): Promise<void> {
  if (insertedNotificationIds.length === 0) return;
  await supabaseAdmin.from('user_notifications').delete().in('id', insertedNotificationIds);
  pass('Cleanup notifications', `${insertedNotificationIds.length} row(s)`);
}

async function main(): Promise<void> {
  console.log(`Smoke: notifications @ ${BASE_URL}\n`);

  const auth = await verifyOtp(TEST_PHONE);
  if (!auth) {
    process.exit(1);
  }

  try {
    await seedNotifications(auth.userId);

    const unreadBefore = await requestJson(
      'GET',
      '/api/v1/users/me/notifications/unread-count',
      undefined,
      auth.token,
    );
    if (unreadBefore.status === 200 && unreadBefore.body.unread_count === 2) {
      pass('GET unread-count before read', '2');
    } else {
      fail('GET unread-count before read', JSON.stringify(unreadBefore.body));
    }

    const list = await requestJson('GET', '/api/v1/users/me/notifications', undefined, auth.token);
    const notifications = list.body.notifications as Array<{ id: string; is_read: boolean }> | undefined;
    if (list.status === 200 && notifications && notifications.length >= 2) {
      pass('GET notifications list', `${notifications.length} row(s)`);
    } else {
      fail('GET notifications list', `status ${list.status}`);
      return;
    }

    const firstId = insertedNotificationIds[0];
    const mark = await requestJson(
      'PATCH',
      `/api/v1/users/me/notifications/${firstId}/read`,
      {},
      auth.token,
    );
    if (mark.status === 200 && mark.body.unread_count === 1) {
      pass('PATCH mark-read decrements badge', 'unread_count=1');
    } else {
      fail('PATCH mark-read', JSON.stringify(mark.body));
    }

    const unreadAfter = await requestJson(
      'GET',
      '/api/v1/users/me/notifications/unread-count',
      undefined,
      auth.token,
    );
    if (unreadAfter.status === 200 && unreadAfter.body.unread_count === 1) {
      pass('GET unread-count after read', '1');
    } else {
      fail('GET unread-count after read', JSON.stringify(unreadAfter.body));
    }

    const markAgain = await requestJson(
      'PATCH',
      `/api/v1/users/me/notifications/${firstId}/read`,
      {},
      auth.token,
    );
    if (markAgain.status === 404) {
      pass('PATCH mark-read idempotent', '404 NOT_FOUND');
    } else {
      fail('PATCH mark-read idempotent', `status ${markAgain.status}`);
    }
  } finally {
    await cleanup();
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
