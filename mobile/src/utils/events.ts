import type {
  EventListItem,
  EventListRole,
  EventParticipantSummary,
  EventStatus,
} from '@letssplyt/shared/event.types';
import { isViewerPaymentComplete } from './settlementDisplay';

export function statusChipLabel(
  status: EventStatus,
  options?: {
    role?: EventListRole;
    viewerPaymentStatus?: string | null;
  },
): string {
  const role = options?.role;
  const viewerPaid = isViewerPaymentComplete(options?.viewerPaymentStatus);

  if (role === 'creator') {
    switch (status) {
      case 'open':
        return 'Open';
      case 'locked':
        return 'Locked';
      case 'calculating':
        return 'Calculating';
      case 'sent':
        return 'Expenses Share';
      case 'settled':
      case 'archived':
        return 'All settled';
      default:
        return status;
    }
  }

  if (role === 'participant' && viewerPaid) {
    return 'Settled';
  }

  switch (status) {
    case 'open':
      return 'Open';
    case 'locked':
      return 'Locked';
    case 'calculating':
      return 'Calculating';
    case 'sent':
      return 'Expenses Share';
    case 'settled':
    case 'archived':
      return 'Settled';
    default:
      return status;
  }
}

export function isSettledStatus(status: EventStatus): boolean {
  return status === 'settled' || status === 'archived';
}

export function isEventSettledForList(
  event: {
    status: EventStatus;
    role: EventListRole;
    viewer_payment_status?: string | null;
  },
): boolean {
  if (event.role === 'creator') {
    return isSettledStatus(event.status);
  }
  return isSettledStatus(event.status) || isViewerPaymentComplete(event.viewer_payment_status);
}

export function formatEventDate(createdAt: string): string {
  try {
    return new Date(createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function formatMoney(amount: number | null, currency = 'USD'): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function filterEventsBySegment(
  events: EventListItem[],
  segment: 'active' | 'settled',
): EventListItem[] {
  return events.filter((event) => {
    const settled = isEventSettledForList(event);
    return segment === 'settled' ? settled : !settled;
  });
}

/** Organiser row — cannot be removed from the member list. */
export function isPayerParticipant(
  participant: EventParticipantSummary,
  payer?: { display_name: string },
): boolean {
  if (participant.is_organiser) return true;
  if (!payer) return false;
  return participant.join_method === 'qr_app' && participant.display_name === payer.display_name;
}

export function joinMethodLabel(method: string, isOrganiser = false): string {
  if (isOrganiser) return 'Organiser';
  switch (method) {
    case 'qr_app':
      return 'App';
    case 'qr_web':
      return 'QR Web';
    case 'manual_phone':
    case 'manual_name_only':
      return 'Manual';
    default:
      return method;
  }
}

/** Registered user (has linked account) — not a phone/name-only guest. */
export function isRegisteredEventParticipant(userId: string | null | undefined): boolean {
  return userId != null && userId.length > 0;
}