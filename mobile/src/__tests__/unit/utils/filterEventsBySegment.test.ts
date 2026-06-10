import { describe, expect, it } from '@jest/globals';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { filterEventsBySegment } from '../../../utils/events';

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

  it('returns settled/archived events for settled segment', () => {
    const settled = filterEventsBySegment(events, 'settled');
    expect(settled.map((e) => e.id)).toEqual(['e2']);
  });
});
