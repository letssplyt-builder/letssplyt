import { randomBytes } from 'crypto';
import { AppError, Errors, NotFoundError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import type {
  CreateEventResponse,
  EventDetailResponse,
  EventListItem,
  EventListResponse,
  EventRecord,
  EventSettlementSummary,
  JoinTokenInfo,
  LockEventResponse,
  ReopenEventResponse,
} from '@letssplyt/shared/event.types';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;
const CREATE_TOKEN_TTL_HOURS = 24;
const REOPEN_TOKEN_TTL_HOURS = 1;

type EventRow = EventRecord & { deleted_at?: string | null };

interface EventCursor {
  created_at: string;
  id: string;
}

function getAppBaseUrl(): string {
  const domain = process.env.APP_DOMAIN ?? 'http://localhost:3000';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain.replace(/\/$/, '');
  }
  return `https://${domain}`;
}

export function buildJoinUrl(token: string): string {
  return `${getAppBaseUrl()}/join/${token}`;
}

export function generateJoinTokenValue(): string {
  return randomBytes(18).toString('base64url');
}

export function encodeEventCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ created_at: createdAt, id } satisfies EventCursor)).toString(
    'base64url',
  );
}

export function decodeEventCursor(cursor: string): EventCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as EventCursor;
    if (!parsed.created_at || !parsed.id) {
      throw new Error('invalid');
    }
    return parsed;
  } catch {
    throw Errors.validation('Invalid pagination cursor');
  }
}

async function fetchEventRow(eventId: string): Promise<EventRow> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select(
      'id, payer_id, title, event_date, total_amount, currency, status, split_mode, ai_stage, locale, locked_at, messages_sent_at, fully_settled_at, created_at, updated_at, deleted_at',
    )
    .eq('id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    throw new NotFoundError('Event not found');
  }

  return data as EventRow;
}

async function assertEventOwner(event: EventRow, userId: string): Promise<void> {
  if (event.payer_id !== userId) {
    throw Errors.forbidden('You do not have permission to modify this event');
  }
}

async function countParticipants(eventId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('event_id', eventId);

  if (error) {
    throw new AppError('PARTICIPANTS_COUNT_FAILED', 'Could not count participants', 500);
  }

  return (data ?? []).length;
}

async function deactivateActiveTokens(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('event_join_tokens')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('is_active', true);

  if (error) {
    throw new AppError('TOKEN_REVOKE_FAILED', 'Could not revoke join tokens', 500);
  }
}

async function createJoinToken(
  eventId: string,
  ttlHours: number,
): Promise<{ token: string; expires_at: string }> {
  const token = generateJoinTokenValue();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from('event_join_tokens').insert({
    event_id: eventId,
    token,
    expires_at: expiresAt,
    is_active: true,
  });

  if (error) {
    throw new AppError('TOKEN_CREATE_FAILED', 'Could not create join token', 500);
  }

  return { token, expires_at: expiresAt };
}

async function fetchActiveJoinToken(eventId: string): Promise<JoinTokenInfo | null> {
  const { data, error } = await supabaseAdmin
    .from('event_join_tokens')
    .select('token, expires_at, is_active')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const token = data.token as string;
  return {
    token,
    join_url: buildJoinUrl(token),
    expires_at: data.expires_at as string,
    is_active: data.is_active as boolean,
  };
}

function mapEventRecord(row: EventRow): EventRecord {
  return {
    id: row.id,
    payer_id: row.payer_id,
    title: row.title,
    event_date: row.event_date,
    total_amount: row.total_amount,
    currency: row.currency,
    status: row.status,
    split_mode: row.split_mode,
    ai_stage: row.ai_stage,
    locale: row.locale,
    locked_at: row.locked_at,
    messages_sent_at: row.messages_sent_at,
    fully_settled_at: row.fully_settled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function assertEventAccess(event: EventRow, userId: string): Promise<void> {
  if (event.payer_id === userId) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('event_id', event.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new AppError('ACCESS_CHECK_FAILED', 'Could not verify event access', 500);
  }

  if (!data) {
    throw Errors.forbidden('You do not have access to this event');
  }
}

function buildSettlementSummary(
  participants: Array<{ payment_status: string; amount_owed: number | null }>,
  totalAmount: number | null,
): EventSettlementSummary {
  const total = totalAmount ?? 0;
  let collected = 0;
  let confirmed_count = 0;
  let pending_count = 0;

  for (const participant of participants) {
    const amount = participant.amount_owed ?? 0;
    if (participant.payment_status === 'confirmed' || participant.payment_status === 'settled') {
      collected += amount;
      confirmed_count += 1;
    } else if (participant.payment_status === 'pending') {
      pending_count += 1;
    }
  }

  return {
    total,
    collected,
    outstanding: Math.max(0, total - collected),
    confirmed_count,
    pending_count,
  };
}

export async function createEvent(
  userId: string,
  input: { title: string; event_date?: string },
): Promise<CreateEventResponse> {
  const { data: eventRow, error: eventError } = await supabaseAdmin
    .from('events')
    .insert({
      payer_id: userId,
      title: input.title,
      event_date: input.event_date ?? null,
      status: 'open',
      ai_stage: 'none',
    })
    .select('id, title, status')
    .single();

  if (eventError || !eventRow) {
    throw new AppError('EVENT_CREATE_FAILED', 'Could not create event', 500);
  }

  const { token, expires_at } = await createJoinToken(eventRow.id as string, CREATE_TOKEN_TTL_HOURS);

  return {
    id: eventRow.id as string,
    title: eventRow.title as string,
    status: eventRow.status as CreateEventResponse['status'],
    join_url: buildJoinUrl(token),
    token_expires_at: expires_at,
  };
}

export async function listEvents(
  userId: string,
  options: { cursor?: string; limit?: number },
): Promise<EventListResponse> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

  let query = supabaseAdmin
    .from('events')
    .select('id, title, status, total_amount, created_at')
    .eq('payer_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (options.cursor) {
    const decoded = decodeEventCursor(options.cursor);
    query = query.lt('created_at', decoded.created_at);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('EVENTS_LIST_FAILED', 'Could not list events', 500);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    status: EventListItem['status'];
    total_amount: number | null;
    created_at: string;
  }>;

  const has_more = rows.length > limit;
  const pageRows = has_more ? rows.slice(0, limit) : rows;

  const events: EventListItem[] = await Promise.all(
    pageRows.map(async (row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      participant_count: await countParticipants(row.id),
      total_amount: row.total_amount,
      created_at: row.created_at,
    })),
  );

  const last = pageRows[pageRows.length - 1];
  const next_cursor =
    has_more && last ? encodeEventCursor(last.created_at, last.id) : null;

  return { events, next_cursor, has_more };
}

