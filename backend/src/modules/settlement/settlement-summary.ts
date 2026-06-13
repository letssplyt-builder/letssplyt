import type { EventSettlementSummary } from '@letssplyt/shared/event.types';
import { isSettlementCompleteStatus } from './settlement.state-machine';

export interface SettlementSummaryParticipant {
  payment_status: string;
  amount_owed: number | null;
  is_organiser?: boolean;
}

/**
 * Settlement totals for the payer's event detail card.
 * Excludes the organiser's own share — they paid the restaurant; only others owe them.
 */
export function buildEventSettlementSummary(
  participants: SettlementSummaryParticipant[],
  totalAmount: number | null,
): EventSettlementSummary {
  const total = totalAmount ?? 0;
  const debtors = participants.filter((participant) => !participant.is_organiser);

  let collected = 0;
  let outstanding = 0;
  let confirmed_count = 0;
  let pending_count = 0;

  for (const participant of debtors) {
    const amount = participant.amount_owed ?? 0;
    if (amount <= 0) continue;

    const status = participant.payment_status;

    if (status === 'confirmed' || status === 'settled') {
      collected += amount;
      confirmed_count += 1;
    } else if (status === 'pending') {
      pending_count += 1;
    }

    if (!isSettlementCompleteStatus(status)) {
      outstanding += amount;
    }
  }

  return {
    total,
    collected,
    outstanding: Math.max(0, outstanding),
    confirmed_count,
    pending_count,
  };
}
