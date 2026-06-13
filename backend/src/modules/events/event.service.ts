import { randomBytes } from 'crypto';
import { AppError, Errors, NotFoundError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import {
  collectLinkedUserIds,
  loadLinkedUserDisplayNames,
  resolveLinkedDisplayName,
} from '../participants/participant-display-name';
import type {
  CreateEventResponse,
  EventDetailResponse,
  EventListItem,
  EventListResponse,
  EventRecord,
  JoinTokenInfo,
  LockEventResponse,
  ParticipantAssignedItem,
  ReopenEventResponse,
} from '@letssplyt/shared/event.types';
import { fetchReceiptReviewSnapshot } from '../receipts/receipt-review.read';
import { buildEventSettlementSummary } from '../settlement/settlement-summary';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;
/** Initial join links and reopen-after-lock tokens share the same 24-hour TTL. */
const JOIN_TOKEN_TTL_HOURS = 24;

type EventRow = EventRecord & { deleted_at?: string | null };

export type EventRowWithReceiptFields = EventRow & {
  tax_amount: number | null;
  tip_amount: number | null;
  fees_amount: number | null;
  receipt_scan_attempted: boolean;
};

/** Stages where payer may edit itemised split — include post-calculate stages so Edit share keeps receipt data. */
const RECEIPT_REVIEW_STAGES = new Set([
  'parsed',
  'parsed_confirmed',
  'calculating',
  'calculated',
  'messaging',
  'complete',
]);

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

export async function fetchEventRow(eventId: string): Promise<EventRowWithReceiptFields> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select(
      'id, payer_id, title, event_date, total_amount, currency, status, split_mode, ai_stage, locale, locked_at, messages_sent_at, fully_settled_at, created_at, updated_at, deleted_at, tax_amount, tip_amount, fees_amount, receipt_scan_attempted',
    )
    .eq('id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    throw new NotFoundError('Event not found');
  }

  return data as EventRowWithReceiptFields;
}

export async function assertEventOwner(event: EventRow, userId: string): Promise<void> {
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

async function insertCreatorParticipant(userId: string, eventId: string): Promise<void> {
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    throw new AppError('PAYER_FETCH_FAILED', 'Could not load creator profile', 500);
  }

  const { error: participantError } = await supabaseAdmin.from('participants').insert({
    event_id: eventId,
    user_id: userId,
    guest_pii_token: null,
    display_name: user.display_name as string,
    join_method: 'qr_app',
    payment_status: 'pending',
  });

  if (participantError) {
    throw new AppError('PARTICIPANT_CREATE_FAILED', 'Could not add creator to event', 500);
  }
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

  const eventId = eventRow.id as string;

  try {
    await insertCreatorParticipant(userId, eventId);
  } catch (err) {
    await supabaseAdmin.from('events').delete().eq('id', eventId);
    throw err;
  }

  const { token, expires_at } = await createJoinToken(eventId, JOIN_TOKEN_TTL_HOURS);

  return {
    id: eventRow.id as string,
    title: eventRow.title as string,
    status: eventRow.status as CreateEventResponse['status'],
    join_url: buildJoinUrl(token),
    token_expires_at: expires_at,
  };
}

