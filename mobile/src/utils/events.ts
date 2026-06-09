import type {
  EventListItem,
  EventParticipantSummary,
  EventStatus,
} from '@letssplyt/shared/event.types';

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

export function statusChipLabel(status: EventStatus): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'locked':
      return 'Locked';
    case 'calculating':
      return 'Calculating';
    case 'sent':
      return 'Sent';
    case 'settled':
      return 'Settled';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}

export function isSettledStatus(status: EventStatus): boolean {
  return status === 'settled' || status === 'archived';
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
  return events.filter((event) =>
    segment === 'settled' ? isSettledStatus(event.status) : !isSettledStatus(event.status),
  );
}
