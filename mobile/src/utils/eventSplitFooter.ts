import type { AiStage } from '@letssplyt/shared/event.types';

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
