import type { EventListItem } from '@letssplyt/shared/event.types';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  EventRoleSection,
  eventSectionHeaderLabel,
} from '../../../components/events/EventRoleSection';

const event: EventListItem = {
  id: 'e1',
  title: 'Friday Dinner',
  status: 'open',
  participant_count: 2,
  total_amount: null,
  created_at: '2026-06-08T00:00:00.000Z',
  role: 'creator',
  creator_name: null,
};

describe('eventSectionHeaderLabel', () => {
  it('includes the event count', () => {
    expect(eventSectionHeaderLabel('Open', 2)).toBe('Open · 2');
  });
});

describe('EventRoleSection', () => {
  it('starts expanded and hides cards when collapsed', () => {
    const onEventPress = jest.fn();
    render(
      <EventRoleSection
        title="Open"
        events={[event]}
        emptyMessage=""
        onEventPress={onEventPress}
      />,
    );

    expect(screen.getByText('Friday Dinner')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open, 1 event'));
    expect(screen.queryByText('Friday Dinner')).toBeNull();
    expect(screen.getByText('Open · 1')).toBeTruthy();
  });
});
