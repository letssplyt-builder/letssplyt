import type { EventListItem, EventStatus } from '@letssplyt/shared/event.types';

export function joinMethodLabel(method: string): string {
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
