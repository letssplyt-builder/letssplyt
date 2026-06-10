import type { EventListItem } from '@letssplyt/shared/event.types';
import { isSettledStatus } from './events';

export interface EventSectionGroup {
  active: EventListItem[];
  settled: EventListItem[];
}

export function groupEventsBySettlement(events: EventListItem[]): EventSectionGroup {
  const active: EventListItem[] = [];
  const settled: EventListItem[] = [];

  for (const event of events) {
    if (isSettledStatus(event.status)) {
      settled.push(event);
    } else {
      active.push(event);
    }
  }

  return { active, settled };
}