async function fetchParticipantEventIds(userId: string): Promise<string[]> {
  const { data: participantRows, error: participantError } = await supabaseAdmin
    .from('participants')
    .select('event_id')
    .eq('user_id', userId);

  if (participantError) {
    throw new AppError('EVENTS_LIST_FAILED', 'Could not list events', 500);
  }

  const eventIds = [...new Set((participantRows ?? []).map((row) => row.event_id as string))];
  if (eventIds.length === 0) {
    return [];
  }

  const { data: eventRows, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, payer_id')
    .in('id', eventIds)
    .is('deleted_at', null);

  if (eventError) {
    throw new AppError('EVENTS_LIST_FAILED', 'Could not list events', 500);
  }

  return (eventRows ?? [])
    .filter((row) => (row.payer_id as string) !== userId)
    .map((row) => row.id as string);
}

async function fetchCreatorNames(payerIds: string[]): Promise<Map<string, string>> {
  if (payerIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, display_name')
    .in('id', payerIds);

  if (error) {
    throw new AppError('EVENTS_LIST_FAILED', 'Could not list events', 500);
  }

  return new Map(
    (data ?? []).map((row) => [row.id as string, row.display_name as string]),
  );
}

export async function listEvents(
  userId: string,
  options: { cursor?: string; limit?: number; role?: 'creator' | 'participant' | 'all' },
): Promise<EventListResponse> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  const role = options.role ?? 'all';
  const participantEventIds = role !== 'creator' ? await fetchParticipantEventIds(userId) : [];

  let query = supabaseAdmin
    .from('events')
    .select('id, title, status, total_amount, created_at, payer_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (role === 'creator') {
    query = query.eq('payer_id', userId);
  } else if (role === 'participant') {
    if (participantEventIds.length === 0) {
      return { events: [], next_cursor: null, has_more: false };
    }
    query = query.in('id', participantEventIds);
  } else if (participantEventIds.length > 0) {
    query = query.or(`payer_id.eq.${userId},id.in.(${participantEventIds.join(',')})`);
  } else {
    query = query.eq('payer_id', userId);
  }

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
    payer_id: string;
  }>;

  const has_more = rows.length > limit;
  const pageRows = has_more ? rows.slice(0, limit) : rows;

  const creatorPayerIds = [
    ...new Set(
      pageRows.filter((row) => row.payer_id !== userId).map((row) => row.payer_id),
    ),
  ];
  const creatorNames = await fetchCreatorNames(creatorPayerIds);

  const events: EventListItem[] = await Promise.all(
    pageRows.map(async (row) => {
      const isCreator = row.payer_id === userId;
      let viewer_payment_status: string | null | undefined = undefined;
      if (!isCreator) {
        const { data: viewerRow } = await supabaseAdmin
          .from('participants')
          .select('payment_status')
          .eq('event_id', row.id)
          .eq('user_id', userId)
          .maybeSingle();
        viewer_payment_status = (viewerRow?.payment_status as string | null) ?? null;
      }
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        participant_count: await countParticipants(row.id),
        total_amount: row.total_amount,
        created_at: row.created_at,
        role: isCreator ? 'creator' : 'participant',
        creator_name: isCreator ? null : (creatorNames.get(row.payer_id) ?? null),
        viewer_payment_status,
      };
    }),
  );

  const last = pageRows[pageRows.length - 1];
  const next_cursor =
    has_more && last ? encodeEventCursor(last.created_at, last.id) : null;

  return { events, next_cursor, has_more };
}

async function fetchMyAssignedItems(
  eventId: string,
  participantId: string,
): Promise<ParticipantAssignedItem[]> {
  const { data, error } = await supabaseAdmin
    .from('item_assignments')
    .select('share_amount, receipt_items!inner(id, name, is_shared, event_id)')
    .eq('participant_id', participantId)
    .eq('receipt_items.event_id', eventId);

  if (error) {
    throw new AppError('ITEM_ASSIGNMENTS_FETCH_FAILED', 'Could not load assigned items', 500);
  }

  return (data ?? []).flatMap((row) => {
    const raw = row.receipt_items as
      | { id: string; name: string; is_shared: boolean }
      | Array<{ id: string; name: string; is_shared: boolean }>
      | null;
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return [];
    return [
      {
        id: item.id,
        name: item.name,
        share_amount: row.share_amount as number,
        is_shared: item.is_shared,
      },
    ];
  });
}

