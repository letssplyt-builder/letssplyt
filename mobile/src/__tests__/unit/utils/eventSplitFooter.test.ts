import { describe, expect, it } from '@jest/globals';
import {
  canEditEventShare,
  canOrganiserNudgeOrMarkCash,
  canParticipantPayShare,
  canResetEventExpenses,
  canDeleteEvent,
  canSendEventMessages,
  getEventSplitActionMode,
  hasPaymentRequestBeenSent,
  hasSettlementBlockingEdit,
  hasEventExpensesEntered,
  resolveEventSplitActionMode,
  resolveSplitEntryMode,
} from '../../../utils/eventSplitFooter';

describe('getEventSplitActionMode', () => {
  it('returns initial when no receipt scan', () => {
    expect(getEventSplitActionMode('none')).toBe('initial');
  });

  it('returns parsing while A1 is running', () => {
    expect(getEventSplitActionMode('parsing')).toBe('parsing');
  });

  it('returns review after parse before confirm', () => {
    expect(getEventSplitActionMode('parsed')).toBe('review');
  });

  it('returns edit after itemization', () => {
    expect(getEventSplitActionMode('parsed_confirmed')).toBe('edit');
    expect(getEventSplitActionMode('calculated')).toBe('edit');
    expect(getEventSplitActionMode('complete')).toBe('edit');
  });

  it('returns failed for retry scan path', () => {
    expect(getEventSplitActionMode('failed')).toBe('failed');
  });

  it('resolve falls back to review when receipt_review exists but stage is stale none', () => {
    expect(resolveEventSplitActionMode('none', true)).toBe('review');
  });

  it('resolve prefers stage when parsed', () => {
    expect(resolveEventSplitActionMode('parsed', true)).toBe('review');
  });

  it('resolve shows edit when confirmed with receipt data', () => {
    expect(resolveEventSplitActionMode('parsed_confirmed', true)).toBe('edit');
  });
});

describe('resolveSplitEntryMode', () => {
  it('uses itemised when receipt review is present', () => {
    expect(resolveSplitEntryMode(null, 'none', true)).toBe('itemised');
  });

  it('uses itemised when split_mode is itemised', () => {
    expect(resolveSplitEntryMode('itemised', 'parsed_confirmed', false)).toBe('itemised');
  });

  it('uses manual for equal split after calculate without receipt scan', () => {
    expect(resolveSplitEntryMode('equal', 'calculated', false)).toBe('manual');
  });

  it('uses manual for portion split after calculate', () => {
    expect(resolveSplitEntryMode('portion', 'calculated', false)).toBe('manual');
  });

  it('uses manual when calculated even if split_mode is still null', () => {
    expect(resolveSplitEntryMode(null, 'calculated', false)).toBe('manual');
  });
});

describe('hasEventExpensesEntered', () => {
  it('is true after receipt confirm or split calculate', () => {
    expect(hasEventExpensesEntered('parsed_confirmed')).toBe(true);
    expect(hasEventExpensesEntered('calculated')).toBe(true);
  });

  it('is false before expenses are entered', () => {
    expect(hasEventExpensesEntered('none')).toBe(false);
    expect(hasEventExpensesEntered('parsed')).toBe(false);
  });
});

describe('canResetEventExpenses', () => {
  it('allows reset when expenses entered and messages not sent', () => {
    expect(canResetEventExpenses('calculated', null)).toBe(true);
  });

  it('blocks reset after messages sent', () => {
    expect(canResetEventExpenses('calculated', '2026-01-01T00:00:00.000Z')).toBe(false);
  });
});

describe('canDeleteEvent', () => {
  it('allows delete before messages sent', () => {
    expect(canDeleteEvent(null)).toBe(true);
    expect(canDeleteEvent(undefined)).toBe(true);
  });

  it('blocks delete after messages sent', () => {
    expect(canDeleteEvent('2026-01-01T00:00:00.000Z')).toBe(false);
  });
});

describe('canSendEventMessages', () => {
  it('allows send when expenses entered and messages not sent', () => {
    expect(canSendEventMessages('calculated', null)).toBe(true);
    expect(canSendEventMessages('messaging', null)).toBe(true);
  });

  it('blocks send after messages sent', () => {
    expect(canSendEventMessages('calculated', '2026-01-01T00:00:00.000Z')).toBe(false);
  });
});

describe('hasSettlementBlockingEdit', () => {
  it('detects self-reported, confirmed, or settled participants', () => {
    expect(
      hasSettlementBlockingEdit([
        { payment_status: 'pending' },
        { payment_status: 'confirmed' },
      ]),
    ).toBe(true);
    expect(hasSettlementBlockingEdit([{ payment_status: 'settled' }])).toBe(true);
    expect(hasSettlementBlockingEdit([{ payment_status: 'self_reported' }])).toBe(true);
    expect(hasSettlementBlockingEdit([{ payment_status: 'pending' }])).toBe(false);
    expect(hasSettlementBlockingEdit([{ payment_status: 'disputed' }])).toBe(false);
  });
});

describe('canEditEventShare', () => {
  it('allows edit before messages are sent', () => {
    expect(canEditEventShare(null, [{ payment_status: 'confirmed' }])).toBe(true);
  });

  it('allows post-send edit when all participants are pending', () => {
    expect(
      canEditEventShare('2026-01-01T00:00:00.000Z', [
        { payment_status: 'pending' },
        { payment_status: 'pending' },
      ]),
    ).toBe(true);
  });

  it('blocks post-send edit when a payment is self-reported', () => {
    expect(
      canEditEventShare('2026-01-01T00:00:00.000Z', [
        { payment_status: 'pending' },
        { payment_status: 'self_reported' },
      ]),
    ).toBe(false);
  });

  it('blocks post-send edit after a payment is confirmed', () => {
    expect(
      canEditEventShare('2026-01-01T00:00:00.000Z', [
        { payment_status: 'pending' },
        { payment_status: 'confirmed' },
      ]),
    ).toBe(false);
  });

  it('allows post-send edit after disputed self-report returns to pending', () => {
    expect(
      canEditEventShare('2026-01-01T00:00:00.000Z', [
        { payment_status: 'pending' },
        { payment_status: 'pending' },
      ]),
    ).toBe(true);
  });
});

describe('payment request gating', () => {
  it('detects when payment requests were sent', () => {
    expect(hasPaymentRequestBeenSent(null)).toBe(false);
    expect(hasPaymentRequestBeenSent('2026-01-01T00:00:00.000Z')).toBe(true);
  });

  it('blocks organiser collection actions until messages are sent', () => {
    expect(canOrganiserNudgeOrMarkCash(null)).toBe(false);
    expect(canOrganiserNudgeOrMarkCash('2026-01-01T00:00:00.000Z')).toBe(true);
  });

  it('blocks participant pay until share is posted and messages sent', () => {
    expect(canParticipantPayShare(null, 25, 'pending')).toBe(false);
    expect(canParticipantPayShare('2026-01-01T00:00:00.000Z', null, 'pending')).toBe(false);
    expect(canParticipantPayShare('2026-01-01T00:00:00.000Z', undefined, 'pending')).toBe(false);
    expect(canParticipantPayShare('2026-01-01T00:00:00.000Z', 0, 'pending')).toBe(false);
    expect(canParticipantPayShare('2026-01-01T00:00:00.000Z', 25, 'confirmed')).toBe(false);
    expect(canParticipantPayShare('2026-01-01T00:00:00.000Z', 25, 'pending')).toBe(true);
    expect(canParticipantPayShare('2026-01-01T00:00:00.000Z', 25, 'disputed')).toBe(true);
  });
});
