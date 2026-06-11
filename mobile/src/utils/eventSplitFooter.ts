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
