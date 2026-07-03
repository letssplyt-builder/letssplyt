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

export function sortEventsByDateDesc(events: EventListItem[]): EventListItem[] {
  return [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export interface EventStatusGroup {
  label: string;
  visualKey: EventStatusVisualKey;
  events: EventListItem[];
}

const ACTIVE_STATUS_GROUP_ORDER: EventStatusVisualKey[] = [
  'open',
  'locked',
  'calculating',
  'sent',
];

function eventStatusOptions(event: EventListItem): {
  role: EventListRole;
  viewerPaymentStatus?: string | null;
} {
  return {
    role: event.role,
    viewerPaymentStatus: event.viewer_payment_status,
  };
}

/** Groups active events by lifecycle status; newest first within each group. */
export function groupEventsByStatus(events: EventListItem[]): EventStatusGroup[] {
  const buckets = new Map<EventStatusVisualKey, EventListItem[]>();

  for (const event of events) {
    const visualKey = resolveEventStatusVisualKey(event.status, eventStatusOptions(event));
    if (visualKey === 'settled') {
      continue;
    }
    const bucket = buckets.get(visualKey) ?? [];
    bucket.push(event);
    buckets.set(visualKey, bucket);
  }

  return ACTIVE_STATUS_GROUP_ORDER.filter((visualKey) => buckets.has(visualKey)).map(
    (visualKey) => {
      const groupEvents = sortEventsByDateDesc(buckets.get(visualKey)!);
      const sample = groupEvents[0]!;
      return {
        label: statusChipLabel(sample.status, eventStatusOptions(sample)),
        visualKey,
        events: groupEvents,
      };
    },
  );
}

export type EventStatusVisualKey = 'open' | 'locked' | 'calculating' | 'sent' | 'settled';

export interface EventStatusVisual {
  chipBackground: string;
  chipText: string;
  cardAccent: string;
}

const STATUS_VISUALS: Record<EventStatusVisualKey, EventStatusVisual> = {
  open: {
    chipBackground: 'rgba(45, 212, 191, 0.22)',
    chipText: '#5EEAD4',
    cardAccent: '#2DD4BF',
  },
  locked: {
    chipBackground: 'rgba(251, 191, 36, 0.22)',
    chipText: '#FCD34D',
    cardAccent: '#FBBF24',
  },
  calculating: {
    chipBackground: 'rgba(167, 139, 250, 0.24)',
    chipText: '#C4B5FD',
    cardAccent: '#A78BFA',
  },
  sent: {
    chipBackground: 'rgba(56, 189, 248, 0.22)',
    chipText: '#7DD3FC',
    cardAccent: '#38BDF8',
  },
  settled: {
    chipBackground: 'rgba(52, 211, 153, 0.24)',
    chipText: '#6EE7B7',
    cardAccent: '#34D399',
  },
};

export function resolveEventStatusVisualKey(
  status: EventStatus,
  options?: {
    role?: EventListRole;
    viewerPaymentStatus?: string | null;
  },
): EventStatusVisualKey {
  if (options?.role === 'participant' && isViewerPaymentComplete(options?.viewerPaymentStatus)) {
    return 'settled';
  }
  if (status === 'settled' || status === 'archived') {
    return 'settled';
  }
  if (status === 'sent') {
    return 'sent';
  }
  if (status === 'calculating') {
    return 'calculating';
  }
  if (status === 'locked') {
    return 'locked';
  }
  return 'open';
}

export function eventStatusVisual(
  status: EventStatus,
  options?: {
    role?: EventListRole;
    viewerPaymentStatus?: string | null;
  },
): EventStatusVisual {
  return STATUS_VISUALS[resolveEventStatusVisualKey(status, options)];
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