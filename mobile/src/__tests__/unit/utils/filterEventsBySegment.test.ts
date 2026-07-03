import { describe, expect, it } from '@jest/globals';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { filterEventsBySegment, statusChipLabel, eventStatusVisual, groupEventsByStatus } from '../../../utils/events';

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

describe('groupEventsByStatus', () => {
  it('groups by lifecycle status with newest first in each group', () => {
    const events: EventListItem[] = [
      { ...baseEvent, id: 'open-old', status: 'open', created_at: '2026-06-01T00:00:00.000Z' },
      { ...baseEvent, id: 'open-new', status: 'open', created_at: '2026-06-08T00:00:00.000Z' },
      { ...baseEvent, id: 'sent-1', status: 'sent', created_at: '2026-06-05T00:00:00.000Z' },
      { ...baseEvent, id: 'locked-1', status: 'locked', created_at: '2026-06-03T00:00:00.000Z' },
    ];

    const groups = groupEventsByStatus(events);

    expect(groups.map((group) => group.visualKey)).toEqual(['open', 'locked', 'sent']);
    expect(groups[0]?.events.map((event) => event.id)).toEqual(['open-new', 'open-old']);
    expect(groups[1]?.events.map((event) => event.id)).toEqual(['locked-1']);
    expect(groups[2]?.events.map((event) => event.id)).toEqual(['sent-1']);
    expect(groups[0]?.label).toBe('Open');
    expect(groups[2]?.label).toBe('Expenses Share');
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

describe('eventStatusVisual', () => {
  it('returns distinct visuals for lifecycle states', () => {
    expect(eventStatusVisual('open').cardAccent).toBe('#2DD4BF');
    expect(eventStatusVisual('locked').cardAccent).toBe('#FBBF24');
    expect(eventStatusVisual('calculating').cardAccent).toBe('#A78BFA');
    expect(eventStatusVisual('sent', { role: 'creator' }).cardAccent).toBe('#38BDF8');
    expect(eventStatusVisual('settled', { role: 'creator' }).cardAccent).toBe('#34D399');
  });

  it('uses settled visual for participant who has paid', () => {
    expect(
      eventStatusVisual('sent', {
        role: 'participant',
        viewerPaymentStatus: 'confirmed',
      }).cardAccent,
    ).toBe('#34D399');
  });
});
