import { randomUUID } from 'crypto';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { AppError } from '../../infrastructure/errors';
import logger from '../../infrastructure/logger';
import { encryptPhone, hashPhone } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { resolveUserAfterOtp } from '../auth/auth.service';
import {
  findParticipantIdByUserInEvent,
  linkParticipantToUser,
} from '../participants/participant-link.service';
import { sendOtp, verifyTwilioCodeForJoin } from './join-otp';
import { JOIN_COUNTRY_OPTIONS } from './join-countries';

export type JoinPageKind = 'form' | 'expired' | 'locked' | 'not_found';

export interface JoinEventContext {
  token: string;
  eventId: string;
  eventTitle: string;
  payerName: string;
  eventStatus: string;
}

export type JoinServiceErrorCode =
  | 'INVALID_PHONE'
  | 'OTP_UNAVAILABLE'
  | 'OPTED_OUT'
  | 'EVENT_LOCKED'
  | 'INVALID_OTP'
  | 'NAME_REQUIRED';

export class JoinServiceError extends Error {
  readonly code: JoinServiceErrorCode;
  readonly status: number;
  readonly deepLinkUrl?: string;

  constructor(code: JoinServiceErrorCode, message: string, status: number, deepLinkUrl?: string) {
    super(message);
    this.name = 'JoinServiceError';
    this.code = code;
    this.status = status;
    this.deepLinkUrl = deepLinkUrl;
  }
}

interface TokenRow {
  id: string;
  event_id: string;
  token: string;
  expires_at: string;
  is_active: boolean;
}

interface EventRow {
  id: string;
  title: string;
  status: string;
  payer_id: string;
}

export function buildPhoneE164(countryDial: string, nationalDigits: string): string {
  const digits = nationalDigits.replace(/\D/g, '');
  const candidate = `${countryDial}${digits}`;
  const iso = dialToIsoCountry(countryDial);
  const parsed = parsePhoneNumberFromString(candidate, iso);
  if (!parsed?.isValid()) {
    throw new JoinServiceError('INVALID_PHONE', 'Enter a valid phone number', 400);
  }
  return parsed.format('E.164');
}

function dialToIsoCountry(dial: string): CountryCode {
  const match = JOIN_COUNTRY_OPTIONS.find((c) => c.dial === dial);
  return (match?.code ?? 'US') as CountryCode;
}

export function resolveMessageChannel(phoneE164: string): 'sms' | 'whatsapp' {
  return phoneE164.startsWith('+91') ? 'whatsapp' : 'sms';
}

export function resolveCountryCode(phoneE164: string): string {
  const parsed = parsePhoneNumberFromString(phoneE164);
  return parsed?.country ?? 'US';
}

async function fetchTokenRow(token: string): Promise<TokenRow | null> {
  const { data, error } = await supabaseAdmin
    .from('event_join_tokens')
    .select('id, event_id, token, expires_at, is_active')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    throw new AppError('TOKEN_LOOKUP_FAILED', 'Could not validate join link', 500);
  }

  return data as TokenRow | null;
}

async function fetchEventRow(eventId: string): Promise<EventRow | null> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, title, status, payer_id')
    .eq('id', eventId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError('EVENT_LOOKUP_FAILED', 'Could not load event', 500);
  }

  return data as EventRow | null;
}

async function fetchPayerName(payerId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', payerId)
    .maybeSingle();

  if (error || !data?.display_name) {
    return 'Someone';
  }

  return data.display_name as string;
}

function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function classifyJoinPage(
  tokenRow: TokenRow | null,
  eventRow: EventRow | null,
): JoinPageKind {
  if (!tokenRow || !eventRow) return 'not_found';
  if (!tokenRow.is_active || isTokenExpired(tokenRow.expires_at)) return 'expired';
  if (eventRow.status !== 'open') return 'locked';
  return 'form';
}

export async function loadJoinEventContext(token: string): Promise<{
  pageKind: JoinPageKind;
  context: JoinEventContext | null;
}> {
  const tokenRow = await fetchTokenRow(token);
  if (!tokenRow) {
    return { pageKind: 'not_found', context: null };
  }

  const eventRow = await fetchEventRow(tokenRow.event_id);
  const pageKind = classifyJoinPage(tokenRow, eventRow);

  if (!eventRow) {
    return { pageKind: 'not_found', context: null };
  }

  const payerName = await fetchPayerName(eventRow.payer_id);

  return {
    pageKind,
    context: {
      token,
      eventId: eventRow.id,
      eventTitle: eventRow.title,
      payerName,
      eventStatus: eventRow.status,
    },
  };
}

