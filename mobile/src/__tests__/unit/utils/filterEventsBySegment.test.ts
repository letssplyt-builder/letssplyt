import { describe, expect, it } from '@jest/globals';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { filterEventsBySegment, statusChipLabel } from '../../../utils/events';

const baseEvent: EventListItem = {
  id: 'e1',
  title: 'Dinner',
  status: 'open',
  participant_count: 2,
  total_amount: null,
  created_at: '2026-06-08T00:00:00.000Z',
  role: 'creator',
  creator_name: null,
};

describe('filterEventsBySegment', () => {
  const events: EventListItem[] = [
    baseEvent,
    { ...baseEvent, id: 'e2', status: 'settled' },
    { ...baseEvent, id: 'e3', status: 'sent' },
  ];

  it('returns non-settled events for active segment', () => {
    const active = filterEventsBySegment(events, 'active');
    expect(active.map((e) => e.id)).toEqual(['e1', 'e3']);
  });

  it('returns settled/archived events for settled segment for creator', () => {
    const settled = filterEventsBySegment(events, 'settled');
    expect(settled.map((e) => e.id)).toEqual(['e2']);
  });

  it('moves participant paid events to settled segment', () => {
    const participantEvents: EventListItem[] = [
      {
        ...baseEvent,
        id: 'e-sent',
        role: 'participant',
        status: 'sent',
        viewer_payment_status: 'confirmed',
      },
      {
        ...baseEvent,
        id: 'e-pending',
        role: 'participant',
        status: 'sent',
        viewer_payment_status: 'pending',
      },
    ];

    const settled = filterEventsBySegment(participantEvents, 'settled');
    expect(settled.map((e) => e.id)).toEqual(['e-sent']);

    const active = filterEventsBySegment(participantEvents, 'active');
    expect(active.map((e) => e.id)).toEqual(['e-pending']);
  });

  it('creator sent event stays active until event is settled', () => {
    const creatorSent = {
      ...baseEvent,
      id: 'e-sent',
      role: 'creator' as const,
      status: 'sent' as const,
    };
    expect(filterEventsBySegment([creatorSent], 'settled')).toEqual([]);
    expect(filterEventsBySegment([creatorSent], 'active')).toEqual([creatorSent]);
  });
});

describe('statusChipLabel', () => {
  it('shows Expenses Share for sent events to organiser', () => {
    expect(statusChipLabel('sent', { role: 'creator' })).toBe('Expenses Share');
  });

  it('shows All settled when organiser event is settled', () => {
    expect(statusChipLabel('settled', { role: 'creator' })).toBe('All settled');
  });

  it('shows Settled for participant who has paid', () => {
    expect(
      statusChipLabel('sent', { role: 'participant', viewerPaymentStatus: 'confirmed' }),
    ).toBe('Settled');
  });
});
