import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { EventsScreen } from '../../../screens/events/EventsScreen';
import * as eventService from '../../../services/event.service';
import { useEventStore } from '../../../store/eventStore';

jest.mock('../../../services/event.service');

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
          events: [activeCreated, settledCreated],
          next_cursor: null,
          has_more: false,
        };
      }
      return {
        events: [activeJoined],
        next_cursor: null,
        has_more: false,
      };
    });
    jest.clearAllMocks();
  });

  it('renders Active | Settled toggle and created/joined sections', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeTruthy();
      expect(screen.getByText('Settled')).toBeTruthy();
      expect(screen.getByText('Events you created')).toBeTruthy();
      expect(screen.getByText('Events you joined')).toBeTruthy();
    });
  });

  it('shows only active events when Active segment is selected', async () => {
    render(
      <EventsScreen
        navigation={navigation}
        route={{ key: 'Events', name: 'Events' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
      expect(screen.getByText('Team Lunch')).toBeTruthy();
      expect(screen.queryByText('Old Brunch')).toBeNull();
    });
  });

  it('shows settled created events when Settled segment is selected', async () => {
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
      expect(screen.getByText('Old Brunch')).toBeTruthy();
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