/** Analytics funnel write — logs failures but never blocks the join flow. */
export async function writeFunnelCheckpoint(input: {
  sessionId: string;
  eventId: string;
  checkpoint:
    | 'join_page_loaded'
    | 'phone_entered'
    | 'otp_sent'
    | 'otp_verified'
    | 'join_confirmed';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('funnel_checkpoints').insert({
      session_id: input.sessionId,
      event_id: input.eventId,
      checkpoint: input.checkpoint,
      metadata: input.metadata ?? {},
    });

    if (error) {
      logger.error({
        msg: 'Funnel checkpoint write failed',
        checkpoint: input.checkpoint,
        eventId: input.eventId,
        supabaseCode: error.code,
        supabaseMessage: error.message,
        hint: 'Apply supabase migrations if funnel_checkpoints is missing.',
      });
    }
  } catch (err) {
    logger.error({
      err,
      msg: 'Funnel checkpoint write failed',
      checkpoint: input.checkpoint,
      eventId: input.eventId,
    });
  }
}

async function assertEventOpenForJoin(eventId: string): Promise<EventRow> {
  const eventRow = await fetchEventRow(eventId);
  if (!eventRow) {
    throw new JoinServiceError('EVENT_LOCKED', 'This event has been locked', 409);
  }
  if (eventRow.status !== 'open') {
    throw new JoinServiceError(
      'EVENT_LOCKED',
      'This event has been locked. Ask the bill payer to unlock it or contact them directly.',
      409,
    );
  }
  return eventRow;
}

async function checkSmsOptOut(phoneHash: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('sms_opt_outs')
    .select('id')
    .eq('phone_hash', phoneHash)
    .maybeSingle();

  if (error) {
    throw new AppError('OPT_OUT_CHECK_FAILED', 'Could not verify SMS opt-out status', 500);
  }

  return Boolean(data);
}

async function findRegisteredUserByPhoneHash(phoneHash: string): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('phone_hash', phoneHash)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError('USER_LOOKUP_FAILED', 'Could not verify account status', 500);
  }

  const row = data as { id: string } | null;
  return row?.id ? row : null;
}

async function findGuestParticipantByPhone(
  eventId: string,
  phoneHash: string,
): Promise<string | null> {
  const { data: participants, error } = await supabaseAdmin
    .from('participants')
    .select('id, guest_pii_token')
    .eq('event_id', eventId)
    .not('guest_pii_token', 'is', null);

  if (error) {
    throw new AppError('PARTICIPANTS_LOOKUP_FAILED', 'Could not load participants', 500);
  }

  const guestTokens = (participants ?? [])
    .map((row) => row.guest_pii_token as string | null)
    .filter((token): token is string => Boolean(token));

  if (guestTokens.length === 0) return null;

  const { data: guestRows, error: guestError } = await supabaseAdmin
    .from('guest_pii')
    .select('id')
    .in('id', guestTokens)
    .eq('phone_hash', phoneHash)
    .limit(1);

  if (guestError || !guestRows?.[0]) return null;

  const guestId = guestRows[0].id as string;
  const match = (participants ?? []).find((p) => p.guest_pii_token === guestId);
  return (match?.id as string) ?? null;
}

async function findParticipantInEvent(
  eventId: string,
  phoneHash: string,
  userId?: string | null,
): Promise<string | null> {
  if (userId) {
    const byUser = await findParticipantIdByUserInEvent(eventId, userId);
    if (byUser) return byUser;
  }

  return findGuestParticipantByPhone(eventId, phoneHash);
}

export interface JoinPhoneSubmissionInput {
  token: string;
  displayName: string;
  countryDial: string;
  phoneNational: string;
  sessionId: string;
}

export interface JoinPhoneSubmissionResult {
  phoneE164: string;
  displayName: string;
  alreadyJoined: boolean;
}

export async function submitJoinPhone(
  input: JoinPhoneSubmissionInput,
): Promise<JoinPhoneSubmissionResult> {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new JoinServiceError('NAME_REQUIRED', 'Name is required', 400);
  }

  const { context } = await loadJoinEventContext(input.token);
  if (!context) {
    throw new JoinServiceError('EVENT_LOCKED', 'Join link is not valid', 410);
  }

  await assertEventOpenForJoin(context.eventId);

  const phoneE164 = buildPhoneE164(input.countryDial, input.phoneNational);
  const phoneHash = hashPhone(phoneE164);

  const registeredUser = await findRegisteredUserByPhoneHash(phoneHash);
  const existingParticipantId = await findParticipantInEvent(
    context.eventId,
    phoneHash,
    registeredUser?.id,
  );
  // Skip OTP only when a registered user is already linked to this event.
  if (existingParticipantId && registeredUser) {
    return { phoneE164, displayName, alreadyJoined: true };
  }

  if (await checkSmsOptOut(phoneHash)) {
    throw new JoinServiceError(
      'OPTED_OUT',
      'This phone number has opted out of SMS messages from LetsSplyt.',
      400,
    );
  }

  const otpResult = await sendOtp(phoneE164);
  if (!otpResult.sent) {
    throw new JoinServiceError('OTP_UNAVAILABLE', 'Unable to send verification code', 503);
  }

  await writeFunnelCheckpoint({
    sessionId: input.sessionId,
    eventId: context.eventId,
    checkpoint: 'phone_entered',
  });
  await writeFunnelCheckpoint({
    sessionId: input.sessionId,
    eventId: context.eventId,
    checkpoint: 'otp_sent',
  });

  return { phoneE164, displayName, alreadyJoined: false };
}

