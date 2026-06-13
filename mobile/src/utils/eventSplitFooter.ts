import type { AiStage, SplitMode } from '@letssplyt/shared/event.types';

export type EventSplitActionMode = 'initial' | 'review' | 'edit' | 'parsing' | 'failed';

/** Footer CTA mode from ai_stage alone. */
export function getEventSplitActionMode(aiStage: AiStage): EventSplitActionMode {
  switch (aiStage) {
    case 'none':
      return 'initial';
    case 'parsing':
      return 'parsing';
    case 'failed':
      return 'failed';
    case 'parsed':
      return 'review';
    case 'parsed_confirmed':
    case 'calculating':
    case 'calculated':
    case 'messaging':
    case 'complete':
      return 'edit';
    default:
      return 'initial';
  }
}

/**
 * Resolve footer CTA when event detail may be stale (e.g. user returned from Item Review
 * without confirming — stack keeps EventDetail mounted so ai_stage may not have refreshed).
 */
export function resolveEventSplitActionMode(
  aiStage: AiStage,
  hasReceiptReview: boolean,
): EventSplitActionMode {
  const fromStage = getEventSplitActionMode(aiStage);
  if (fromStage !== 'initial') {
    return fromStage;
  }
  if (hasReceiptReview) {
    return aiStage === 'parsed_confirmed' ? 'edit' : 'review';
  }
  return 'initial';
}

/** Split entry screen mode for Edit share — itemised receipt vs custom/manual total. */
export function resolveSplitEntryMode(
  splitMode: SplitMode | null,
  aiStage: AiStage,
  hasReceiptReview: boolean,
): 'itemised' | 'manual' {
  if (hasReceiptReview || splitMode === 'itemised') {
    return 'itemised';
  }
  if (
    splitMode === 'equal' ||
    splitMode === 'portion' ||
    aiStage === 'calculated' ||
    aiStage === 'messaging' ||
    aiStage === 'complete'
  ) {
    return 'manual';
  }
  return 'itemised';
}

/** Whether expense data has been entered (receipt confirmed or split calculated). */
export function hasEventExpensesEntered(aiStage: AiStage): boolean {
  switch (aiStage) {
    case 'parsed_confirmed':
    case 'calculating':
    case 'calculated':
    case 'messaging':
    case 'complete':
      return true;
    default:
      return false;
  }
}

/** Reset is allowed once expenses exist but payment messages have not been sent. */
export function canResetEventExpenses(
  aiStage: AiStage,
  messagesSentAt: string | null,
): boolean {
  return hasEventExpensesEntered(aiStage) && !messagesSentAt;
}

/** Send messages CTA when split is ready but payment requests have not been sent. */
export function canSendEventMessages(
  aiStage: AiStage,
  messagesSentAt: string | null,
): boolean {
  return hasEventExpensesEntered(aiStage) && !messagesSentAt;
}

const SPLIT_EDIT_BLOCK_STATUSES = new Set(['self_reported', 'confirmed', 'settled']);

/** Whether any participant blocks split edit (self-reported or confirmed payment). */
export function hasSettlementBlockingEdit(
  participants: Array<{ payment_status: string }>,
): boolean {
  return participants.some((row) => SPLIT_EDIT_BLOCK_STATUSES.has(row.payment_status));
}

/**
 * Post-send: Edit share allowed only when no self-reports or confirmed payments exist.
 * Disputing a self-report (back to pending) re-opens edit if nothing else blocks it.
 * Pre-send: always allowed while in the edit footer mode.
 */
export function canEditEventShare(
  messagesSentAt: string | null,
  participants: Array<{ payment_status: string }>,
): boolean {
  if (!messagesSentAt) {
    return true;
  }
  return !hasSettlementBlockingEdit(participants);
}

/** Payment collection UX unlocks after the organiser sends payment request messages. */
export function hasPaymentRequestBeenSent(
  messagesSentAt: string | null | undefined,
): boolean {
  return Boolean(messagesSentAt);
}

/** Organizer nudge / mark-cash actions — only after payment requests were sent. */
export function canOrganiserNudgeOrMarkCash(
  messagesSentAt: string | null | undefined,
): boolean {
  return hasPaymentRequestBeenSent(messagesSentAt);
}

/** Participant Pay now / All paid — share must be finalised and requests sent. */
export function canParticipantPayShare(
  messagesSentAt: string | null | undefined,
  amountOwed: number | null | undefined,
  paymentStatus: string,
): boolean {
  if (!hasPaymentRequestBeenSent(messagesSentAt)) {
    return false;
  }
  if (amountOwed === null || amountOwed <= 0) {
    return false;
  }
  return paymentStatus === 'pending' || paymentStatus === 'disputed';
}