export async function getEventById(userId: string, eventId: string): Promise<EventDetailResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventAccess(eventRow, userId);

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('id, display_name, avatar_colour')
    .eq('id', eventRow.payer_id)
    .maybeSingle();

  if (payerError || !payer) {
    throw new AppError('PAYER_FETCH_FAILED', 'Could not load event payer', 500);
  }

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('id, display_name, join_method, payment_status, amount_owed')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (participantsError) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  const participants = (participantRows ?? []).map((row) => ({
    id: row.id as string,
    display_name: row.display_name as string,
    join_method: row.join_method as string,
    payment_status: row.payment_status as string,
    amount_owed: row.amount_owed as number | null,
  }));

  const join_token = eventRow.status === 'open' ? await fetchActiveJoinToken(eventId) : null;
  const summary =
    eventRow.status !== 'open'
      ? buildSettlementSummary(participants, eventRow.total_amount)
      : null;

  return {
    event: {
      ...mapEventRecord(eventRow),
      payer: {
        id: payer.id as string,
        display_name: payer.display_name as string,
        avatar_colour: payer.avatar_colour as string,
      },
    },
    participants,
    join_token,
    summary,
  };
}

export async function lockEvent(userId: string, eventId: string): Promise<LockEventResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'open') {
    throw Errors.conflict('Event is not open', 'ALREADY_LOCKED');
  }

  const participant_count = await countParticipants(eventId);
  if (participant_count < 2) {
    throw new AppError(
      'MINIMUM_PARTICIPANTS_REQUIRED',
      'At least two participants are required to lock the group',
      400,
    );
  }

  const lockedAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('events')
    .update({
      status: 'locked',
      locked_at: lockedAt,
      participant_count_at_lock: participant_count,
    })
    .eq('id', eventId);

  if (updateError) {
    throw new AppError('EVENT_LOCK_FAILED', 'Could not lock event', 500);
  }

  await deactivateActiveTokens(eventId);

  return {
    event_id: eventId,
    status: 'locked',
    locked_at: lockedAt,
    participant_count,
  };
}

export async function reopenEvent(userId: string, eventId: string): Promise<ReopenEventResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'locked') {
    throw Errors.conflict('Event is not locked', 'NOT_LOCKED');
  }

  const { error: updateError } = await supabaseAdmin
    .from('events')
    .update({ status: 'open', locked_at: null })
    .eq('id', eventId);

  if (updateError) {
    throw new AppError('EVENT_REOPEN_FAILED', 'Could not reopen event', 500);
  }

  await deactivateActiveTokens(eventId);
  const { token, expires_at } = await createJoinToken(eventId, REOPEN_TOKEN_TTL_HOURS);

  return {
    join_token: token,
    join_url: buildJoinUrl(token),
    expires_at,
  };
}

export async function regenerateJoinToken(
  userId: string,
  eventId: string,
): Promise<ReopenEventResponse> {
  const eventRow = await fetchEventRow(eventId);
  await assertEventOwner(eventRow, userId);

  if (eventRow.status !== 'open') {
    throw Errors.conflict('Join tokens can only be regenerated for open events', 'GROUP_IS_LOCKED');
  }

  const activeToken = await fetchActiveJoinToken(eventId);
  if (activeToken && new Date(activeToken.expires_at).getTime() > Date.now()) {
    throw Errors.conflict('Active join token has not expired yet', 'TOKEN_STILL_VALID');
  }

  await deactivateActiveTokens(eventId);
  const { token, expires_at } = await createJoinToken(eventId, CREATE_TOKEN_TTL_HOURS);

  return {
    join_token: token,
    join_url: buildJoinUrl(token),
    expires_at,
  };
}