export interface JoinOtpVerificationInput {
  token: string;
  displayName: string;
  phoneE164: string;
  code: string;
  sessionId: string;
}

export interface JoinOtpVerificationResult {
  participantId: string;
  eventTitle: string;
  payerName: string;
}

export async function verifyJoinOtp(
  input: JoinOtpVerificationInput,
): Promise<JoinOtpVerificationResult> {
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new JoinServiceError('NAME_REQUIRED', 'Name is required', 400);
  }

  const { context } = await loadJoinEventContext(input.token);
  if (!context) {
    throw new JoinServiceError('EVENT_LOCKED', 'Join link is not valid', 410);
  }

  const eventRow = await assertEventOpenForJoin(context.eventId);

  const phoneE164 = input.phoneE164.trim();
  const phoneHash = hashPhone(phoneE164);

  const approved = await verifyTwilioCodeForJoin(phoneE164, input.code);
  if (!approved) {
    throw new JoinServiceError('INVALID_OTP', 'Incorrect code. Try again.', 400);
  }

  const phoneEncrypted = encryptPhone(phoneE164);
  const resolvedUser = await resolveUserAfterOtp(
    phoneE164,
    phoneHash,
    phoneEncrypted,
    displayName,
    'register',
  );

  const existingParticipantId = await findParticipantInEvent(
    context.eventId,
    phoneHash,
    resolvedUser.userId,
  );
  if (existingParticipantId) {
    await linkParticipantToUser(existingParticipantId, resolvedUser.userId);
    const { error: participantNameError } = await supabaseAdmin
      .from('participants')
      .update({ display_name: displayName })
      .eq('id', existingParticipantId);
    if (participantNameError) {
      logger.warn({
        msg: 'Failed to update participant display_name after web join',
        participantId: existingParticipantId,
        supabaseCode: participantNameError.code,
        supabaseMessage: participantNameError.message,
      });
    }
    await writeFunnelCheckpoint({
      sessionId: input.sessionId,
      eventId: context.eventId,
      checkpoint: 'otp_verified',
      metadata: { participant_id: existingParticipantId },
    });
    await writeFunnelCheckpoint({
      sessionId: input.sessionId,
      eventId: context.eventId,
      checkpoint: 'join_confirmed',
      metadata: { participant_id: existingParticipantId },
    });
    return {
      participantId: existingParticipantId,
      eventTitle: eventRow.title,
      payerName: context.payerName,
    };
  }

  const messageChannel = resolveMessageChannel(phoneE164);
  const countryCode = resolveCountryCode(phoneE164);

  const { data: participant, error: participantError } = await supabaseAdmin
    .from('participants')
    .insert({
      event_id: context.eventId,
      user_id: resolvedUser.userId,
      guest_pii_token: null,
      display_name: displayName,
      join_method: 'qr_web',
      payment_status: 'pending',
      country_code: countryCode,
      message_channel: messageChannel,
    })
    .select('id')
    .single();

  if (participantError || !participant) {
    logger.error({
      msg: 'Participant create failed during web join',
      eventId: context.eventId,
      userId: resolvedUser.userId,
      joinMethod: 'qr_web',
      supabaseCode: participantError?.code,
      supabaseMessage: participantError?.message,
      hint: 'Apply supabase/migrations/20260609000001_ensure_participants_web_join.sql',
    });
    throw new AppError('PARTICIPANT_CREATE_FAILED', 'Could not add you to the event', 500);
  }

  await writeFunnelCheckpoint({
    sessionId: input.sessionId,
    eventId: context.eventId,
    checkpoint: 'otp_verified',
    metadata: { participant_id: participant.id },
  });
  await writeFunnelCheckpoint({
    sessionId: input.sessionId,
    eventId: context.eventId,
    checkpoint: 'join_confirmed',
    metadata: { participant_id: participant.id },
  });

  return {
    participantId: participant.id as string,
    eventTitle: eventRow.title,
    payerName: context.payerName,
  };
}

/** Exported for unit tests — ensures hashing runs before persistence. */
export function hashPhoneForJoin(phoneE164: string): string {
  return hashPhone(phoneE164);
}

export function encryptPhoneForJoin(phoneE164: string): string {
  return encryptPhone(phoneE164);
}

export function newFunnelSessionId(): string {
  return randomUUID();
}