export async function getEventById(userId: string, eventId: string): Promise<EventDetailResponse> {
  const eventRow: EventRowWithReceiptFields = await fetchEventRow(eventId);
  await assertEventAccess(eventRow, userId);
  const isPayer = eventRow.payer_id === userId;

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
    .select(
      'id, user_id, display_name, join_method, payment_status, amount_owed, message_sent_at, message_delivered_at, message_failed, self_reported_method',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (participantsError) {
    throw new AppError('PARTICIPANTS_FETCH_FAILED', 'Could not load participants', 500);
  }

  const rows = participantRows ?? [];
  const linkedUserIds = collectLinkedUserIds(
    rows.map((row) => ({ user_id: row.user_id as string | null })),
  );
  const linkedNames = await loadLinkedUserDisplayNames(linkedUserIds);

  const participants = rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string | null,
    display_name: resolveLinkedDisplayName(
      {
        user_id: row.user_id as string | null,
        display_name: row.display_name as string,
      },
      linkedNames,
    ),
    join_method: row.join_method as string,
    payment_status: row.payment_status as string,
    amount_owed: row.amount_owed as number | null,
    is_organiser: (row.user_id as string | null) === eventRow.payer_id,
    is_self: (row.user_id as string | null) === userId,
    message_sent_at: row.message_sent_at as string | null,
    message_delivered_at: row.message_delivered_at as string | null,
    message_failed: Boolean(row.message_failed),
    self_reported_method: row.self_reported_method as string | null,
  }));

  const selfParticipant = participants.find((participant) => participant.is_self);

  const join_token =
    isPayer && eventRow.status === 'open' ? await fetchActiveJoinToken(eventId) : null;
  const summary =
    isPayer && eventRow.status !== 'open'
      ? buildEventSettlementSummary(participants, eventRow.total_amount)
      : null;

  let my_items: ParticipantAssignedItem[] | undefined;
  if (
    selfParticipant &&
    eventRow.split_mode === 'itemised' &&
    selfParticipant.amount_owed !== null
  ) {
    my_items = await fetchMyAssignedItems(eventId, selfParticipant.id);
  }

  let receipt_review: EventDetailResponse['receipt_review'];
  if (
    isPayer &&
    RECEIPT_REVIEW_STAGES.has(eventRow.ai_stage) &&
    eventRow.receipt_scan_attempted
  ) {
    receipt_review = await fetchReceiptReviewSnapshot(eventId, {
      tax_amount: eventRow.tax_amount,
      tip_amount: eventRow.tip_amount,
      fees_amount: eventRow.fees_amount,
      currency: eventRow.currency,
    });
  }

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
    ...(my_items !== undefined ? { my_items } : {}),
    ...(receipt_review !== undefined ? { receipt_review } : {}),
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

  const { data: lockedRow, error: updateError } = await supabaseAdmin
    .from('events')
    .update({
      status: 'locked',
      locked_at: lockedAt,
      participant_count_at_lock: participant_count,
    })
    .eq('id', eventId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (updateError) {
    throw new AppError('EVENT_LOCK_FAILED', 'Could not lock event', 500);
  }

  if (!lockedRow) {
    throw Errors.conflict('Event is not open', 'ALREADY_LOCKED');
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

  const { data: reopenedRow, error: updateError } = await supabaseAdmin
    .from('events')
    .update({ status: 'open', locked_at: null })
    .eq('id', eventId)
    .eq('status', 'locked')
    .select('id')
    .maybeSingle();

  if (updateError) {
    throw new AppError('EVENT_REOPEN_FAILED', 'Could not reopen event', 500);
  }

  if (!reopenedRow) {
    throw Errors.conflict('Event is not locked', 'NOT_LOCKED');
  }

  await deactivateActiveTokens(eventId);
  const { token, expires_at } = await createJoinToken(eventId, JOIN_TOKEN_TTL_HOURS);

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
  const { token, expires_at } = await createJoinToken(eventId, JOIN_TOKEN_TTL_HOURS);

  return {
    join_token: token,
    join_url: buildJoinUrl(token),
    expires_at,
  };
}
