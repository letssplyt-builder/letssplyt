import type { EventRecord } from '@letssplyt/shared/event.types';
import { isViewerPaymentComplete } from './settlementDisplay';
import { statusChipLabel } from './events';

export interface ParticipantShareHero {
  label: string;
  amount: number | null;
  statusLine: string;
  pending: boolean;
  paid?: boolean;
}

export function splitModeDescription(splitMode: EventRecord['split_mode']): string | null {
  switch (splitMode) {
    case 'equal':
      return 'Split evenly among all members';
    case 'portion':
      return 'Split by portion — each member’s share reflects their assigned weight';
    case 'itemised':
      return 'Itemised split — your share is based on the items assigned to you';
    default:
      return null;
  }
}

export function resolveParticipantShareHero(
  event: EventRecord,
  amountOwed: number | null | undefined,
  creatorName: string,
  paymentStatus?: string | null,
): ParticipantShareHero {
  const creator = creatorName.trim() || 'the organiser';
  const paid = isViewerPaymentComplete(paymentStatus);

  if (amountOwed !== null && amountOwed !== undefined) {
    if (paid) {
      return {
        label: 'Your share',
        amount: amountOwed,
        statusLine: 'Paid',
        pending: false,
        paid: true,
      };
    }
    return {
      label: 'Your share',
      amount: amountOwed,
      statusLine: paymentStatusLine(event.status),
      pending: false,
    };
  }

  if (event.status === 'open') {
    return {
      label: 'Your share',
      amount: null,
      statusLine: `This event is still open. Waiting for ${creator} to lock it and calculate your share.`,
      pending: true,
    };
  }

  if (event.status === 'locked' && ['none', 'parsing', 'parsed'].includes(event.ai_stage)) {
    return {
      label: 'Your share',
      amount: null,
      statusLine: `Bill locked. ${creator} is preparing the receipt and split.`,
      pending: true,
    };
  }

  if (['calculating', 'parsed', 'calculated', 'messaging'].includes(event.ai_stage)) {
    return {
      label: 'Your share',
      amount: null,
      statusLine: 'Your share is being calculated. Check back shortly.',
      pending: true,
    };
  }

  return {
    label: 'Your share',
    amount: null,
    statusLine: `Waiting for ${creator} to finalise the split.`,
    pending: true,
  };
}

export function participantEventStatusLabel(
  event: EventRecord,
  paymentStatus?: string | null,
): string {
  if (isViewerPaymentComplete(paymentStatus)) {
    return 'Settled';
  }
  return statusChipLabel(event.status, { role: 'participant', viewerPaymentStatus: paymentStatus });
}

function paymentStatusLine(status: EventRecord['status']): string {
  switch (status) {
    case 'sent':
      return 'Payment request';
    case 'settled':
    case 'archived':
      return 'Event settled';
    case 'calculating':
      return 'Split calculated';
    default:
      return 'Share calculated';
  }
}
