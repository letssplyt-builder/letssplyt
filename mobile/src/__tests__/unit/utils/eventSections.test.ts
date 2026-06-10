import { describe, expect, it } from '@jest/globals';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { groupEventsBySettlement } from '../../../utils/eventSections';

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

describe('groupEventsBySettlement', () => {
  it('splits active and settled events', () => {
    const events: EventListItem[] = [
      baseEvent,
      { ...baseEvent, id: 'e2', status: 'settled' },
      { ...baseEvent, id: 'e3', status: 'archived' },
    ];

    const grouped = groupEventsBySettlement(events);

    expect(grouped.active).toHaveLength(1);
    expect(grouped.settled).toHaveLength(2);
  });
});
