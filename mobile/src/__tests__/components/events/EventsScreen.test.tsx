import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { EventsScreen } from '../../../screens/events/EventsScreen';
import * as eventService from '../../../services/event.service';
import { useEventStore } from '../../../store/eventStore';

jest.mock('../../../services/event.service');

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

const navigation = { navigate: jest.fn() } as never;

const activeCreated = {
  id: 'e-created-active',
  title: 'Friday Dinner',
  status: 'open' as const,
  participant_count: 2,
  total_amount: null,
  created_at: '2026-06-08T00:00:00.000Z',
  role: 'creator' as const,
  creator_name: null,
};

const settledCreated = {
  ...activeCreated,
  id: 'e-created-settled',
  title: 'Old Brunch',
  status: 'settled' as const,
};

const activeJoined = {
  id: 'e-joined-active',
  title: 'Team Lunch',
  status: 'sent' as const,
  participant_count: 4,
  total_amount: 120,
  created_at: '2026-06-07T00:00:00.000Z',
  role: 'participant' as const,
  creator_name: 'Jordan',
};

const settledJoined = {
  ...activeJoined,
  id: 'e-joined-settled',
  title: 'Past Dinner',
  status: 'settled' as const,
  viewer_payment_status: 'confirmed',
};

const sentCreated = {
  ...activeCreated,
  id: 'e-created-sent',
  title: 'Birthday Party',
  status: 'sent' as const,
  created_at: '2026-06-09T00:00:00.000Z',
};

describe('EventsScreen', () => {
  beforeEach(() => {
    useEventStore.setState({
      createModalOpen: false,
      qrPresentation: null,
      isCreating: false,
    });
    jest.mocked(eventService.fetchEvents).mockImplementation(async (_cursor, options) => {
      if (options?.role === 'creator') {
        return {
          events: [activeCreated, sentCreated, settledCreated],
          next_cursor: null,
          has_more: false,
        };
      }
      return {
        events: [activeJoined, settledJoined],
        next_cursor: null,
        has_more: false,
      };
    });
    jest.clearAllMocks();
  });

  it('renders You created | You joined | Settled tabs', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('You created')).toBeTruthy();
      expect(screen.getByText('You joined')).toBeTruthy();
      expect(screen.getByText('Settled')).toBeTruthy();
    });
  });

  it('shows only created active events on You created tab', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
      expect(screen.queryByText('Team Lunch')).toBeNull();
      expect(screen.queryByText('Old Brunch')).toBeNull();
    });
  });

  it('groups active created events by status', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Expenses Share').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
      expect(screen.getByText('Birthday Party')).toBeTruthy();
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });
  });

  it('shows only joined active events on You joined tab', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('You joined'));

    await waitFor(() => {
      expect(screen.getByText('Team Lunch')).toBeTruthy();
      expect(screen.queryByText('Friday Dinner')).toBeNull();
      expect(screen.queryByText('Old Brunch')).toBeNull();
    });
  });

  it('groups settled events into created and joined sections', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Settled'));

    await waitFor(() => {
      expect(screen.getByText('Events you created')).toBeTruthy();
      expect(screen.getByText('Events you joined')).toBeTruthy();
      expect(screen.getByText('All settled — everyone has paid their share')).toBeTruthy();
      expect(screen.getByText('Settled — your share is paid')).toBeTruthy();
      expect(screen.getByText('Old Brunch')).toBeTruthy();
      expect(screen.getByText('Past Dinner')).toBeTruthy();
      expect(screen.queryByText('Friday Dinner')).toBeNull();
      expect(screen.queryByText('Team Lunch')).toBeNull();
    });
  });

  it('navigates to EventDetail when a card is pressed', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Friday Dinner'));

    expect(navigation.navigate).toHaveBeenCalledWith('EventDetail', {
      eventId: 'e-created-active',
    });
  });
});
